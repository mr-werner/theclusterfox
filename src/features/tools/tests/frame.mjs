// Checks for the 2D frame solver against textbook results.
import assert from "node:assert/strict";
import { solveFrame, frameTemplate, FRAME_TEMPLATES } from "../model/frame.js";
import { FRAME_SECTIONS, memberSection, frameMaterial } from "../data/frameLibrary.js";
import { section } from "../model/structures.js";

const near = (actual, expected, rel = 1e-3, what = "") =>
  assert(Math.abs(actual - expected) <= rel * Math.abs(expected) + 1e-12, `${what}: expected ${expected}, got ${actual}`);

// Library: published properties agree with the plate model within the fillet allowance.
for (const s of FRAME_SECTIONS) {
  const g = section(s.shape, s.dims);
  assert(g && g.A > 0, `${s.id}: geometry`);
  if (s.props) {
    near(s.props.A, g.A, 0.12, `${s.id} area vs plates`);
    near(s.props.Ix, g.Ix, 0.08, `${s.id} Ix vs plates`);
    near(s.props.Sx, g.Ix / (s.dims.h / 2), 0.08, `${s.id} Sx vs plates`);
  }
  const p = memberSection({ sec: s.id });
  assert(p.A > 0 && p.I > 0 && p.S > 0 && p.Imin > 0 && p.Imin <= p.I * 1.0001, `${s.id}: member section`);
}
assert(frameMaterial("a992").Fy === 345e6);

const W = "W12x26";
const sec = memberSection({ sec: W });
const E = 200e9, EI = E * sec.I;
const beam = (supA, supB, loads, extra = {}) => ({
  nodes: [
    { id: "A", x: 0, y: 0, sup: supA },
    { id: "B", x: 6, y: 0, sup: supB },
  ],
  members: [{ id: "M1", a: "A", b: "B", sec: W, mat: "a992", ...extra }],
  loads,
});
const L = 6, w = 10e3, P = 20e3;
const udl = [{ on: "member", member: "M1", kind: "udl", dir: "down", w }];

// Simply supported, uniform load.
let r = solveFrame(beam("pin", "rollerY", udl));
assert(r.ok, r.error);
near(r.members[0].Mabs, (w * L * L) / 8, 1e-6, "SS udl M");
near(r.members[0].Mmax, (w * L * L) / 8, 1e-6, "SS udl sagging is positive");
near(r.members[0].defl, (5 * w * L ** 4) / (384 * EI), 1e-4, "SS udl δ");
near(r.reactions[0].Ry, (w * L) / 2, 1e-9, "SS reaction");
near(r.members[0].Vabs, (w * L) / 2, 1e-6, "SS shear");

// Same beam drawn right to left gives the same answers.
r = solveFrame({ ...beam("pin", "rollerY", udl), members: [{ id: "M1", a: "B", b: "A", sec: W, mat: "a992" }] });
near(r.members[0].Mmax, (w * L * L) / 8, 1e-6, "reversed beam sagging positive");
near(r.members[0].defl, (5 * w * L ** 4) / (384 * EI), 1e-4, "reversed δ");

// Fixed–fixed, uniform load.
r = solveFrame(beam("fixed", "fixed", udl));
near(r.members[0].Mmin, -(w * L * L) / 12, 1e-6, "FF end moment");
near(r.members[0].Mmax, (w * L * L) / 24, 1e-4, "FF midspan moment");
near(r.members[0].defl, (w * L ** 4) / (384 * EI), 1e-4, "FF δ");
near(Math.abs(r.reactions[0].M), (w * L * L) / 12, 1e-6, "FF reaction moment");

// Cantilever, end point load (applied at the free joint).
r = solveFrame(beam("fixed", "free", [{ on: "node", node: "B", Fx: 0, Fy: -P, M: 0 }]));
near(-r.nodes[1].dy, (P * L ** 3) / (3 * EI), 1e-6, "cantilever tip δ");
near(r.members[0].Mabs, P * L, 1e-6, "cantilever M");

// Off-centre point load on a simple span: M = P a b / L.
r = solveFrame(beam("pin", "rollerY", [{ on: "member", member: "M1", kind: "point", dir: "down", P, a: 2 }]));
near(r.members[0].Mmax, (P * 2 * 4) / L, 1e-6, "SS point M");
near(r.reactions[0].Ry, (P * 4) / L, 1e-9, "SS point RA");
near(r.members[0].Vabs, (P * 4) / L, 1e-6, "shear jump");

// Propped cantilever, uniform load: prop reaction 3wL/8, fixed-end moment wL²/8.
r = solveFrame(beam("fixed", "rollerY", udl));
near(r.reactions.find((x) => x.node === "B").Ry, (3 * w * L) / 8, 1e-6, "propped prop");
near(Math.abs(r.reactions.find((x) => x.node === "A").M), (w * L * L) / 8, 1e-6, "propped MA");

// A hinge at the fixed end turns it back into a simple span.
r = solveFrame(beam("fixed", "rollerY", udl, { hingeA: true }));
near(r.members[0].Mmax, (w * L * L) / 8, 1e-6, "hinged end");
near(r.reactions.find((x) => x.node === "A").M, 0, 1e-6, "no moment at a hinge");

// Axial bar: δ = P L / E A.
r = solveFrame(beam("pin", "rollerY", [{ on: "node", node: "B", Fx: P, Fy: 0, M: 0 }], { hingeA: true, hingeB: true }));
near(r.nodes[1].dx, (P * L) / (E * sec.A), 1e-9, "axial δ");
near(r.members[0].Nmax, P, 1e-9, "tension");
assert(r.ok && r.members[0].Mabs < 1e-6, "no bending in a two-force member");

// Triangle truss: apex load P, span 2a, rise h. Each diagonal carries P/(2 sinθ) in compression, the tie P/(2 tanθ) in tension.
const tri = solveFrame({
  nodes: [
    { id: "A", x: 0, y: 0, sup: "pin" },
    { id: "B", x: 4, y: 0, sup: "rollerY" },
    { id: "C", x: 2, y: 3, sup: "free" },
  ],
  members: [
    { id: "T", a: "A", b: "B", sec: "HSS3x3x1/4", mat: "a500", hingeA: true, hingeB: true },
    { id: "D1", a: "A", b: "C", sec: "HSS3x3x1/4", mat: "a500", hingeA: true, hingeB: true },
    { id: "D2", a: "B", b: "C", sec: "HSS3x3x1/4", mat: "a500", hingeA: true, hingeB: true },
  ],
  loads: [{ on: "node", node: "C", Fx: 0, Fy: -P, M: 0 }],
});
assert(tri.ok, tri.error);
const th = Math.atan2(3, 2);
near(tri.members[0].Nmax, P / (2 * Math.tan(th)), 1e-6, "truss tie");
near(-tri.members[1].Nmin, P / (2 * Math.sin(th)), 1e-6, "truss diagonal");

// Fixed-base portal under a lateral load with a very stiff beam: each column takes H/2 and
// sways Δ = (H/2) h³ / (12 E I).
const H = 10e3, h = 4;
const portal = solveFrame({
  nodes: [
    { id: "A", x: 0, y: 0, sup: "fixed" },
    { id: "B", x: 0, y: h },
    { id: "C", x: 6, y: h },
    { id: "D", x: 6, y: 0, sup: "fixed" },
  ],
  members: [
    { id: "C1", a: "A", b: "B", sec: W, mat: "a992" },
    { id: "BM", a: "B", b: "C", sec: "custom", custom: { shape: "props", A: 1, I: 1, S: 1 }, mat: "a992" },
    { id: "C2", a: "D", b: "C", sec: W, mat: "a992" },
  ],
  loads: [{ on: "node", node: "B", Fx: H, Fy: 0, M: 0 }],
});
assert(portal.ok, portal.error);
near(portal.nodes[1].dx, ((H / 2) * h ** 3) / (12 * EI), 1e-2, "portal sway (axial shortening adds a little)");
near(portal.reactions[0].Rx + portal.reactions[1].Rx, -H, 1e-9, "portal base shear");

// Mechanisms are reported, not solved.
const mech = solveFrame({
  nodes: [
    { id: "A", x: 0, y: 0, sup: "pin" },
    { id: "B", x: 0, y: 4 },
    { id: "C", x: 6, y: 4 },
    { id: "D", x: 6, y: 0, sup: "pin" },
  ],
  members: [
    { id: "M1", a: "A", b: "B", sec: W, mat: "a992", hingeB: true },
    { id: "M2", a: "B", b: "C", sec: W, mat: "a992" },
    { id: "M3", a: "D", b: "C", sec: W, mat: "a992", hingeB: true },
  ],
  loads: [{ on: "node", node: "B", Fx: 1000, Fy: 0, M: 0 }],
});
assert(!mech.ok && /mechanism/.test(mech.error), "mechanism detected");
assert(!solveFrame({ nodes: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 1, y: 0 }], members: [{ id: "M", a: "A", b: "B", sec: W, mat: "a992" }], loads: [] }).ok, "needs a support");

// Self-weight on a simple span: w = ρ A g.
r = solveFrame({ ...beam("pin", "rollerY", []), selfWeight: true });
near(r.members[0].Mmax, (7850 * sec.A * 9.80665 * L * L) / 8, 1e-6, "self weight");

// A sloped member under gravity balances.
r = solveFrame({
  nodes: [
    { id: "A", x: 0, y: 0, sup: "pin" },
    { id: "B", x: 4, y: 3, sup: "rollerY" },
  ],
  members: [{ id: "R", a: "A", b: "B", sec: W, mat: "a992" }],
  loads: [{ on: "member", member: "R", kind: "udl", dir: "down", w }],
});
near(r.reactions[0].Ry + r.reactions[1].Ry, w * 5, 1e-9, "sloped equilibrium");
near(r.members[0].Mmax, (w * 4 / 5) * 25 / 8, 1e-6, "sloped M uses the perpendicular component");

// Every template solves and balances, in both unit systems.
for (const t of FRAME_TEMPLATES) {
  if (t.id === "blank") continue;
  for (const us of [false, true]) {
    const m = frameTemplate(t.id, us);
    const res = solveFrame(m);
    assert(res.ok, `${t.id}: ${res.error}`);
    assert(!res.warnings.some((x) => /balance/.test(x)), `${t.id} balances`);
    assert(res.members.every((x) => Number.isFinite(x.util) && x.util > 0), `${t.id} utilization`);
  }
}

console.log("Frame builder checks passed.");
