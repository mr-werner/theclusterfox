import { num, choice, preset, text, out, say } from "./define.js";
import { G } from "../model/units.js";
import { standardAtmosphere } from "../model/air.js";
import { waterAt } from "../data/fluids.js";
import { parseModel, solveSystem, pumpCurve, operatingPoint, curves, runLabel, DEFAULT_MODEL } from "../model/pumpSystem.js";

// Liquids with the vapour pressure that NPSH needs. Water comes from the IAPWS
// table; the others are typical values near 20 °C (fuels vary with blend).
const water = (c) => {
  const T = c + 273.15;
  return { label: `Water, ${c} °C`, set: { rho: Number(waterAt("rho", T).toFixed(2)), mu: Number(waterAt("mu", T).toPrecision(4)), pv: Number(waterAt("pv", T).toPrecision(4)) } };
};
const PUMP_FLUIDS = [
  ...[5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90].map(water),
  { label: "Seawater, 20 °C", set: { rho: 1025, mu: 1.08e-3, pv: 2300 } },
  { label: "Glycol 50/50 (ethylene), 20 °C", set: { rho: 1070, mu: 3.8e-3, pv: 1500 } },
  { label: "Ethanol, 20 °C", set: { rho: 789, mu: 1.2e-3, pv: 5900 } },
  { label: "Methanol, 20 °C", set: { rho: 792, mu: 0.59e-3, pv: 13000 } },
  { label: "Gasoline (typical), 20 °C", set: { rho: 740, mu: 0.6e-3, pv: 40000 } },
  { label: "Diesel (typical), 20 °C", set: { rho: 840, mu: 3e-3, pv: 100 } },
  { label: "Hydraulic oil ISO VG 46, 40 °C", set: { rho: 860, mu: 0.04, pv: 1 } },
];

const GPM = 6.30901964e-5;
const FT = 0.3048;

export const pumpSystem = {
  id: "pump-system",
  cat: "fluids",
  name: "Pump system builder (NPSH and pump head)",
  blurb: "Lay out the suction and discharge piping to get NPSH available, total head, the system curve and the pump's operating point.",
  keywords: "npsh npsha npshr net positive suction head pump sizing total dynamic head tdh system curve operating point cavitation suction lift flooded suction piping system fittings elevation pump selection",
  inputs: [
    num("Q", "Design flow rate", "flow", 200 * GPM, { min: 0 }),
    text("model", "Pipe runs", DEFAULT_MODEL, { hidden: true }),
    preset("fluid", "Fluid", PUMP_FLUIDS, { value: "Water, 20 °C" }),
    num("rho", "Density", "density", PUMP_FLUIDS[3].set.rho, { min: 0 }),
    num("mu", "Dynamic viscosity", "dynvisc", PUMP_FLUIDS[3].set.mu, { min: 0 }),
    num("pv", "Vapour pressure (absolute)", "pressure", PUMP_FLUIDS[3].set.pv, { min: 0, hint: "At the pumping temperature. Hot water and light fuels have high vapour pressure, which eats into NPSH." }),
    num("site", "Site elevation above sea level", "length", 0, { hint: "Sets the atmospheric pressure. Every 300 m (1,000 ft) of altitude costs about 0.35 m (1.2 ft) of NPSH." }),
    choice("src", "Supply", [
      { value: "open", label: "Open tank" },
      { value: "closed", label: "Closed tank" },
    ]),
    num("srcP", "Pressure above the liquid (gauge)", "pressure", 0, { when: (v) => v.src === "closed", hint: "Negative for a vacuum, such as a condenser hotwell." }),
    num("zs", "Supply liquid level above the pump", "length", 10 * FT, { hint: "Negative if the liquid is below the pump (suction lift)." }),
    choice("dst", "Delivers to", [
      { value: "tank", label: "A tank" },
      { value: "free", label: "Open pipe end" },
    ]),
    num("zd", "Destination liquid level above the pump", "length", 40 * FT, { when: (v) => v.dst === "tank" }),
    num("dstP", "Destination pressure (gauge)", "pressure", 0, { when: (v) => v.dst === "tank", hint: "Pressure in a closed tank or boiler, or the residual pressure needed at the end." }),
    num("NPSHr", "Pump NPSH required (0 to skip)", "length", 3, { min: 0, hint: "From the pump curve at your flow. Leave 0 if you don't have a pump picked yet." }),
    num("H0", "Pump curve: shutoff head (0 to skip)", "length", 0, { min: 0 }),
    num("Qr", "Pump curve: rated flow", "flow", 200 * GPM, { min: 0, when: (v) => v.H0 > 0 }),
    num("Hr", "Pump curve: rated head", "length", 0, { min: 0, when: (v) => v.H0 > 0 }),
    num("Qm", "Pump curve: run-out flow (optional)", "flow", 0, { min: 0, when: (v) => v.H0 > 0 }),
    num("Hm", "Pump curve: head at run-out (optional)", "length", 0, { min: 0, when: (v) => v.H0 > 0 }),
    num("eta", "Pump efficiency", "percent", 0.7, { min: 0.01, max: 1 }),
    num("etaM", "Motor efficiency", "percent", 0.92, { min: 0.01, max: 1 }),
  ],
  compute: (v) => {
    const runs = parseModel(v.model);
    const patm = standardAtmosphere(v.site).p;
    const p = { rho: v.rho, mu: v.mu, pv: v.pv, patm, srcP: v.src === "closed" ? v.srcP : 0, zs: v.zs, dst: v.dst, zd: v.zd, dstP: v.dstP };
    const warnings = [];
    const bad = runs.find((r) => !(r.L >= 0) || (r.D !== undefined && !(r.D > 0)));
    if (bad) return { results: [], warnings: ["Each pipe run needs a length of zero or more, and custom pipes need an inside diameter."] };
    if (!runs.some((r) => r.side === "d")) warnings.push("There's no discharge piping yet, so the head is just the lift to the destination.");

    const s = solveSystem(runs, v.Q, p);
    const g = v.rho * G;
    const curve = v.H0 > 0 ? pumpCurve({ H0: v.H0, Qr: v.Qr, Hr: v.Hr, Qm: v.Qm, Hm: v.Hm }) : null;
    const op = curve ? operatingPoint(runs, p, curve, v.Qr) : null;
    const opSys = op ? solveSystem(runs, op.Q, p) : null;

    const results = [out("NPSHa", "NPSH available", "length", s.NPSHa, { primary: true })];
    if (v.NPSHr > 0) {
      const margin = s.NPSHa - v.NPSHr;
      const ratio = s.NPSHa / v.NPSHr;
      results.push(out("margin", "NPSH margin (available − required)", "length", margin));
      results.push(out("ratio", "NPSH margin ratio (NPSHa / NPSHr)", "none", ratio));
      const verdict = margin <= 0 ? "Fails: the pump will cavitate" : ratio < 1.1 || margin < 0.6 ? "Too tight: expect cavitation at times" : ratio < 1.3 ? "Marginal: fine for clean, cool water only" : "OK";
      results.push(say("npshCheck", "NPSH check", verdict));
      if (margin <= 0) warnings.push("NPSH available is below what the pump needs. Raise the supply level, shorten or upsize the suction pipe, cool the liquid, or pick a pump with lower NPSHr.");
      else if (ratio < 1.3 || margin < 0.6) warnings.push("The NPSH margin is thin. Hydraulic Institute 9.6.1 suggests a margin ratio of 1.1 to 2.5 depending on the service, and at least about 0.6–1.5 m (2–5 ft) for most pumps.");
    }
    results.push(
      out("TDH", "Total dynamic head at design flow", "length", s.TDH),
      out("static", "Static head (lift plus pressure difference)", "length", s.staticHead),
      out("hfS", "Suction side losses", "length", s.hfS),
      out("hfD", "Discharge side losses", "length", s.hfD),
      out("pS", "Pressure at pump suction (gauge)", "pressure", s.pSuction),
      out("pD", "Pressure at pump discharge (gauge)", "pressure", s.pDischarge),
      out("patm", "Atmospheric pressure at site", "pressure", patm)
    );
    if (op) {
      results.push(
        out("Qop", "Operating point: flow", "flow", op.Q),
        out("Hop", "Operating point: head", "length", op.H),
        out("NPSHop", "NPSH available at operating flow", "length", opSys.NPSHa)
      );
      if (v.NPSHr > 0 && opSys.NPSHa < v.NPSHr * 1.1) warnings.push("At the flow where the pump actually settles, NPSH available is too close to (or below) NPSH required. NPSHr rises with flow, so check the pump curve at that flow.");
      if (op.Q < v.Q * 0.9) warnings.push("The pump settles below your design flow. A bigger impeller, a faster speed or a lower-loss system would close the gap.");
      if (op.Q > v.Q * 1.25) warnings.push("The pump settles well above your design flow. It may need throttling, a trimmed impeller or a VFD, and NPSHr will be higher out there.");
    } else if (curve) warnings.push("The pump curve never crosses the system curve: the pump can't make enough head to lift to the destination.");

    const Hsize = op ? op.H : s.TDH;
    const Qsize = op ? op.Q : v.Q;
    const Ph = g * Qsize * Hsize;
    results.push(
      out("Ph", op ? "Hydraulic power at operating point" : "Hydraulic power", "power", Ph),
      out("Ps", "Shaft power", "power", Ph / v.eta),
      out("Pe", "Electrical input", "power", Ph / v.eta / v.etaM)
    );

    s.sRows.forEach((r, i) => {
      if (r.v > 2.4) warnings.push(`Suction run ${i + 1} (${r.run.name || runLabel(r.run)}) runs at ${r.v.toFixed(1)} m/s. Keep pump suction lines below about 1.5–2.4 m/s (5–8 ft/s) so the flow reaches the impeller evenly.`);
    });
    s.dRows.forEach((r, i) => {
      if (r.v > 3.5) warnings.push(`Discharge run ${i + 1} (${r.run.name || runLabel(r.run)}) runs at ${r.v.toFixed(1)} m/s. Above about 3 m/s (10 ft/s) lines get noisy and erode fittings.`);
    });
    if (s.inletZ > v.zs + 1e-9) warnings.push("The suction pipe inlet sits above the supply liquid level, so it would draw air. Lower the inlet or check the rise of each suction run.");
    const low = s.nodes.find((n) => n.p < v.pv * 1.05);
    if (low && s.NPSHa > 0) warnings.push("Somewhere in the piping the pressure drops close to the liquid's vapour pressure (a high point running under vacuum). It may flash or air-bind there.");
    if (v.zs < 0 && -v.zs > patm / g - v.pv / g - 1) warnings.push("That suction lift is close to the physical limit for this liquid. Even a perfect pipe can't lift much further.");

    const pts = curves(runs, p, v.Q, curve, v.Qr, v.NPSHr);
    return {
      results,
      warnings,
      visual: { type: "pump", s, op, NPSHr: v.NPSHr, Q: v.Q, curves: pts, runs, zs: v.zs, zd: s.zdEff, dst: v.dst, src: v.src, pv: v.pv, rho: v.rho, patm },
    };
  },
  formula: [
    "h_f = ( f L / D + ΣK ) · v² / 2g + Δp_equipment / ρg   (each run)",
    "K_fitting = (L/D)_eq · f_T   (Crane TP-410)",
    "NPSHa = (p_atm + p_supply) / ρg + z_supply − h_f,suction − p_vapour / ρg",
    "TDH = (p_dest − p_supply) / ρg + (z_dest − z_supply) + h_f,suction + h_f,discharge",
    "Operating point: H_pump(Q) = TDH(Q)",
    "P_shaft = ρ g Q H / η",
  ],
  about:
    "Lay the system out in flow order. Suction runs go from the supply tank to the pump, and discharge runs go from the pump to the end. For each run, give the pipe, its length, how far it rises (negative if it drops), and its fittings. Elevations are measured from the pump centerline. Friction uses Darcy–Weisbach with the Colebrook friction factor, and fittings use the Crane equivalent-length method, so their losses scale with pipe size. Atmospheric pressure comes from the standard atmosphere at your site elevation. NPSH available is the absolute head at the pump suction above the liquid's vapour pressure. It must stay above the pump's NPSH required, with margin to spare. Each loss is lumped at the end of its run when the pressure at the joints is worked out. Single-path systems only: no branches or loops, and liquids only.",
  sources: "Crane TP-410, Flow of Fluids Through Valves, Fittings and Pipe; Hydraulic Institute ANSI/HI 9.6.1, Rotodynamic Pumps Guideline for NPSH Margin; Colebrook (1939).",
  related: ["pressure-drop", "pump-power", "pipe-velocity"],
};
