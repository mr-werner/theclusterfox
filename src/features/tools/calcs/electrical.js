import { num, choice, text, out, say } from "./define.js";
import { parseNumber } from "../model/units.js";
import { CONDUCTOR_SIZES, RHO_CU, RHO_AL, ALPHA_CU, ALPHA_AL, RESISTOR_COLORS } from "../data/electrical.js";

const ohmModes = [
  { value: "VI", label: "Voltage and current" },
  { value: "VR", label: "Voltage and resistance" },
  { value: "IR", label: "Current and resistance" },
  { value: "PV", label: "Power and voltage" },
  { value: "PI", label: "Power and current" },
  { value: "PR", label: "Power and resistance" },
];

const digitColors = RESISTOR_COLORS.filter((c) => c.digit !== undefined).map((c) => c.name);
const multColors = RESISTOR_COLORS.map((c) => c.name);
const tolColors = RESISTOR_COLORS.filter((c) => c.tol !== undefined).map((c) => c.name);
const color = (name) => RESISTOR_COLORS.find((c) => c.name === name);

function formatOhms(r) {
  if (r >= 1e6) return `${+(r / 1e6).toPrecision(3)} MΩ`;
  if (r >= 1e3) return `${+(r / 1e3).toPrecision(3)} kΩ`;
  return `${+r.toPrecision(3)} Ω`;
}

export const electrical = [
  {
    id: "ohms-law",
    cat: "elec",
    name: "Ohm's law and power",
    blurb: "Know any two of voltage, current, resistance and power? Get the other two.",
    keywords: "ohms law voltage current resistance power watts amps volts",
    inputs: [
      choice("mode", "I know", ohmModes),
      num("V", "Voltage", "voltage", 12, { when: (v) => v.mode.includes("V") }),
      num("I", "Current", "current", 2, { when: (v) => v.mode.includes("I") }),
      num("R", "Resistance", "resistance", 6, { min: 0, when: (v) => v.mode.includes("R") }),
      num("P", "Power", "power", 24, { min: 0, when: (v) => v.mode.includes("P") }),
    ],
    compute: ({ mode, V, I, R, P }) => {
      let v = V, i = I, r = R, p = P;
      if (mode === "VI") (r = V / I), (p = V * I);
      if (mode === "VR") (i = V / R), (p = (V * V) / R);
      if (mode === "IR") (v = I * R), (p = I * I * R);
      if (mode === "PV") (i = P / V), (r = (V * V) / P);
      if (mode === "PI") (v = P / I), (r = P / (I * I));
      if (mode === "PR") (i = Math.sqrt(P / R)), (v = Math.sqrt(P * R));
      const first = ["V", "I", "R", "P"].find((k) => !mode.includes(k));
      const all = [
        out("V", "Voltage", "voltage", v),
        out("I", "Current", "current", i),
        out("R", "Resistance", "resistance", r),
        out("P", "Power", "power", p, { unit: "W" }),
      ];
      return {
        results: [...all.filter((x) => !mode.includes(x.id)), ...all.filter((x) => mode.includes(x.id))].map((x) => ({ ...x, primary: x.id === first })),
      };
    },
    formula: ["V = I · R", "P = V · I = I² R = V² / R"],
    about: "Ohm's law ties voltage, current and resistance together; the power law adds watts. With any two known, the other two follow. This is for DC or resistive AC loads.",
    related: ["series-parallel", "voltage-drop"],
  },
  {
    id: "voltage-drop",
    cat: "elec",
    name: "Wire voltage drop",
    blurb: "Voltage lost along a cable run, and the smallest wire that keeps it under 3%.",
    keywords: "voltage drop wire size awg cable length copper aluminum conductor",
    inputs: [
      choice("sys", "System", [{ value: "1", label: "DC or single-phase AC" }, { value: "3", label: "Three-phase AC" }]),
      choice("metal", "Conductor", [{ value: "cu", label: "Copper" }, { value: "al", label: "Aluminum" }]),
      choice("size", "Wire size", CONDUCTOR_SIZES.map((s) => s.label), "12 AWG"),
      num("L", "One-way length", "length", 30, { min: 0 }),
      num("I", "Load current", "current", 16, { min: 0 }),
      num("V", "Supply voltage", "voltage", 120, { min: 0 }),
      num("T", "Conductor temperature", "temp", 348.15),
      num("limit", "Allowed drop", "percent", 0.03, { min: 0 }),
    ],
    compute: ({ sys, metal, size, L, I, V, T, limit }) => {
      const rho = (metal === "cu" ? RHO_CU : RHO_AL) * (1 + (metal === "cu" ? ALPHA_CU : ALPHA_AL) * (T - 293.15));
      const k = sys === "3" ? Math.sqrt(3) : 2;
      const dropFor = (area) => (k * L * I * rho) / area;
      const s = CONDUCTOR_SIZES.find((x) => x.label === size);
      const Vd = dropFor(s.area);
      const family = (x) => (x.label.includes("mm²") ? "mm" : "awg");
      const best = CONDUCTOR_SIZES.filter((x) => family(x) === family(s))
        .sort((a, b) => a.area - b.area)
        .find((x) => dropFor(x.area) / V <= limit);
      return {
        results: [
          out("Vd", "Voltage drop", "voltage", Vd, { primary: true }),
          out("pct", "Drop as % of supply", "percent", Vd / V),
          out("Vl", "Voltage at the load", "voltage", V - Vd),
          out("loss", "Power lost in the cable", "power", (sys === "3" ? 3 : 2) * I * I * (rho / s.area) * L, { unit: "W" }),
          say("best", `Smallest size within ${+(limit * 100).toFixed(1)}%`, best ? best.label : "Larger than the biggest size listed"),
        ],
        warnings: ["Voltage drop is not ampacity: check the wire is also rated for the current (see the wire gauge table). Reactance is ignored, which is fine for small wires but understates drop on large AC feeders."],
      };
    },
    formula: ["R′ = ρ₂₀ (1 + α (T − 20 °C)) / A", "DC / single-phase: V_d = 2 · L · I · R′", "Three-phase: V_d = √3 · L · I · R′"],
    about: "Current flowing out and back through a long cable loses voltage to the wire's resistance. The NEC recommends keeping branch circuits under 3% and the whole run under 5%. Resistance is corrected to the conductor's operating temperature (75 °C is the usual design value).",
    related: ["ohms-law"],
  },
  {
    id: "resistor-code",
    cat: "elec",
    name: "Resistor color code",
    blurb: "Read the value of a 4- or 5-band resistor from its colors.",
    keywords: "resistor color code bands value tolerance",
    inputs: [
      choice("bands", "Bands", [{ value: "4", label: "4 bands" }, { value: "5", label: "5 bands" }]),
      choice("b1", "1st band", digitColors.filter((c) => c !== "Black"), "Yellow"),
      choice("b2", "2nd band", digitColors, "Violet"),
      choice("b3", "3rd band", digitColors, "Black", { when: (v) => v.bands === "5" }),
      choice("m", "Multiplier", multColors, "Red"),
      choice("t", "Tolerance", tolColors, "Gold"),
    ],
    compute: ({ bands, b1, b2, b3, m, t }) => {
      const digits = bands === "5" ? [b1, b2, b3] : [b1, b2];
      const base = Number(digits.map((c) => color(c).digit).join(""));
      const R = base * color(m).mult;
      const tol = color(t).tol;
      return {
        results: [
          say("R", "Resistance", formatOhms(R), { primary: true }),
          say("tol", "Tolerance", `± ${tol}%`),
          say("range", "Range", `${formatOhms(R * (1 - tol / 100))} to ${formatOhms(R * (1 + tol / 100))}`),
        ],
        visual: { type: "resistor", colors: [...digits, m, t].map((c) => color(c).hex), names: [...digits, m, t] },
      };
    },
    formula: ["R = (digits) × multiplier"],
    about: "Read from the end with the bands bunched together. The first two (or three) bands are digits, the next is the power of ten, and the last, set a little apart, is the tolerance. Gold and silver as a multiplier mean ×0.1 and ×0.01.",
    related: ["series-parallel"],
  },
  {
    id: "series-parallel",
    cat: "elec",
    name: "Series and parallel",
    blurb: "Combine any number of resistors, capacitors or inductors.",
    keywords: "series parallel resistors capacitors inductors equivalent combine",
    inputs: [
      choice("part", "Parts", [{ value: "R", label: "Resistors or inductors" }, { value: "C", label: "Capacitors" }]),
      text("list", "Values (comma separated, k and M allowed)", "100, 220, 470"),
    ],
    compute: ({ part, list }) => {
      const vals = String(list).split(/[,;\s]+/).map(parseNumber).filter((x) => Number.isFinite(x) && x > 0);
      if (!vals.length) return { results: [], warnings: ["Enter at least one positive value."] };
      const sum = vals.reduce((a, b) => a + b, 0);
      const recip = 1 / vals.reduce((a, b) => a + 1 / b, 0);
      const [series, parallel] = part === "C" ? [recip, sum] : [sum, recip];
      return {
        results: [out("s", "In series", "none", series, { primary: true }), out("p", "In parallel", "none", parallel), say("n", "Count", String(vals.length))],
      };
    },
    formula: ["Resistors: R_series = ΣR,   1/R_parallel = Σ(1/R)", "Capacitors: 1/C_series = Σ(1/C),   C_parallel = ΣC"],
    about: "Results are in the same unit as the values you type: type ohms, get ohms; type microfarads, get microfarads. Inductors without coupling combine like resistors.",
    related: ["ohms-law", "rc-time"],
  },
  {
    id: "rc-time",
    cat: "elec",
    name: "RC time constant",
    blurb: "Charging time and cutoff frequency of a resistor–capacitor circuit.",
    keywords: "rc time constant tau capacitor charge filter cutoff frequency",
    inputs: [num("R", "Resistance", "resistance", 10000, { min: 0 }), num("C", "Capacitance", "capacitance", 100e-6, { min: 0 })],
    compute: ({ R, C }) => {
      const tau = R * C;
      const points = [];
      for (let k = 0; k <= 50; k++) points.push({ x: (k / 10) * tau, y: 1 - Math.exp(-k / 10) });
      return {
        results: [
          out("tau", "Time constant τ", "time", tau, { primary: true }),
          out("t95", "Time to 95% (3τ)", "time", 3 * tau),
          out("t99", "Time to 99.3% (5τ)", "time", 5 * tau),
          out("fc", "Cutoff frequency", "frequency", 1 / (2 * Math.PI * tau)),
        ],
        visual: { type: "line", x: { label: "Time", dim: "time" }, y: { label: "Charge", dim: "percent" }, points },
      };
    },
    formula: ["τ = R C", "V(t) = V₀ (1 − e^(−t/τ))", "f_c = 1 / (2π R C)"],
    about: "A capacitor charging through a resistor gets 63% of the way there in one time constant and is considered fully charged after five. The same pair makes a first-order low-pass or high-pass filter at the cutoff frequency.",
    related: ["series-parallel"],
  },
  {
    id: "three-phase",
    cat: "elec",
    name: "Three-phase power",
    blurb: "Real, apparent and reactive power, or the current a motor draws.",
    keywords: "three phase power kva kw kvar power factor current motor",
    inputs: [
      choice("mode", "Find", [{ value: "P", label: "Power from current" }, { value: "I", label: "Current from power" }]),
      num("V", "Line-to-line voltage", "voltage", 480, { min: 0 }),
      num("I", "Line current", "current", 50, { min: 0, when: (v) => v.mode === "P" }),
      num("P", "Real power", "power", 35000, { min: 0, when: (v) => v.mode === "I" }),
      num("pf", "Power factor", "none", 0.85, { min: 0, max: 1 }),
    ],
    compute: ({ mode, V, I, P, pf }) => {
      const current = mode === "P" ? I : P / (Math.sqrt(3) * V * pf);
      const S = Math.sqrt(3) * V * current;
      const real = S * pf;
      return {
        results: [
          mode === "P" ? out("P", "Real power", "power", real, { primary: true }) : out("I", "Line current", "current", current, { primary: true }),
          out("S", "Apparent power", "apparentPower", S),
          out("Q", "Reactive power", "reactivePower", S * Math.sin(Math.acos(pf))),
          mode === "P" ? out("I", "Line current", "current", current) : out("P", "Real power", "power", real),
        ],
      };
    },
    formula: ["S = √3 · V_LL · I", "P = S · PF", "Q = S · sin(acos PF)"],
    about: "In a balanced three-phase system the √3 comes from adding three currents 120° apart. Power factor is the share of current doing useful work; motors at light load have poor power factor.",
    related: ["voltage-drop"],
  },
  {
    id: "battery-runtime",
    cat: "elec",
    name: "Battery runtime",
    blurb: "How long a battery bank runs a load.",
    keywords: "battery runtime capacity amp hours inverter load solar",
    inputs: [
      num("Ah", "Capacity", "charge", 100, { min: 0 }),
      num("V", "Battery voltage", "voltage", 12, { min: 0 }),
      num("P", "Load", "power", 150, { min: 0 }),
      num("dod", "Usable depth of discharge", "percent", 0.8, { min: 0, max: 1, hint: "About 50% for lead-acid, 80–100% for lithium iron phosphate." }),
      num("eta", "Inverter / converter efficiency", "percent", 0.9, { min: 0.01, max: 1 }),
    ],
    compute: ({ Ah, V, P, dod, eta }) => {
      const E = Ah * V * 3600;
      return {
        results: [
          out("t", "Runtime", "time", (E * dod * eta) / P, { primary: true, unit: "h" }),
          out("E", "Stored energy", "energy", E, { unit: "Wh" }),
          out("Eu", "Usable energy", "energy", E * dod, { unit: "Wh" }),
          out("I", "Battery current", "current", P / eta / V),
        ],
      };
    },
    formula: ["E = Ah · V", "t = E · DoD · η / P"],
    about: "A rough runtime that ignores Peukert losses (lead-acid batteries deliver less at high current) and cold weather, both of which shorten it.",
    related: ["ohms-law"],
  },
];
