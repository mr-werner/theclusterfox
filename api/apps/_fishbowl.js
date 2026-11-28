import { createHash } from "node:crypto";

import { sql } from "../plan/_db.js";
import { act, newGame, roomCode, tick, view, GameError, cleanName } from "../../src/features/fishbowl/model/game.js";

// /api/apps/fishbowl — live Fishbowl rooms (db/migrations/021).
//   GET  ?room=&password=&player=&v=   the room as this player sees it;
//                                      { same: true } when nothing changed since v
//   POST { op: "create"|"join"|"act", room, password, player, name, action }
//
// Phones poll about once a second. Each change reads the room, applies the
// move with the shared rules, and writes it back only if nobody else wrote
// in between (the version column), retrying when two taps race.

const STALE_HOURS = 12;
const ID = /^[A-Za-z0-9_-]{8,64}$/;

const hash = (code, password) => createHash("sha256").update(`fishbowl:${code}:${password}`).digest("hex");

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function load(db, code, password) {
  const rows = await db`select state, version, password_hash from public.fishbowl_rooms where code = ${code}`;
  if (!rows.length) throw new HttpError(404, "There's no room by that name. Check the spelling, or host a new one.");
  if (rows[0].password_hash !== hash(code, password)) throw new HttpError(403, "That password doesn't match this room.");
  return rows[0];
}

// Apply a change with optimistic locking. `change` returns the new state or
// null for "nothing to write".
async function update(db, code, password, change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await load(db, code, password);
    const next = change(row.state);
    if (!next) return { state: row.state, version: row.version };
    const done = await db`
      update public.fishbowl_rooms set state = ${JSON.stringify(next)}::jsonb, version = version + 1, updated_at = now()
      where code = ${code} and version = ${row.version} returning version`;
    if (done.length) return { state: next, version: done[0].version };
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 80));
  }
  throw new HttpError(409, "Lots of taps at once. Try that again.");
}

export default async function fishbowl(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const db = sql();
  if (!db) return res.status(503).json({ error: "Fishbowl isn't set up on this server yet." });

  const input = req.method === "GET" ? req.query : readBody(req);
  const code = roomCode(input.room);
  const password = String(input.password ?? "");
  const player = String(input.player ?? "");
  if (!code || code.length < 2) return res.status(400).json({ error: "Give the room a name (at least 2 letters)." });
  if (!password) return res.status(400).json({ error: "Type the room's password." });
  if (!ID.test(player)) return res.status(400).json({ error: "Reload the page and try again." });

  const send = ({ state, version }, extra = {}) =>
    res.status(200).json({ version, now: Date.now(), room: view(state, player, Date.now()), ...extra });

  try {
    if (req.method === "GET") {
      const now = Date.now();
      const since = Number(input.v);
      let result = await update(db, code, password, (state) => {
        const s = structuredClone(state);
        let changed = tick(s, now);
        const me = s.players.find((p) => p.id === player);
        // Note when each phone was last here, now and then, so an away host can be replaced.
        if (me && now - (me.seen ?? 0) > 20000) {
          me.seen = now;
          changed = true;
        }
        return changed ? s : null;
      });
      if (Number.isFinite(since) && since === result.version) return res.status(200).json({ same: true, version: result.version, now: Date.now() });
      return send(result);
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Use GET or POST." });
    }

    const now = Date.now();
    if (input.op === "create") {
      if (password.length < 2) return res.status(400).json({ error: "Use a password of at least 2 characters." });
      const name = cleanName(input.name);
      if (!name) return res.status(400).json({ error: "Type your name." });
      const state = newGame({ roomName: input.room, hostId: player, hostName: name, now });
      const rows = await db`
        insert into public.fishbowl_rooms (code, password_hash, state)
        values (${code}, ${hash(code, password)}, ${JSON.stringify(state)}::jsonb)
        on conflict (code) do update set
          password_hash = excluded.password_hash, state = excluded.state,
          version = public.fishbowl_rooms.version + 1, created_at = now(), updated_at = now()
        where public.fishbowl_rooms.updated_at < now() - make_interval(hours => ${STALE_HOURS})
        returning version`;
      if (!rows.length) {
        return res.status(409).json({ error: "A game with that room name is going right now. Join it, or pick another name." });
      }
      return send({ state, version: rows[0].version });
    }

    const action = input.op === "join" ? { type: "join", name: input.name } : input.action;
    if (!action || typeof action !== "object") return res.status(400).json({ error: "Unknown move." });
    const result = await update(db, code, password, (state) => act(state, player, action, { now }));
    return send(result);
  } catch (error) {
    if (error instanceof GameError) return res.status(400).json({ error: error.message });
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    throw error;
  }
}
