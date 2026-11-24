// JumpFox's saved data, in this browser: your home DZ, wind limit, logbook,
// planned jump days and saved events. Plain functions so tests and TaskFox
// can use them. The logbook downloads as CSV or a JSON backup (see
// model/logbook.js) so it's never only in one browser.

export const STORAGE_KEY = "jumpfox-data-v1";

export const JUMP_TYPES = [
  { id: "tandem", name: "Tandem" },
  { id: "aff", name: "AFF / student" },
  { id: "sl", name: "Static line / IAD" },
  { id: "solo", name: "Solo / belly" },
  { id: "rw", name: "Formation (belly group)" },
  { id: "freefly", name: "Freefly" },
  { id: "tracking", name: "Tracking / angle" },
  { id: "wingsuit", name: "Wingsuit" },
  { id: "crw", name: "Canopy formation (CRW)" },
  { id: "hop", name: "Hop and pop" },
  { id: "hp", name: "Canopy piloting" },
  { id: "night", name: "Night jump" },
  { id: "water", name: "Water jump" },
  { id: "demo", name: "Demo" },
  { id: "other", name: "Other" },
];
const TYPE_IDS = new Set(JUMP_TYPES.map(t => t.id));

export function emptyData() {
  return {
    version: 1,
    homeDz: null, // drop zone id
    jumper: "A", // JUMPER_TYPES id
    limitMph: null, // null means the jumper type's default
    exitFt: 13500,
    pullFt: 3500,
    style: "belly",
    profile: { name: "", uspa: "", license: "" },
    prior: { jumps: 0, freefallMin: 0 }, // jumps logged before JumpFox
    reserveRepackedOn: null, // "YYYY-MM-DD"
    jumps: [],
    plans: [], // [{ id, day, dzId, note }]
    events: [], // [{ id, day, name, where, url }]
    updatedAt: null,
  };
}

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));
const intIn = (v, lo, hi, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n))) : d;
};
const isDay = v => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** One logbook entry, cleaned. Returns null for anything without a date. */
export function cleanJump(j) {
  if (!isObj(j) || !isDay(j.date)) return null;
  return {
    id: str(j.id, 40) || `j${Math.random().toString(36).slice(2, 10)}`,
    number: intIn(j.number, 1, 100000, 1),
    date: j.date,
    dzId: str(j.dzId, 40),
    dzName: str(j.dzName, 80),
    aircraft: str(j.aircraft, 40),
    exitFt: intIn(j.exitFt, 0, 40000, 13500),
    pullFt: intIn(j.pullFt, 0, 15000, 3500),
    freefallSec: intIn(j.freefallSec, 0, 600, 0),
    type: TYPE_IDS.has(j.type) ? j.type : "other",
    canopy: str(j.canopy, 40),
    distanceM: j.distanceM === "" || j.distanceM == null || !Number.isFinite(Number(j.distanceM)) ? null : Math.max(0, Math.min(99999, Number(j.distanceM))),
    notes: str(j.notes, 1000),
    signedBy: str(j.signedBy, 80),
  };
}

export function sortJumps(jumps) {
  return [...jumps].sort((a, b) => b.number - a.number || (a.date < b.date ? 1 : -1));
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObj(raw)) return base;
  const p = isObj(raw.profile) ? raw.profile : {};
  const prior = isObj(raw.prior) ? raw.prior : {};
  return {
    ...base,
    homeDz: typeof raw.homeDz === "string" ? raw.homeDz.slice(0, 40) : null,
    jumper: ["student", "A", "B", "CD", "tandem"].includes(raw.jumper) ? raw.jumper : base.jumper,
    limitMph: raw.limitMph == null ? null : intIn(raw.limitMph, 5, 40, null),
    exitFt: intIn(raw.exitFt, 1500, 30000, base.exitFt),
    pullFt: intIn(raw.pullFt, 1500, 10000, base.pullFt),
    style: ["belly", "freefly"].includes(raw.style) ? raw.style : base.style,
    profile: { name: str(p.name, 80), uspa: str(p.uspa, 20), license: str(p.license, 40) },
    prior: { jumps: intIn(prior.jumps, 0, 100000, 0), freefallMin: intIn(prior.freefallMin, 0, 100000, 0) },
    reserveRepackedOn: isDay(raw.reserveRepackedOn) ? raw.reserveRepackedOn : null,
    jumps: sortJumps((Array.isArray(raw.jumps) ? raw.jumps : []).map(cleanJump).filter(Boolean)).slice(0, 20000),
    plans: (Array.isArray(raw.plans) ? raw.plans : [])
      .filter(x => isObj(x) && isDay(x.day))
      .map(x => ({ id: str(x.id, 40), day: x.day, dzId: str(x.dzId, 40), note: str(x.note, 200) }))
      .filter(x => x.id)
      .slice(0, 200),
    events: (Array.isArray(raw.events) ? raw.events : [])
      .filter(x => isObj(x) && isDay(x.day))
      .map(x => ({ id: str(x.id, 40), day: x.day, name: str(x.name, 100), where: str(x.where, 100), url: /^https:\/\//.test(x.url ?? "") ? str(x.url, 300) : "" }))
      .filter(x => x.id && x.name)
      .slice(0, 200),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function loadData() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export const newId = prefix => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
