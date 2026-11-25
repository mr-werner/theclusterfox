// Reading finished workouts from watches and apps: FIT (what Garmin, Coros,
// Wahoo, Polar, Suunto and Concept2 save), TCX and GPX, also inside a .zip
// (Garmin Connect's "Export original") or gzipped (Strava's bulk export).
//
// Every reader returns the same shape, so the Log treats them alike:
//   { name, type, start (ms), sec, meters, hrAvg, hrMax, powerAvg,
//     points: [{ lat, lon, t, seg, ele?, hr? }]   (only fixes with a position)
//     samples: [{ t, d }]                          (distance over time, for splits) }
// An indoor row has no points but still has samples from the machine.

import { parseGpx, trackDistance, movingSeconds, guessSport, splits as splitList, compact, downsample } from "./geo.js";
import { allSessions } from "./plan.js";
import { toIsoDay } from "./units.js";
import { SPORTS } from "../data/events.js";

const FIT_EPOCH = 631065600; // 1989-12-31T00:00:00Z in Unix seconds
const SEMI = 180 / 2 ** 31;

// FIT sport numbers worth telling apart.
const FIT_SPORT = { 1: "running", 2: "cycling", 11: "walking", 15: "rowing", 17: "hiking", 19: "paddling", 37: "stand_up_paddleboarding", 41: "kayaking" };

/** Read a FIT file (an ArrayBuffer or Uint8Array). */
export function parseFit(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14) throw new Error("That FIT file is empty.");
  const headerSize = v.getUint8(0);
  const sig = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (sig !== ".FIT") throw new Error("That isn't a FIT file.");
  const dataEnd = Math.min(bytes.length, headerSize + v.getUint32(4, true));

  const defs = {};
  let o = headerSize;
  let lastTs = 0;
  const records = [];
  const sessions = [];
  const laps = [];
  let fileSport = null;

  const read = (off, size, base, little) => {
    // Base types: 0x00 enum, 0x01 sint8, 0x02 uint8, 0x83 sint16, 0x84 uint16,
    // 0x85 sint32, 0x86 uint32, 0x88 float32, 0x8B uint16z, 0x8C uint32z, 0x0A uint8z.
    const t = base & 0x1f;
    if (size === 1) {
      const x = t === 1 ? v.getInt8(off) : v.getUint8(off);
      return (t === 1 && x === 0x7f) || (t !== 1 && x === 0xff) || (t === 0x0a && x === 0) ? null : x;
    }
    if (size === 2) {
      const signed = t === 3;
      const x = signed ? v.getInt16(off, little) : v.getUint16(off, little);
      return (signed && x === 0x7fff) || (!signed && x === 0xffff) || (t === 0x0b && x === 0) ? null : x;
    }
    if (size === 4) {
      if (t === 8) {
        const f = v.getFloat32(off, little);
        return Number.isFinite(f) ? f : null;
      }
      const signed = t === 5;
      const x = signed ? v.getInt32(off, little) : v.getUint32(off, little);
      return (signed && x === 0x7fffffff) || (!signed && x === 0xffffffff) || (t === 0x0c && x === 0) ? null : x;
    }
    return null; // strings and arrays aren't needed here
  };

  while (o < dataEnd) {
    const h = v.getUint8(o);
    o += 1;
    if (h & 0x80) {
      // Compressed timestamp header: a data message with a 5-bit time offset.
      const local = (h >> 5) & 0x03;
      const offset = h & 0x1f;
      let ts = (lastTs & ~0x1f) + offset;
      if (offset < (lastTs & 0x1f)) ts += 0x20;
      lastTs = ts;
      o = dataMessage(defs[local], o, ts);
      continue;
    }
    const local = h & 0x0f;
    if (h & 0x40) {
      // Definition message.
      const little = v.getUint8(o + 1) === 0;
      const global = v.getUint16(o + 2, little);
      const n = v.getUint8(o + 4);
      o += 5;
      const fields = [];
      for (let i = 0; i < n; i += 1) {
        fields.push({ num: v.getUint8(o), size: v.getUint8(o + 1), base: v.getUint8(o + 2) });
        o += 3;
      }
      let devSize = 0;
      if (h & 0x20) {
        const nd = v.getUint8(o);
        o += 1;
        for (let i = 0; i < nd; i += 1) {
          devSize += v.getUint8(o + 1);
          o += 3;
        }
      }
      defs[local] = { global, little, fields, devSize };
    } else {
      o = dataMessage(defs[local], o, null);
    }
  }

  function dataMessage(def, at, compressedTs) {
    if (!def) throw new Error("That FIT file is damaged.");
    const f = {};
    let p = at;
    for (const fd of def.fields) {
      if (p + fd.size > bytes.length) throw new Error("That FIT file is cut short.");
      f[fd.num] = read(p, fd.size, fd.base, def.little);
      p += fd.size;
    }
    p += def.devSize;
    if (f[253] != null) lastTs = f[253];
    const ts = f[253] ?? compressedTs;
    const ms = ts != null ? (ts + FIT_EPOCH) * 1000 : null;
    if (def.global === 20 && ms != null) {
      const speed = f[73] ?? f[6];
      records.push({
        t: ms,
        lat: f[0] != null ? f[0] * SEMI : null,
        lon: f[1] != null ? f[1] * SEMI : null,
        ele: f[78] != null ? f[78] / 5 - 500 : f[2] != null ? f[2] / 5 - 500 : null,
        hr: f[3] ?? null,
        d: f[5] != null ? f[5] / 100 : null,
        speed: speed != null ? speed / 1000 : null,
        power: f[7] ?? null,
      });
    } else if (def.global === 18) {
      sessions.push({ start: f[2] != null ? (f[2] + FIT_EPOCH) * 1000 : null, sport: f[5], sub: f[6], elapsed: f[7] != null ? f[7] / 1000 : null, timer: f[8] != null ? f[8] / 1000 : null, dist: f[9] != null ? f[9] / 100 : null, hrAvg: f[16], hrMax: f[17], powerAvg: f[20] });
    } else if (def.global === 19) {
      laps.push({ timer: f[8] != null ? f[8] / 1000 : null, dist: f[9] != null ? f[9] / 100 : null });
    } else if (def.global === 12 && f[0] != null) {
      fileSport = f[0];
    }
    return p;
  }

  if (!records.length && !sessions.length) throw new Error("No workout data in that FIT file.");
  records.sort((a, b) => a.t - b.t);
  const s = sessions[0] ?? {};
  const sportNum = s.sport ?? fileSport;
  const type = FIT_SPORT[sportNum] ?? (s.sub === 14 ? "rowing" : "");
  return finish({
    name: null,
    type,
    start: s.start ?? records[0]?.t,
    sec: s.timer ?? s.elapsed ?? (laps.length ? laps.reduce((n, l) => n + (l.timer ?? 0), 0) : null),
    meters: s.dist ?? (laps.length ? laps.reduce((n, l) => n + (l.dist ?? 0), 0) : null),
    hrAvg: s.hrAvg ?? null,
    hrMax: s.hrMax ?? null,
    powerAvg: s.powerAvg ?? null,
    records,
  });
}

/** Read a TCX file (Garmin Training Center XML; Concept2, Polar and others export it). */
export function parseTcx(text, Parser = globalThis.DOMParser) {
  const doc = new Parser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("That file isn't a readable TCX file.");
  const all = (el, name) => Array.from(el.getElementsByTagName("*")).filter(n => n.localName === name || n.nodeName === name || n.nodeName.endsWith(`:${name}`));
  const first = (el, name) => all(el, name)[0] ?? null;
  const numOf = (el, name) => {
    const x = parseFloat(first(el, name)?.textContent);
    return Number.isFinite(x) ? x : null;
  };
  const activity = first(doc, "Activity");
  if (!activity) throw new Error("No workout in that TCX file.");
  const records = [];
  for (const tp of all(activity, "Trackpoint")) {
    const t = Date.parse(first(tp, "Time")?.textContent ?? "");
    if (!Number.isFinite(t)) continue;
    const hrEl = first(tp, "HeartRateBpm");
    records.push({
      t,
      lat: numOf(tp, "LatitudeDegrees"),
      lon: numOf(tp, "LongitudeDegrees"),
      ele: numOf(tp, "AltitudeMeters"),
      hr: hrEl ? numOf(hrEl, "Value") : null,
      d: numOf(tp, "DistanceMeters"),
      speed: numOf(tp, "Speed"),
      power: numOf(tp, "Watts"),
    });
  }
  const laps = all(activity, "Lap");
  const lapNum = name => {
    const vals = laps.map(l => {
      const el = Array.from(l.children).find(c => c.localName === name);
      const x = parseFloat(el?.textContent);
      return Number.isFinite(x) ? x : null;
    });
    return vals.some(x => x != null) ? vals.reduce((n, x) => n + (x ?? 0), 0) : null;
  };
  const lapStart = laps[0] ? Date.parse(laps[0].getAttribute("StartTime") ?? "") : NaN;
  const idTime = Date.parse(first(activity, "Id")?.textContent ?? "");
  records.sort((a, b) => a.t - b.t);
  if (!records.length && !laps.length) throw new Error("No workout data in that TCX file.");
  return finish({
    name: first(activity, "Notes")?.textContent?.trim().slice(0, 80) || null,
    type: (activity.getAttribute("Sport") ?? "").toLowerCase(),
    start: Number.isFinite(lapStart) ? lapStart : Number.isFinite(idTime) ? idTime : records[0]?.t,
    sec: lapNum("TotalTimeSeconds"),
    meters: lapNum("DistanceMeters"),
    hrAvg: null,
    hrMax: null,
    powerAvg: null,
    records,
  });
}

/** Fill in what the file didn't say from its samples. */
function finish(f) {
  const recs = f.records;
  const points = [];
  let seg = 0;
  for (let i = 0; i < recs.length; i += 1) {
    const r = recs[i];
    if (i > 0 && r.t - recs[i - 1].t > 5 * 60 * 1000) seg += 1; // a long gap is a pause
    if (Number.isFinite(r.lat) && Number.isFinite(r.lon) && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180 && (r.lat !== 0 || r.lon !== 0)) {
      points.push({ lat: r.lat, lon: r.lon, t: r.t, seg, ...(Number.isFinite(r.ele) ? { ele: r.ele } : {}), ...(r.hr > 0 ? { hr: r.hr } : {}) });
    }
  }
  const samples = recs.filter(r => Number.isFinite(r.d)).map(r => ({ t: r.t, d: r.d }));
  const hrs = recs.map(r => r.hr).filter(h => h > 30 && h < 240);
  const watts = recs.map(r => r.power).filter(w => Number.isFinite(w) && w >= 0 && w < 2500);
  const span = recs.length > 1 ? (recs.at(-1).t - recs[0].t) / 1000 : 0;
  const meters = f.meters ?? (samples.length ? samples.at(-1).d - samples[0].d : points.length > 1 ? trackDistance(points) : 0);
  const sec = f.sec ?? (points.length > 1 ? movingSeconds(points) || span : span);
  if (!f.start || !Number.isFinite(f.start)) throw new Error("That file has no start time.");
  return {
    name: f.name,
    type: f.type,
    start: f.start,
    sec,
    meters,
    hrAvg: f.hrAvg ?? (hrs.length ? Math.round(hrs.reduce((n, h) => n + h, 0) / hrs.length) : null),
    hrMax: f.hrMax ?? (hrs.length ? Math.max(...hrs) : null),
    powerAvg: f.powerAvg ?? (watts.length ? Math.round(watts.reduce((n, w) => n + w, 0) / watts.length) : null),
    points,
    samples,
  };
}

/** GPX through the same shape. */
export function parseGpxFile(text, Parser) {
  const g = parseGpx(text, Parser);
  const recs = g.points.map(p => ({ ...p, d: null, speed: null, power: null }));
  const pts = g.points;
  const meters = trackDistance(pts);
  return { ...finish({ name: g.name, type: g.type, start: pts[0].t, sec: movingSeconds(pts) || (pts.at(-1).t - pts[0].t) / 1000, meters, hrAvg: null, hrMax: null, powerAvg: null, records: recs }), points: pts };
}

/** Seconds for each full split (500 m, km or mile) from distance samples. */
export function sampleSplits(samples, unitM) {
  const out = [];
  if (!samples?.length) return out;
  let next = unitM;
  let lastT = samples[0].t;
  const d0 = samples[0].d;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    while (b.d - d0 >= next && b.d > a.d) {
      const f = (next + d0 - a.d) / (b.d - a.d);
      const t = a.t + f * (b.t - a.t);
      out.push((t - lastT) / 1000);
      lastT = t;
      next += unitM;
    }
  }
  return out;
}

// ---- Archives ----------------------------------------------------------------

async function inflate(bytes, format) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser can't open compressed files. Unzip it first and pick the file inside.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The activity files in a .zip: [{ name, bytes }]. Reads the central directory. */
export async function unzip(bytes, want = /\.(fit|tcx|gpx)(\.gz)?$/i) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i -= 1) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That zip file is damaged.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out = [];
  const dec = new TextDecoder();
  for (let i = 0; i < count && p + 46 <= bytes.length; i += 1) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!want.test(name) || name.startsWith("__MACOSX")) continue;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + csize);
    if (method === 0) out.push({ name, bytes: data });
    else if (method === 8) out.push({ name, bytes: await inflate(data, "deflate-raw") });
  }
  return out;
}

/**
 * Read one picked file into workouts. A zip can hold many.
 * Returns [{ fileName, workout }] or throws for an unreadable file.
 */
export async function readActivityFile(name, bytes, Parser) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) {
    const files = await unzip(bytes);
    if (!files.length) throw new Error("No FIT, TCX or GPX files inside that zip.");
    const out = [];
    for (const f of files) {
      try {
        out.push(...(await readActivityFile(f.name, f.bytes, Parser)));
      } catch {
        // Skip files in the zip that aren't workouts.
      }
    }
    return out;
  }
  if (lower.endsWith(".gz")) return readActivityFile(name.slice(0, -3), await inflate(bytes, "gzip"), Parser);
  const isFit = lower.endsWith(".fit") || (bytes.length > 12 && String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === ".FIT");
  if (isFit) return [{ fileName: name, workout: parseFit(bytes) }];
  const text = new TextDecoder().decode(bytes);
  if (lower.endsWith(".tcx") || /<TrainingCenterDatabase/i.test(text.slice(0, 2000))) return [{ fileName: name, workout: parseTcx(text, Parser) }];
  return [{ fileName: name, workout: parseGpxFile(text, Parser) }];
}

// ---- Into the log ------------------------------------------------------------

/**
 * Turn a read workout into a log activity and its route. If a plan has a
 * session of the same sport that day that isn't done yet, the workout
 * counts for it, the same as recording it in PaceFox would.
 */
export function importedActivity(w, { unit = "mi", plans = [] } = {}) {
  const sport = guessSport(w.type ?? "", w.meters / Math.max(1, w.sec));
  const unitM = sport === "row" ? 500 : unit === "km" ? 1000 : 1609.344;
  const pts = w.points.map(compact);
  const splits = pts.length > 1 ? splitList(pts, unitM).map(s => s.sec) : sampleSplits(w.samples, unitM);
  const day = toIsoDay(w.start);
  let planId = null;
  let sessionId = null;
  for (const plan of plans) {
    if (plan.sport !== sport) continue;
    const s = allSessions(plan).find(x => x.day === day && !plan.completed?.[x.id]);
    if (s) {
      planId = plan.id;
      sessionId = s.id;
      break;
    }
  }
  const activity = {
    id: `g${Math.round(w.start).toString(36)}`,
    sport,
    title: w.name || `${SPORTS[sport].name} from your watch`,
    start: new Date(w.start).toISOString(),
    day,
    sec: w.sec,
    meters: w.meters,
    hrAvg: w.hrAvg,
    hrMax: w.hrMax,
    powerAvg: w.powerAvg,
    source: "watch",
    planId,
    sessionId,
    splits,
    splitUnit: splits.length ? (sport === "row" ? "500m" : unit) : null,
  };
  return { activity, track: pts.length > 1 ? downsample(pts, 600) : null };
}
