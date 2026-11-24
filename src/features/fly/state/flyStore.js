// FlyFox's saved data, in this browser: your aircraft, home airport, saved
// flights and study progress. Plain functions so tests and TaskFox can use them.

export const STORAGE_KEY = "flyfox-data-v1";

export const AIRCRAFT_PRESETS = [
  { id: "c152", name: "Cessna 152", tas: 95, gph: 6, usableGal: 24.5, taxiGal: 0.8 },
  { id: "c172", name: "Cessna 172S", tas: 120, gph: 9, usableGal: 53, taxiGal: 1.1 },
  { id: "pa28", name: "Piper Archer", tas: 125, gph: 9.5, usableGal: 48, taxiGal: 1.1 },
  { id: "sr22", name: "Cirrus SR22", tas: 175, gph: 16, usableGal: 92, taxiGal: 1.5 },
  { id: "da40", name: "Diamond DA40", tas: 135, gph: 9, usableGal: 40, taxiGal: 1 },
  { id: "lsa", name: "Light sport (typical)", tas: 105, gph: 5, usableGal: 24, taxiGal: 0.5 },
];

export function emptyData() {
  return {
    version: 1,
    aircraft: { ...AIRCRAFT_PRESETS[1] },
    home: null, // { id, name, lat, lon }
    route: [], // [{ id, name, lat, lon, elevFt, magVar }]
    altitudeFt: 5500,
    departAt: null, // ISO string; null means "now"
    night: false,
    flights: [], // saved: [{ id, title, route, altitudeFt, departAt, aircraft, createdAt }]
    study: {}, // examId -> { seen: { qid: { right, wrong, last } }, exams: [{ at, score, total, seconds }] }
    goal: null, // license id you're working toward
    updatedAt: null,
  };
}

const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const num = (v, d) => (Number.isFinite(v) ? v : d);

function cleanPoint(p) {
  if (!isObj(p) || typeof p.id !== "string" || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return null;
  return { id: p.id.slice(0, 8), name: String(p.name ?? p.id).slice(0, 80), lat: p.lat, lon: p.lon, elevFt: Number.isFinite(p.elevFt) ? p.elevFt : null, magVar: Number.isFinite(p.magVar) ? p.magVar : null };
}

export function normalizeData(raw) {
  const base = emptyData();
  if (!isObj(raw)) return base;
  const a = isObj(raw.aircraft) ? raw.aircraft : base.aircraft;
  const study = {};
  if (isObj(raw.study)) {
    for (const [exam, s] of Object.entries(raw.study)) {
      if (!isObj(s)) continue;
      const seen = {};
      for (const [qid, r] of Object.entries(isObj(s.seen) ? s.seen : {})) {
        if (isObj(r)) seen[qid] = { right: num(r.right, 0), wrong: num(r.wrong, 0), last: r.last === true };
      }
      study[exam] = {
        seen,
        exams: (Array.isArray(s.exams) ? s.exams : []).filter(isObj).slice(-30).map(e => ({ at: String(e.at ?? ""), score: num(e.score, 0), total: num(e.total, 0), seconds: num(e.seconds, 0) })),
      };
    }
  }
  return {
    ...base,
    aircraft: {
      id: typeof a.id === "string" ? a.id : "custom",
      name: typeof a.name === "string" ? a.name.slice(0, 40) : base.aircraft.name,
      tas: Math.min(600, Math.max(40, num(a.tas, base.aircraft.tas))),
      gph: Math.min(400, Math.max(1, num(a.gph, base.aircraft.gph))),
      usableGal: Math.min(5000, Math.max(5, num(a.usableGal, base.aircraft.usableGal))),
      taxiGal: Math.min(50, Math.max(0, num(a.taxiGal, base.aircraft.taxiGal))),
    },
    home: cleanPoint(raw.home),
    route: (Array.isArray(raw.route) ? raw.route : []).map(cleanPoint).filter(Boolean).slice(0, 12),
    altitudeFt: Math.min(45000, Math.max(1000, num(raw.altitudeFt, base.altitudeFt))),
    departAt: typeof raw.departAt === "string" && !Number.isNaN(Date.parse(raw.departAt)) ? raw.departAt : null,
    night: raw.night === true,
    flights: (Array.isArray(raw.flights) ? raw.flights : [])
      .filter(isObj)
      .map(f => ({
        id: String(f.id ?? ""),
        title: String(f.title ?? "").slice(0, 80),
        route: (Array.isArray(f.route) ? f.route : []).map(cleanPoint).filter(Boolean),
        altitudeFt: num(f.altitudeFt, 5500),
        departAt: typeof f.departAt === "string" ? f.departAt : null,
        minutes: num(f.minutes, null),
        createdAt: String(f.createdAt ?? ""),
      }))
      .filter(f => f.id && f.route.length >= 2)
      .slice(0, 50),
    study,
    goal: typeof raw.goal === "string" ? raw.goal : null,
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

/** Record an answer. */
export function recordAnswer(study, examId, qid, right) {
  const s = study[examId] ?? { seen: {}, exams: [] };
  const r = s.seen[qid] ?? { right: 0, wrong: 0, last: false };
  return { ...study, [examId]: { ...s, seen: { ...s.seen, [qid]: { right: r.right + (right ? 1 : 0), wrong: r.wrong + (right ? 0 : 1), last: right } } } };
}

export function recordExam(study, examId, result) {
  const s = study[examId] ?? { seen: {}, exams: [] };
  return { ...study, [examId]: { ...s, exams: [...s.exams, result].slice(-30) } };
}

/** How far along you are on an exam's bank: { seen, mastered, missed, total }. */
export function progressFor(study, examId, questionIds) {
  const seen = study[examId]?.seen ?? {};
  let s = 0;
  let mastered = 0;
  let missed = 0;
  for (const id of questionIds) {
    const r = seen[id];
    if (!r) continue;
    s += 1;
    if (r.last) mastered += 1;
    else missed += 1;
  }
  return { seen: s, mastered, missed, total: questionIds.length };
}
