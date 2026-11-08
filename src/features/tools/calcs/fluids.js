import { num, choice, preset, out, say } from "./define.js";
import { G } from "../model/units.js";
import { frictionFactor, flowRegime, circleArea } from "../model/math.js";
import { FLUID_PRESETS } from "../data/fluids.js";
import { ROUGHNESS, HAZEN_C, MANNING_N, STEEL_PIPE, pipeLabel } from "../data/piping.js";

const fluidPreset = (extra) => preset("fluid", "Fluid", FLUID_PRESETS, extra);
const rhoIn = () => num("rho", "Density", "density", 998.2, { min: 0 });
const muIn = () => num("mu", "Dynamic viscosity", "dynvisc", 1.002e-3, { min: 0 });
const NPS2 = STEEL_PIPE.find((p) => p.nps === "2" && p.sch === "40").ID;
const pipePresets = [
  { label: "Custom size", set: {} },
  ...STEEL_PIPE.filter((p) => p.sch === "40").map((p) => ({ label: pipeLabel(p), set: { D: p.ID } })),
];

export const fluids = [
  {
    id: "pipe-velocity",
    cat: "fluids",
    name: "Pipe flow velocity",
    blurb: "How fast fluid moves for a given flow rate and pipe size.",
    keywords: "velocity flow rate pipe diameter gpm speed",
    inputs: [
      num("Q", "Flow rate", "flow", 0.005, { min: 0 }),
      preset("pipe", "Steel pipe (Sch 40)", pipePresets, { value: "NPS 2″ Sch 40" }),
      num("D", "Inside diameter", "smallLength", NPS2, { min: 0 }),
    ],
    compute: ({ Q, D }) => {
      const A = circleArea(D);
      const v = Q / A;
      const warnings = [];
      if (v > 3) warnings.push("Above about 3 m/s (10 ft/s) water lines get noisy and erode fittings. Many designers keep water at 1–2.5 m/s.");
      return {
        results: [
          out("v", "Velocity", "velocity", v, { primary: true }),
          out("A", "Flow area", "smallArea", A),
          out("hv", "Velocity head v²/2g", "length", (v * v) / (2 * G)),
        ],
        warnings,
      };
    },
    formula: ["A = π D² / 4", "v = Q / A"],
    about:
      "Flow rate divided by the open area of the pipe gives the average velocity. Velocity drives friction loss, noise and erosion, so it is the first thing to check when sizing a line. Pick a standard steel pipe to fill in its real inside diameter.",
    related: ["pressure-drop", "reynolds"],
  },
  {
    id: "reynolds",
    cat: "fluids",
    name: "Reynolds number",
    blurb: "Tells you whether a flow is laminar, transitional or turbulent.",
    keywords: "reynolds laminar turbulent re viscosity",
    inputs: [
      num("v", "Velocity", "velocity", 1.5, { min: 0 }),
      num("D", "Characteristic length (pipe ID)", "smallLength", 0.05, { min: 0 }),
      fluidPreset(),
      rhoIn(),
      muIn(),
    ],
    compute: ({ v, D, rho, mu }) => {
      const Re = (rho * v * D) / mu;
      return {
        results: [
          out("Re", "Reynolds number", "none", Re, { primary: true }),
          say("regime", "Flow regime (in a pipe)", flowRegime(Re)),
          out("nu", "Kinematic viscosity", "kinvisc", mu / rho),
        ],
      };
    },
    formula: ["Re = ρ v D / μ = v D / ν"],
    about:
      "The Reynolds number compares inertia to viscous drag. In round pipes flow stays smooth and layered (laminar) below about 2,300, becomes fully turbulent above about 4,000, and can flip between the two in between. It sets which friction factor formula applies.",
    related: ["pressure-drop", "pipe-velocity"],
  },
  {
    id: "pressure-drop",
    cat: "fluids",
    name: "Pipe pressure drop (Darcy–Weisbach)",
    blurb: "Friction loss in a straight pipe for any liquid or gas, with a Moody chart.",
    keywords: "pressure drop head loss friction darcy weisbach colebrook moody pipe",
    inputs: [
      num("Q", "Flow rate", "flow", 0.005, { min: 0 }),
      preset("pipe", "Steel pipe (Sch 40)", pipePresets, { value: "NPS 2″ Sch 40" }),
      num("D", "Inside diameter", "smallLength", NPS2, { min: 0 }),
      num("L", "Pipe length", "length", 100, { min: 0 }),
      num("K", "Fittings, sum of K (optional)", "none", 0, { min: 0, hint: "Add K for each elbow, valve and so on. See the minor loss table." }),
      preset("mat", "Pipe material", ROUGHNESS.map((r) => ({ label: r.name, set: { eps: r.eps } })), { value: "Commercial steel, welded steel" }),
      num("eps", "Absolute roughness ε", "smallLength", 0.045e-3, { min: 0 }),
      fluidPreset(),
      rhoIn(),
      muIn(),
    ],
    compute: ({ Q, D, L, K, eps, rho, mu }) => {
      const v = Q / circleArea(D);
      const Re = (rho * v * D) / mu;
      const rel = eps / D;
      const f = frictionFactor(Re, rel);
      const dpPipe = ((f * L) / D) * ((rho * v * v) / 2);
      const dpFit = (K * rho * v * v) / 2;
      const dp = dpPipe + dpFit;
      const warnings = [];
      if (Re >= 2300 && Re < 4000) warnings.push("Transitional flow: the friction factor is uncertain here. The turbulent (Colebrook) value is shown, which is the conservative choice.");
      return {
        results: [
          out("dp", "Pressure drop", "pressure", dp, { primary: true }),
          out("hf", "Head loss", "length", dp / (rho * G)),
          out("dpL", "Pressure drop per 100 m", "pressure", (dpPipe / L) * 100),
          out("v", "Velocity", "velocity", v),
          out("Re", "Reynolds number", "none", Re),
          say("regime", "Flow regime", flowRegime(Re)),
          out("f", "Darcy friction factor f", "none", f),
          out("P", "Power lost to friction", "power", dp * Q),
        ],
        warnings,
        visual: { type: "moody", Re, f, rel },
      };
    },
    formula: ["v = Q / (π D² / 4)", "Re = ρ v D / μ", "1/√f = −2 log₁₀( ε/(3.7 D) + 2.51/(Re √f) )   (turbulent)", "f = 64 / Re   (laminar)", "Δp = ( f L / D + ΣK ) · ρ v² / 2"],
    about:
      "Darcy–Weisbach is the general-purpose pipe friction equation: it works for any Newtonian fluid, in any units, at any temperature. The friction factor comes from the Colebrook–White equation, solved exactly here rather than read off a chart. The dot on the Moody chart shows where your pipe sits.",
    sources: "Colebrook (1939); Moody (1944); Crane TP-410 for fitting K values.",
    related: ["pipe-velocity", "reynolds", "pump-power", "hazen-williams"],
  },
  {
    id: "hazen-williams",
    cat: "fluids",
    name: "Water pipe head loss (Hazen–Williams)",
    blurb: "The quick empirical method used for water distribution and fire sprinkler systems.",
    keywords: "hazen williams water head loss sprinkler c factor",
    inputs: [
      num("Q", "Flow rate", "flow", 0.005, { min: 0 }),
      preset("pipe", "Steel pipe (Sch 40)", pipePresets, { value: "NPS 2″ Sch 40" }),
      num("D", "Inside diameter", "smallLength", NPS2, { min: 0 }),
      num("L", "Pipe length", "length", 100, { min: 0 }),
      preset("mat", "Pipe material", HAZEN_C.map((r) => ({ label: r.name, set: { C: r.C } })), { value: "Steel, new" }),
      num("C", "Hazen–Williams C", "none", 120, { min: 1 }),
    ],
    compute: ({ Q, D, L, C }) => {
      const hf = (10.67 * L * Q ** 1.852) / (C ** 1.852 * D ** 4.8704);
      const dp = hf * 998.2 * G;
      return {
        results: [
          out("hf", "Head loss", "length", hf, { primary: true }),
          out("dp", "Pressure drop", "pressure", dp),
          out("dpL", "Pressure drop per 100 m", "pressure", (dp / L) * 100),
          out("v", "Velocity", "velocity", Q / circleArea(D)),
        ],
        warnings: ["Hazen–Williams is only valid for water at ordinary temperatures (about 5–25 °C) in turbulent flow. Use Darcy–Weisbach for anything else."],
      };
    },
    formula: ["h_f = 10.67 · L · Q^1.852 / ( C^1.852 · D^4.8704 )   (SI units: m, m³/s)"],
    about: "An empirical formula that needs only one roughness number, C. Higher C means a smoother pipe. It is the standard in water supply and NFPA 13 sprinkler calculations.",
    related: ["pressure-drop"],
  },
  {
    id: "hydrostatic",
    cat: "fluids",
    name: "Hydrostatic pressure",
    blurb: "Pressure at depth in a tank, well or column of liquid.",
    keywords: "hydrostatic pressure depth head water column tank",
    inputs: [
      num("h", "Depth below surface", "length", 10, { min: 0 }),
      fluidPreset(),
      rhoIn(),
      num("p0", "Pressure at the surface (absolute)", "pressure", 101325, { min: 0 }),
    ],
    compute: ({ h, rho, p0 }) => {
      const pg = rho * G * h;
      return {
        results: [out("pg", "Gauge pressure", "pressure", pg, { primary: true }), out("pa", "Absolute pressure", "pressure", pg + p0), out("grad", "Pressure per metre of depth", "pressure", rho * G)],
      };
    },
    formula: ["p_gauge = ρ g h", "p_abs = p₀ + ρ g h"],
    about: "Pressure in a still liquid depends only on depth and density, not on the shape of the container. Ten metres of fresh water adds roughly one atmosphere.",
    related: ["buoyancy", "tank-drain"],
  },
  {
    id: "pump-power",
    cat: "fluids",
    name: "Pump power",
    blurb: "Hydraulic and shaft power needed to move a flow against a head.",
    keywords: "pump power head horsepower kw efficiency",
    inputs: [
      num("Q", "Flow rate", "flow", 0.01, { min: 0 }),
      num("H", "Total head", "length", 30, { min: 0 }),
      fluidPreset(),
      rhoIn(),
      num("eta", "Pump efficiency", "percent", 0.7, { min: 0.01, max: 1 }),
      num("etaM", "Motor efficiency", "percent", 0.92, { min: 0.01, max: 1 }),
    ],
    compute: ({ Q, H, rho, eta, etaM }) => {
      const Ph = rho * G * Q * H;
      return {
        results: [
          out("Ps", "Shaft power", "power", Ph / eta, { primary: true }),
          out("Ph", "Hydraulic power", "power", Ph),
          out("Pe", "Electrical input", "power", Ph / eta / etaM),
          out("dp", "Pressure rise", "pressure", rho * G * H),
        ],
      };
    },
    formula: ["P_hydraulic = ρ g Q H", "P_shaft = P_hydraulic / η_pump", "P_electric = P_shaft / η_motor"],
    about: "The power that ends up in the fluid is density × g × flow × head. Real pumps waste some of it as heat, so divide by efficiency to size the motor. Centrifugal pumps typically run 50–85% efficient.",
    related: ["pressure-drop"],
  },
  {
    id: "orifice",
    cat: "fluids",
    name: "Orifice plate flow",
    blurb: "Flow through an orifice or nozzle from the pressure difference across it.",
    keywords: "orifice flow meter discharge coefficient nozzle beta",
    inputs: [
      num("d", "Orifice diameter", "smallLength", 0.025, { min: 0 }),
      num("D", "Pipe inside diameter", "smallLength", 0.05, { min: 0 }),
      num("dp", "Differential pressure", "pressure", 20000, { min: 0 }),
      num("Cd", "Discharge coefficient", "none", 0.61, { min: 0, hint: "About 0.61 for a sharp-edged plate, 0.95–0.99 for a smooth nozzle." }),
      fluidPreset(),
      rhoIn(),
    ],
    compute: ({ d, D, dp, Cd, rho }) => {
      const beta = d / D;
      const warnings = [];
      if (beta >= 1) return { results: [], warnings: ["The orifice must be smaller than the pipe."] };
      if (beta < 0.2 || beta > 0.75) warnings.push("Standard orifice coefficients assume a diameter ratio β between 0.2 and 0.75.");
      const Q = Cd * circleArea(d) * Math.sqrt((2 * dp) / (rho * (1 - beta ** 4)));
      return {
        results: [out("Q", "Flow rate", "flow", Q, { primary: true }), out("m", "Mass flow", "massflow", Q * rho), out("beta", "Diameter ratio β", "none", beta), out("v", "Velocity in the orifice", "velocity", Q / circleArea(d))],
        warnings,
      };
    },
    formula: ["β = d / D", "Q = C_d · A_o · √( 2 Δp / ( ρ (1 − β⁴) ) )"],
    about: "Squeezing flow through a smaller hole speeds it up and drops its pressure. Measuring that drop tells you the flow. This is incompressible flow; for gases with a large pressure drop add an expansion factor.",
    sources: "ISO 5167 gives full discharge coefficient correlations.",
    related: ["pressure-drop"],
  },
  {
    id: "manning",
    cat: "fluids",
    name: "Open channel flow (Manning)",
    blurb: "Flow in ditches, gutters, culverts and part-full sewers.",
    keywords: "manning open channel ditch culvert gutter slope flow",
    inputs: [
      choice("shape", "Channel shape", [{ value: "rect", label: "Rectangular" }, { value: "trap", label: "Trapezoidal" }, { value: "circle", label: "Round pipe, part full" }]),
      num("b", "Bottom width", "length", 1, { min: 0, when: (v) => v.shape !== "circle" }),
      num("z", "Side slope (horizontal per 1 vertical)", "none", 1, { min: 0, when: (v) => v.shape === "trap" }),
      num("Dc", "Pipe diameter", "length", 0.6, { min: 0, when: (v) => v.shape === "circle" }),
      num("y", "Water depth", "length", 0.4, { min: 0 }),
      num("S", "Bed slope", "percent", 0.005, { min: 0 }),
      preset("lining", "Lining", MANNING_N.map((r) => ({ label: r.name, set: { n: r.n } })), { value: "Finished concrete" }),
      num("n", "Manning n", "none", 0.012, { min: 0 }),
    ],
    compute: ({ shape, b, z, Dc, y, S, n }) => {
      let A, P, T;
      if (shape === "circle") {
        if (y > Dc) return { results: [], warnings: ["Depth can't be more than the pipe diameter."] };
        const r = Dc / 2;
        const th = 2 * Math.acos((r - y) / r);
        A = (r * r * (th - Math.sin(th))) / 2;
        P = r * th;
        T = 2 * Math.sqrt(Math.max(0, y * (Dc - y)));
      } else {
        const zz = shape === "trap" ? z : 0;
        A = (b + zz * y) * y;
        P = b + 2 * y * Math.sqrt(1 + zz * zz);
        T = b + 2 * zz * y;
      }
      const R = A / P;
      const v = (1 / n) * R ** (2 / 3) * Math.sqrt(S);
      const Fr = T > 0 ? v / Math.sqrt((G * A) / T) : NaN;
      return {
        results: [
          out("Q", "Flow rate", "flow", v * A, { primary: true }),
          out("v", "Velocity", "velocity", v),
          out("A", "Flow area", "area", A),
          out("R", "Hydraulic radius", "length", R),
          out("Fr", "Froude number", "none", Fr),
          say("regime", "Flow type", Fr < 1 ? "Subcritical (calm)" : Fr > 1 ? "Supercritical (rapid)" : "Critical"),
        ],
      };
    },
    formula: ["R = A / P", "v = (1/n) · R^(2/3) · S^(1/2)   (SI)", "Q = v · A", "Fr = v / √( g A / T )"],
    about: "Manning's equation balances gravity pulling water down a slope against friction from the channel lining. It assumes steady, uniform flow, which is a fair picture of long straight channels.",
    related: ["hydrostatic"],
  },
  {
    id: "buoyancy",
    cat: "fluids",
    name: "Buoyancy",
    blurb: "Will it float? Buoyant force on a submerged object.",
    keywords: "buoyancy archimedes float sink displacement",
    inputs: [
      num("V", "Submerged volume", "volume", 0.1, { min: 0 }),
      num("m", "Object mass", "mass", 50, { min: 0 }),
      fluidPreset(),
      rhoIn(),
    ],
    compute: ({ V, m, rho }) => {
      const Fb = rho * V * G;
      const W = m * G;
      return {
        results: [
          out("Fb", "Buoyant force", "force", Fb, { primary: true }),
          out("W", "Object weight", "force", W),
          out("net", "Net force (+ up)", "force", Fb - W),
          say("float", "Result", Fb > W ? "Floats" : Fb < W ? "Sinks" : "Neutrally buoyant"),
          out("rhoObj", "Object average density", "density", m / V),
        ],
      };
    },
    formula: ["F_b = ρ_fluid · V · g"],
    about: "A submerged body is pushed up by the weight of the fluid it displaces (Archimedes). It floats if its average density is less than the fluid's.",
    related: ["hydrostatic"],
  },
  {
    id: "tank-drain",
    cat: "fluids",
    name: "Tank draining time",
    blurb: "How long a vertical tank takes to empty through a hole in the bottom.",
    keywords: "tank drain time torricelli outlet empty",
    inputs: [
      num("Dt", "Tank diameter", "length", 1.5, { min: 0 }),
      num("h", "Starting liquid height", "length", 2, { min: 0 }),
      num("d", "Outlet diameter", "smallLength", 0.025, { min: 0 }),
      num("Cd", "Discharge coefficient", "none", 0.62, { min: 0, hint: "About 0.6 for a sharp hole, 0.8–0.95 for a short pipe outlet." }),
    ],
    compute: ({ Dt, h, d, Cd }) => {
      const At = circleArea(Dt);
      const Ao = circleArea(d);
      const t = (At / (Cd * Ao)) * Math.sqrt((2 * h) / G);
      const v0 = Math.sqrt(2 * G * h);
      return {
        results: [
          out("t", "Time to empty", "time", t, { primary: true }),
          out("Q0", "Starting flow rate", "flow", Cd * Ao * v0),
          out("v0", "Starting jet velocity", "velocity", v0),
          out("V", "Volume drained", "volume", At * h),
        ],
      };
    },
    formula: ["v = √(2 g h)   (Torricelli)", "t = ( A_tank / (C_d A_outlet) ) · √( 2 h / g )"],
    about: "The outflow slows as the level drops because the driving head falls. Integrating that gives a drain time proportional to the square root of the starting height.",
    related: ["hydrostatic", "tank-volume"],
  },
];
