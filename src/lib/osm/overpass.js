// One way for every app to ask OpenStreetMap's Overpass API for map data
// (data © OpenStreetMap contributors, ODbL).
//
// Overpass is free and keyless, but each public server gives one address
// only a couple of query "slots" at a time, answers 429 when they're used
// up, and reports a query that ran too long as HTTP 200 with a "remark" and
// no (or partial) data. The apps used to race every mirror at once, which
// used up slots on all of them, kept the losing queries running on the
// servers, and let a fast "timed out" answer win as if it were an empty
// result. This module instead:
//
//  - runs at most two queries at a time from this page (Overpass's slot limit),
//  - asks one mirror at a time, starting a second only if the first is slow
//    or fails, and remembers which mirrors are busy for a while,
//  - treats a "runtime error" remark as a failure and moves on,
//  - shares one request between identical queries and keeps answers
//    (in memory and in localStorage, a day by default),
//  - falls back to the site's own /api/apps/overpass, which asks from a
//    different network, when every mirror turns the browser away,
//  - always ends: a time budget per query, then an OverpassError whose
//    .kind ("busy", "timeout", "offline", "query") an app can explain.

export const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const SERVER = "/api/apps/overpass";
const MAX_RUNNING = 2;
const HEDGE_MS = 8000;
const DAY = 24 * 3600 * 1000;
const STORE_PREFIX = "osm:v1:";
const STORE_MAX_CHARS = 400_000;

const MESSAGES = {
  busy: "OpenStreetMap's map servers are busy right now. Try again in a minute.",
  timeout: "That map search was too big for OpenStreetMap's servers. Try a smaller area.",
  offline: "You're offline, so map data can't load. Reconnect and try again.",
  query: "The map search couldn't be read by OpenStreetMap's servers.",
};

export class OverpassError extends Error {
  constructor(kind, message, options) {
    super(message ?? MESSAGES[kind] ?? MESSAGES.busy, options);
    this.name = "OverpassError";
    this.kind = kind;
  }
}

const abortError = () => new DOMException("Aborted", "AbortError");

// ---- mirror health ----

const cooldown = new Map(); // url -> time it can be asked again
let preferred = null; // the mirror that answered last

function rest(url, ms) {
  cooldown.set(url, Math.max(cooldown.get(url) ?? 0, Date.now() + ms));
}

/** Mirrors in the order to try them: the last one that worked, then healthy ones, then resting ones. */
export function mirrorOrder(list = MIRRORS, now = Date.now()) {
  const ready = list.filter(u => (cooldown.get(u) ?? 0) <= now);
  const resting = list.filter(u => (cooldown.get(u) ?? 0) > now).sort((a, b) => cooldown.get(a) - cooldown.get(b));
  if (preferred && ready.includes(preferred)) ready.splice(ready.indexOf(preferred), 1), ready.unshift(preferred);
  return [...ready, ...resting];
}

/** For tests. */
export function resetOverpass() {
  cooldown.clear();
  preferred = null;
  memory.clear();
  inflight.clear();
  queue.length = 0;
}

// ---- reading an answer ----

/**
 * Turns one mirror's response into { body } or { error, partial }.
 * Overpass reports a query that ran out of time or memory as 200 OK with a
 * remark, so a 200 isn't enough on its own.
 */
export async function readAnswer(response) {
  if (response.status === 400) return { error: new OverpassError("query", undefined, { cause: new Error(await response.text().catch(() => "400")) }) };
  if (!response.ok) {
    const retry = Number(response.headers?.get?.("retry-after"));
    return { error: new OverpassError("busy", undefined, { cause: new Error(`HTTP ${response.status}`) }), rest: Number.isFinite(retry) && retry > 0 ? retry * 1000 : response.status === 429 ? 30000 : 15000 };
  }
  let body;
  try {
    body = await response.json();
  } catch (error) {
    // An HTML or XML error page instead of JSON: the server is overloaded.
    return { error: new OverpassError("busy", undefined, { cause: error }), rest: 15000 };
  }
  if (!body || !Array.isArray(body.elements)) return { error: new OverpassError("busy", undefined, { cause: new Error("No elements in answer") }), rest: 15000 };
  const remark = String(body.remark ?? "");
  if (/runtime error|out of memory|timed out|rate_limited/i.test(remark)) {
    const kind = /timed out|out of memory/i.test(remark) ? "timeout" : "busy";
    return { error: new OverpassError(kind, undefined, { cause: new Error(remark) }), partial: body.elements.length ? body : null, rest: kind === "busy" ? 15000 : 0 };
  }
  return { body };
}

/** The [timeout:N] a query asks the server for, in ms (Overpass's default is 180 s). */
export function queryTimeout(query) {
  const m = /\[timeout:(\d+)\]/.exec(query);
  return (m ? Number(m[1]) : 180) * 1000;
}

// ---- asking the mirrors ----

/**
 * Ask mirrors for one query until one answers well, the time is up or the
 * signal aborts. Starts with one mirror and adds a second if the first is
 * still working after hedgeMs or fails. Resolves to the Overpass JSON; a
 * result cut short by a server timeout comes back with partial: true only
 * when nothing better was found.
 */
export async function askMirrors(query, { signal, timeout, mirrors = MIRRORS, hedgeMs = HEDGE_MS, headers = {}, fetchImpl = globalThis.fetch } = {}) {
  if (signal?.aborted) throw abortError();
  const budget = timeout ?? Math.min(90000, queryTimeout(query) + 15000);
  const order = mirrorOrder(mirrors);
  const payload = new URLSearchParams({ data: query }).toString();
  const controllers = new Set();

  return new Promise((resolve, reject) => {
    let next = 0;
    let active = 0;
    let done = false;
    let lastError = null;
    let partial = null;
    let hedge = null;

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(hedge);
      signal?.removeEventListener("abort", onAbort);
      for (const c of controllers) c.abort();
      fn(value);
    };
    const giveUp = () => {
      if (partial) return finish(resolve, { ...partial, partial: true });
      finish(reject, lastError ?? new OverpassError("busy"));
    };
    const onAbort = () => finish(reject, abortError());
    signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => {
      lastError = lastError?.kind === "timeout" ? lastError : new OverpassError("busy", undefined, { cause: new Error("No mirror answered in time") });
      giveUp();
    }, budget);

    const start = () => {
      if (done || active >= 2) return;
      if (next >= order.length) {
        if (!active) giveUp();
        return;
      }
      const url = order[next++];
      active++;
      clearTimeout(hedge);
      if (next < order.length) hedge = setTimeout(start, hedgeMs);
      const c = new AbortController();
      controllers.add(c);
      (async () => {
        let response;
        try {
          response = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body: payload, signal: c.signal });
        } catch (error) {
          if (done || c.signal.aborted) return;
          // Network failure, or a refusal without CORS headers (some 429s).
          rest(url, 60000);
          throw new OverpassError("busy", undefined, { cause: error });
        }
        const answer = await readAnswer(response);
        if (done) return;
        if (answer.body) {
          preferred = url;
          cooldown.delete(url);
          return finish(resolve, answer.body);
        }
        if (answer.rest) rest(url, answer.rest);
        if (answer.partial && (!partial || answer.partial.elements.length > partial.elements.length)) partial = answer.partial;
        throw answer.error;
      })()
        .catch(error => {
          if (done) return;
          if (error?.kind === "query") return finish(reject, error); // every mirror would say the same
          if (!lastError || lastError.kind !== "timeout") lastError = error;
        })
        .finally(() => {
          controllers.delete(c);
          active--;
          if (!done) start();
        });
    };
    start();
  });
}

// ---- the page's queue, cache and shared requests ----

const memory = new Map(); // key -> { t, body }
const inflight = new Map(); // key -> job
const queue = [];
let running = 0;

function pump() {
  while (running < MAX_RUNNING && queue.length) {
    const job = queue.shift();
    if (job.controller.signal.aborted) continue;
    running++;
    job.run().finally(() => {
      running--;
      pump();
    });
  }
}

/** A short, stable key for a query. */
export function queryKey(query) {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < query.length; i++) {
    const c = query.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = Math.imul(b ^ c, 2246822519) >>> 0;
  }
  return `${a.toString(36)}${b.toString(36)}${query.length.toString(36)}`;
}

function storage() {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readCache(key, ttl) {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && now - hit.t < ttl) return hit.body;
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORE_PREFIX + key);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (now - saved.t >= ttl) return null;
    memory.set(key, saved);
    return saved.body;
  } catch {
    return null;
  }
}

function writeCache(key, body) {
  const entry = { t: Date.now(), body };
  memory.set(key, entry);
  if (memory.size > 60) memory.delete(memory.keys().next().value);
  const store = storage();
  if (!store) return;
  let raw;
  try {
    raw = JSON.stringify(entry);
  } catch {
    return;
  }
  if (raw.length > STORE_MAX_CHARS) return;
  try {
    store.setItem(STORE_PREFIX + key, raw);
  } catch {
    // Full: drop the oldest saved map answers and try once more.
    try {
      const keys = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k?.startsWith(STORE_PREFIX)) keys.push([k, JSON.parse(store.getItem(k) ?? "{}").t ?? 0]);
      }
      keys.sort((x, y) => x[1] - y[1]).slice(0, Math.ceil(keys.length / 2) + 1).forEach(([k]) => store.removeItem(k));
      store.setItem(STORE_PREFIX + key, raw);
    } catch {
      /* the memory copy still works for this visit */
    }
  }
}

async function askServer(query, { signal, timeout }) {
  if (typeof window === "undefined") throw new OverpassError("busy");
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop);
  const timer = setTimeout(stop, timeout);
  try {
    const response = await fetch(SERVER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: query }), signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(body.elements)) throw new OverpassError(body.kind === "timeout" ? "timeout" : "busy");
    return body;
  } catch (error) {
    if (signal.aborted) throw abortError();
    throw error instanceof OverpassError ? error : new OverpassError("busy", undefined, { cause: error });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}

/**
 * Run an Overpass query: `overpass("[out:json][timeout:25];...;out;", { signal })`.
 * Resolves to the Overpass JSON ({ elements, ... }; partial: true if a server
 * timeout cut it short and nothing better came back). Rejects with an
 * AbortError when signal aborts, or an OverpassError otherwise.
 *
 * Options: signal; timeout (ms for the whole try, default the query's own
 * [timeout:N] plus 15 s); ttl (ms to keep the answer, default a day, 0 to
 * skip the cache); server (false to skip the /api/apps/overpass fallback).
 */
export function overpass(query, { signal, timeout, ttl = DAY, server = true } = {}) {
  if (signal?.aborted) return Promise.reject(abortError());
  const key = queryKey(query);
  if (ttl > 0) {
    const hit = readCache(key, ttl);
    if (hit) return Promise.resolve(hit);
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return Promise.reject(new OverpassError("offline"));

  let job = inflight.get(key);
  if (!job) {
    const controller = new AbortController();
    const budget = timeout ?? Math.min(90000, queryTimeout(query) + 15000);
    job = { controller, waiters: 0 };
    job.promise = new Promise((resolve, reject) => {
      job.run = async () => {
        try {
          const started = Date.now();
          let body;
          try {
            body = await askMirrors(query, { signal: controller.signal, timeout: budget });
          } catch (error) {
            if (controller.signal.aborted || error?.kind === "query" || !server) throw error;
            const left = budget - (Date.now() - started);
            body = await askServer(query, { signal: controller.signal, timeout: Math.max(15000, left) }).catch(() => {
              throw error;
            });
          }
          if (ttl > 0 && !body.partial) writeCache(key, body);
          resolve(body);
        } catch (error) {
          reject(error);
        } finally {
          if (inflight.get(key) === job) inflight.delete(key);
        }
      };
    });
    job.promise.catch(() => {});
    inflight.set(key, job);
    queue.push(job);
    pump();
  }

  job.waiters++;
  if (!signal) return job.promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(abortError());
      if (--job.waiters === 0) {
        job.controller.abort();
        if (inflight.get(key) === job) inflight.delete(key);
      }
    };
    signal.addEventListener("abort", onAbort, { once: true });
    job.promise.then(
      v => (signal.removeEventListener("abort", onAbort), resolve(v)),
      e => (signal.removeEventListener("abort", onAbort), reject(e))
    );
  });
}

/**
 * Splits a long line of points (a route) into pieces of `size` points that
 * share their end points, so a query along a whole drive becomes several
 * small ones the servers can finish.
 */
export function chunkLine(points, size = 30) {
  if (points.length <= size) return [points];
  const out = [];
  for (let i = 0; i < points.length - 1; i += size - 1) out.push(points.slice(i, i + size));
  return out;
}

/**
 * Runs `build(piece)` (which returns an Overpass query) for each piece of a
 * long line and merges the elements, without repeats. Pieces run through
 * the same queue, so at most two at a time. onPiece(elements, done, total)
 * fires as each piece lands, for filling a map in as it goes. Resolves to
 * { elements, failed, partial }; rejects only if every piece failed.
 */
export async function overpassAlongLine(points, build, { size = 30, onPiece, ...opts } = {}) {
  const pieces = chunkLine(points, size);
  const seen = new Set();
  const elements = [];
  let failed = 0;
  let partial = false;
  let firstError = null;
  let done = 0;
  await Promise.all(
    pieces.map(async piece => {
      try {
        const body = await overpass(build(piece), opts);
        if (body.partial) partial = true;
        const fresh = body.elements.filter(e => !seen.has(`${e.type}/${e.id}`) && seen.add(`${e.type}/${e.id}`));
        elements.push(...fresh);
        onPiece?.(fresh, ++done, pieces.length);
      } catch (error) {
        if (error?.name === "AbortError") throw error;
        failed++;
        firstError ??= error;
        onPiece?.([], ++done, pieces.length);
      }
    })
  );
  if (failed === pieces.length) throw firstError;
  return { elements, failed, partial: partial || failed > 0 };
}
