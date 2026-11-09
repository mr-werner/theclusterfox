import assert from "node:assert/strict";
import { DIMS, convert, toSI, fromSI, parseNumber, fmt, CONVERTER_DIMS, defaultUnit } from "../model/units.js";
import { frictionFactor } from "../model/math.js";
import { standardAtmosphere, psychrometrics, satPressure } from "../model/air.js";
import { solveBeam, section, solveFreeBeam, parseBeamModel, stringifyBeamModel } from "../model/structures.js";
import { defaultsOf, run, applyPreset, matchingPreset, toParams, fromParams } from "../model/engine.js";
import { fluids } from "../calcs/fluids.js";
import { heat } from "../calcs/heat.js";
import { air } from "../calcs/air.js";
import { mechanics } from "../calcs/mechanics.js";
import { electrical } from "../calcs/electrical.js";
import { geometry } from "../calcs/geometry.js";
import { TABLES } from "../tables.js";
import { awgDiameter } from "../data/electrical.js";

const CALCS = [...fluids, ...heat, ...air, ...mechanics, ...electrical, ...geometry];
const near = (actual, expected, rel = 1e-3, what = "") =>
  assert(Math.abs(actual - expected) <= rel * Math.abs(expected), `${what}: expected ${expected}, got ${actual}`);
const result = (calc, id, values = {}) => {
  const c = CALCS.find((x) => x.id === calc);
  const r = run(c, { ...defaultsOf(c), ...values });
  const found = r.results.find((x) => x.id === id);
  assert(found, `${calc}: no result ${id} (${r.warnings.join("; ")})`);
  return found.value ?? found.text;
};

// Units.
near(convert(1, "pressure", "psi", "kPa"), 6.894757, 1e-6, "psi→kPa");
near(convert(100, "temp", "C", "F"), 212, 1e-9, "°C→°F");
near(convert(-40, "temp", "F", "C"), -40, 1e-9, "−40 °F");
near(convert(0, "temp", "C", "K"), 273.15, 1e-12, "0 °C→K");
near(convert(1, "flow", "gpm", "L/min"), 3.785411784, 1e-9, "gpm→L/min");
near(convert(1, "power", "TR", "BTU/h"), 12000, 1e-6, "ton→BTU/h");
near(convert(1, "energy", "kWh", "BTU"), 3412.14, 1e-5, "kWh→BTU");
near(convert(1, "conductivity", "BTU/hftF", "W/mK"), 1.730735, 1e-6, "k");
near(convert(1, "rvalue", "ft2Fh/BTU", "m2K/W"), 0.17611, 1e-4, "R");
near(convert(1, "dtemp", "dF", "dC"), 5 / 9, 1e-12, "ΔT");
near(fromSI(toSI(72, "temp", "F"), "temp", "F"), 72, 1e-12, "round trip");
for (const [id, d] of Object.entries(DIMS)) {
  assert(d.units.length && d.byId[d.si] && d.byId[d.us], `${id}: default units must exist`);
  for (const x of d.units) assert(x.f > 0, `${id}/${x.id}: factor`);
}
for (const d of CONVERTER_DIMS) assert(DIMS[d], `converter dim ${d}`);
assert.equal(parseNumber("4.7k"), 4700);
assert.equal(parseNumber("1 1/4"), 1.25);
assert.equal(parseNumber("3/8"), 0.375);
assert.equal(parseNumber("1,250.5"), 1250.5);
assert.equal(parseNumber("2e-3"), 0.002);
assert(Number.isNaN(parseNumber("abc")));
assert.equal(fmt(1234.567), "1,235");
assert.equal(fmt(0.000012346), "1.235 × 10⁻⁵");

// Friction factor matches the Moody chart (Re 1e5, ε/D 1e-4 → 0.0185) and laminar 64/Re.
near(frictionFactor(1e5, 1e-4), 0.0185, 5e-3, "Colebrook");
near(frictionFactor(1000, 0.01), 0.064, 1e-9, "laminar");
near(frictionFactor(1e7, 0), 0.0081, 1e-2, "smooth pipe");

// Standard atmosphere.
const sl = standardAtmosphere(0);
near(sl.p, 101325, 1e-9, "ISA p0");
near(sl.rho, 1.225, 1e-3, "ISA rho0");
near(sl.a, 340.29, 1e-4, "ISA a0");
near(standardAtmosphere(1609).p, 83430, 2e-3, "ISA Denver");
near(standardAtmosphere(11019).p, 22632, 2e-3, "ISA tropopause");
near(standardAtmosphere(11019).T, 216.65, 1e-4, "ISA tropopause T");

// Psychrometrics (ASHRAE): 24 °C, 50% RH, sea level.
near(satPressure(293.15), 2339.2, 2e-3, "psat 20 °C");
near(satPressure(373.15), 101418, 2e-3, "psat 100 °C");
const ps = psychrometrics(297.15, 0.5, 101325);
near(ps.W, 0.009298, 3e-3, "humidity ratio");
near(ps.h, 47810, 3e-3, "enthalpy");
near(ps.dew - 273.15, 12.96, 1e-2, "dew point");
near(ps.wet - 273.15, 17.05, 1e-2, "wet bulb");

// Beams: closed-form textbook cases.
const E = 200e9, I = 8.69e-6, L = 4, P = 10000, w = 5000;
const beam = (support, load) => solveBeam({ support, load, L, P, w, E, I, a: L / 2 });
near(beam("ss", "point").maxY, (P * L ** 3) / (48 * E * I), 1e-6, "SS point δ");
near(beam("ss", "point").maxM, (P * L) / 4, 1e-9, "SS point M");
near(beam("ss", "udl").maxY, (5 * w * L ** 4) / (384 * E * I), 1e-6, "SS udl δ");
near(beam("ss", "udl").maxM, (w * L * L) / 8, 1e-9, "SS udl M");
near(solveBeam({ support: "cant", load: "point", L, P, E, I, a: L }).maxY, (P * L ** 3) / (3 * E * I), 1e-6, "cantilever end δ");
near(Math.abs(solveBeam({ support: "cant", load: "point", L, P, E, I, a: L }).maxM), P * L, 1e-9, "cantilever M");
near(beam("cant", "udl").maxY, (w * L ** 4) / (8 * E * I), 1e-6, "cantilever udl δ");
near(beam("fixed", "udl").maxY, (w * L ** 4) / (384 * E * I), 1e-6, "fixed udl δ");
near(Math.abs(beam("fixed", "udl").maxM), (w * L * L) / 12, 1e-9, "fixed udl M");
near(beam("fixed", "point").maxY, (P * L ** 3) / (192 * E * I), 1e-6, "fixed point δ");
near(Math.abs(beam("fixed", "point").maxM), (P * L) / 8, 1e-9, "fixed point M");
{
  const off = solveBeam({ support: "ss", load: "point", L, P, E, I, a: 1 });
  near(off.RA, 7500, 1e-9, "SS off-center reaction");
  near(off.maxM, 7500, 1e-9, "SS off-center M = Pab/L");
  const fx = solveBeam({ support: "fixed", load: "point", L, P, E, I, a: 1 });
  const last = fx.pts[fx.pts.length - 1];
  near(last.M, -(P * 1 * 1 * 3) / 16, 1e-6, "fixed off-center right-end moment = −P a² b / L²");
  assert(Math.abs(last.y) < 1e-12 && Math.abs(fx.pts[0].y) < 1e-12, "fixed ends don't move");
}

// Sections.
near(section("rect", { b: 0.05, h: 0.1 }).Ix, (0.05 * 0.1 ** 3) / 12, 1e-12, "rect I");
near(section("round", { D: 0.1 }).Ix, (Math.PI * 0.1 ** 4) / 64, 1e-12, "round I");
{
  // IPE 160: h 160, b 82, tf 7.4, tw 5.0 → Iy-y ≈ 869 cm⁴ (the published value includes root fillets).
  const ipe = section("ibeam", { b: 0.082, h: 0.16, tf: 0.0074, tw: 0.005 });
  near(ipe.Ix, 869e-8, 0.05, "IPE 160 I");
}

// Angle 50×50×5 (sharp corners): A 475 mm², Iₓ 11.25 cm⁴, least I ≈ 4.59 cm⁴, centroid 14.3 mm (handbook with fillets: 480, 11.0, 4.59, 14.0).
{
  const L5 = section("angle", { b: 0.05, h: 0.05, t: 0.005 });
  near(L5.A, 475e-6, 1e-9, "angle A");
  near(L5.Ix, 11.2503e-8, 1e-4, "angle Ix");
  near(L5.Imin, 4.589e-8, 1e-3, "angle least I");
  near(L5.yc, 0.014342, 1e-4, "angle centroid");
}
// Tee 100×100×10: centroid 71.3 mm from the stem tip, I = 180 cm⁴.
near(section("tee", { b: 0.1, h: 0.1, tf: 0.01, tw: 0.01 }).yc, 0.0713158, 1e-5, "tee centroid");
near(section("tee", { b: 0.1, h: 0.1, tf: 0.01, tw: 0.01 }).Ix, 180.0044e-8, 1e-5, "tee I");
// Channel: symmetric about x, so Iₓ is the I-beam formula with the flanges moved to one side.
near(section("channel", { b: 0.05, h: 0.1, tf: 0.008, tw: 0.006 }).Ix, section("ibeam", { b: 0.05, h: 0.1, tf: 0.008, tw: 0.006 }).Ix, 1e-9, "channel Ix = I-beam Ix");
near(section("triangle", { b: 0.1, h: 0.1 }).Ix, (0.1 * 0.1 ** 3) / 36, 1e-12, "triangle I");
near(section("hex", { s: 0.02 }).A, (Math.sqrt(3) / 2) * 0.02 ** 2, 1e-12, "hex area");

// Beam builder (stiffness method) against closed-form beams.
{
  const fb = (items, Lb = L) => solveFreeBeam({ L: Lb, E, I, items });
  const ss = fb([{ kind: "pin", x: 0 }, { kind: "roller", x: L }, { kind: "point", P, x: 1.3 }]);
  const ssRef = solveBeam({ support: "ss", load: "point", L, P, a: 1.3, E, I });
  near(ss.maxY, ssRef.maxY, 1e-4, "builder SS point δ");
  near(ss.maxM, ssRef.maxM, 1e-6, "builder SS point M");
  near(fb([{ kind: "fixed", x: 0 }, { kind: "udl", w1: w, w2: w, x1: 0, x2: L }]).maxY, (w * L ** 4) / (8 * E * I), 1e-5, "builder cantilever udl δ");
  const ff = fb([{ kind: "fixed", x: 0 }, { kind: "fixed", x: L }, { kind: "point", P, x: 1 }]);
  near(ff.minM, -(P * 1 * 3 * 3) / 16, 1e-6, "builder fixed-end moment P a b² / L²");
  // Two equal spans, uniform load: outer reactions 3/8 wL, middle 5/4 wL, support moment −wL²/8.
  const two = fb([{ kind: "pin", x: 0 }, { kind: "roller", x: 4 }, { kind: "roller", x: 8 }, { kind: "udl", w1: w, w2: w, x1: 0, x2: 8 }], 8);
  near(two.reactions[0].R, (3 / 8) * w * 4, 1e-6, "two-span end reaction");
  near(two.reactions[1].R, (5 / 4) * w * 4, 1e-6, "two-span middle reaction");
  near(two.minM, (-w * 16) / 8, 1e-6, "two-span support moment");
  // Triangular load on a simple span: reactions wL/6 and wL/3, M max = wL²/(9√3).
  const tri = fb([{ kind: "pin", x: 0 }, { kind: "roller", x: L }, { kind: "udl", w1: 0, w2: w, x1: 0, x2: L }]);
  near(tri.reactions[1].R, (w * L) / 3, 1e-6, "triangular load reaction");
  near(tri.maxM, (w * L * L) / (9 * Math.sqrt(3)), 1e-4, "triangular load moment");
  // A clockwise couple on a simple span: reactions ±M/L.
  near(fb([{ kind: "pin", x: 0 }, { kind: "roller", x: L }, { kind: "moment", M: 1000, x: 1 }]).reactions[0].R, -1000 / L, 1e-6, "couple reaction");
  // Equilibrium: reactions balance the load.
  const odd = fb([{ kind: "pin", x: 0.5 }, { kind: "roller", x: 3 }, { kind: "fixed", x: 4 }, { kind: "point", P: 7000, x: 0 }, { kind: "udl", w1: 2000, w2: 9000, x1: 1, x2: 3.7 }]);
  near(odd.reactions.reduce((s, r) => s + r.R, 0), odd.totalLoad, 1e-6, "builder equilibrium");
  assert(fb([{ kind: "pin", x: 0 }, { kind: "point", P, x: 2 }]).error, "one pin is a mechanism");
  const text = "pin@0;roller@4;roller@8;w6000@0-8;P15000@6;M2000@3;w0:3000@1-2";
  assert.equal(stringifyBeamModel(parseBeamModel(text)), text, "beam model round trip");
}

// Wire gauge.
near(awgDiameter("12") * 1000, 2.053, 1e-3, "12 AWG");
near(awgDiameter("4/0") * 1000, 11.684, 1e-3, "4/0 AWG");

// Calculators against hand checks.
near(result("pipe-velocity", "v"), 0.005 / ((Math.PI * 0.0525 ** 2) / 4), 1e-4, "velocity");
near(result("heat-energy", "Q"), 100 * 4182 * 40, 1e-9, "Q = m c ΔT");
near(result("bolt-torque", "T"), 0.2 * 0.75 * 580e6 * 58e-6 * 0.01, 1e-9, "M10 8.8 torque");
near(result("voltage-drop", "Vd"), (2 * 30 * 16 * 1.724e-8 * (1 + 0.00393 * 55)) / ((Math.PI * awgDiameter("12") ** 2) / 4), 1e-9, "voltage drop");
assert.equal(result("resistor-code", "R"), "4.7 kΩ");
near(result("tank-volume", "pct", { h: 0.75 }), 0.5, 1e-9, "half-full horizontal tank");
near(result("tank-volume", "fill", { shape: "sphere", h: 1.5 }), (Math.PI * 1.5 ** 3) / 6, 1e-9, "full sphere");
near(result("series-parallel", "p", { list: "100, 100" }), 50, 1e-12, "parallel");
near(result("air-heat", "q", { Q: toSI(1000, "flow", "cfm"), dT: toSI(20, "dtemp", "dF") }), convert(1.08 * 1000 * 20, "power", "BTU/h", "W"), 0.02, "1.08 rule");
near(result("hydrostatic", "pg", { h: 10, rho: 1000 }), 98066.5, 1e-9, "10 m water");
near(result("standard-atmosphere", "p", { z: 0 }), 101325, 1e-9, "ISA calc");
near(result("ohms-law", "R"), 6, 1e-12, "Ohm");
near(result("three-phase", "P"), Math.sqrt(3) * 480 * 50 * 0.85, 1e-9, "3φ");
near(result("ideal-gas", "rho"), 1.225, 2e-3, "air density at 15 °C");
near(result("beam", "R2", { setup: "custom", L: 8, model: "pin@0;roller@5;w6000@0-5;P12000@8", I: 2.77e-5 }), 34200, 1e-6, "builder: overhang reaction");
{
  // The builder seeded from a standard case gives the same answer as the formula.
  const c = CALCS.find((x) => x.id === "beam");
  const simple = { ...defaultsOf(c), load: "udl" };
  const custom = c.onSet({ ...simple, setup: "custom" }, "setup", simple);
  assert(custom.model, "switching to the builder seeds a model");
  near(result("beam", "y", custom), result("beam", "y", simple), 1e-6, "builder matches standard case");
}

// Every calculator: valid definitions, defaults compute cleanly, presets point at real inputs.
const ids = new Set();
for (const c of CALCS) {
  assert(!ids.has(c.id), `duplicate calc ${c.id}`);
  ids.add(c.id);
  assert(c.name && c.blurb && c.about && c.formula?.length, `${c.id}: needs name, blurb, about, formula`);
  const inputIds = new Set(c.inputs.map((i) => i.id));
  for (const i of c.inputs) {
    if (i.type === "num") assert(DIMS[i.dim], `${c.id}.${i.id}: unknown dim ${i.dim}`);
    if (i.type === "preset") {
      for (const o of i.options) assert(Object.keys(o.set).length === 0 || Object.keys(o.set).some((k) => inputIds.has(k)), `${c.id}.${i.id}: preset ${o.label} sets nothing here`);
      assert(i.options.some((o) => o.label === i.value), `${c.id}.${i.id}: default preset ${i.value} missing`);
    }
    if (i.type === "choice") assert(i.options.some((o) => o.value === i.value), `${c.id}.${i.id}: default choice`);
  }
  for (const r of c.related || []) assert(CALCS.some((x) => x.id === r), `${c.id}: related ${r} missing`);
  const values = defaultsOf(c);
  // Each default preset matches the default values, so the dropdown doesn't start on "Custom".
  for (const i of c.inputs.filter((x) => x.type === "preset")) {
    const label = matchingPreset(i, values);
    const opt = i.options.find((o) => o.label === i.value);
    if (Object.keys(opt.set).length) assert.equal(label, i.value, `${c.id}.${i.id}: defaults don't match preset ${i.value}`);
  }
  // Try every choice option too.
  const variants = [values];
  for (const i of c.inputs.filter((x) => x.type === "choice")) for (const o of i.options) variants.push({ ...values, [i.id]: o.value });
  for (const v of variants) {
    const r = run(c, v);
    assert(r.results.length, `${c.id}: no results for ${JSON.stringify(v)} — ${r.warnings.join("; ")}`);
    for (const x of r.results) {
      if (x.text === undefined) {
        assert(DIMS[x.dim], `${c.id}.${x.id}: unknown dim ${x.dim}`);
        assert(Number.isFinite(x.value), `${c.id}.${x.id}: not finite (${x.value}) for ${JSON.stringify(v)}`);
        if (x.unit) assert(DIMS[x.dim].byId[x.unit], `${c.id}.${x.id}: unknown unit ${x.unit}`);
      }
    }
    assert.equal(r.results.filter((x) => x.primary).length, 1, `${c.id}: exactly one primary result`);
  }
  // Presets apply.
  for (const i of c.inputs.filter((x) => x.type === "preset")) {
    const last = i.options[i.options.length - 1];
    const v = applyPreset(c, values, i.id, last.label);
    assert.equal(matchingPreset(i, v), Object.keys(last.set).length ? last.label : matchingPreset(i, v));
  }
  // URL round trip.
  const changed = { ...values };
  const firstNum = c.inputs.find((i) => i.type === "num");
  if (firstNum) changed[firstNum.id] = firstNum.value * 1.5 + 1;
  const back = fromParams(c, new URLSearchParams(toParams(c, changed)));
  for (const [k, v] of Object.entries(changed)) {
    if (typeof v === "number") near(back[k], v, 1e-9, `${c.id}: URL ${k}`);
    else assert.equal(back[k], v);
  }
}

// Tables: columns valid, numbers finite where present.
const tableIds = new Set();
for (const t of TABLES) {
  assert(!tableIds.has(t.id), `duplicate table ${t.id}`);
  tableIds.add(t.id);
  assert(t.rows.length > 0, `${t.id}: empty`);
  for (const c of t.columns) {
    if (c.text) continue;
    assert(DIMS[c.dim], `${t.id}.${c.id}: dim ${c.dim}`);
    if (c.unit) assert(DIMS[c.dim].byId[c.unit], `${t.id}.${c.id}: unit ${c.unit}`);
    for (const r of t.rows) assert(r[c.id] === null || Number.isFinite(r[c.id]), `${t.id}.${c.id}: bad value ${r[c.id]}`);
  }
  if (t.chart) assert(t.columns.some((c) => c.id === t.chart.x) && t.columns.some((c) => c.id === t.chart.y), `${t.id}: chart columns`);
}

console.log(`Engineer ToolFox: ${CALCS.length} calculators and ${TABLES.length} tables check out.`);

// Calc reports: inputs and results in the units on screen, CSV safe for Excel.
{
  const { inputRows, resultRows, reportText, reportCsv } = await import("../model/report.js");
  const calc = fluids.find((c) => c.id === "pressure-drop");
  const values = defaultsOf(calc);
  const out = run(calc, values);
  const metric = (dim) => defaultUnit(dim, "si");
  const inputs = inputRows(calc, values, metric);
  const results = resultRows(out.results, (r) => r.unit || metric(r.dim));
  assert(inputs.some((r) => r.label === "Pipe length" && r.value === "100" && r.unit === "m"), "length input in metres");
  assert(results.length === out.results.length && results[0].value !== "—", "every result written out");
  const text = reportText({ calc, inputs, results, date: new Date("2026-01-02") });
  assert(text.includes("2026-01-02") && text.includes("Equations") && text.includes("Sources"));
  const csv = reportCsv({ inputs, results });
  assert(csv.startsWith("﻿Section,Quantity,Value,Unit"));
  assert(csv.includes("Reynolds number,") && !csv.includes("−"), "no unicode minus or thousands commas in numbers");
  console.log("Engineer ToolFox: calc reports check out.");
}

// Fan and duct system sizer.
{
  const S = await import("../model/airsystem.js");
  const cfm = (x) => toSI(x, "flow", "cfm");
  const inch = 0.0254, ft = 0.3048;
  const stdAir = { rho: S.STD_RHO, mu: 1.8205e-5, ratio: 1 };
  // A 12 in galvanized duct at 1,000 cfm reads about 0.15–0.2 in. w.g. per 100 ft on a duct friction chart.
  const d12 = { kind: "duct", shape: "round", D: 12 * inch, L: 100 * ft, mat: "g" };
  const r12 = S.ductLoss(d12, cfm(1000), stdAir);
  const per100 = fromSI(r12.dp, "pressure", "inH2O");
  assert(per100 > 0.15 && per100 < 0.2, `12 in at 1000 cfm: ${per100} in/100 ft`);
  near(fromSI(r12.v, "velocity", "fpm"), 1273.2, 1e-3, "12 in duct velocity");
  // Velocity pressure of 1,000 fpm standard air is about 0.0623 in. w.g. (V/4005)².
  const pv = S.solveSystem([{ ...d12, L: 0 }, { kind: "fit", type: "exit", n: 1 }], cfm(Math.PI / 4 * 1000), stdAir);
  near(fromSI(pv.fit, "pressure", "inH2O"), (1000 / 4005) ** 2, 4e-3, "velocity pressure");
  // Branch takeoffs use the downstream duct's velocity; elbows the upstream one.
  const path = [d12, { kind: "fit", type: "teeB", n: 1 }, { kind: "duct", shape: "round", D: 8 * inch, L: 1, mat: "g", Q: cfm(300) }];
  const sol = S.solveSystem(path, cfm(1000), stdAir);
  near(sol.rows[1].v, sol.rows[2].v, 1e-12, "branch fitting on branch velocity");
  // Model text round-trips.
  const text = "d,r,0.3048,30.48,g;f,el90r,2;f,custom,1,0.7;d,x,0.5,0.3,10,l,0.4;c,ccoil,150";
  assert.equal(S.stringifySystem(S.parseSystem(text)), text);
  // Components scale with flow squared; the system curve starts at zero and rises.
  const comp = [{ kind: "comp", type: "filt", dp: 100 }];
  near(S.solveSystem(comp, 1, stdAir, 2).total, 400, 1e-12, "component ∝ Q²");
  // Denver air is about 83% of standard density, and the standard-air pressure is higher by that ratio.
  const den = S.siteAir(1609, 294.26, 0);
  assert(den.ratio > 0.81 && den.ratio < 0.85, `Denver density ratio ${den.ratio}`);
  const calc = air.find((c) => c.id === "fan-system");
  const base = run(calc, defaultsOf(calc));
  const high = run(calc, { ...defaultsOf(calc), z: 1609 });
  const val = (o, id) => o.results.find((r) => r.id === id).value;
  assert(val(high, "sys") < val(base, "sys"), "thinner air, less duct loss");
  near(val(high, "Pstd"), val(high, "P") / val(high, "ratio"), 1e-12, "standard-air pressure");
  near(val(base, "bhp"), (val(base, "P") * defaultsOf(calc).Q) / defaultsOf(calc).fanEff, 1e-12, "brake power");
  // The fan's operating point sits on both curves.
  const withFan = run(calc, { ...defaultsOf(calc), fan: "curve" });
  const op = withFan.visual.fan.op;
  assert(op, "fan operating point found");
  const sysAtOp = S.solveSystem(S.parseSystem(defaultsOf(calc).model), defaultsOf(calc).Q, withFan.visual.air, op.Q).total;
  near(op.P, sysAtOp, 1e-6, "operating point on the system curve");
  assert(op.Q >= defaultsOf(calc).Q, "example fan meets the design airflow");
  // Auto-size picks the smallest standard size meeting 0.1 in/100 ft: 1,000 cfm → 14 in.
  const D = S.sizeRound(cfm(1000), stdAir, "g", toSI(0.1, "pressureGradient", "inH2O/100ft"), 0, S.roundSizes("us"));
  near(D / inch, 14, 1e-9, "auto-size 1000 cfm");
  assert.equal(S.standardMotor(700).label, "1 hp (0.75 kW)");
  console.log("Engineer ToolFox: fan and duct system checks out.");
}
