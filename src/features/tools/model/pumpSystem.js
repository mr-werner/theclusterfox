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

// Inline equipment: zero-length items between pipe runs, such as a filter or a
// heat exchanger. Each has a pressure drop at the design flow that scales with
// flow squared, or for a control valve a Cv (US gpm at 1 psi), dp = SG·(Q/Cv)².
const PSI = 6894.757;
const psi = (x) => Number((x * PSI).toPrecision(5));
export const EQUIPMENT = [
  { id: "filter", name: "Filter", short: "Filter", dp: psi(5) },
  { id: "basket", name: "Basket strainer", short: "Strainer", dp: psi(2) },
  { id: "meter", name: "Flow meter", short: "Meter", dp: psi(2) },
  { id: "wmeter", name: "Water meter", short: "Water meter", dp: psi(5) },
  { id: "bfp", name: "Backflow preventer (RPZ)", short: "Backflow", dp: psi(12) },
  { id: "cv", name: "Control valve", short: "Control valve", dp: psi(5), cv: 60 },
  { id: "hx", name: "Heat exchanger", short: "Heat exch.", dp: psi(5) },
  { id: "coil", name: "Coil", short: "Coil", dp: psi(4.3) },
  { id: "boiler", name: "Boiler or chiller", short: "Boiler", dp: psi(6.5) },
  { id: "other", name: "Other equipment", short: "Equipment", dp: psi(3) },
];
export const equipmentById = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e]));
export const isEquip = (run) => Boolean(run && run.eq);
export const equipLabel = (run) => equipmentById[run.eq]?.name || "Equipment";

/** A new piece of equipment with its typical pressure drop. */
export function newEquipment(side, id) {
  const e = equipmentById[id] || equipmentById.other;
  return { side, eq: e.id, L: 0, dz: 0, fit: {}, dp: e.dp, cv: 0, name: "" };
}

/** Pressure drop across a piece of equipment at flow Q (Qd is the design flow). */
export function equipmentDp(run, Q, rho, Qd) {
  if (run.cv > 0) {
    const gpm = Math.abs(Q) / 6.30901964e-5;
    return (rho / 999) * (gpm / run.cv) ** 2 * PSI;
  }
  return Qd > 0 ? (run.dp || 0) * (Q / Qd) ** 2 : run.dp || 0;
}

/** Short tags for each item on one side: pipes S1, S2…; equipment E1, E2…. */
export function tagsFor(list, side) {
  let p = 0, e = 0;
  const S = side === "s" ? "S" : "D";
  return list.map((r) => (isEquip(r) ? `${S}E${++e}` : `${S}${++p}`));
}

export const runLabel = (run) => {
  if (isEquip(run)) return equipLabel(run);
  const k = pipeKind(run.kind);
  if (!k.table) return "Custom pipe";
  return `${run.size}″ ${k.name}`;
};

// ── Model text ↔ objects. Kept compact because it lives in the page URL. ──
// side,kind,size or ID,length,rise,fittings,extra pressure drop,name
//   s,s40,4,3,-1.5,entSharp*1+el90*2+gate*1,0,Suction
// Equipment uses "@type" as the kind and its Cv (0 for none) as the size:
//   d,@filter,0,0,0,,34474,Sand filter
// Runs are separated by "|".

const clean = (s) => String(s ?? "").replace(/[|,*+~]/g, " ");

export function parseModel(text) {
  const runs = [];
  for (const part of String(text || "").split("|")) {
    const f = part.split(",");
    if (f.length < 5) continue;
    const [side, kind, size, L, dz, fits = "", dp = "0", name = ""] = f;
    if (kind.startsWith("@")) {
      const id = equipmentById[kind.slice(1)] ? kind.slice(1) : "other";
      runs.push({ side: side === "d" ? "d" : "s", eq: id, L: 0, dz: 0, fit: {}, dp: Number(dp) || 0, cv: Number(size) > 0 ? Number(size) : 0, name });
      continue;
    }
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
      if (isEquip(r)) return [r.side, `@${r.eq}`, n6(r.cv || 0), "0", "0", "", n6(r.dp || 0), clean(r.name)].join(",");
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

/** Head loss across one run at flow Q. Qd (design flow) scales the equipment drops. */
export function runLoss(run, Q, rho, mu, Qd) {
  if (isEquip(run)) {
    const hEquip = equipmentDp(run, Q, rho, Qd) / (rho * G);
    return { D: 0, eps: 0, A: 0, v: 0, Re: 0, f: 0, K: 0, hv: 0, hPipe: 0, hFit: 0, hEquip, h: hEquip, equip: true };
  }
  const { D, eps } = runGeometry(run);
  const A = circleArea(D);
  const v = Q / A;
  const Re = (rho * Math.abs(v) * D) / mu;
  const f = Re > 0 ? frictionFactor(Re, eps / D) : 0;
  const K = fittingK(run.fit, D);
  const hv = (v * v) / (2 * G);
  const hPipe = ((f * run.L) / D) * hv;
  const hFit = K * hv;
  const hEquip = (Qd > 0 ? (run.dp || 0) * (Q / Qd) ** 2 : run.dp || 0) / (rho * G);
  return { D, eps, A, v, Re, f, K, hv, hPipe, hFit, hEquip, h: hPipe + hFit + hEquip };
}

/**
 * Solve the system at flow Q.
 * p: { rho, mu, pv, patm, src: "open"|"closed"|"main", srcP (gauge), zs (liquid level),
 *      dst: "tank"|"free", zd, dstP (gauge), Qd (design flow, scales equipment drops) }
 * A water main is a pressure source at the tap: its "level" is the tap itself.
 */
export function solveSystem(runs, Q, p) {
  const { rho, mu, pv, patm, Qd } = p;
  const g = rho * G;
  const suction = runs.filter((r) => r.side === "s");
  const discharge = runs.filter((r) => r.side === "d");

  // Suction: the first run starts at the tank; its inlet sits Σrise below the pump.
  let z = -suction.reduce((s, r) => s + r.dz, 0);
  const inletZ = z;
  const zs = p.src === "main" ? inletZ : p.zs;
  let H = (patm + p.srcP) / g + zs; // absolute total head at the liquid surface (or in the main)
  const nodes = [{ at: "source", z: inletZ, H, v: 0 }];
  const sRows = [];
  for (const r of suction) {
    const l = runLoss(r, Q, rho, mu, Qd);
    H -= l.h;
    z += r.dz;
    sRows.push({ run: r, ...l });
    nodes.push({ at: "s", z, H, v: l.v });
  }
  borrowVelocity(sRows);
  sRows.forEach((r, i) => (nodes[i + 1].v = r.v));
  const Hs = H;
  const hfS = sRows.reduce((s, r) => s + r.h, 0);
  const NPSHa = Hs - pv / g;
  const vs = sRows.length ? sRows[sRows.length - 1].v : 0;

  // Discharge: losses along the way.
  const dRows = discharge.map((r) => ({ run: r, ...runLoss(r, Q, rho, mu, Qd) }));
  borrowVelocity(dRows);
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
    staticHead: zdEff - zs + (dstP - p.srcP) / g,
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

// Equipment has no bore of its own: it takes the velocity of the pipe next to it.
function borrowVelocity(rows) {
  rows.forEach((r, i) => {
    if (!r.equip) return;
    const near = rows.slice(0, i).reverse().find((x) => !x.equip) || rows.slice(i + 1).find((x) => !x.equip);
    r.v = near ? near.v : 0;
  });
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

// ── Editing on the drawing ─────────────────────────────────────────────────
// The pump centerline is the datum. On the suction side the joints are worked
// back from the pump, so joint 0 is the tank outlet (or the tap on the main);
// on the discharge side joint 0 is the pump and the last joint is the end.

const ENTRANCES = new Set(["entSharp", "entProj", "entRound", "foot", "footH"]);

/** Elevation of every joint along one side, in flow order (n + 1 values for n items). */
export function jointZ(list, side) {
  const z = [0];
  if (side === "s") {
    for (let i = list.length - 1; i >= 0; i--) z.unshift(z[0] - list[i].dz);
  } else {
    for (const r of list) z.push(z[z.length - 1] + r.dz);
  }
  return z.map((x) => Number(x.toPrecision(12)));
}

/** A pipe's rise changed: its straight part stays, the vertical part changes. */
export function withRise(run, dz) {
  if (isEquip(run)) return run;
  const flat = Math.max((run.L || 0) - Math.abs(run.dz || 0), 0);
  return { ...run, dz, L: Number((flat + Math.abs(dz)).toPrecision(10)) };
}

/** The joints that move together with joint k: equipment has no length, so both its ends move as one. */
export function jointGroup(list, k) {
  let a = k, b = k;
  while (a > 0 && isEquip(list[a - 1])) a--;
  while (b < list.length && isEquip(list[b])) b++;
  return [a, b];
}

/** Can joint k be dragged? The pump end is fixed. */
export function jointMovable(list, side, k) {
  const [a, b] = jointGroup(list, k);
  return side === "s" ? b < list.length : a > 0;
}

/** Move joint k (and anything rigidly tied to it) to elevation Z. Pipes on either side stretch to suit. */
export function moveJoint(list, side, k, Z) {
  if (!jointMovable(list, side, k)) return list;
  const z = jointZ(list, side);
  const [a, b] = jointGroup(list, k);
  const next = list.map((r) => ({ ...r }));
  if (a > 0) next[a - 1] = withRise(next[a - 1], Number((Z - z[a - 1]).toPrecision(10)));
  if (b < list.length) next[b] = withRise(next[b], Number((z[b + 1] - Z).toPrecision(10)));
  return next;
}

/**
 * Split pipe i into two at a point along it. `at` is 0…1 along the drawn path,
 * which is the straight part first and then the rise. Entrance fittings stay with
 * the first piece, the exit goes with the second, and the rest stay with the longer.
 */
export function splitRun(list, i, at) {
  const r = list[i];
  if (!r || isEquip(r)) return list;
  const t = clampNum(at, 0.02, 0.98);
  const rise = Math.abs(r.dz);
  const flat = Math.max(r.L - rise, 0);
  const tot = flat + rise || 1;
  const cut = t * tot; // distance along the path
  const L1 = cut, L2 = tot - cut;
  const dz1 = cut <= flat ? 0 : Math.sign(r.dz) * (cut - flat);
  const dz2 = r.dz - dz1;
  const f1 = {}, f2 = {};
  for (const [id, n] of Object.entries(r.fit || {})) {
    if (ENTRANCES.has(id)) f1[id] = n;
    else if (id === "exit") f2[id] = n;
    else (L1 >= L2 ? f1 : f2)[id] = n;
  }
  const p = (x) => Number(x.toPrecision(6));
  const a = { ...r, L: p(L1), dz: p(dz1), fit: f1, dp: r.dp || 0 };
  const b = { ...r, L: p(L2), dz: p(dz2), fit: f2, dp: 0, name: r.name ? `${r.name} (cont.)`.slice(0, 40) : "" };
  return [...list.slice(0, i), a, b, ...list.slice(i + 1)];
}

/** Drop a piece of equipment onto pipe i, splitting the pipe around it. */
export function insertEquipment(list, i, at, item) {
  const split = splitRun(list, i, at);
  if (split === list) return list;
  return [...split.slice(0, i + 1), { ...item, side: list[i].side }, ...split.slice(i + 1)];
}

/** Add one fitting or valve to pipe i. */
export function addFitting(list, i, id) {
  const r = list[i];
  if (!r || isEquip(r) || !fittingById[id]) return list;
  return list.map((x, k) => (k === i ? { ...x, fit: { ...x.fit, [id]: (x.fit?.[id] || 0) + 1 } } : x));
}

const samePipe = (a, b) => a && b && !isEquip(a) && !isEquip(b) && a.kind === b.kind && (pipeKind(a.kind).table ? a.size === b.size : a.D === b.D && a.eps === b.eps);

/** Remove item i. Taking out equipment rejoins the pipe either side when it's the same pipe. */
export function removeItem(list, i) {
  const r = list[i];
  const prev = list[i - 1], next = list[i + 1];
  if (isEquip(r) && samePipe(prev, next)) {
    const fit = { ...prev.fit };
    for (const [id, n] of Object.entries(next.fit || {})) fit[id] = (fit[id] || 0) + n;
    const joined = { ...prev, L: Number((prev.L + next.L).toPrecision(10)), dz: Number((prev.dz + next.dz).toPrecision(10)), fit, dp: (prev.dp || 0) + (next.dp || 0) };
    return [...list.slice(0, i - 1), joined, ...list.slice(i + 2)];
  }
  return list.filter((_, k) => k !== i);
}
