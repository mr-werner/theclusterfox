/* global process */
import { createHash } from "node:crypto";

import { sql } from "../plan/_db.js";
import { cleanCode, isCode } from "../../src/features/crib/lib/code.js";

// /api/apps/crib — CribFox, the two-phone baby monitor (db/migrations/022).
// Everything is a POST { op, code, peer, ... }:
//   ice                 the STUN/TURN servers the phones should use
//   host                this phone becomes the monitor for `code`
//   poll                check in; returns setup messages for this phone,
//                       and for a viewer the monitor's status (and its still
//                       picture when `wantSnap`); the monitor sends `status`
//                       and, when asked for one, `snap`
//   send { to, body }   a WebRTC setup message for another phone
//   stop                the monitor is turning off
//
// Video and sound never pass through here: once set up, the phones stream
// to each other directly (or through TURN). The one exception is picture
// mode, a still frame every couple of seconds for a viewer whose network
// won't let a live stream through.

const PEER = /^[A-Za-z0-9_-]{8,64}$/;
const ONLINE_MS = 20000;
const TAKEOVER_MS = 45000;
const MAX_BODY = 24000;
const MAX_SNAP = 160000;
const SIGNAL_MINUTES = 10;

const hash = (code) => createHash("sha256").update(`cribfox:${code}`).digest("hex");

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }, { urls: "stun:stun.cloudflare.com:3478" }];

// TURN relays video when the two networks won't connect directly (common on
// cell data). Either a Cloudflare Realtime TURN key, or any TURN server's
// address and login, set in Vercel's environment variables.
let cached = { at: 0, servers: null };
async function iceServers() {
  const env = process.env;
  if (env.CLOUDFLARE_TURN_KEY_ID && env.CLOUDFLARE_TURN_API_TOKEN) {
    if (cached.servers && Date.now() - cached.at < 6 * 3600 * 1000) return cached.servers;
    try {
      const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.CLOUDFLARE_TURN_API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: 86400 }),
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.iceServers) ? data.iceServers : [data.iceServers];
        cached = { at: Date.now(), servers: [...STUN, ...list.filter(Boolean)] };
        return cached.servers;
      }
      console.error("cribfox: Cloudflare TURN answered", res.status);
    } catch (error) {
      console.error("cribfox: Cloudflare TURN", error);
    }
  }
  if (env.TURN_URLS) {
    const urls = env.TURN_URLS.split(",").map((u) => u.trim()).filter(Boolean);
    return [...STUN, { urls, username: env.TURN_USERNAME || undefined, credential: env.TURN_CREDENTIAL || undefined }];
  }
  return STUN;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const ms = (t) => (t ? new Date(t).getTime() : 0);

export default async function crib(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  const input = readBody(req);
  if (input.op === "ice") return res.status(200).json({ iceServers: await iceServers() });

  const db = sql();
  if (!db) return res.status(503).json({ error: "CribFox isn't set up on this server yet." });

  const code = cleanCode(input.code);
  const peer = String(input.peer ?? "");
  if (!isCode(code)) return res.status(400).json({ error: "That code isn't right. It's 8 letters and numbers, like K7QM-3XRA." });
  if (!PEER.test(peer)) return res.status(400).json({ error: "Reload the page and try again." });
  const key = hash(code);
  const now = Date.now();

  try {
    if (input.op === "host") {
      const rows = await db`
        insert into public.crib_rooms (code_hash, monitor_peer)
        values (${key}, ${peer})
        on conflict (code_hash) do update set
          monitor_peer = excluded.monitor_peer, monitor_seen = now(), status = '{}'::jsonb,
          snap = null, snap_at = null, updated_at = now()
        where public.crib_rooms.monitor_peer = ${peer}
           or public.crib_rooms.monitor_seen < now() - make_interval(secs => ${TAKEOVER_MS / 1000})
        returning code_hash`;
      if (!rows.length) throw new HttpError(409, "Another phone is already the monitor for this code. Make a new code instead.");
      // Old setup messages for this phone are from a page that has gone.
      await db`delete from public.crib_signals where code_hash = ${key} and to_peer = ${peer}`;
      return res.status(200).json({ ok: true, now });
    }

    const rooms = await db`select monitor_peer, monitor_seen, status, snap_at, snap_wanted from public.crib_rooms where code_hash = ${key}`;
    if (!rooms.length) throw new HttpError(404, "There's no monitor with that code. Check it on the monitor phone.");
    const room = rooms[0];
    const isMonitor = room.monitor_peer === peer;

    if (input.op === "send") {
      const to = String(input.to ?? "");
      if (!PEER.test(to)) throw new HttpError(400, "Unknown phone.");
      // A viewer only ever talks to the monitor.
      if (!isMonitor && to !== room.monitor_peer) throw new HttpError(409, "The monitor restarted. Connecting again…");
      const body = JSON.stringify(input.body ?? null);
      if (body.length > MAX_BODY) throw new HttpError(413, "That message is too big.");
      await db`insert into public.crib_signals (code_hash, to_peer, from_peer, body) values (${key}, ${to}, ${peer}, ${body}::jsonb)`;
      if (Math.random() < 0.05) await db`delete from public.crib_signals where created_at < now() - make_interval(mins => ${SIGNAL_MINUTES})`;
      return res.status(200).json({ ok: true, now });
    }

    if (input.op === "stop") {
      if (isMonitor) await db`delete from public.crib_rooms where code_hash = ${key} and monitor_peer = ${peer}`;
      await db`delete from public.crib_signals where code_hash = ${key}`;
      return res.status(200).json({ ok: true });
    }

    if (input.op !== "poll") throw new HttpError(400, "Unknown request.");

    const after = Number.isFinite(Number(input.after)) ? Number(input.after) : 0;
    const messages = await db`
      select id, from_peer, body from public.crib_signals
      where code_hash = ${key} and to_peer = ${peer} and id > ${after}
        and created_at > now() - make_interval(mins => ${SIGNAL_MINUTES})
      order by id limit 50`;
    const inbox = messages.map((m) => ({ id: Number(m.id), from: m.from_peer, body: m.body }));
    const lastId = inbox.length ? inbox[inbox.length - 1].id : after;

    if (isMonitor) {
      const status = input.status && typeof input.status === "object" ? input.status : {};
      const clean = {
        level: Math.max(0, Math.min(100, Math.round(Number(status.level) || 0))),
        battery: Number.isFinite(Number(status.battery)) ? Math.round(Number(status.battery)) : null,
        charging: typeof status.charging === "boolean" ? status.charging : null,
        viewers: Math.max(0, Math.min(20, Math.round(Number(status.viewers) || 0))),
        dim: Boolean(status.dim),
        hidden: Boolean(status.hidden),
        at: now,
      };
      const snap = typeof input.snap === "string" && input.snap.startsWith("data:image/") && input.snap.length <= MAX_SNAP ? input.snap : null;
      if (snap) {
        await db`update public.crib_rooms set monitor_seen = now(), status = ${JSON.stringify(clean)}::jsonb, snap = ${snap}, snap_at = now(), updated_at = now() where code_hash = ${key}`;
      } else {
        await db`update public.crib_rooms set monitor_seen = now(), status = ${JSON.stringify(clean)}::jsonb where code_hash = ${key}`;
      }
      const wantSnap = now - ms(room.snap_wanted) < 12000;
      return res.status(200).json({ now, messages: inbox, lastId, wantSnap });
    }

    // A viewer.
    const out = {
      now,
      messages: inbox,
      lastId,
      monitor: {
        peer: room.monitor_peer,
        online: now - ms(room.monitor_seen) < ONLINE_MS,
        seen: ms(room.monitor_seen),
        status: room.status || {},
      },
    };
    if (input.wantSnap) {
      await db`update public.crib_rooms set snap_wanted = now() where code_hash = ${key}`;
      const have = Number(input.snapAt) || 0;
      if (ms(room.snap_at) > have) {
        const snaps = await db`select snap, snap_at from public.crib_rooms where code_hash = ${key}`;
        if (snaps[0]?.snap) {
          out.snap = snaps[0].snap;
          out.snapAt = ms(snaps[0].snap_at);
        }
      }
    }
    return res.status(200).json(out);
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
}
