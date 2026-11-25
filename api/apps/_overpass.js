// POST /api/apps/overpass  body: { data: "<Overpass QL>" }
//
// The last thing the browser tries when every Overpass mirror turns it away
// (phones on a carrier network share one address, so they run out of
// Overpass slots fast). Asks the mirrors from here, one at a time, with a
// polite User-Agent, and keeps answers for an hour in this instance.
// Only read-only JSON queries with a short [timeout] are passed on.

import { askMirrors, OverpassError, queryKey } from "../../src/lib/osm/overpass.js";

const MAX_QUERY = 20000;
const MAX_SERVER_TIMEOUT = 25;
const KEEP_MS = 3600 * 1000;
const kept = new Map();

/** The query to send, with its [timeout] capped, or null if it isn't one we pass on. */
export function safeQuery(raw) {
  if (typeof raw !== "string") return null;
  const query = raw.trim();
  if (!query || query.length > MAX_QUERY) return null;
  if (!/^\[out:json\]/.test(query)) return null;
  if (/\[out:(?!json)|\[maxsize:|convert |make |timeline\(|retro\(/i.test(query)) return null;
  const capped = query.replace(/\[timeout:(\d+)\]/, (_, n) => `[timeout:${Math.min(Number(n), MAX_SERVER_TIMEOUT)}]`);
  return /\[timeout:\d+\]/.test(capped) ? capped : capped.replace("[out:json]", `[out:json][timeout:${MAX_SERVER_TIMEOUT}]`);
}

export default async function overpassRoute(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });
  let body = req.body ?? {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      body = {};
    }
  }
  const query = safeQuery(body.data);
  if (!query) return res.status(400).json({ error: "Send an Overpass JSON query as { data }.", kind: "query" });

  const key = queryKey(query);
  const hit = kept.get(key);
  if (hit && Date.now() - hit.t < KEEP_MS) return res.status(200).json(hit.body);

  try {
    const answer = await askMirrors(query, { timeout: 26000, hedgeMs: 9000, headers: { "User-Agent": "TheClusterFox/1.0 (+https://theclusterfox.com)", Accept: "application/json" } });
    if (!answer.partial) {
      kept.set(key, { t: Date.now(), body: answer });
      if (kept.size > 150) kept.delete(kept.keys().next().value);
    }
    return res.status(200).json(answer);
  } catch (error) {
    const kind = error instanceof OverpassError ? error.kind : "busy";
    console.error("/api/apps/overpass:", kind, error?.cause?.message ?? error?.message);
    return res.status(kind === "query" ? 400 : 503).json({ error: error.message, kind });
  }
}
