// Fan and duct system: the critical path from fan to the farthest outlet as a
// list of duct runs, fittings and components. Everything is SI (m, m³/s, Pa).
//
// Duct friction is Darcy–Weisbach with Colebrook friction factors on the
// hydraulic diameter, which is how the ASHRAE duct design method works.
// Fitting losses are C × velocity pressure. Air density comes from the site
// elevation (standard atmosphere pressure), temperature and humidity.

import { frictionFactor, bisect } from "./math.js";
import { standardAtmosphere, psychrometrics } from "./air.js";

export const STD_RHO = 1.2041; // kg/m³, standard air (20 °C, 101.325 kPa, dry); 0.075 lb/ft³

/** Absolute roughness of duct materials, m. */
export const DUCT_MATERIALS = [
  { id: "g", label: "Galvanized steel", eps: 0.09e-3 },
  { id: "s", label: "Smooth (PVC, aluminum, stainless)", eps: 0.03e-3 },
  { id: "b", label: "Fibrous glass duct board", eps: 0.9e-3 },
  { id: "l", label: "Lined with fibrous liner", eps: 1.5e-3 },
  { id: "f", label: "Flexible duct, fully stretched", eps: 3.0e-3 },
  { id: "c", label: "Concrete or masonry", eps: 1.3e-3 },
];
export const materialById = Object.fromEntries(DUCT_MATERIALS.map((m) => [m.id, m]));

/**
 * Fitting loss coefficients (C, on the velocity pressure in the duct the fitting
 * sits on: the duct before it, or the duct after it for branch takeoffs,
 * entries and contractions). These are typical mid-range values for a first pass. For final
 * design, use the coefficient for your exact fitting geometry and flow split.
 */
export const FITTINGS = [
  { id: "el90r", label: "90° elbow, round, smooth radius (R/D 1.5)", C: 0.15 },
  { id: "el90g5", label: "90° elbow, round, 5-piece gored", C: 0.2 },
  { id: "el90g3", label: "90° elbow, round, 3-piece gored", C: 0.35 },
  { id: "el45r", label: "45° elbow, round", C: 0.1 },
  { id: "el90rr", label: "90° elbow, rectangular, radius (R/W 1)", C: 0.22 },
  { id: "el90mv", label: "90° elbow, mitered with turning vanes", C: 0.25 },
  { id: "el90m", label: "90° elbow, mitered, no vanes", C: 1.2 },
  { id: "flex90", label: "90° bend in flexible duct", C: 0.8 },
  { id: "teeS", label: "Tee or wye, straight through main", C: 0.2 },
  { id: "teeB", label: "Tee, into the branch (square takeoff)", C: 1.0, ref: "next" },
  { id: "wyeB", label: "45° wye or conical tap, into the branch", C: 0.4, ref: "next" },
  { id: "red", label: "Reducer or transition, gradual", C: 0.1 },
  { id: "exp", label: "Sudden enlargement", C: 0.6 },
  { id: "con", label: "Sudden contraction", C: 0.35, ref: "next" },
  { id: "entB", label: "Entry from plenum, bellmouth", C: 0.05, ref: "next" },
  { id: "entP", label: "Entry from plenum, plain", C: 0.5, ref: "next" },
  { id: "exit", label: "Exit into room or plenum (lost velocity)", C: 1.0 },
  { id: "damp", label: "Balancing damper, wide open", C: 0.2 },
  { id: "fire", label: "Fire damper, open (curtain type)", C: 0.2 },
  { id: "custom", label: "Other (type your own C)", C: 0.5 },
];
export const fittingById = Object.fromEntries(FITTINGS.map((f) => [f.id, f]));

/** Components with a fixed pressure drop. Defaults are typical design allowances. */
export const COMPONENTS = [
  { id: "filt", label: "Filter (MERV 8, mid-life)", dp: 100 },
  { id: "filt13", label: "Filter (MERV 13, mid-life)", dp: 150 },
  { id: "ccoil", label: "Cooling coil (wet)", dp: 150 },
  { id: "hcoil", label: "Heating coil", dp: 40 },
  { id: "vav", label: "VAV or terminal box", dp: 100 },
  { id: "diff", label: "Supply diffuser or register", dp: 25 },
  { id: "grille", label: "Return or exhaust grille", dp: 15 },
  { id: "louv", label: "Outdoor air louver", dp: 40 },
  { id: "att", label: "Sound attenuator", dp: 50 },
  { id: "hood", label: "Wall cap or roof hood", dp: 30 },
  { id: "other", label: "Other component", dp: 50 },
];
export const componentById = Object.fromEntries(COMPONENTS.map((c) => [c.id, c]));

// Standard round duct sizes, m (inch sizes, then common metric sizes).
const ROUND_IN = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 54, 60];
const ROUND_MM = [80, 100, 125, 160, 200, 250, 315, 355, 400, 450, 500, 560, 630, 710, 800, 900, 1000, 1120, 1250, 1400, 1600];
export const roundSizes = (system) => (system === "us" ? ROUND_IN.map((d) => d * 0.0254) : ROUND_MM.map((d) => d / 1000));

// ---- Model text: items split by ";", fields by ",". -----------------------
// duct, round:        d,r,D,L,mat[,Q]
// duct, rectangular:  d,x,a,b,L,mat[,Q]
// fitting:            f,type,count[,C]
// component:          c,type,dp
const num = (s) => (s === undefined || s === "" ? undefined : Number(s));

export function parseSystem(text) {
  const items = [];
  for (const raw of String(text || "").split(";")) {
    const p = raw.trim().split(",");
    if (p[0] === "d" && p[1] === "r") {
      const it = { kind: "duct", shape: "round", D: num(p[2]), L: num(p[3]), mat: materialById[p[4]] ? p[4] : "g", Q: num(p[5]) };
      if (it.D > 0 && it.L >= 0) items.push(it);
    } else if (p[0] === "d" && p[1] === "x") {
      const it = { kind: "duct", shape: "rect", a: num(p[2]), b: num(p[3]), L: num(p[4]), mat: materialById[p[5]] ? p[5] : "g", Q: num(p[6]) };
      if (it.a > 0 && it.b > 0 && it.L >= 0) items.push(it);
    } else if (p[0] === "f" && fittingById[p[1]]) {
      items.push({ kind: "fit", type: p[1], n: Math.max(1, Math.round(num(p[2]) || 1)), C: num(p[3]) });
    } else if (p[0] === "c" && componentById[p[1]]) {
      const dp = num(p[2]);
      items.push({ kind: "comp", type: p[1], dp: Number.isFinite(dp) ? dp : componentById[p[1]].dp });
    }
  }
  return items;
}

const g = (x) => (x === undefined || !Number.isFinite(x) ? "" : String(Number(x.toPrecision(6))));

export function stringifySystem(items) {
  return items
    .map((it) => {
      if (it.kind === "duct") {
        const head = it.shape === "rect" ? ["d", "x", g(it.a), g(it.b)] : ["d", "r", g(it.D)];
        const parts = [...head, g(it.L), it.mat];
        if (Number.isFinite(it.Q) && it.Q > 0) parts.push(g(it.Q));
        return parts.join(",");
      }
      if (it.kind === "fit") return ["f", it.type, it.n, ...(Number.isFinite(it.C) ? [g(it.C)] : [])].join(",");
      return ["c", it.type, g(it.dp)].join(",");
    })
    .join(";");
}

// ---- Air and duct physics -------------------------------------------------

/** Moist air at a site: elevation z (m), dry-bulb T (K), relative humidity 0–1. */
export function siteAir(z, T, rh = 0) {
  const p = standardAtmosphere(Math.max(-500, z)).p;
  const rho = psychrometrics(T, Math.min(1, Math.max(0, rh)), p).rho;
  const mu = (1.458e-6 * T ** 1.5) / (T + 110.4);
  return { p, rho, mu, ratio: rho / STD_RHO };
}

/** Flow area and hydraulic diameter of a duct. */
export function ductGeometry(it) {
  if (it.shape === "rect") return { A: it.a * it.b, Dh: (2 * it.a * it.b) / (it.a + it.b) };
  return { A: (Math.PI * it.D * it.D) / 4, Dh: it.D };
}

/** Pressure loss of straight duct, Pa, plus velocity and friction rate. */
export function ductLoss(it, Q, air) {
  const { A, Dh } = ductGeometry(it);
  const v = Q / A;
  const Re = (air.rho * v * Dh) / air.mu;
  const f = frictionFactor(Re, materialById[it.mat].eps / Dh);
  const rate = Q > 0 ? (f / Dh) * ((air.rho * v * v) / 2) : 0; // Pa per m
  return { v, Re, f, rate, pv: (air.rho * v * v) / 2, dp: rate * it.L };
}

/**
 * Pressure loss of the whole path at fan airflow Qfan.
 * Ducts with their own airflow scale with the fan (a branch keeps its share).
 * Fittings use the velocity of the duct before them (after them for branch
 * takeoffs, entries and contractions), falling back to the other side.
 * Components scale with flow squared from their design drop.
 */
export function solveSystem(items, Qd, air, Qfan = Qd) {
  const scale = Qd > 0 ? Qfan / Qd : 0;
  const ducts = items.map((it) => (it.kind === "duct" ? it : null));
  const rows = [];
  let last = null;
  const nextDuct = (i) => ducts.slice(i + 1).find(Boolean) || null;
  let duct = 0, fit = 0, comp = 0;
  items.forEach((it, i) => {
    if (it.kind === "duct") {
      const Q = (Number.isFinite(it.Q) && it.Q > 0 ? it.Q : Qd) * scale;
      const r = ductLoss(it, Q, air);
      last = { it, Q, v: r.v, pv: r.pv };
      duct += r.dp;
      rows.push({ i, kind: "duct", Q, ...r });
    } else if (it.kind === "fit") {
      const ref = fittingById[it.type].ref === "next" ? "next" : "prev";
      const viaNext = () => {
        const d = nextDuct(i);
        if (!d) return null;
        const Q = (Number.isFinite(d.Q) && d.Q > 0 ? d.Q : Qd) * scale;
        const r = ductLoss(d, Q, air);
        return { Q, v: r.v, pv: r.pv };
      };
      const host = ref === "next" ? viaNext() || last : last || viaNext();
      const C = Number.isFinite(it.C) ? it.C : fittingById[it.type].C;
      const dp = host ? C * it.n * host.pv : 0;
      fit += dp;
      rows.push({ i, kind: "fit", C, v: host?.v ?? NaN, pv: host?.pv ?? NaN, dp, orphan: !host });
    } else {
      const dp = it.dp * scale * scale;
      comp += dp;
      rows.push({ i, kind: "comp", dp });
    }
  });
  return { rows, duct, fit, comp, total: duct + fit + comp };
}

/** System curve points from 0 to `upTo` × design airflow. */
export function systemCurve(items, Qd, air, upTo = 1.5, n = 31) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const Q = (Qd * upTo * k) / (n - 1);
    pts.push({ x: Q, y: k === 0 ? 0 : solveSystem(items, Qd, air, Q).total });
  }
  return pts;
}

/**
 * A simple fan curve through shutoff pressure P0 (at Q = 0), the rated point
 * (Qr, Pr) and free delivery Qmax: P = P0 (1 − (Q/Qmax)^k), with the exponent
 * k fitted so the curve passes the rated point. All at standard air; `ratio`
 * scales pressure to the actual density.
 */
export function fanCurve({ P0, Qmax, Qr, Pr }, ratio = 1) {
  let k = 2;
  if (Qr > 0 && Qr < Qmax && Pr > 0 && Pr < P0) k = Math.log(1 - Pr / P0) / Math.log(Qr / Qmax);
  const P = (Q) => (Q >= Qmax ? 0 : ratio * P0 * (1 - (Q / Qmax) ** k));
  return { P, k };
}

/** Where the fan curve meets the system curve. Returns { Q, P } or null. */
export function operatingPoint(fanP, items, Qd, air, Qmax) {
  const f = (Q) => fanP(Q) - solveSystem(items, Qd, air, Q).total;
  if (!(Qmax > 0) || f(Qmax * 1e-6) <= 0 || f(Qmax) >= 0) return null;
  const Q = bisect(f, Qmax * 1e-6, Qmax, Qmax * 1e-9);
  return { Q, P: fanP(Q) };
}

/** Smallest standard round size that keeps friction at or under `maxRate` (Pa/m) and velocity under `maxV`. */
export function sizeRound(Q, air, mat, maxRate, maxV, sizes) {
  for (const D of sizes) {
    const r = ductLoss({ shape: "round", D, L: 1, mat }, Q, air);
    if ((!(maxRate > 0) || r.rate <= maxRate) && (!(maxV > 0) || r.v <= maxV)) return D;
  }
  return sizes[sizes.length - 1];
}

const HP = [0.25, 1 / 3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300];
const KW = [0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];

/** Next standard motor at or above a shaft power (W): { hp, kW } labels. */
export function standardMotor(W) {
  const hp = HP.find((h) => h * 745.7 >= W);
  const kw = KW.find((k) => k * 1000 >= W);
  const hpLabel = hp === undefined ? "over 300 hp" : hp === 1 / 3 ? "1/3 hp" : hp === 0.25 ? "1/4 hp" : hp === 0.5 ? "1/2 hp" : hp === 0.75 ? "3/4 hp" : `${hp} hp`;
  const kwLabel = kw === undefined ? "over 250 kW" : `${kw} kW`;
  return { hp, kw, label: `${hpLabel} (${kwLabel})` };
}
