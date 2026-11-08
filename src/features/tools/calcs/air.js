import { num, choice, preset, out } from "./define.js";
import { standardAtmosphere, psychrometrics } from "../model/air.js";
import { GASES, RU } from "../data/fluids.js";

export const air = [
  {
    id: "psychrometrics",
    cat: "air",
    name: "Psychrometric calculator",
    blurb: "Dew point, wet bulb, humidity ratio and enthalpy of moist air.",
    keywords: "psychrometric humidity dew point wet bulb enthalpy relative humidity moist air",
    inputs: [
      num("T", "Dry-bulb temperature", "temp", 297.15),
      num("rh", "Relative humidity", "percent", 0.5, { min: 0, max: 1 }),
      choice("pmode", "Pressure from", [{ value: "alt", label: "Altitude" }, { value: "p", label: "Barometric pressure" }]),
      num("z", "Altitude", "length", 0, { when: (v) => v.pmode === "alt" }),
      num("p", "Barometric pressure", "pressure", 101325, { min: 1000, when: (v) => v.pmode === "p" }),
    ],
    compute: ({ T, rh, pmode, z, p }) => {
      const P = pmode === "alt" ? standardAtmosphere(z).p : p;
      const s = psychrometrics(T, rh, P);
      return {
        results: [
          out("dew", "Dew point", "temp", s.dew, { primary: true }),
          out("wet", "Wet-bulb temperature", "temp", s.wet),
          out("W", "Humidity ratio", "humidityRatio", s.W),
          out("h", "Enthalpy (per kg dry air)", "specEnergy", s.h),
          out("v", "Specific volume (per kg dry air)", "specVolume", s.v),
          out("rho", "Moist air density", "density", s.rho),
          out("pw", "Vapor partial pressure", "pressure", s.pw),
          out("P", "Barometric pressure used", "pressure", P),
        ],
      };
    },
    formula: ["p_w = RH · p_ws(T)", "W = 0.621945 · p_w / (p − p_w)", "h = 1.006 t + W (2501 + 1.86 t)   kJ/kg, t in °C", "v = 0.287042 (t + 273.15)(1 + 1.607858 W) / p"],
    about: "Moist air is dry air plus water vapor. From any two properties (here dry bulb and relative humidity) at a known pressure, every other property follows. Saturation pressure uses the Hyland–Wexler equations; the wet bulb is solved from the psychrometric energy balance.",
    sources: "ASHRAE Handbook — Fundamentals, chapter 1 (Psychrometrics).",
    related: ["air-heat", "standard-atmosphere"],
  },
  {
    id: "air-heat",
    cat: "air",
    name: "Air heating and cooling load",
    blurb: "Sensible heat added to or taken from an airstream.",
    keywords: "sensible heat airflow cfm hvac load 1.08 btu",
    inputs: [
      num("Q", "Airflow", "airflow", 0.5, { min: 0 }),
      num("dT", "Temperature change", "dtemp", 10),
      num("rho", "Air density", "density", 1.204, { min: 0 }),
      num("cp", "Specific heat of air", "cp", 1006, { min: 0 }),
    ],
    compute: ({ Q, dT, rho, cp }) => {
      const q = rho * cp * Q * dT;
      return { results: [out("q", "Sensible heat", "power", q, { primary: true }), out("tons", "In tons of cooling", "power", q, { unit: "TR" }), out("m", "Mass flow", "massflow", rho * Q)] };
    },
    formula: ["q = ρ · c_p · Q · ΔT", "US shortcut: BTU/h ≈ 1.08 × cfm × ΔT(°F)"],
    about: "The everyday HVAC sizing equation. The 1.08 factor in the US shortcut is just standard air density × specific heat × 60 min/h. At altitude air is thinner, so lower the density.",
    related: ["psychrometrics", "duct-size"],
  },
  {
    id: "duct-size",
    cat: "air",
    name: "Duct velocity and equivalent size",
    blurb: "Air velocity in round or rectangular ducts and the round equivalent.",
    keywords: "duct velocity equivalent diameter rectangular round hvac fpm",
    inputs: [
      num("Q", "Airflow", "airflow", 0.5, { min: 0 }),
      choice("shape", "Duct shape", [{ value: "rect", label: "Rectangular" }, { value: "round", label: "Round" }]),
      num("a", "Width", "smallLength", 0.4, { min: 0, when: (v) => v.shape === "rect" }),
      num("b", "Height", "smallLength", 0.25, { min: 0, when: (v) => v.shape === "rect" }),
      num("D", "Diameter", "smallLength", 0.3, { min: 0, when: (v) => v.shape === "round" }),
    ],
    compute: ({ Q, shape, a, b, D }) => {
      if (shape === "round") {
        const A = (Math.PI * D * D) / 4;
        return { results: [out("v", "Velocity", "velocity", Q / A, { primary: true, unit: "m/s" }), out("A", "Area", "area", A)] };
      }
      const A = a * b;
      const De = (1.3 * (a * b) ** 0.625) / (a + b) ** 0.25;
      const Dh = (2 * a * b) / (a + b);
      return {
        results: [
          out("v", "Velocity", "velocity", Q / A, { primary: true }),
          out("A", "Area", "area", A),
          out("De", "Equivalent round duct (same friction)", "smallLength", De),
          out("Dh", "Hydraulic diameter", "smallLength", Dh),
          out("ar", "Aspect ratio", "none", Math.max(a, b) / Math.min(a, b)),
        ],
      };
    },
    formula: ["v = Q / A", "D_e = 1.30 (a b)^0.625 / (a + b)^0.25   (Huebscher)", "D_h = 2 a b / (a + b)"],
    about: "The equivalent diameter is the round duct with the same friction loss at the same airflow, which is what duct friction charts are built on. Typical design velocities: 2–4 m/s (400–800 fpm) for residential branches, up to 10 m/s (2000 fpm) for commercial mains.",
    related: ["air-heat"],
  },
  {
    id: "standard-atmosphere",
    cat: "air",
    name: "Standard atmosphere",
    blurb: "Air temperature, pressure and density at any altitude (ISA).",
    keywords: "standard atmosphere isa altitude pressure density speed of sound elevation",
    inputs: [num("z", "Altitude", "length", 1609, { min: -500, max: 86000 }), num("dT", "Temperature offset from ISA", "dtemp", 0)],
    compute: ({ z, dT }) => {
      const s = standardAtmosphere(z, dT);
      const curve = [];
      for (let h = 0; h <= 20000; h += 500) curve.push({ x: h, y: standardAtmosphere(h, dT).p });
      return {
        results: [
          out("p", "Pressure", "pressure", s.p, { primary: true }),
          out("T", "Temperature", "temp", s.T),
          out("rho", "Density", "density", s.rho),
          out("sigma", "Density ratio ρ/ρ₀", "none", s.sigma),
          out("delta", "Pressure ratio p/p₀", "none", s.delta),
          out("a", "Speed of sound", "velocity", s.a),
          out("mu", "Dynamic viscosity", "dynvisc", s.mu),
        ],
        visual: { type: "line", x: { label: "Altitude", dim: "length" }, y: { label: "Pressure", dim: "pressure" }, points: curve, marker: { x: z, y: s.p } },
      };
    },
    formula: ["Troposphere (0–11 km): T = 288.15 − 0.0065 h", "p = p_b (T_b / T)^(g₀ / (R L))", "Isothermal layers: p = p_b · exp( −g₀ (h − h_b) / (R T_b) )"],
    about: "The International Standard Atmosphere is the agreed reference used for aircraft performance, engine ratings and altitude corrections. Sea level is 15 °C and 101.325 kPa. The offset lets you model hot or cold days (ISA+20 and so on).",
    sources: "ISO 2533:1975; U.S. Standard Atmosphere 1976.",
    related: ["psychrometrics", "ideal-gas"],
  },
  {
    id: "ideal-gas",
    cat: "air",
    name: "Gas density (ideal gas law)",
    blurb: "Density and specific volume of a gas at any pressure and temperature.",
    keywords: "ideal gas law pv nrt density gas constant molar mass",
    inputs: [
      preset("gas", "Gas", GASES.map((g) => ({ label: g.name, set: { M: g.M * 1000 } }))),
      num("M", "Molar mass (g/mol)", "none", 28.966, { min: 0 }),
      num("p", "Absolute pressure", "pressure", 101325, { min: 0 }),
      num("T", "Temperature", "temp", 288.15),
    ],
    compute: ({ M, p, T }) => {
      const R = RU / (M / 1000);
      const rho = p / (R * T);
      return {
        results: [
          out("rho", "Density", "density", rho, { primary: true }),
          out("v", "Specific volume", "specVolume", 1 / rho),
          out("R", "Specific gas constant", "cp", R, { unit: "J/kgK" }),
          out("Vm", "Molar volume (L/mol)", "none", ((RU * T) / p) * 1000),
        ],
      };
    },
    formula: ["p V = n R_u T", "ρ = p / (R T),   R = R_u / M,   R_u = 8.314 J/(mol·K)"],
    about: "Most gases behave close to ideal at ordinary pressures and temperatures. Near condensation or at very high pressure, a compressibility factor Z is needed.",
    related: ["standard-atmosphere"],
  },
];
