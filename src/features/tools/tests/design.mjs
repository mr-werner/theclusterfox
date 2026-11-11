// Design & Manufacturing: GD&T checks and the process recommender.
import assert from "node:assert/strict";
import { CALLOUTS, HOLE, PIN, bonusFor, calloutById, evaluate, initialState, runoutFim, virtualCondition } from "../design/gdtModel.js";
import { evaluatePattern, evaluateShift, holeMadeIn, seatPart } from "../design/gdtLessons.js";
import { PROCESSES, FEATURES, MATERIALS, SHAPES, capableOf, fit, recommend } from "../design/processes.js";

const near = (a, b, tol = 1e-6, what = "") => assert(Math.abs(a - b) <= tol, `${what}: expected ${b}, got ${a}`);
const run = (id, patch = {}) => {
  const c = calloutById[id];
  return evaluate(c, { ...initialState(c), ...patch });
};

// Every callout evaluates from its starting state, and has the text the page shows.
for (const c of CALLOUTS) {
  const r = evaluate(c, initialState(c));
  assert(Array.isArray(r.checks) && r.checks.length, `${c.id} has checks`);
  assert.equal(typeof r.ok, "boolean", `${c.id} ok`);
  for (const k of ["means", "zone", "part", "accept", "datums", "modifiers", "inspect"]) assert(c.text[k], `${c.id} explains ${k}`);
  assert(c.text.mistakes.length, `${c.id} lists mistakes`);
  assert(c.read(initialState(c), (v) => `${v} mm`).length > 20, `${c.id} reads aloud`);
  assert(c.make.char && c.make.feature, `${c.id} links to manufacturing`);
  for (const p of c.params(initialState(c))) assert(p.choices || (p.min < p.max && p.step > 0), `${c.id}.${p.key} range`);
}
assert.equal(new Set(CALLOUTS.map((c) => c.id)).size, CALLOUTS.length, "unique ids");

// Material condition: bonus and virtual condition.
near(bonusFor("MMC", HOLE, 10.06), 0.06, 1e-9, "hole MMC bonus");
near(bonusFor("LMC", HOLE, 10.06), 0.04, 1e-9, "hole LMC bonus");
near(bonusFor("RFS", HOLE, 10.06), 0, 1e-9, "RFS no bonus");
near(bonusFor("MMC", PIN, 9.95), 0.15, 1e-9, "pin MMC bonus");
near(virtualCondition("MMC", HOLE, 0.2), 9.8, 1e-9, "hole VC");
near(virtualCondition("MMC", PIN, 0.05), 10.15, 1e-9, "pin VC");

// Flatness ignores tilt; parallelism doesn't.
assert(run("flatness", { tol: 0.05, wave: 0.04, tilt: 0.15 }).checks[0].ok, "tilted but flat passes flatness");
assert(!run("parallelism", { tol: 0.05, wave: 0.04, tilt: 0.15 }).ok, "tilted fails parallelism");
assert(!run("flatness", { tol: 0.05, wave: 0.04, tilt: 0.25 }).ok, "too much tilt fails on size (Rule #1)");

// Position: 2 × radial offset, bonus at MMC, square zone without ⌀.
{
  const r = run("position", { tol: 0.2, dia: true, mod: "MMC", dx: 0.06, dy: 0.08, size: 10.0 });
  near(r.main.measured, 0.2, 1e-9, "position error");
  assert(r.ok, "on the edge passes");
  assert(!run("position", { tol: 0.2, mod: "RFS", dx: 0.09, dy: 0.08, size: 10.05 }).ok, "RFS no bonus fails");
  assert(run("position", { tol: 0.2, mod: "MMC", dx: 0.09, dy: 0.08, size: 10.05 }).ok, "MMC bonus passes");
  const sq = run("position", { tol: 0.2, dia: false, dx: 0.09, dy: 0.09, mod: "RFS", size: 10.05 });
  near(sq.main.measured, 0.18, 1e-9, "square zone");
  assert(sq.ok, "corner of a square zone passes where a round zone fails");
  assert(!run("position", { size: 10.2 }).ok, "out of size fails");
  assert(!run("position", { datums: [] }).ok, "position needs a datum");
  assert(run("position", { datums: ["A", "B"], dx: 0, dy: 0.3, tol: 0.1, mod: "RFS" }).ok, "without C, Y isn't checked");
}

// Straightness: Rule #1 for surface lines, bonus for axis at MMC.
assert(!run("straightness", { mode: "line", tol: 0.1, bow: 0.05, wave: 0, size: 10.08 }).ok, "envelope");
assert(run("straightness", { mode: "axis", tol: 0.02, mod: "MMC", bow: 0.1, size: 9.95 }).ok, "axis bonus");

// Profile: datums lock the zone.
assert(run("profile-surface", { datums: [], shift: 0.2, tilt: 0.1, bump: 0.05, tol: 0.1 }).ok, "floating profile ignores shift");
assert(!run("profile-surface", { datums: ["A"], shift: 0.2, tilt: 0, bump: 0, tol: 0.1 }).ok, "datum profile counts shift");

// Runout: total sees taper, circular doesn't.
{
  const s = { e: 0, amp: 0, bow: 0, taper: 0.04 };
  near(runoutFim(s, false), 0, 1e-9, "taper invisible to circular runout");
  near(runoutFim(s, true), 0.02, 1e-6, "taper shows in total runout");
  near(runoutFim({ e: 0.01, amp: 0, bow: 0, taper: 0 }, false), 0.02, 1e-4, "2 × eccentricity");
}

// Angularity: a width, not an angle.
near(run("angularity", { err: 0, wave: 0.02 }).main.measured, 0.02, 1e-9, "only waviness at zero error");

// Processes are complete and sane.
const mats = new Set(MATERIALS.map((m) => m.id)), shapes = new Set(SHAPES.map((s) => s.id)), feats = new Set(FEATURES.map((f) => f.id));
for (const p of PROCESSES) {
  assert(p.tol[0] <= p.tol[1] && p.ra[0] <= p.ra[1], `${p.id} best ≤ typical`);
  for (const v of Object.values(p.caps)) assert(v[0] <= v[1], `${p.id} cap order`);
  assert(p.materials.every((m) => mats.has(m)) && p.shapes.every((s) => shapes.has(s)) && p.features.every((f) => feats.has(f)), `${p.id} known ids`);
  assert(p.machines.length && p.how && p.good && p.limits, `${p.id} described`);
}
assert.equal(fit([0.01, 0.05], 0.1), 2);
assert.equal(fit([0.01, 0.05], 0.02), 1);
assert.equal(fit([0.01, 0.05], 0.005), 0);

// A turned steel shaft with a ground-class bearing seat: turn, then grind.
{
  const r = recommend({ material: "steel", shape: "round", features: ["od"], tol: 0.003, ra: 0.4, qty: 100 });
  assert(["turning", "swiss"].includes(r.route[0].p.id), `turned first, got ${r.route[0].p.id}`);
  assert(r.route.some((s) => s.p && ["cyl-grind", "centerless"].includes(s.p.id)), "then ground");
}
// An aluminium bracket, loose tolerance, one-off: milled, nothing else.
{
  const r = recommend({ material: "al", shape: "prismatic", features: ["flat", "holes", "pockets"], tol: 0.1, ra: 3.2, qty: 1 });
  assert.equal(r.route[0].p.id, "milling");
  assert.equal(r.route.length, 1, "no finishing needed");
}
// Plastic enclosure at 100k: molded.
assert.equal(recommend({ material: "plastic", shape: "complex", features: ["thin", "holes"], tol: 0.1, ra: 1.6, qty: 100000 }).route[0].p.id, "injection");
// Sheet steel bracket: cut from sheet.
assert(["laser", "punching", "press-brake", "stamping"].includes(recommend({ material: "steel", shape: "sheet", features: ["profile", "holes", "bends"], tol: 0.2, ra: 6.3, qty: 50 }).route[0].p.id));
// GD&T link: lapping is the way to 0.001 flatness.
assert(capableOf("flatness", 0.001).some((x) => x.p.id === "lapping"));
assert(!capableOf("flatness", 0.001).some((x) => x.p.id === "milling"));

// Straightness on a surface line is a flat bar: no ⌀ in its size.
{
  const c = calloutById.straightness;
  const st = { ...initialState(c), mode: "line" };
  assert(!c.params(st).some((p) => p.label.includes("⌀")), "surface line has no diameter input");
  assert(!evaluate(c, st).checks.some((k) => k.label.includes("⌀")), "surface line checks have no ⌀");
}

// Datum shift: MMB lets the whole pattern shift, RMB doesn't, and shift can't save a stray hole.
{
  const base = { tol: 0.2, mod: "RFS", bore: 20.08, hole: 8.0, dx: 0.12, dy: 0, solo: 0 };
  assert(!evaluateShift({ ...base, dmod: "RMB" }).ok, "RMB: pattern off 0.12 fails");
  const m = evaluateShift({ ...base, dmod: "MMB" });
  assert(m.ok, "MMB: shift saves it");
  near(Math.max(...m.errors), 0.16, 1e-3, "0.12 − 0.04 slide, ×2");
  const stray = evaluateShift({ ...base, dmod: "MMB", bore: 20.06, dx: 0, solo: 0.14 });
  assert(!stray.ok, "shift can't rescue one stray hole");
  near(evaluateShift({ ...base, dmod: "MMB", bore: 20.06, dx: 0, solo: 0.13 }).errors[0], 0.2, 2e-3, "stray hole after the best slide");
}

// Hole patterns: composite accepts a shifted pattern that single rejects, and the lower line matches assembly.
{
  const s = { px: 0.25, py: -0.15, rotDeg: 0, stray: 0, hole: 8.45, single: 0.4, upper: 0.8, lower: 0.4 };
  const r = evaluatePattern(s);
  assert(!r.single.ok && r.composite.ok && r.assembles, "shifted pattern: composite and cover agree");
  const bad = evaluatePattern({ ...s, px: 0, py: 0, hole: 8.4, stray: 0.4 });
  assert(!bad.lower.ok && !bad.assembles, "stray hole fails the lower line and the cover");
  const ok = evaluatePattern({ ...s, px: 0, py: 0, hole: 8.4, stray: 0.3 });
  assert(ok.lower.ok && ok.assembles && !ok.single.ok, "best fit shares one stray hole's error");
}

// Datum order: a part drilled A|B measures perfect A|B and fails B|A.
{
  const h = holeMadeIn("AB", 0.25);
  near(seatPart("AB", 0.25, h).error, 0, 1e-9, "same order as made");
  near(seatPart("BA", 0.25, h).error, 0.316, 2e-3, "other order");
  near(seatPart("BA", 0, holeMadeIn("AB", 0)).error, 0, 1e-9, "square part doesn't care");
}

console.log("design: all checks passed");
