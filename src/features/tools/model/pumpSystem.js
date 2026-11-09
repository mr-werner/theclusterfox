// Pump system builder: a supply, suction runs, a pump, discharge runs and a
// destination. Works out NPSH available, total dynamic head, the system curve,
// the pump operating point and the pressure at every joint.
//
// Everything is SI. Elevations are measured from the pump centerline (up is +).

import { G } from "./units.js";
import { frictionFactor, circleArea, interp } from "./math.js";
import { STEEL_PIPE, COPPER_TUBE } from "../data/piping.js";

// Pipe kinds. Plastic pipe to ASTM D1785 has the same OD and wall as steel of the
// same schedule, so it shares the steel table.
export const PIPE_KINDS = [
  { id: "s40", name: "Steel Sch 40", table: "steel", sch: "40", eps: 0.045e-3 },
  { id: "s80", name: "Steel Sch 80", table: "steel", sch: "80", eps: 0.045e-3 },
  { id: "g40", name: "Galvanized Sch 40", table: "steel", sch: "40", eps: 0.15e-3 },
  { id: "r40", name: "Old steel Sch 40 (rusted)", table: "steel", sch: "40", eps: 0.5e-3 },
  { id: "ss40", name: "Stainless Sch 40", table: "steel", sch: "40", eps: 0.015e-3 },
  { id: "p40", name: "PVC Sch 40", table: "steel", sch: "40", eps: 0.0015e-3 },
  { id: "p80", name: "PVC Sch 80", table: "steel", sch: "80", eps: 0.0015e-3 },
  { id: "cuL", name: "Copper Type L", table: "copper", type: "L", eps: 0.0015e-3 },
  { id: "cuK", name: "Copper Type K", table: "copper", type: "K", eps: 0.0015e-3 },
  { id: "custom", name: "Custom (type the ID)", table: null, eps: 0.045e-3 },
];
export const pipeKind = (id) => PIPE_KINDS.find((k) => k.id === id) || PIPE_KINDS[0];

/** Nominal sizes on offer for a pipe kind. */
export function sizesFor(kindId) {
  const k = pipeKind(kindId);
  if (k.table === "steel") return STEEL_PIPE.filter((p) => p.sch === k.sch).map((p) => ({ size: p.nps, ID: p.ID }));
  if (k.table === "copper") return COPPER_TUBE.filter((p) => p.type === k.type).map((p) => ({ size: p.size, ID: p.ID }));
  return [];
}

// Fittings. Most use the Crane TP-410 method, K = (L/D)·fT, where fT is the
// fully turbulent friction factor of clean steel pipe of that size. A few are
// plain K values, which don't depend on size.
export const FITTINGS = [
  { id: "el90", name: "90° elbow, standard", LD: 30 },
  { id: "el90lr", name: "90° elbow, long radius", LD: 14 },
  { id: "el45", name: "45° elbow", LD: 16 },
  { id: "teeRun", name: "Tee, flow through run", LD: 20 },
  { id: "teeBr", name: "Tee, flow through branch", LD: 60 },
  { id: "gate", name: "Gate valve, open", LD: 8 },
  { id: "ball", name: "Ball valve, full port, open", LD: 3 },
  { id: "bfly", name: "Butterfly valve, open", LD: 45 },
  { id: "plug", name: "Plug valve, open", LD: 18 },
  { id: "globe", name: "Globe valve, open", LD: 340 },
  { id: "angle", name: "Angle valve, open", LD: 150 },
  { id: "swing", name: "Swing check valve", LD: 100 },
  { id: "lift", name: "Lift check valve", LD: 600 },
  { id: "tilt", name: "Tilting disc check valve", LD: 40 },
  { id: "foot", name: "Foot valve with strainer (poppet)", LD: 420 },
  { id: "footH", name: "Foot valve with strainer (hinged)", LD: 75 },
  { id: "strainer", name: "Y-strainer, clean (typical)", K: 3 },
  { id: "reducer", name: "Reducer or increaser, gradual (typical)", K: 0.2 },
  { id: "entSharp", name: "Entrance from tank, flush", K: 0.5 },
  { id: "entProj", name: "Entrance from tank, projecting pipe", K: 0.78 },
  { id: "entRound", name: "Entrance, bell-mouth", K: 0.04 },
  { id: "exit", name: "Exit (into tank or open air)", K: 1 },
];
export const fittingById = Object.fromEntries(FITTINGS.map((f) => [f.id, f]));

// Crane TP-410 fully turbulent friction factors for clean commercial steel,
// by inside diameter (inches, Sch 40). Interpolated in between, held at the ends.
const FT_TABLE = [
  [0.622, 0.027], [0.824, 0.025], [1.049, 0.023], [1.38, 0.022], [1.61, 0.021], [2.067, 0.019], [2.469, 0.018],
  [3.068, 0.018], [4.026, 0.017], [5.047, 0.016], [6.065, 0.015], [7.981, 0.014], [10.02, 0.014], [11.94, 0.013],
  [15, 0.013], [17, 0.012], [23, 0.012],
];
/** Fully turbulent friction factor fT used to scale fitting losses, for inside diameter D (m). */
export const fT = (D) => interp(FT_TABLE.map((r) => r[0]), FT_TABLE.map((r) => r[1]), clampNum(D / 0.0254, 0.622, 23));
const clampNum = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** Sum of K for a run's fittings. */
export function fittingK(fit, D) {
  let K = 0;
  for (const [id, n] of Object.entries(fit || {})) {
    const f = fittingById[id];
    if (!f || !(n > 0)) continue;
    K += n * (f.K ?? f.LD * fT(D));
  }
  return K;
}

/** Inside diameter and roughness of a run. */
export function runGeometry(run) {
  const k = pipeKind(run.kind);
  if (!k.table) return { D: run.D, eps: run.eps ?? k.eps };
  const s = sizesFor(k.id).find((p) => p.size === run.size);
  return { D: s ? s.ID : run.D, eps: k.eps };
}

export const runLabel = (run) => {
  const k = pipeKind(run.kind);
  if (!k.table) return "Custom pipe";
  return `${run.size}″ ${k.name}`;
};

// ── Model text ↔ objects. Kept compact because it lives in the page URL. ──
// side,kind,size or ID,length,rise,fittings,extra pressure drop,name
//   s,s40,4,3,-1.5,entSharp*1+el90*2+gate*1,0,Suction
// Runs are separated by "|".

const clean = (s) => String(s ?? "").replace(/[|,*+~]/g, " ");

export function parseModel(text) {
  const runs = [];
  for (const part of String(text || "").split("|")) {
    const f = part.split(",");
    if (f.length < 5) continue;
    const [side, kind, size, L, dz, fits = "", dp = "0", name = ""] = f;
    const fit = {};
    for (const p of fits.split("+")) {
      const [id, n] = p.split("*");
      if (fittingById[id] && Number(n) > 0) fit[id] = Number(n);
    }
    const k = pipeKind(kind);
    const run = { side: side === "d" ? "d" : "s", kind: k.id, L: Number(L) || 0, dz: Number(dz) || 0, fit, dp: Number(dp) || 0, name };
    if (k.table) run.size = size;
    else {
      const [D, eps] = size.split("~");
      run.D = Number(D) || 0.05;
      run.eps = Number(eps) >= 0 && eps !== undefined && eps !== "" ? Number(eps) : k.eps;
    }
    runs.push(run);
  }
  return runs;
}

const n6 = (x) => String(Number((Number(x) || 0).toPrecision(6)));

export function stringifyModel(runs) {
  return runs
    .map((r) => {
      const k = pipeKind(r.kind);
      const size = k.table ? r.size : `${n6(r.D)}~${n6(r.eps ?? k.eps)}`;
      const fits = Object.entries(r.fit || {})
        .filter(([, n]) => n > 0)
        .map(([id, n]) => `${id}*${n}`)
        .join("+");
      return [r.side, k.id, size, n6(r.L), n6(r.dz), fits, n6(r.dp || 0), clean(r.name)].join(",");
    })
    .join("|");
}

/** Head loss across one run at flow Q. */
export function runLoss(run, Q, rho, mu) {
  const { D, eps } = runGeometry(run);
  const A = circleArea(D);
  const v = Q / A;
  const Re = (rho * Math.abs(v) * D) / mu;
  const f = Re > 0 ? frictionFactor(Re, eps / D) : 0;
  const K = fittingK(run.fit, D);
  const hv = (v * v) / (2 * G);
  const hPipe = ((f * run.L) / D) * hv;
  const hFit = K * hv;
  const hEquip = (run.dp || 0) / (rho * G);
  return { D, eps, A, v, Re, f, K, hv, hPipe, hFit, hEquip, h: hPipe + hFit + hEquip };
}

/**
 * Solve the system at flow Q.
 * p: { rho, mu, pv, patm, srcP (gauge), zs (liquid level), dst: "tank"|"free", zd, dstP (gauge) }
 */
export function solveSystem(runs, Q, p) {
  const { rho, mu, pv, patm } = p;
  const g = rho * G;
  const suction = runs.filter((r) => r.side === "s");
  const discharge = runs.filter((r) => r.side === "d");

  // Suction: the first run starts at the tank; its inlet sits Σrise below the pump.
  let z = -suction.reduce((s, r) => s + r.dz, 0);
  const inletZ = z;
  let H = (patm + p.srcP) / g + p.zs; // absolute total head at the liquid surface
  const nodes = [{ at: "source", z: inletZ, H, v: 0 }];
  const sRows = [];
  for (const r of suction) {
    const l = runLoss(r, Q, rho, mu);
    H -= l.h;
    z += r.dz;
    sRows.push({ run: r, ...l });
    nodes.push({ at: "s", z, H, v: l.v });
  }
  const Hs = H;
  const hfS = sRows.reduce((s, r) => s + r.h, 0);
  const NPSHa = Hs - pv / g;
  const vs = sRows.length ? sRows[sRows.length - 1].v : 0;

  // Discharge: losses along the way.
  const dRows = discharge.map((r) => ({ run: r, ...runLoss(r, Q, rho, mu) }));
  const hfD = dRows.reduce((s, r) => s + r.h, 0);
  const outletZ = discharge.reduce((s, r) => s + r.dz, 0);
  // A pipe that ends above the liquid in the tank spills, so it has to lift to its own outlet.
  const zdEff = p.dst === "free" ? outletZ : Math.max(p.zd, outletZ);
  const dstP = p.dst === "free" ? 0 : p.dstP;
  const Hd = (patm + dstP) / g + zdEff + hfD; // head needed at the pump outlet
  const TDH = Hd - Hs;

  let zz = 0;
  let HH = Hd;
  const dNodes = [{ at: "pump", z: 0, H: Hd, v: dRows[0]?.v ?? 0 }];
  for (const r of dRows) {
    HH -= r.h;
    zz += r.run.dz;
    dNodes.push({ at: "d", z: zz, H: HH, v: r.v });
  }

  // Absolute pressure at each joint: p = ρg(H − z) − ρv²/2.
  const pAbs = (n) => g * (n.H - n.z) - (rho * n.v * n.v) / 2;
  const allNodes = [...nodes, ...dNodes].map((n) => ({ ...n, p: pAbs(n) }));

  return {
    Q,
    sRows,
    dRows,
    hfS,
    hfD,
    Hs,
    Hd,
    NPSHa,
    TDH,
    staticHead: zdEff - p.zs + (dstP - p.srcP) / g,
    zdEff,
    inletZ,
    outletZ,
    vs,
    vd: dRows[0]?.v ?? 0,
    pSuction: pAbs({ H: Hs, z: 0, v: vs }) - patm,
    pDischarge: pAbs({ H: Hd, z: 0, v: dRows[0]?.v ?? 0 }) - patm,
    nodes: allNodes,
  };
}

/** Pump curve H(Q) from shutoff head, a rated point and an optional run-out point. */
export function pumpCurve({ H0, Qr, Hr, Qm, Hm }) {
  if (!(H0 > 0 && Qr > 0 && Hr > 0)) return null;
  if (Qm > Qr && Hm >= 0 && Hm < Hr) {
    // Quadratic through (0, H0), (Qr, Hr), (Qm, Hm).
    const a = H0;
    const det = Qr * Qm * (Qm - Qr);
    const b = ((Hr - a) * Qm * Qm - (Hm - a) * Qr * Qr) / det;
    const c = ((Hm - a) * Qr - (Hr - a) * Qm) / det;
    return (Q) => a + b * Q + c * Q * Q;
  }
  const k = (H0 - Hr) / (Qr * Qr);
  return (Q) => H0 - k * Q * Q;
}

/** Flow where the pump curve runs out of head (or a generous cap). */
function runout(curve, Qr) {
  let hi = Qr;
  for (let i = 0; i < 40 && curve(hi) > 0; i++) hi *= 1.25;
  return hi;
}

/** Where the pump and system curves cross. */
export function operatingPoint(runs, p, curve, Qr) {
  const sys = (Q) => solveSystem(runs, Q, p).TDH;
  const d = (Q) => curve(Q) - sys(Q);
  if (d(1e-9) <= 0) return null; // pump can't even reach the static head
  const hi = runout(curve, Qr);
  if (d(hi) > 0) return null;
  let lo = 1e-9,
    top = hi;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + top) / 2;
    if (d(mid) > 0) lo = mid;
    else top = mid;
  }
  const Q = (lo + top) / 2;
  return { Q, H: curve(Q) };
}

/** Points for the system curve, pump curve and NPSH available, 0 → Qmax. */
export function curves(runs, p, Qdesign, curve, Qr, NPSHr) {
  const Qmax = Math.max(Qdesign * 1.6, curve ? Math.min(runout(curve, Qr), Qr * 2) : 0);
  const sys = [],
    pump = [],
    npsh = [],
    req = [];
  for (let i = 0; i <= 40; i++) {
    const Q = (Qmax * i) / 40;
    const s = solveSystem(runs, Q, p);
    sys.push({ x: Q, y: s.TDH });
    npsh.push({ x: Q, y: s.NPSHa });
    if (curve) {
      const h = curve(Q);
      if (h >= 0) pump.push({ x: Q, y: h });
    }
  }
  if (NPSHr > 0) req.push({ x: 0, y: NPSHr }, { x: Qmax, y: NPSHr });
  return { sys, pump, npsh, req, Qmax };
}

export const DEFAULT_MODEL = stringifyModel([
  { side: "s", kind: "s40", size: "4", L: 3, dz: 0, fit: { entSharp: 1, gate: 1, el90: 1 }, dp: 0, name: "Tank outlet" },
  { side: "s", kind: "s40", size: "4", L: 2, dz: -1.5, fit: { el90: 1, strainer: 1, reducer: 1 }, dp: 0, name: "Drop to pump" },
  { side: "d", kind: "s40", size: "3", L: 2, dz: 0, fit: { reducer: 1, swing: 1, gate: 1 }, dp: 0, name: "Pump discharge" },
  { side: "d", kind: "s40", size: "3", L: 12, dz: 12, fit: { el90: 2 }, dp: 0, name: "Riser" },
  { side: "d", kind: "s40", size: "3", L: 45, dz: 0, fit: { el90: 3, exit: 1 }, dp: 0, name: "Header to tank" },
]);
