import { parseIcs } from "../../src/services/plan/ics.js";

// Fetches a public calendar link (.ics or webcal://) and returns its
// events. Browsers can't fetch most calendar links directly (no CORS), so
// this proxies them, for public internet addresses only.

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8000;

// Private, loopback and link-local addresses, and names that only mean
// something inside a network.
export function isPublicHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || (!host.includes(".") && !host.includes(":"))) return false;
  if (/\.(local|internal|localhost|lan|home|corp)$/.test(host)) return false;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  // Any IPv6 literal is refused rather than parsed.
  if (host.includes(":")) return false;
  return true;
}

export function feedUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? "").trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
  if (url.port && !["80", "443"].includes(url.port)) return null;
  return isPublicHost(url.hostname) ? url : null;
}

async function readCapped(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      reader.cancel();
      throw new Error("too-big");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let url = feedUrl(req.query.url);
  if (!url) {
    return res.status(400).json({ error: "That doesn't look like a public calendar link." });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Follow redirects by hand so each hop is checked.
    let response;
    for (let hop = 0; hop < 4; hop++) {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "user-agent": "TheClusterFox-PlanFox/1.0" },
      });
      if (response.status < 300 || response.status >= 400) break;
      const next = feedUrl(new URL(response.headers.get("location") ?? "", url).toString());
      if (!next) throw new Error("bad-redirect");
      url = next;
    }

    if (!response.ok) {
      return res.status(502).json({ error: `The calendar link answered with an error (${response.status}).` });
    }

    const text = await readCapped(response);
    if (!text.includes("BEGIN:VCALENDAR")) {
      return res.status(422).json({ error: "That link isn't a calendar file. Look for an iCal, .ics or \"subscribe\" link." });
    }

    const nameMatch = /^X-WR-CALNAME:(.+)$/m.exec(text);
    const events = parseIcs(text);

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=7200");

    return res.status(200).json({ name: nameMatch ? nameMatch[1].trim().slice(0, 60) : null, events });
  } catch (error) {
    if (error.message === "too-big") return res.status(413).json({ error: "That calendar is too large to load." });
    console.error("Calendar feed error:", error.message);
    return res.status(502).json({ error: "Couldn't load that calendar link." });
  } finally {
    clearTimeout(timer);
  }
}
