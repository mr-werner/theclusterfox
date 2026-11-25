// Shared Overpass helper: run with `node src/lib/osm/tests/overpass.mjs`.
import assert from "node:assert/strict";
import { MIRRORS, OverpassError, askMirrors, chunkLine, mirrorOrder, overpass, overpassAlongLine, queryKey, queryTimeout, readAnswer, resetOverpass } from "../overpass.js";
import { safeQuery } from "../../../../api/apps/_overpass.js";

const Q = "[out:json][timeout:20];node(around:1000,39.1,-84.5)[shop];out 5;";
const ok = (elements = [{ type: "node", id: 1, lat: 1, lon: 2 }]) => new Response(JSON.stringify({ elements }), { status: 200 });
const status = (code, headers) => new Response("busy", { status: code, headers });
const remark = (text, elements = []) => new Response(JSON.stringify({ elements, remark: text }), { status: 200 });
const wait = ms => new Promise(r => setTimeout(r, ms));

/** A fake fetch that answers each mirror with a function of the call. */
function fakeFetch(byHost) {
  const calls = [];
  const fn = async (url, init) => {
    const host = new URL(url).host;
    calls.push(host);
    const answer = byHost[host] ?? byHost.default;
    return answer(init, calls.filter(h => h === host).length);
  };
  fn.calls = calls;
  return fn;
}
const host = i => new URL(MIRRORS[i]).host;
const hang = init => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));

// --- reading answers ---------------------------------------------------------
{
  assert.ok((await readAnswer(ok())).body, "a normal answer is a body");
  const timedOut = await readAnswer(remark("runtime error: Query timed out in \"query\" at line 1 after 26 seconds."));
  assert.equal(timedOut.error.kind, "timeout", "a 200 with a timeout remark is a failure, not an empty result");
  const partial = await readAnswer(remark("runtime error: Query timed out", [{ type: "node", id: 9 }]));
  assert.equal(partial.partial.elements.length, 1, "keeps what came back before the timeout");
  const r429 = await readAnswer(status(429, { "Retry-After": "12" }));
  assert.equal(r429.error.kind, "busy");
  assert.equal(r429.rest, 12000, "honors Retry-After");
  assert.equal((await readAnswer(status(400))).error.kind, "query");
  assert.equal((await readAnswer(new Response("<html>oops</html>", { status: 200 }))).error.kind, "busy", "an HTML page is a busy server");
  assert.equal(queryTimeout(Q), 20000);
  assert.equal(queryTimeout("[out:json];node(1);out;"), 180000);
  assert.notEqual(queryKey(Q), queryKey(Q + " "));
  assert.equal(queryKey(Q), queryKey(`${Q}`));
}

// --- one mirror at a time, moving on when one fails ------------------------
{
  resetOverpass();
  const f = fakeFetch({ [host(0)]: () => status(429), default: () => ok() });
  const body = await askMirrors(Q, { fetchImpl: f, hedgeMs: 5000 });
  assert.equal(body.elements.length, 1);
  assert.deepEqual(f.calls, [host(0), host(1)], "asks the next mirror only after the first refuses");
  assert.equal(mirrorOrder()[0], MIRRORS[1], "the mirror that answered goes first next time");
  assert.equal(mirrorOrder().at(-1), MIRRORS[0], "a mirror that said 429 rests at the back");
}

{
  resetOverpass();
  const f = fakeFetch({ [host(0)]: () => remark("runtime error: Query timed out"), default: () => ok([{ type: "node", id: 5 }]) });
  const body = await askMirrors(Q, { fetchImpl: f });
  assert.equal(body.elements[0].id, 5, "a timeout remark doesn't win as an empty answer");
}

{
  resetOverpass();
  const f = fakeFetch({ [host(0)]: hang, default: () => ok([{ type: "node", id: 7 }]) });
  const started = Date.now();
  const body = await askMirrors(Q, { fetchImpl: f, hedgeMs: 50 });
  assert.equal(body.elements[0].id, 7, "a slow mirror gets a second one started alongside it");
  assert.ok(Date.now() - started < 1000);
  assert.equal(f.calls.length, 2, "only two at once");
}

{
  resetOverpass();
  const f = fakeFetch({ default: () => status(400) });
  await assert.rejects(askMirrors(Q, { fetchImpl: f }), e => e.kind === "query");
  assert.equal(f.calls.length, 1, "a bad query isn't sent to every mirror");
}

{
  resetOverpass();
  const f = fakeFetch({ default: () => status(504) });
  await assert.rejects(askMirrors(Q, { fetchImpl: f }), e => e instanceof OverpassError && e.kind === "busy" && /busy/.test(e.message));
  assert.equal(f.calls.length, MIRRORS.length, "tries every mirror once, then gives up");
}

{
  resetOverpass();
  const f = fakeFetch({ default: hang });
  await assert.rejects(askMirrors(Q, { fetchImpl: f, timeout: 120, hedgeMs: 30 }), e => e.kind === "busy", "always ends within its time budget");
}

{
  resetOverpass();
  const f = fakeFetch({ [host(0)]: () => remark("runtime error: Query timed out", [{ type: "node", id: 1 }]), default: () => status(503) });
  const body = await askMirrors(Q, { fetchImpl: f });
  assert.equal(body.partial, true, "a partial answer is better than none when every mirror fails");
}

{
  resetOverpass();
  const ctl = new AbortController();
  const f = fakeFetch({ default: hang });
  const job = askMirrors(Q, { fetchImpl: f, signal: ctl.signal });
  ctl.abort();
  await assert.rejects(job, e => e.name === "AbortError");
}

// --- overpass(): shared requests, cache, queue -----------------------------
{
  resetOverpass();
  let n = 0;
  globalThis.fetch = async () => (n++, await wait(20), ok());
  const [a, b] = await Promise.all([overpass(Q), overpass(Q)]);
  assert.equal(n, 1, "identical queries share one request");
  assert.equal(a, b);
  await overpass(Q);
  assert.equal(n, 1, "answers are kept");
  await overpass(Q, { ttl: 0 });
  assert.equal(n, 2, "ttl 0 skips the cache");
}

{
  resetOverpass();
  let running = 0;
  let most = 0;
  globalThis.fetch = async () => {
    most = Math.max(most, ++running);
    await wait(15);
    running--;
    return ok();
  };
  await Promise.all([1, 2, 3, 4, 5].map(i => overpass(`${Q}//${i}`)));
  assert.ok(most <= 2, `at most two queries at once (saw ${most})`);
}

{
  resetOverpass();
  let calls = 0;
  globalThis.fetch = (url, init) => (calls++, hang(init));
  const ctl = new AbortController();
  const p = overpass(Q, { signal: ctl.signal, ttl: 0, timeout: 100 });
  const other = overpass(Q, { ttl: 0, timeout: 100 });
  ctl.abort();
  await assert.rejects(p, e => e.name === "AbortError", "a caller's abort ends its wait");
  await assert.rejects(other, e => e.kind === "busy", "the other caller still gets its own answer or error");
  assert.ok(calls >= 1);
}

// --- long lines ------------------------------------------------------------
{
  const pts = Array.from({ length: 100 }, (_, i) => ({ lat: i, lon: i }));
  const pieces = chunkLine(pts, 30);
  assert.equal(pieces[0].at(-1), pieces[1][0], "pieces share their end points");
  assert.equal(pieces.at(-1).at(-1), pts.at(-1), "the last piece reaches the end");
  assert.equal(chunkLine(pts.slice(0, 10), 30).length, 1);

  resetOverpass();
  globalThis.fetch = async (url, init) => {
    const q = new URLSearchParams(init.body).get("data");
    if (q.includes("piece:1")) return status(504);
    const i = Number(/piece:(\d+)/.exec(q)[1]);
    return ok([{ type: "node", id: 1 }, { type: "node", id: 100 + i }]);
  };
  let landed = 0;
  const out = await overpassAlongLine(pts, piece => `${Q}//piece:${pieces.findIndex(p => p[0] === piece[0])}`, { size: 30, server: false, onPiece: () => landed++ });
  assert.equal(landed, pieces.length);
  assert.equal(out.failed, 1);
  assert.equal(out.partial, true);
  assert.equal(out.elements.filter(e => e.id === 1).length, 1, "no repeats across pieces");
}

// --- the server fallback only passes on safe queries -----------------------
{
  assert.equal(safeQuery("[out:json][timeout:90];node(1);out;"), "[out:json][timeout:25];node(1);out;", "caps the server timeout");
  assert.equal(safeQuery("[out:json];node(1);out;"), "[out:json][timeout:25];node(1);out;");
  assert.equal(safeQuery("[out:xml];node(1);out;"), null);
  assert.equal(safeQuery("[out:json][maxsize:9000000000];node(1);out;"), null);
  assert.equal(safeQuery(42), null);
  assert.equal(safeQuery(`[out:json];${"x".repeat(30000)}`), null);
}

console.log("Overpass helper: all checks passed.");
