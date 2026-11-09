// A 2D frame solver: the direct stiffness method with Euler–Bernoulli frame
// elements (axial + bending), member-end hinges, and pin, roller and fixed supports.
//
// Units are SI throughout. Global axes: x to the right, y up, rotations
// counter-clockwise positive. Each member runs from joint `a` to joint `b`; its
// local x points from a to b and local y is local x turned 90° counter-clockwise.
//
// Model:
//   nodes:   [{ id, x, y, sup: "free" | "pin" | "fixed" | "rollerY" | "rollerX" }]
//            rollerY stops vertical movement (rolls sideways); rollerX stops horizontal.
//   members: [{ id, a, b, sec, mat, axis, hingeA, hingeB, K }]
//   loads:   joint     { id, on: "node", node, Fx, Fy, M }   (Fx right +, Fy up +, M counter-clockwise +)
//            member    { id, on: "member", member, kind: "point" | "udl", dir: "down" | "right" | "perp", P | w, a }
//                      Positive values push down, right, or toward the member's right-hand side
//                      (local −y). Point loads sit a metres from the member's start joint.
//   selfWeight: true adds ρ A g to every member as a downward uniform load.

import { memberSection, frameMaterial } from "../data/frameLibrary.js";
import { G } from "./units.js";

const subdivFor = (count) => Math.max(4, Math.min(12, Math.round(240 / Math.max(1, count))));

/** Solve A x = b in place (dense, partial pivoting). Returns null when singular. */
function solveDense(A, b, tolScale) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(A[c][c]);
    for (let r = c + 1; r < n; r++) {
      const v = Math.abs(A[r][c]);
      if (v > best) (best = v), (p = r);
    }
    if (best <= tolScale) return { singular: c };
    if (p !== c) {
      [A[p], A[c]] = [A[c], A[p]];
      [b[p], b[c]] = [b[c], b[p]];
    }
    const piv = A[c][c], rowC = A[c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / piv;
      if (f === 0) continue;
      const row = A[r];
      for (let k = c; k < n; k++) row[k] -= f * rowC[k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    const row = A[r];
    for (let k = r + 1; k < n; k++) s -= row[k] * x[k];
    x[r] = s / row[r];
  }
  return { x };
}

/** Local stiffness of a frame element. */
function localK(EA, EI, L) {
  const a = EA / L, b = (12 * EI) / L ** 3, c = (6 * EI) / L ** 2, d = (4 * EI) / L, e = (2 * EI) / L;
  return [
    [a, 0, 0, -a, 0, 0],
    [0, b, c, 0, -b, c],
    [0, c, d, 0, -c, e],
    [-a, 0, 0, a, 0, 0],
    [0, -b, -c, 0, b, -c],
    [0, c, e, 0, -c, d],
  ];
}

/** Statically condense out local DOF r (a hinge): returns new k and equivalent loads. */
function condense(k, f, r) {
  const krr = k[r][r];
  const k2 = k.map((row, i) => row.map((v, j) => (i === r || j === r ? 0 : v - (k[i][r] * k[r][j]) / krr)));
  const f2 = f.map((v, i) => (i === r ? 0 : v - (k[i][r] * f[r]) / krr));
  return { k: k2, f: f2 };
}

const SUPPORT_DOFS = { free: [], pin: [0, 1], fixed: [0, 1, 2], rollerY: [1], rollerX: [0] };

/** Direction of a member load as a global unit vector (the way a positive value pushes). */
function loadDir(dir, c, s) {
  if (dir === "right") return [1, 0];
  if (dir === "perp") return [s, -c]; // local −y
  return [0, -1]; // down
}

/**
 * Solve a frame. Returns { ok, error?, warnings, nodes (displacements), reactions,
 * members (diagrams and checks), summary }.
 */
export function solveFrame(model) {
  const warnings = [];
  const nodes = model.nodes || [];
  const nodeIdx = new Map(nodes.map((n, i) => [n.id, i]));
  const members = (model.members || []).filter((m) => nodeIdx.has(m.a) && nodeIdx.has(m.b) && m.a !== m.b);
  if (nodes.length < 2 || members.length === 0) return { ok: false, error: "Add at least one member between two joints.", warnings };
  if (!nodes.some((n) => n.sup && n.sup !== "free")) return { ok: false, error: "Add a support: tap a joint and pick pinned, roller or fixed.", warnings };

  // Mesh points: the real joints first, then points inside members.
  const pts = nodes.map((n) => ({ x: n.x, y: n.y, joint: n.id }));
  const SUBDIV = subdivFor(members.length);
  const elems = [];
  const mInfo = [];
  for (const m0 of members) {
    // Run every member left to right (or upward when vertical), so a positive
    // moment always means tension on the bottom (or right-hand) face.
    let m = m0;
    const ddx = nodes[nodeIdx.get(m0.b)].x - nodes[nodeIdx.get(m0.a)].x, ddy = nodes[nodeIdx.get(m0.b)].y - nodes[nodeIdx.get(m0.a)].y;
    const flip = ddx < -1e-9 * Math.hypot(ddx, ddy) || (Math.abs(ddx) <= 1e-9 * Math.hypot(ddx, ddy) && ddy < 0);
    if (flip) m = { ...m0, a: m0.b, b: m0.a, hingeA: m0.hingeB, hingeB: m0.hingeA };
    const na = nodes[nodeIdx.get(m.a)], nb = nodes[nodeIdx.get(m.b)];
    const dx = nb.x - na.x, dy = nb.y - na.y, L = Math.hypot(dx, dy);
    if (!(L > 1e-9)) {
      warnings.push(`Member ${m.id} has zero length and was left out.`);
      continue;
    }
    const c = dx / L, s = dy / L;
    const sec = memberSection(m);
    const mat = frameMaterial(m.mat);
    if (!sec || !(sec.A > 0) || !(sec.I > 0)) return { ok: false, error: `Member ${m.id}: check its section, the area and moment of inertia must be above zero.`, warnings };
    const E = mat.E;
    // Loads on this member.
    const point = [], udl = [];
    for (const ld of model.loads || []) {
      if (ld.on !== "member" || ld.member !== m.id) continue;
      // "Toward the right-hand side" is judged along the member as it was drawn.
      const [gx, gy] = loadDir(ld.dir, flip ? -c : c, flip ? -s : s);
      if (ld.kind === "point" && Number.isFinite(ld.P) && ld.P !== 0) {
        const a0 = Math.min(Math.max(ld.a ?? L / 2, 0), L);
        const a = flip ? L - a0 : a0;
        point.push({ a, px: ld.P * gx, py: ld.P * gy });
      } else if (ld.kind === "udl" && Number.isFinite(ld.w) && ld.w !== 0) {
        udl.push({ qx: ld.w * gx, qy: ld.w * gy });
      }
    }
    if (model.selfWeight) {
      const mat2 = mat;
      udl.push({ qx: 0, qy: -mat2.rho * sec.A * G, self: true });
    }
    const qgx = udl.reduce((t, q) => t + q.qx, 0), qgy = udl.reduce((t, q) => t + q.qy, 0);
    // Stations along the member.
    const st = new Set([0, L]);
    for (let i = 1; i < SUBDIV; i++) st.add((L * i) / SUBDIV);
    for (const p of point) st.add(p.a);
    const xs = [...st].sort((p, q) => p - q).filter((x, i, arr) => i === 0 || x - arr[i - 1] > L * 1e-6);
    xs[xs.length - 1] = L;
    const ids = xs.map((x, i) => {
      if (i === 0) return nodeIdx.get(m.a);
      if (i === xs.length - 1) return nodeIdx.get(m.b);
      pts.push({ x: na.x + c * x, y: na.y + s * x, member: m.id });
      return pts.length - 1;
    });
    const first = elems.length;
    for (let i = 0; i < xs.length - 1; i++) elems.push({ m: mInfo.length, i: ids[i], j: ids[i + 1], L: xs[i + 1] - xs[i], x0: xs[i], hingeA: i === 0 && m.hingeA, hingeB: i === xs.length - 2 && m.hingeB });
    // Point loads go straight onto mesh points.
    const pl = point.map((p) => {
      let k = 0;
      for (let i = 0; i < xs.length; i++) if (Math.abs(xs[i] - p.a) < Math.abs(xs[k] - p.a)) k = i;
      return { ...p, a: xs[k], at: ids[k] };
    });
    mInfo.push({ m, na, nb, L, c, s, sec, mat, E, EA: E * sec.A, EI: E * sec.I, point: pl, udl, qgx, qgy, xs, ids, first, last: elems.length - 1 });
  }

  const N = pts.length * 3;
  const K = Array.from({ length: N }, () => new Float64Array(N));
  const F = new Float64Array(N);

  // Element matrices in global axes.
  for (const e of elems) {
    const mi = mInfo[e.m];
    const { c, s } = mi;
    const qx = mi.qgx * c + mi.qgy * s, qy = -mi.qgx * s + mi.qgy * c; // local components
    const Le = e.L;
    let k = localK(mi.EA, mi.EI, Le);
    let f = [(qx * Le) / 2, (qy * Le) / 2, (qy * Le * Le) / 12, (qx * Le) / 2, (qy * Le) / 2, (-qy * Le * Le) / 12];
    e.k0 = k;
    e.f0 = f;
    if (e.hingeA) ({ k, f } = condense(k, f, 2));
    if (e.hingeB) ({ k, f } = condense(k, f, 5));
    e.k = k;
    e.f = f;
    e.qx = qx;
    e.qy = qy;
    const T = [c, s, 0, -s, c, 0];
    const rot = (v) => [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2], c * v[3] - s * v[4], s * v[3] + c * v[4], v[5]];
    // kg = Tᵀ k T, done by blocks.
    const R = [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1],
    ];
    const dofs = [3 * e.i, 3 * e.i + 1, 3 * e.i + 2, 3 * e.j, 3 * e.j + 1, 3 * e.j + 2];
    const kg = Array.from({ length: 6 }, () => new Array(6).fill(0));
    for (let p = 0; p < 6; p++)
      for (let q = 0; q < 6; q++) {
        let sum = 0;
        const bp = p < 3 ? 0 : 3, bq = q < 3 ? 0 : 3;
        for (let a = 0; a < 3; a++) {
          const Rpa = R[p - bp][a];
          if (!Rpa) continue;
          for (let b = 0; b < 3; b++) {
            const Rqb = R[q - bq][b];
            if (Rqb) sum += Rpa * k[bp + a][bq + b] * Rqb;
          }
        }
        kg[p][q] = sum;
      }
    e.T = T;
    e.dofs = dofs;
    const fg = rot(f);
    for (let p = 0; p < 6; p++) {
      F[dofs[p]] += fg[p];
      for (let q = 0; q < 6; q++) K[dofs[p]][dofs[q]] += kg[p][q];
    }
  }

  // Point loads on members and loads on joints.
  for (const mi of mInfo) for (const p of mi.point) (F[3 * p.at] += p.px), (F[3 * p.at + 1] += p.py);
  for (const ld of model.loads || []) {
    if (ld.on !== "node" || !nodeIdx.has(ld.node)) continue;
    const i = nodeIdx.get(ld.node);
    F[3 * i] += ld.Fx || 0;
    F[3 * i + 1] += ld.Fy || 0;
    F[3 * i + 2] += ld.M || 0;
  }

  // Restraints.
  const fixed = new Uint8Array(N);
  nodes.forEach((n, i) => {
    for (const d of SUPPORT_DOFS[n.sup || "free"] || []) fixed[3 * i + d] = 1;
  });
  let maxDiag = 0;
  for (let i = 0; i < N; i++) maxDiag = Math.max(maxDiag, Math.abs(K[i][i]));
  // A joint where every member is hinged has no rotational stiffness. Its rotation
  // doesn't matter, so pin it in place; a moment applied there can't be carried.
  const spinFree = [];
  for (let i = 0; i < pts.length; i++) {
    const r = 3 * i + 2;
    if (!fixed[r] && Math.abs(K[r][r]) <= maxDiag * 1e-14) {
      fixed[r] = 1;
      spinFree.push(i);
      if (Math.abs(F[r]) > 0) warnings.push(`Joint ${pts[i].joint ?? ""} is hinged on every member, so the moment applied there has nothing to push against and was ignored.`);
    }
  }

  const free = [];
  for (let i = 0; i < N; i++) if (!fixed[i]) free.push(i);
  const A = free.map((r) => free.map((c) => K[r][c]));
  const b = free.map((r) => F[r]);
  const sol = solveDense(A, b, maxDiag * 1e-11);
  if (sol.singular !== undefined) {
    const dof = free[sol.singular];
    const p = pts[Math.floor(dof / 3)];
    const where = p.joint ? `joint ${p.joint}` : `member ${p.member}`;
    return {
      ok: false,
      error: `The frame can move without resisting (it's a mechanism), near ${where}. Add a support, a brace, or make a hinged connection rigid.`,
      warnings,
    };
  }
  const u = new Float64Array(N);
  free.forEach((d, k) => (u[d] = sol.x[k]));

  // Reactions R = K u − F at restrained DOFs (supports only).
  const reactions = [];
  nodes.forEach((n, i) => {
    const dofs = SUPPORT_DOFS[n.sup || "free"] || [];
    if (!dofs.length) return;
    const r = [0, 0, 0];
    for (const d of dofs) {
      const row = 3 * i + d;
      let sum = -F[row];
      for (let c = 0; c < N; c++) sum += K[row][c] * u[c];
      r[d] = sum;
    }
    reactions.push({ node: n.id, sup: n.sup, Rx: r[0], Ry: r[1], M: r[2] });
  });

  // Member results.
  const memberResults = mInfo.map((mi) => {
    const { m, L, c, s, sec, mat, EI } = mi;
    const subs = elems.slice(mi.first, mi.last + 1);
    const local = (v) => [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]];
    // Displacements of each sub-element end in local axes, including hinge rotations.
    const subDisp = subs.map((e) => {
      const d = [...local([u[e.dofs[0]], u[e.dofs[1]], u[e.dofs[2]]]), ...local([u[e.dofs[3]], u[e.dofs[4]], u[e.dofs[5]]])];
      const k0 = e.k0, f0 = e.f0;
      const rel = [e.hingeA ? 2 : -1, e.hingeB ? 5 : -1].filter((x) => x >= 0);
      for (const r of rel) {
        let sum = f0[r];
        for (let q = 0; q < 6; q++) if (q !== r && !rel.includes(q)) sum -= k0[r][q] * d[q];
        d[r] = sum / k0[r][r];
      }
      if (rel.length === 2) {
        // Both ends hinged on a single sub-element (only if the member had one); solve the 2×2.
        const [r1, r2] = rel;
        const g = (r) => f0[r] - [0, 1, 3, 4].reduce((t, q) => t + k0[r][q] * d[q], 0);
        const a11 = k0[r1][r1], a12 = k0[r1][r2], a22 = k0[r2][r2];
        const det = a11 * a22 - a12 * a12;
        d[r1] = (g(r1) * a22 - g(r2) * a12) / det;
        d[r2] = (a11 * g(r2) - a12 * g(r1)) / det;
      }
      return d;
    });
    // End forces of the whole member, from its first sub-element: f = k d − f_equiv.
    const d0 = subDisp[0], e0 = subs[0];
    const fA = e0.k0.map((row, i) => row.reduce((t, kv, j) => t + kv * d0[j], 0) - e0.f0[i]);
    const dl = subDisp[subDisp.length - 1], el = subs[subs.length - 1];
    const fB = el.k0.map((row, i) => row.reduce((t, kv, j) => t + kv * dl[j], 0) - el.f0[i]);
    const qx = e0.qx, qy = e0.qy;
    const pls = mi.point.map((p) => ({ a: p.a, px: c * p.px + s * p.py, py: -s * p.px + c * p.py }));
    // Internal forces at x along the member (left-hand free body). after: include loads exactly at x.
    const forces = (x, after) => {
      let Nx = -(fA[0] + qx * x), V = fA[1] + qy * x, M = -fA[2] + fA[1] * x + (qy * x * x) / 2;
      for (const p of pls) {
        if (p.a < x - 1e-12 || (after && Math.abs(p.a - x) <= 1e-12)) {
          Nx -= p.px;
          V += p.py;
          M += p.py * (x - p.a);
        }
      }
      return { N: Nx, V, M };
    };
    const samples = [];
    subs.forEach((e, k) => {
      const d = subDisp[k];
      const n = 6;
      for (let i = 0; i <= n; i++) {
        if (k > 0 && i === 0) continue;
        const xi = i / n, x = e.x0 + xi * e.L, Le = e.L;
        const after = i === 0;
        // Hermite deflection plus the uniform-load bubble.
        const H1 = 1 - 3 * xi ** 2 + 2 * xi ** 3, H2 = Le * (xi - 2 * xi ** 2 + xi ** 3), H3 = 3 * xi ** 2 - 2 * xi ** 3, H4 = Le * (-(xi ** 2) + xi ** 3);
        const v = H1 * d[1] + H2 * d[2] + H3 * d[4] + H4 * d[5] + ((qy * Le ** 4) / (24 * EI)) * xi ** 2 * (1 - xi) ** 2;
        const ua = d[0] * (1 - xi) + d[3] * xi;
        samples.push({ x, u: ua, v, ...forces(x, after && k === 0) });
      }
      // A point load at the start of the next sub-element: also record the value just after it.
      if (k < subs.length - 1) {
        const xe = e.x0 + e.L;
        if (pls.some((p) => Math.abs(p.a - xe) <= 1e-12)) {
          const last = samples[samples.length - 1];
          samples.push({ ...last, ...forces(xe, true) });
        }
      }
    });
    // Deflection relative to the chord between the ends.
    const vA = samples[0].v, vB = samples[samples.length - 1].v;
    let rel = 0, relX = 0, maxDisp = 0;
    let Nmax = 0, Nmin = 0, Vabs = 0, Mabs = 0, Mmax = 0, Mmin = 0, sig = 0, sigX = 0;
    for (const p of samples) {
      const r = p.v - (vA + ((vB - vA) * p.x) / L);
      if (Math.abs(r) > Math.abs(rel)) (rel = r), (relX = p.x);
      maxDisp = Math.max(maxDisp, Math.hypot(p.u, p.v));
      Nmax = Math.max(Nmax, p.N);
      Nmin = Math.min(Nmin, p.N);
      Vabs = Math.max(Vabs, Math.abs(p.V));
      Mabs = Math.max(Mabs, Math.abs(p.M));
      Mmax = Math.max(Mmax, p.M);
      Mmin = Math.min(Mmin, p.M);
      const sp = Math.abs(p.N) / sec.A + Math.abs(p.M) / sec.S;
      if (sp > sig) (sig = sp), (sigX = p.x);
    }
    const Kf = m.K > 0 ? m.K : 1;
    const Pcr = (Math.PI ** 2 * mat.E * sec.Imin) / (Kf * L) ** 2;
    const comp = -Nmin;
    return {
      id: m.id, L, c, s, a: m.a, b: m.b, xa: mi.na.x, ya: mi.na.y, section: sec, material: mat,
      samples, endA: { N: -fA[0], V: fA[1], M: -fA[2] }, endB: { N: fB[3], V: -fB[4], M: fB[5] },
      Nmax, Nmin, Vabs, Mabs, Mmax, Mmin, sigma: sig, sigmaX: sigX, util: sig / mat.Fy,
      defl: Math.abs(rel), deflX: relX, spanRatio: rel !== 0 ? L / Math.abs(rel) : Infinity, maxDisp,
      Pcr, compression: comp, bucklingRatio: comp > 0 ? Pcr / comp : Infinity,
      weight: mat.rho * sec.A * L * G,
      totalLoad: Math.hypot(mi.qgx, mi.qgy) * L,
    };
  });

  const nodeDisp = nodes.map((n, i) => ({ id: n.id, dx: u[3 * i], dy: u[3 * i + 1], rz: spinFree.includes(i) ? null : u[3 * i + 2] }));

  // Totals and an equilibrium check.
  let Fx = 0, Fy = 0;
  for (const ld of model.loads || []) if (ld.on === "node") (Fx += ld.Fx || 0), (Fy += ld.Fy || 0);
  for (const mi of mInfo) {
    Fx += mi.qgx * mi.L;
    Fy += mi.qgy * mi.L;
    for (const p of mi.point) (Fx += p.px), (Fy += p.py);
  }
  const Rx = reactions.reduce((t, r) => t + r.Rx, 0), Ry = reactions.reduce((t, r) => t + r.Ry, 0);
  const scale = Math.max(Math.abs(Fx), Math.abs(Fy), 1);
  if (Math.abs(Rx + Fx) > scale * 1e-6 || Math.abs(Ry + Fy) > scale * 1e-6) warnings.push("The reactions don't quite balance the loads; the model may be close to unstable.");

  const pick = (key, abs = true) => memberResults.reduce((best, r) => ((abs ? Math.abs(r[key]) : r[key]) > (best ? (abs ? Math.abs(best[key]) : best[key]) : -Infinity) ? r : best), null);
  const govern = pick("util", false);
  const maxNode = nodeDisp.reduce((best, n) => (Math.hypot(n.dx, n.dy) > Math.hypot(best.dx, best.dy) ? n : best), nodeDisp[0]);
  const summary = {
    maxDisp: Math.max(...memberResults.map((r) => r.maxDisp)),
    maxJoint: { id: maxNode.id, d: Math.hypot(maxNode.dx, maxNode.dy), dx: maxNode.dx, dy: maxNode.dy },
    maxM: pick("Mabs"),
    maxV: pick("Vabs"),
    maxTension: pick("Nmax", false),
    maxCompression: pick("compression", false),
    governing: govern,
    worstDefl: memberResults.reduce((b2, r) => (r.spanRatio < (b2?.spanRatio ?? Infinity) ? r : b2), null),
    worstBuckling: memberResults.reduce((b2, r) => (r.bucklingRatio < (b2?.bucklingRatio ?? Infinity) ? r : b2), null),
    totalLoad: { Fx, Fy },
    weight: memberResults.reduce((t, r) => t + r.weight, 0),
  };

  for (const r of memberResults) {
    if (r.util > 1) warnings.push(`Member ${r.id} is overstressed: ${Math.round(r.util * 100)}% of its ${r.material.kind === "wood" ? "bending strength" : "yield stress"}.`);
    if (r.compression > 0 && r.bucklingRatio < 1) warnings.push(`Member ${r.id} would buckle: its compression is more than the Euler buckling load.`);
  }

  return { ok: true, warnings, nodes: nodeDisp, reactions, members: memberResults, summary };
}

// Templates ------------------------------------------------------------------

let seq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
export const newId = uid;

/** Lowest unused short label (1, 2, 3 … or A, B, C …) for joints and members. */
export function nextLabel(items, letters) {
  const used = new Set(items.map((x) => x.id));
  for (let i = 1; i < 1000; i++) {
    const id = letters ? String.fromCharCode(64 + ((i - 1) % 26) + 1) + (i > 26 ? Math.floor((i - 1) / 26) : "") : `M${i}`;
    if (!used.has(id)) return id;
  }
  return uid(letters ? "J" : "M");
}

const FT = 0.3048;

/** Starter frames. `us` picks US sizes and round-foot dimensions. */
export function frameTemplate(kind, us) {
  const L = us ? (x) => x * FT : (x) => x; // feet or metres
  const col = us ? "W10x33" : "HEA 200";
  const beam = us ? "W14x30" : "IPE 300";
  const brace = us ? "HSS4x4x1/4" : "SHS 100x100x5";
  const truss = us ? "HSS3x3x1/4" : "SHS 50x50x4";
  const mat = us ? "a992" : "s355";
  const bmat = us ? "a500" : "s355";
  const kN = us ? 4448.2216 : 1000; // kip or kN
  const kNm = us ? 14593.9 : 1000; // kip/ft or kN/m
  const J = (id, x, y, sup = "free") => ({ id, x: L(x), y: L(y), sup });
  const M = (id, a, b, sec, extra = {}) => ({ id, a, b, sec, mat: sec === brace || sec === truss ? bmat : mat, axis: "strong", hingeA: false, hingeB: false, K: 1, ...extra });
  const s = us ? [20, 12] : [6, 4];
  switch (kind) {
    case "portal":
      return {
        nodes: [J("A", 0, 0, "fixed"), J("B", 0, s[1]), J("C", s[0], s[1]), J("D", s[0], 0, "fixed")],
        members: [M("M1", "A", "B", col), M("M2", "B", "C", beam), M("M3", "D", "C", col)],
        loads: [
          { id: "L1", on: "member", member: "M2", kind: "udl", dir: "down", w: (us ? 1 : 15) * kNm },
          { id: "L2", on: "node", node: "B", Fx: (us ? 3 : 10) * kN, Fy: 0, M: 0 },
        ],
      };
    case "braced":
      return {
        nodes: [J("A", 0, 0, "pin"), J("B", 0, s[1]), J("C", s[0], s[1]), J("D", s[0], 0, "pin")],
        members: [
          M("M1", "A", "B", col),
          M("M2", "B", "C", beam, { hingeA: true, hingeB: true }),
          M("M3", "D", "C", col),
          M("M4", "A", "C", brace, { hingeA: true, hingeB: true }),
        ],
        loads: [
          { id: "L1", on: "member", member: "M2", kind: "udl", dir: "down", w: (us ? 1 : 15) * kNm },
          { id: "L2", on: "node", node: "B", Fx: (us ? 5 : 20) * kN, Fy: 0, M: 0 },
        ],
      };
    case "truss": {
      const p = us ? 8 : 2.5, h = us ? 8 : 2.5;
      const nodes = [J("A", 0, 0, "pin"), J("B", p, 0), J("C", 2 * p, 0), J("D", 3 * p, 0), J("E", 4 * p, 0, "rollerY"), J("F", p, h), J("G", 2 * p, h), J("H", 3 * p, h)];
      const pairs = [["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"], ["F", "G"], ["G", "H"], ["A", "F"], ["B", "F"], ["F", "C"], ["C", "G"], ["C", "H"], ["D", "H"], ["H", "E"]];
      return {
        nodes,
        members: pairs.map(([a, b], i) => M(`M${i + 1}`, a, b, truss, { hingeA: true, hingeB: true })),
        loads: ["B", "C", "D"].map((n, i) => ({ id: `L${i + 1}`, on: "node", node: n, Fx: 0, Fy: -(us ? 3 : 10) * kN, M: 0 })),
      };
    }
    case "cantilever":
      return {
        nodes: [J("A", 0, 0, "fixed"), J("B", s[1] / 2, 0), J("C", s[1] * 0.75, 0), J("D", 0, -s[1] / 2, "pin")],
        members: [M("M1", "A", "B", beam), M("M2", "B", "C", beam), M("M3", "D", "B", brace, { hingeA: true, hingeB: true })],
        loads: [{ id: "L1", on: "node", node: "C", Fx: 0, Fy: -(us ? 2 : 10) * kN, M: 0 }],
      };
    case "continuous":
      return {
        nodes: [J("A", 0, 0, "pin"), J("B", s[0], 0, "rollerY"), J("C", 2 * s[0], 0, "rollerY"), J("D", 2.6 * s[0], 0)],
        members: [M("M1", "A", "B", beam), M("M2", "B", "C", beam), M("M3", "C", "D", beam)],
        loads: [
          { id: "L1", on: "member", member: "M1", kind: "udl", dir: "down", w: (us ? 1 : 10) * kNm },
          { id: "L2", on: "member", member: "M2", kind: "udl", dir: "down", w: (us ? 1 : 10) * kNm },
          { id: "L3", on: "member", member: "M3", kind: "point", dir: "down", P: (us ? 3 : 15) * kN, a: 0.6 * L(s[0]) },
        ],
      };
    case "gable": {
      const w = us ? 40 : 12, h = us ? 14 : 4.5, r = us ? 22 : 7;
      return {
        nodes: [J("A", 0, 0, "pin"), J("B", 0, h), J("C", w / 2, r), J("D", w, h), J("E", w, 0, "pin")],
        members: [M("M1", "A", "B", col), M("M2", "B", "C", beam), M("M3", "C", "D", beam), M("M4", "E", "D", col)],
        loads: [
          { id: "L1", on: "member", member: "M2", kind: "udl", dir: "down", w: (us ? 0.6 : 8) * kNm },
          { id: "L2", on: "member", member: "M3", kind: "udl", dir: "down", w: (us ? 0.6 : 8) * kNm },
          { id: "L3", on: "member", member: "M1", kind: "udl", dir: "perp", w: (us ? 0.3 : 4) * kNm },
        ],
      };
    }
    default:
      return { nodes: [], members: [], loads: [] };
  }
}

export const FRAME_TEMPLATES = [
  { id: "portal", label: "Portal frame" },
  { id: "braced", label: "Braced bay" },
  { id: "gable", label: "Gable frame" },
  { id: "truss", label: "Truss" },
  { id: "cantilever", label: "Bracket" },
  { id: "continuous", label: "Continuous beam" },
  { id: "blank", label: "Blank" },
];
