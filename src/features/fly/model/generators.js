// Practice questions with fresh numbers every time: the calculation
// questions every FAA test has (density altitude, crosswind, wind
// correction, fuel, weight and balance, METAR and winds-aloft decoding).
// Each generator makes a question in the same shape as the static bank.

import { densityAltitude, norm, pad3, pressureAltitude, windTriangle } from "./nav.js";
import { fdCode } from "../../../services/weather/windsAloft.js";

/** A small seeded random generator (mulberry32), so tests can repeat a question. */
export function rng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r, lo, hi, step = 1) => lo + Math.floor(r() * ((hi - lo) / step + 1)) * step;
const pickOne = (r, list) => list[Math.floor(r() * list.length)];

/** Nudge the first number in a label: "14 knots" -> "18 knots". */
function bump(label, k) {
  return label.replace(/-?[\d,]+(\.\d+)?/, m => {
    const n = Number(m.replace(/,/g, ""));
    const dec = (m.split(".")[1] ?? "").length;
    const step = Math.max(1, Math.abs(n) * 0.12);
    const v = n + k * (dec ? Number(step.toFixed(dec)) : Math.round(step));
    return dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US");
  });
}

/** Put the right answer among two different wrong ones, in a random order. */
function shuffle(r, right, wrongs) {
  const picked = [];
  for (const w of wrongs) if (w !== right && !picked.includes(w) && picked.length < 2) picked.push(w);
  for (let k = 1; picked.length < 2 && k < 20; k++) {
    for (const cand of [bump(right, k), bump(right, -k)]) if (cand !== right && !picked.includes(cand) && picked.length < 2) picked.push(cand);
  }
  const choices = [right, ...picked];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices, answer: choices.indexOf(right) };
}

const fmt = n => Math.round(n).toLocaleString("en-US");
const PILOT = ["par", "spa", "cax"];
const CREWED = ["par", "spa", "cax", "ira"];

export const GENERATORS = [
  {
    id: "g-da",
    exams: [...PILOT, "uag"],
    topic: "performance",
    make(r) {
      const elev = int(r, 0, 7000, 100);
      const altim = int(r, 2950, 3040) / 100;
      const temp = int(r, 0, 38);
      const da = Math.round(densityAltitude(elev, altim, temp) / 100) * 100;
      const pa = pressureAltitude(elev, altim);
      const { choices, answer } = shuffle(r, `${fmt(da)} ft`, [`${fmt(Math.round(pa / 100) * 100)} ft`, `${fmt(da + int(r, 9, 20) * 100)} ft`]);
      return {
        text: `Field elevation ${fmt(elev)} ft, altimeter ${altim.toFixed(2)}, temperature ${temp} °C. What's the density altitude, to the nearest 100 ft?`,
        choices,
        answer,
        why: `Pressure altitude = ${fmt(elev)} + (29.92 − ${altim.toFixed(2)}) × 1,000 = ${fmt(pa)} ft. Standard temperature there is ${(15 - (2 * pa) / 1000).toFixed(1)} °C, so density altitude ≈ ${fmt(pa)} + 120 × (${temp} − ${(15 - (2 * pa) / 1000).toFixed(1)}) ≈ ${fmt(da)} ft.`,
        ref: "PHAK ch. 11",
      };
    },
  },
  {
    id: "g-xwind",
    exams: [...PILOT, "ira"],
    topic: "performance",
    make(r) {
      const rwy = int(r, 1, 36);
      const angle = pickOne(r, [20, 30, 40, 45, 50, 60, 70]) * (r() < 0.5 ? -1 : 1);
      const dir = norm(rwy * 10 + angle);
      const kt = int(r, 8, 28);
      const cross = Math.round(Math.abs(kt * Math.sin((angle * Math.PI) / 180)));
      const head = Math.round(kt * Math.cos((angle * Math.PI) / 180));
      const { choices, answer } = shuffle(r, `${cross} knots`, [`${head} knots`, `${kt} knots`].filter(w => w !== `${cross} knots`).concat([`${cross + 4} knots`]).slice(0, 2));
      return {
        text: `Landing on runway ${String(rwy).padStart(2, "0")} with the wind ${pad3(dir)}° at ${kt} knots. What's the crosswind component?`,
        choices,
        answer,
        why: `The wind is ${Math.abs(angle)}° off the runway. Crosswind = ${kt} × sin ${Math.abs(angle)}° ≈ ${cross} knots (headwind ${kt} × cos ${Math.abs(angle)}° ≈ ${head}).`,
        ref: "PHAK ch. 11",
      };
    },
  },
  {
    id: "g-wca",
    exams: CREWED,
    topic: "nav",
    make(r) {
      const tc = int(r, 1, 36) * 10;
      const tas = int(r, 9, 16) * 10;
      const wdir = int(r, 1, 36) * 10;
      const wkt = int(r, 10, 35);
      const t = windTriangle(tc, tas, { dir: wdir, kt: wkt });
      const hdg = Math.round(t.heading);
      const gs = Math.round(t.gs);
      const wrongHdg = Math.round(norm(tc - (hdg - tc)));
      const { choices, answer } = shuffle(r, `Heading ${pad3(hdg)}°, groundspeed ${gs} kt`, [
        `Heading ${pad3(wrongHdg)}°, groundspeed ${gs} kt`,
        `Heading ${pad3(hdg)}°, groundspeed ${Math.round(2 * tas - gs)} kt`,
      ]);
      return {
        text: `True course ${pad3(tc)}°, true airspeed ${tas} knots, wind ${pad3(wdir)}° at ${wkt} knots. What true heading and groundspeed?`,
        choices,
        answer,
        why: `Wind correction angle = asin(${wkt} × sin(${wdir} − ${tc}) ÷ ${tas}) ≈ ${t.wca >= 0 ? "+" : ""}${t.wca.toFixed(0)}°, toward the wind. Groundspeed = TAS × cos(WCA) − wind × cos(wind angle) ≈ ${gs} knots. An E6B gives the same.`,
        ref: "PHAK ch. 16",
      };
    },
  },
  {
    id: "g-fuel",
    exams: CREWED,
    topic: "regs",
    make(r) {
      const dist = int(r, 90, 400, 10);
      const gs = int(r, 95, 150, 5);
      const gph = int(r, 6, 14) + (r() < 0.5 ? 0.5 : 0);
      const night = r() < 0.5;
      const reserve = night ? 45 : 30;
      const total = (dist / gs + reserve / 60) * gph;
      const right = `${total.toFixed(1)} gal`;
      const { choices, answer } = shuffle(r, right, [`${((dist / gs) * gph).toFixed(1)} gal`, `${((dist / gs + (night ? 30 : 45) / 60) * gph).toFixed(1)} gal`]);
      return {
        text: `A ${night ? "night" : "day"} VFR flight of ${dist} nm at ${gs} knots groundspeed, burning ${gph} gallons an hour. What's the minimum fuel, including the required reserve?`,
        choices,
        answer,
        why: `Flight time ${(dist / gs).toFixed(2)} h plus a ${reserve}-minute ${night ? "night" : "day"} reserve = ${(dist / gs + reserve / 60).toFixed(2)} h × ${gph} gph ≈ ${total.toFixed(1)} gallons.`,
        ref: "14 CFR 91.151",
      };
    },
  },
  {
    id: "g-cg",
    exams: [...PILOT, "uag"],
    topic: "performance",
    make(r) {
      const empty = { w: int(r, 1350, 1700, 10), arm: int(r, 380, 420) / 10 };
      const front = { w: int(r, 260, 400, 5), arm: 37 };
      const rear = { w: int(r, 0, 300, 5), arm: 73 };
      const fuelGal = int(r, 20, 50);
      const fuel = { w: fuelGal * 6, arm: 48 };
      const items = [empty, front, rear, fuel];
      const W = items.reduce((s, i) => s + i.w, 0);
      const M = items.reduce((s, i) => s + i.w * i.arm, 0);
      const cg = M / W;
      const { choices, answer } = shuffle(r, `${cg.toFixed(1)} in`, [`${(cg - int(r, 15, 30) / 10).toFixed(1)} in`, `${(cg + int(r, 15, 30) / 10).toFixed(1)} in`]);
      return {
        text: `Empty weight ${fmt(empty.w)} lb at ${empty.arm} in; front seats ${front.w} lb at 37 in; rear seat ${rear.w} lb at 73 in; ${fuelGal} gal of avgas at 48 in. Where is the CG?`,
        choices,
        answer,
        why: `Fuel: ${fuelGal} × 6 = ${fuel.w} lb. Total weight ${fmt(W)} lb, total moment ${fmt(M)} lb-in. CG = ${fmt(M)} ÷ ${fmt(W)} ≈ ${cg.toFixed(1)} in aft of datum.`,
        ref: "Weight & Balance Handbook",
      };
    },
  },
  {
    id: "g-metar",
    exams: [...CREWED, "uag"],
    topic: "weather",
    make(r) {
      const kinds = [
        { cover: "BKN", base: int(r, 2, 9), vis: pickOne(r, ["1/2", "3/4", "1 1/2", "2"]) },
        { cover: "OVC", base: int(r, 10, 30), vis: pickOne(r, ["3", "4", "5"]) },
        { cover: "BKN", base: int(r, 35, 80), vis: "10" },
        { cover: "OVC", base: int(r, 3, 4), vis: pickOne(r, ["1/4", "1/2"]) },
      ];
      const k = pickOne(r, kinds);
      const visNum = k.vis.split(" ").reduce((s, p) => s + (p.includes("/") ? Number(p.split("/")[0]) / Number(p.split("/")[1]) : Number(p)), 0);
      const ceil = k.base * 100;
      const cat = ceil < 500 || visNum < 1 ? "LIFR" : ceil < 1000 || visNum < 3 ? "IFR" : ceil <= 3000 || visNum <= 5 ? "MVFR" : "VFR";
      const station = pickOne(r, ["KAUS", "KBOS", "KSEA", "KDEN", "KORD", "KATL", "KPHX", "KMSP"]);
      const dir = int(r, 1, 36) * 10;
      const kt = int(r, 3, 18);
      const low = Math.max(1, Math.floor(k.base / 2));
      const temp = int(r, -5, 28);
      const dew = temp - int(r, 0, 8);
      const wx = visNum < 3 ? pickOne(r, [" BR", " -RA", " FG", " HZ"]) : "";
      const metar = `METAR ${station} ${String(int(r, 1, 28)).padStart(2, "0")}${String(int(r, 0, 23)).padStart(2, "0")}53Z ${pad3(dir)}${String(kt).padStart(2, "0")}KT ${k.vis}SM${wx} FEW${String(low).padStart(3, "0")} ${k.cover}${String(k.base).padStart(3, "0")} ${String(Math.abs(temp)).padStart(2, "0").replace(/^/, temp < 0 ? "M" : "")}/${String(Math.abs(dew)).padStart(2, "0").replace(/^/, dew < 0 ? "M" : "")} A${int(r, 2960, 3040)}`;
      const all = ["VFR", "MVFR", "IFR", "LIFR"];
      const wrongs = all.filter(c => c !== cat);
      const { choices, answer } = shuffle(r, cat, [wrongs[int(r, 0, 2)], wrongs.find((c, i) => i !== int(r, 0, 2)) ?? wrongs[0]].filter((v, i, a) => a.indexOf(v) === i).concat(wrongs).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2));
      return {
        text: `What flight category is this report?\n${metar}`,
        choices,
        answer,
        why: `The ceiling is the lowest broken or overcast layer: ${k.cover}${String(k.base).padStart(3, "0")} = ${fmt(ceil)} ft (the FEW layer doesn't count). Visibility ${k.vis} sm. The lower of the two decides: ${cat}.`,
        ref: "AIM 7-1-29",
        mono: true,
      };
    },
  },
  {
    id: "g-fb",
    exams: CREWED,
    topic: "weather",
    make(r) {
      const alt = pickOne(r, [6000, 9000, 12000, 18000, 24000, 30000, 34000]);
      const dir = int(r, 1, 36) * 10;
      const kt = alt >= 30000 && r() < 0.5 ? int(r, 100, 160) : int(r, 8, 85);
      const temp = Math.round(15 - (2 * alt) / 1000 + int(r, -6, 6));
      const code = fdCode({ dir, speedKt: kt, tempC: temp }, alt);
      const right = `${pad3(dir)}° true at ${kt} knots, ${temp} °C`;
      const naive = kt >= 100 ? `${code.slice(0, 2)}0° true at ${Number(code.slice(2, 4))} knots, ${temp} °C` : `${pad3(norm(dir + 180))}° true at ${kt} knots, ${temp} °C`;
      const { choices, answer } = shuffle(r, right, [naive, `${pad3(dir)}° magnetic at ${kt} knots, ${-temp} °C`]);
      return {
        text: `The winds aloft forecast for ${fmt(alt)} ft reads ${code}. What does it mean?`,
        choices,
        answer,
        why: `${code.slice(0, 2)} is the direction in tens of degrees, ${code.slice(2, 4)} the speed${kt >= 100 ? " — a direction over 36 means subtract 50 and add 100 knots" : ""}, then the temperature${alt > 24000 ? " (above 24,000 ft it's always negative, so the sign is left off)" : ""}. Directions are true.`,
        ref: "AC 00-45",
        mono: true,
      };
    },
  },
  {
    id: "g-tsd",
    exams: CREWED,
    topic: "nav",
    make(r) {
      const gs = int(r, 80, 180, 5);
      const minutes = int(r, 12, 95);
      const dist = Math.round((gs * minutes) / 60);
      const { choices, answer } = shuffle(r, `${minutes} minutes`, [`${Math.round((dist / gs) * 100)} minutes`, `${Math.round(minutes * 1.15)} minutes`].filter(w => w !== `${minutes} minutes`).concat([`${minutes + 9} minutes`]).slice(0, 2));
      return {
        text: `At a groundspeed of ${gs} knots, how long does it take to fly ${dist} nautical miles?`,
        choices,
        answer,
        why: `Time = distance ÷ speed = ${dist} ÷ ${gs} = ${(dist / gs).toFixed(2)} h ≈ ${minutes} minutes.`,
        ref: "PHAK ch. 16",
      };
    },
  },
  {
    id: "g-cruise",
    exams: PILOT,
    topic: "regs",
    make(r) {
      const course = int(r, 1, 359);
      const east = course < 180;
      const right = east ? pickOne(r, ["5,500 ft", "7,500 ft", "9,500 ft"]) : pickOne(r, ["4,500 ft", "6,500 ft", "8,500 ft"]);
      const wrong = east ? ["6,500 ft", "8,000 ft"] : ["5,500 ft", "7,000 ft"];
      const { choices, answer } = shuffle(r, right, wrong);
      return {
        text: `Which is an appropriate VFR cruising altitude for a magnetic course of ${pad3(course)}° more than 3,000 ft above the ground?`,
        choices,
        answer,
        why: `${pad3(course)}° is ${east ? "0–179°: odd thousands plus 500" : "180–359°: even thousands plus 500"}.`,
        ref: "14 CFR 91.159",
      };
    },
  },
  {
    id: "g-cloud",
    exams: [...CREWED, "uag"],
    topic: "weather",
    make(r) {
      const temp = int(r, 8, 34);
      const spread = pickOne(r, [5, 7.5, 10, 12.5, 15]);
      const dew = temp - spread;
      const base = (spread / 2.5) * 1000;
      const { choices, answer } = shuffle(r, `${fmt(base)} ft AGL`, [`${fmt(base / 2)} ft AGL`, `${fmt((spread / 4.4) * 1000)} ft AGL`]);
      return {
        text: `At the surface the temperature is ${temp} °C and the dew point ${dew} °C. About how high is the base of cumulus clouds?`,
        choices,
        answer,
        why: `Spread ${spread} °C ÷ 2.5 °C per 1,000 ft = ${fmt(base)} ft above ground. (The 4.4 rule is for °F.)`,
        ref: "PHAK ch. 12",
      };
    },
  },
  {
    id: "g-stall",
    exams: [...PILOT, "uag"],
    topic: "aero",
    make(r) {
      const vs = int(r, 40, 65);
      const bank = pickOne(r, [30, 45, 60]);
      const lf = 1 / Math.cos((bank * Math.PI) / 180);
      const right = Math.round(vs * Math.sqrt(lf));
      const { choices, answer } = shuffle(r, `${right} knots`, [`${Math.round(vs * lf)} knots`, `${vs} knots`]);
      return {
        text: `An airplane stalls at ${vs} knots in level flight. About what is its stall speed in a level ${bank}° banked turn?`,
        choices,
        answer,
        why: `Load factor at ${bank}° = 1 ÷ cos ${bank}° ≈ ${lf.toFixed(2)} G. Stall speed rises with its square root: ${vs} × ${Math.sqrt(lf).toFixed(2)} ≈ ${right} knots.`,
        ref: "PHAK ch. 5",
      };
    },
  },
];

/** Decode a winds-aloft group like "7319" or "2725-08" back to { dir, kt, tempC }. */
export function decodeFb(code, altFt = 9000) {
  const m = /^(\d{2})(\d{2})([+-]?\d{2})?$/.exec(String(code).trim());
  if (!m) return null;
  let d = Number(m[1]);
  let s = Number(m[2]);
  const t = m[3] ? (/^[+-]/.test(m[3]) ? Number(m[3]) : altFt > 24000 ? -Number(m[3]) : Number(m[3])) : null;
  if (d === 99 && s === 0) return { dir: null, kt: 0, tempC: t };
  if (d > 36) {
    d -= 50;
    s += 100;
  }
  return { dir: d * 10, kt: s, tempC: t };
}

/** A fresh question from a generator, with an id unique to its numbers. */
export function makeQuestion(gen, seed) {
  const r = rng(seed);
  const made = gen.make(r);
  return { id: `${gen.id}#${seed}`, base: gen.id, exams: gen.exams, topic: gen.topic, generated: true, ...made };
}

export const generatorsFor = examId => GENERATORS.filter(g => g.exams.includes(examId));
