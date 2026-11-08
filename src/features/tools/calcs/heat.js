import { num, choice, preset, out } from "./define.js";
import { MATERIALS, INSULATION, EMISSIVITY } from "../data/materials.js";

const SIGMA = 5.670374419e-8;

const heatCapPresets = [
  { label: "Water", set: { cp: 4182 } },
  { label: "Air (constant pressure)", set: { cp: 1005 } },
  { label: "Ice", set: { cp: 2090 } },
  { label: "Steam (100 °C)", set: { cp: 2080 } },
  { label: "Glycol 50/50", set: { cp: 3300 } },
  { label: "Engine oil", set: { cp: 1880 } },
  ...MATERIALS.filter((m) => ["Steel", "Aluminum", "Copper alloys", "Stainless", "Construction", "Iron"].includes(m.group)).map((m) => ({ label: m.name, set: { cp: m.cp } })),
];

export const heat = [
  {
    id: "heat-energy",
    cat: "heat",
    name: "Heating energy and time",
    blurb: "Energy to warm or cool something, and how long a heater takes.",
    keywords: "heat energy specific heat q m c delta t heating time water heater",
    inputs: [
      num("m", "Mass", "mass", 100, { min: 0 }),
      preset("substance", "Substance", heatCapPresets),
      num("cp", "Specific heat", "cp", 4182, { min: 0 }),
      num("dT", "Temperature change", "dtemp", 40),
      num("P", "Heater power", "power", 3000, { min: 0 }),
      num("eta", "Heater efficiency", "percent", 1, { min: 0.01, max: 1 }),
    ],
    compute: ({ m, cp, dT, P, eta }) => {
      const Q = m * cp * dT;
      return {
        results: [out("Q", "Energy", "energy", Q, { primary: true }), out("t", "Heating time", "time", Math.abs(Q) / (P * eta)), out("kwh", "Energy in kWh", "energy", Q, { unit: "kWh" })],
      };
    },
    formula: ["Q = m · c_p · ΔT", "t = Q / (η · P)"],
    about: "Sensible heat is mass × specific heat × temperature change. It ignores losses to the surroundings and any phase change (melting or boiling), which needs latent heat on top.",
    related: ["conduction", "air-heat"],
  },
  {
    id: "conduction",
    cat: "heat",
    name: "Conduction through a wall",
    blurb: "Heat loss through a flat layer, and its R-value.",
    keywords: "conduction fourier wall insulation r-value heat loss u-value",
    inputs: [
      preset("mat", "Material", [...INSULATION.map((m) => ({ label: m.name, set: { k: m.k } })), ...MATERIALS.map((m) => ({ label: m.name, set: { k: m.k } }))], { value: "Fiberglass batt" }),
      num("k", "Thermal conductivity", "conductivity", 0.04, { min: 0 }),
      num("t", "Thickness", "smallLength", 0.089, { min: 0 }),
      num("A", "Area", "area", 10, { min: 0 }),
      num("dT", "Temperature difference across it", "dtemp", 20),
    ],
    compute: ({ k, t, A, dT }) => {
      const R = t / k;
      const q = (A * dT) / R;
      return {
        results: [
          out("q", "Heat flow", "power", q, { primary: true }),
          out("R", "R-value", "rvalue", R),
          out("U", "U-value (1/R)", "htc", 1 / R),
          out("flux", "Heat flux", "heatflux", q / A),
          out("Rin", "R-value per inch", "rvalue", (0.0254 / k), { unit: "ft2Fh/BTU" }),
        ],
      };
    },
    formula: ["R = t / k", "q = A · ΔT / R = k A ΔT / t"],
    about: "Fourier's law: heat flows through a solid in proportion to its conductivity and the temperature difference, and inversely to its thickness. For walls with several layers, add their R-values. The R-value people quote on insulation (R-13, R-19) is in US units: ft²·°F·h/BTU.",
    related: ["convection", "radiation"],
  },
  {
    id: "convection",
    cat: "heat",
    name: "Convection heat transfer",
    blurb: "Heat moved between a surface and a moving fluid (Newton's law of cooling).",
    keywords: "convection newton cooling heat transfer coefficient h",
    inputs: [
      preset("regime", "Situation", [
        { label: "Still air (free convection)", set: { h: 10 } },
        { label: "Light breeze over a surface", set: { h: 25 } },
        { label: "Fan-forced air", set: { h: 75 } },
        { label: "Still water", set: { h: 500 } },
        { label: "Water flowing in a pipe", set: { h: 3000 } },
        { label: "Boiling water", set: { h: 10000 } },
        { label: "Condensing steam", set: { h: 15000 } },
      ]),
      num("h", "Heat transfer coefficient", "htc", 10, { min: 0 }),
      num("A", "Surface area", "area", 1, { min: 0 }),
      num("Ts", "Surface temperature", "temp", 333.15),
      num("Tf", "Fluid temperature", "temp", 293.15),
    ],
    compute: ({ h, A, Ts, Tf }) => {
      const q = h * A * (Ts - Tf);
      return { results: [out("q", "Heat flow (surface → fluid)", "power", q, { primary: true }), out("flux", "Heat flux", "heatflux", q / A)] };
    },
    formula: ["q = h · A · (T_s − T_∞)"],
    about: "The coefficient h bundles up everything about the flow: fluid, speed, geometry. The presets give typical values. For a careful design, h comes from a correlation such as Dittus–Boelter for pipes or Churchill–Chu for free convection.",
    related: ["radiation", "conduction"],
  },
  {
    id: "radiation",
    cat: "heat",
    name: "Thermal radiation",
    blurb: "Heat radiated between a surface and its surroundings.",
    keywords: "radiation stefan boltzmann emissivity infrared",
    inputs: [
      preset("surface", "Surface", EMISSIVITY.map((e) => ({ label: e.surface, set: { eps: e.eps } })), { value: "Paint, black matte" }),
      num("eps", "Emissivity", "none", 0.97, { min: 0, max: 1 }),
      num("A", "Area", "area", 1, { min: 0 }),
      num("Ts", "Surface temperature", "temp", 373.15),
      num("Tsur", "Surroundings temperature", "temp", 293.15),
    ],
    compute: ({ eps, A, Ts, Tsur }) => {
      const q = eps * SIGMA * A * (Ts ** 4 - Tsur ** 4);
      const hr = Ts !== Tsur ? q / (A * (Ts - Tsur)) : 4 * eps * SIGMA * Ts ** 3;
      return { results: [out("q", "Net radiated heat", "power", q, { primary: true }), out("flux", "Heat flux", "heatflux", q / A), out("hr", "Equivalent radiation coefficient", "htc", hr)] };
    },
    formula: ["q = ε σ A ( T_s⁴ − T_sur⁴ )", "σ = 5.670 × 10⁻⁸ W/(m²·K⁴)"],
    about: "Every surface radiates in proportion to the fourth power of its absolute temperature. Shiny metals have low emissivity and radiate little; paint, skin and most non-metals are close to 1. This form assumes a small object inside large surroundings.",
    related: ["convection"],
  },
  {
    id: "thermal-expansion",
    cat: "heat",
    name: "Thermal expansion",
    blurb: "How much a part grows when heated, and the stress if it can't.",
    keywords: "thermal expansion coefficient growth stress alpha",
    inputs: [
      preset("mat", "Material", MATERIALS.map((m) => ({ label: m.name, set: { alpha: m.alpha, E: m.E } }))),
      num("alpha", "Expansion coefficient α", "expansion", 11.7e-6, { min: 0 }),
      num("E", "Young's modulus", "modulus", 200e9, { min: 0 }),
      num("L", "Length", "length", 10, { min: 0 }),
      num("dT", "Temperature change", "dtemp", 50),
    ],
    compute: ({ alpha, E, L, dT }) => ({
      results: [
        out("dL", "Change in length", "smallLength", alpha * L * dT, { primary: true }),
        out("strain", "Thermal strain", "none", alpha * dT),
        out("sigma", "Stress if fully restrained", "stress", E * alpha * dT),
        out("dV", "Volume change (fraction)", "percent", 3 * alpha * dT),
      ],
    }),
    formula: ["ΔL = α · L · ΔT", "σ = E · α · ΔT   (fully restrained)"],
    about: "Most solids grow by a fixed fraction per degree. If a part is held so it can't grow, that strain turns into stress instead, which is why pipelines need loops and bridges need expansion joints.",
    related: ["stress-strain"],
  },
  {
    id: "lmtd",
    cat: "heat",
    name: "Heat exchanger (LMTD)",
    blurb: "Log-mean temperature difference and the area a heat exchanger needs.",
    keywords: "heat exchanger lmtd log mean temperature counterflow parallel area u",
    inputs: [
      choice("arr", "Flow arrangement", [{ value: "counter", label: "Counterflow" }, { value: "parallel", label: "Parallel flow" }]),
      num("Thi", "Hot fluid in", "temp", 363.15),
      num("Tho", "Hot fluid out", "temp", 333.15),
      num("Tci", "Cold fluid in", "temp", 288.15),
      num("Tco", "Cold fluid out", "temp", 318.15),
      num("U", "Overall heat transfer coefficient U", "htc", 800, { min: 0 }),
      num("Q", "Heat duty", "power", 50000, { min: 0 }),
    ],
    compute: ({ arr, Thi, Tho, Tci, Tco, U, Q }) => {
      const d1 = arr === "counter" ? Thi - Tco : Thi - Tci;
      const d2 = arr === "counter" ? Tho - Tci : Tho - Tco;
      if (d1 <= 0 || d2 <= 0) return { results: [], warnings: ["The temperatures cross: the hot side must stay hotter than the cold side everywhere."] };
      const lmtd = Math.abs(d1 - d2) < 1e-9 ? d1 : (d1 - d2) / Math.log(d1 / d2);
      return {
        results: [out("A", "Required area", "area", Q / (U * lmtd), { primary: true }), out("lmtd", "LMTD", "dtemp", lmtd), out("d1", "ΔT at end 1", "dtemp", d1), out("d2", "ΔT at end 2", "dtemp", d2)],
      };
    },
    formula: ["LMTD = (ΔT₁ − ΔT₂) / ln(ΔT₁ / ΔT₂)", "A = Q / (U · LMTD)"],
    about: "The temperature difference between the two streams changes along the exchanger; the log mean is the right average to use. Counterflow gives a bigger LMTD than parallel flow for the same temperatures, so it needs less area. Shell-and-tube units with several passes need a correction factor F on top.",
    related: ["heat-energy"],
  },
];

export { SIGMA };
