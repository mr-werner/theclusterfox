import { createHash } from "node:crypto";

import { requestUser, sql } from "./_db.js";

// POST /api/site/feedback — anyone can send feedback, signed in or not.
// It is stored in site_feedback (db/migrations/011) for the developer area.

const KINDS = new Set(["bug", "idea", "praise", "other"]);
const PER_WINDOW = 6; // sends allowed from one address...
const WINDOW_MINUTES = 30; // ...in this many minutes

const clip = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

export default async function feedback(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  const body = readBody(req);
  // A hidden field people never see; bots fill it in. Pretend it worked.
  if (clip(body.website, 200)) return res.status(200).json({ ok: true });

  const message = clip(body.message, 4000);
  if (message.length < 3) return res.status(400).json({ error: "Write a little more so we know what you mean." });

  const kind = KINDS.has(body.kind) ? body.kind : "other";
  const app = clip(body.app, 40) || null;
  const page = clip(body.page, 300) || null;
  const contact = clip(body.contact, 200) || null;
  const userAgent = clip(req.headers["user-agent"], 300) || null;

  const db = sql();
  if (!db) return res.status(503).json({ error: "Feedback isn't set up on this server yet." });

  const user = await requestUser(req);
  const ipHash = createHash("sha256").update(`clusterfox-feedback:${clientIp(req)}`).digest("hex").slice(0, 32);

  try {
    const [{ count }] = await db`
      select count(*)::int as count from public.site_feedback
      where ip_hash = ${ipHash} and created_at > now() - make_interval(mins => ${WINDOW_MINUTES})`;
    if (count >= PER_WINDOW) {
      return res.status(429).json({ error: "That's a lot of feedback at once. Try again in a little while." });
    }

    await db`
      insert into public.site_feedback (user_id, user_name, contact, kind, app, page, message, user_agent, ip_hash)
      values (${user?.id ?? null}, ${user?.name ?? null}, ${contact}, ${kind}, ${app}, ${page}, ${message}, ${userAgent}, ${ipHash})`;
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Feedback:", error.message);
    if (/relation .* does not exist/.test(error.message)) {
      return res.status(503).json({ error: "Feedback isn't set up on this server yet." });
    }
    return res.status(500).json({ error: "Couldn't save your feedback. Please try again." });
  }
}
