// The logbook: totals, license progress, and CSV / JSON files to download
// and load back in. Plain functions so they run in Node tests.

import { LICENSES } from "../data/license.js";
import { cleanJump, JUMP_TYPES, normalizeData, sortJumps } from "../state/jumpStore.js";
import { freefallSeconds } from "./jumpcheck.js";

/** Freefall seconds to log for an exit and pull altitude (AGL). */
export function estimateFreefall(exitFt, pullFt, type) {
  if (["tandem", "sl", "crw"].includes(type)) return type === "tandem" ? Math.round(freefallSeconds(exitFt - Math.max(pullFt, 5000))) : 0;
  return Math.round(freefallSeconds(exitFt - pullFt, type === "freefly" ? "freefly" : type === "wingsuit" ? "wingsuit" : "belly"));
}

/** { jumps, freefallSec, lastDate, byType: [{ id, name, count }], dzCount } including jumps logged before JumpFox. */
export function totals(data) {
  const jumps = data.jumps;
  const byType = {};
  for (const j of jumps) byType[j.type] = (byType[j.type] ?? 0) + 1;
  const highest = jumps.reduce((m, j) => Math.max(m, j.number), 0);
  return {
    jumps: Math.max(highest, data.prior.jumps + jumps.length),
    freefallSec: data.prior.freefallMin * 60 + jumps.reduce((s, j) => s + j.freefallSec, 0),
    lastDate: jumps.reduce((m, j) => (j.date > m ? j.date : m), ""),
    byType: JUMP_TYPES.filter(t => byType[t.id]).map(t => ({ id: t.id, name: t.name, count: byType[t.id] })),
    dzCount: new Set(jumps.map(j => j.dzId || j.dzName).filter(Boolean)).size,
  };
}

/** Where you are on the license ladder: [{ id, name, jumps, freefallMin, jumpsPct, freefallPct, met }]. */
export function licenseProgress(t) {
  const ffMin = t.freefallSec / 60;
  return LICENSES.map(l => ({
    id: l.id,
    name: l.name,
    jumps: l.jumps,
    freefallMin: l.freefallMin,
    jumpsPct: Math.min(1, t.jumps / l.jumps),
    freefallPct: l.freefallMin ? Math.min(1, ffMin / l.freefallMin) : 1,
    met: t.jumps >= l.jumps && ffMin >= l.freefallMin,
  }));
}

/** The next jump number. */
export const nextNumber = data => Math.max(data.prior.jumps, ...data.jumps.map(j => j.number), 0) + 1;

/** "1:05" style minutes and seconds, or "2 h 14 min" for long totals. */
export function fmtFreefall(sec) {
  if (sec >= 3600) return `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min`;
  if (sec >= 60) return `${Math.floor(sec / 60)} min ${String(Math.round(sec % 60)).padStart(2, "0")} s`;
  return `${Math.round(sec)} s`;
}

const COLUMNS = [
  ["number", "Jump"],
  ["date", "Date"],
  ["dzName", "Drop zone"],
  ["aircraft", "Aircraft"],
  ["exitFt", "Exit ft"],
  ["pullFt", "Pull ft"],
  ["freefallSec", "Freefall s"],
  ["type", "Type"],
  ["canopy", "Canopy"],
  ["distanceM", "Distance from target m"],
  ["notes", "Notes"],
  ["signedBy", "Signed by"],
];

const cell = v => {
  const s = v == null ? "" : String(v);
  // Quote anything with commas, quotes or line breaks, and defuse
  // spreadsheet formulas.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The logbook as CSV, oldest jump first, ready for a spreadsheet. */
export function toCsv(jumps) {
  const typeName = id => JUMP_TYPES.find(t => t.id === id)?.name ?? id;
  const rows = [...jumps].reverse().map(j => COLUMNS.map(([k]) => cell(k === "type" ? typeName(j[k]) : j[k])).join(","));
  return [COLUMNS.map(([, h]) => h).join(","), ...rows].join("\r\n") + "\r\n";
}

/** Splits CSV text into rows of cells, handling quotes. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else cur += c;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim()));
}

/** Jumps from a CSV this app (or a spreadsheet with the same headers) made. */
export function fromCsv(text) {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const idx = Object.fromEntries(COLUMNS.map(([k, h]) => [k, head.findIndex(x => x.trim().toLowerCase() === h.toLowerCase())]));
  if (idx.number < 0 || idx.date < 0) throw new Error("That file doesn't look like a JumpFox logbook: it needs Jump and Date columns.");
  const typeId = name => JUMP_TYPES.find(t => t.name.toLowerCase() === String(name).trim().toLowerCase() || t.id === name)?.id ?? "other";
  return rows
    .map((r, i) => {
      const get = k => (idx[k] >= 0 ? (r[idx[k]] ?? "").replace(/^'(?=[=+\-@])/, "") : "");
      return cleanJump({
        id: `csv${i}-${get("number")}`,
        number: get("number"),
        date: get("date").trim(),
        dzName: get("dzName"),
        aircraft: get("aircraft"),
        exitFt: get("exitFt") || undefined,
        pullFt: get("pullFt") || undefined,
        freefallSec: get("freefallSec") || 0,
        type: typeId(get("type")),
        canopy: get("canopy"),
        distanceM: get("distanceM"),
        notes: get("notes"),
        signedBy: get("signedBy"),
      });
    })
    .filter(Boolean);
}

/** A full backup of everything JumpFox saved. */
export const toBackup = data => JSON.stringify({ app: "JumpFox", exportedAt: new Date().toISOString(), data }, null, 2);

/** Loads a backup file's text: returns normalized data. */
export function fromBackup(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a JumpFox backup.");
  }
  const data = body?.app === "JumpFox" ? body.data : body;
  if (!data || !Array.isArray(data.jumps)) throw new Error("That file isn't a JumpFox backup.");
  return normalizeData(data);
}

/** Adds imported jumps, skipping ones already logged with the same number and date. */
export function mergeJumps(existing, incoming) {
  const key = j => `${j.number}|${j.date}`;
  const have = new Set(existing.map(key));
  const added = incoming.filter(j => !have.has(key(j)));
  return { jumps: sortJumps([...existing, ...added]), added: added.length, skipped: incoming.length - added.length };
}
