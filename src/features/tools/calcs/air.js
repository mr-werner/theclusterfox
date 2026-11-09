import { num, choice, preset, out, text, say } from "./define.js";
import { standardAtmosphere, psychrometrics } from "../model/air.js";
import { GASES, RU } from "../data/fluids.js";
import { parseSystem, siteAir, solveSystem, systemCurve, fanCurve, operatingPoint, standardMotor } from "../model/airsystem.js";

// A rooftop unit serving one run of ductwork: 2,000 cfm, critical path to the farthest diffuser.
const FAN_EXAMPLE = [
  "c,louv,40",
  "c,filt,100",
  "c,ccoil,150",
  "f,entP,1",
  "d,x,0.508,0.3048,3.048,g",
  "f,el90mv,1",
  "d,x,0.508,0.3048,12.192,l",
  "f,teeS,2",
  "f,red,1",
  "d,r,0.3048,9.144,g,0.47195",
  "f,wyeB,1",
  "d,r,0.2032,4.572,g,0.14158",
  "f,el90r,1",
  "d,r,0.2032,1.829,f,0.14158",
  "f,flex90,1",
  "c,diff,25",
].join(";");

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
  {
    id: "fan-system",
    cat: "air",
    name: "Fan and duct system sizer",
    blurb: "Build the duct path, then get the static pressure, fan power and motor size, corrected for elevation.",
    keywords: "fan sizing duct static pressure external static esp total pressure elevation altitude density correction fan curve system curve operating point bhp motor flex duct fittings duct design friction rate equal friction",
    inputs: [
      num("Q", "Fan airflow (actual)", "airflow", 0.943895, { min: 0 }),
      text("model", "Duct path", FAN_EXAMPLE, { hidden: true }),
      num("z", "Site elevation", "length", 0, { min: -400, max: 6000 }),
      num("T", "Air temperature at the fan", "temp", 294.261),
      num("rh", "Relative humidity", "percent", 0.5, { min: 0, max: 1 }),
      num("margin", "Safety margin on pressure", "percent", 0.1, { min: 0, max: 1 }),
      num("fanEff", "Fan total efficiency", "percent", 0.6, { min: 0.05, max: 1, hint: "Use the fan's catalog efficiency at its selection point. 50–65% is typical for forward-curved fans, 65–85% for backward-inclined and airfoil." }),
      num("driveEff", "Drive efficiency", "percent", 0.97, { min: 0.05, max: 1, hint: "About 95–97% for a belt drive, 100% for direct drive." }),
      num("motorEff", "Motor efficiency", "percent", 0.89, { min: 0.05, max: 1 }),
      num("rate", "Target friction rate (for sizing ducts)", "pressureGradient", 0.817, { min: 0 }),
      num("vmax", "Velocity limit (for sizing ducts)", "velocity", 7.62, { min: 0 }),
      choice("fan", "Check a fan", [{ value: "none", label: "No fan curve yet" }, { value: "curve", label: "Plot a fan from its catalog" }]),
      num("P0", "Fan shutoff pressure (catalog, standard air)", "airPressure", 597.8, { min: 0, when: (v) => v.fan === "curve" }),
      num("Qr", "Catalog airflow", "airflow", 0.943895, { min: 0, when: (v) => v.fan === "curve" }),
      num("Pr", "Catalog pressure at that airflow", "airPressure", 473.3, { min: 0, when: (v) => v.fan === "curve" }),
      num("Qmax", "Fan free-delivery airflow (zero pressure)", "airflow", 1.699, { min: 0, when: (v) => v.fan === "curve" }),
    ],
    compute: (v) => {
      const items = parseSystem(v.model);
      const air = siteAir(v.z, v.T, v.rh);
      const sys = solveSystem(items, v.Q, air);
      const P = sys.total * (1 + v.margin);
      const Pstd = P / air.ratio;
      const airPower = v.Q * P;
      const shaft = airPower / v.fanEff;
      const input = shaft / (v.driveEff * v.motorEff);
      const motor = standardMotor(shaft / v.driveEff);
      const ductRows = sys.rows.filter((r) => r.kind === "duct");
      const vMax = Math.max(0, ...ductRows.map((r) => r.v));
      const L = items.filter((i) => i.kind === "duct").reduce((a, i) => a + i.L, 0);
      const results = [
        out("P", "Fan total pressure to select", "airPressure", P, { primary: true }),
        out("Pstd", "Same, as standard air (for fan catalogs)", "airPressure", Pstd),
        out("bhp", "Fan shaft power (brake power)", "power", shaft),
        say("motor", "Smallest standard motor", motor.label),
        out("input", "Electrical input power", "power", input),
        out("sys", "Path pressure loss (no margin)", "airPressure", sys.total),
        out("pduct", "Straight duct friction", "airPressure", sys.duct),
        out("pfit", "Fittings", "airPressure", sys.fit),
        out("pcomp", "Components (coils, filters, outlets)", "airPressure", sys.comp),
        out("rho", "Air density at the site", "density", air.rho),
        out("ratio", "Density ratio to standard air", "none", air.ratio),
        out("scfm", "Airflow as standard air (same mass)", "airflow", v.Q * air.ratio),
        out("vmaxd", "Highest duct velocity", "velocity", vMax),
        out("L", "Total duct length on the path", "length", L),
      ];
      const warnings = [];
      if (!items.length) warnings.push("Add duct runs, fittings and components to the path.");
      if (vMax > 12.7) warnings.push("A duct runs faster than 2,500 fpm (12.7 m/s). Expect noise; consider a larger size.");
      if (sys.rows.some((r) => r.orphan)) warnings.push("A fitting has no duct next to it, so its loss can't be worked out. Add a duct run beside it.");
      const flexL = items.filter((i) => i.kind === "duct" && i.mat === "f").reduce((a, i) => a + i.L, 0);
      if (flexL > 0) warnings.push("Flex duct losses assume it's fully stretched. Sagging or compressed flex can have two to four times the friction.");
      let fan = null;
      if (v.fan === "curve") {
        if (!(v.P0 > v.Pr && v.Qmax > v.Qr && v.Qr > 0)) warnings.push("For the fan curve, shutoff pressure must be above the catalog pressure, and free delivery above the catalog airflow.");
        else {
          const fc = fanCurve(v, air.ratio);
          const op = operatingPoint(fc.P, items, v.Q, air, v.Qmax);
          const pts = Array.from({ length: 41 }, (_, k) => ({ x: (v.Qmax * k) / 40, y: fc.P((v.Qmax * k) / 40) }));
          fan = { pts, op };
          if (op) {
            results.push(out("opQ", "This fan delivers (on your system)", "airflow", op.Q));
            results.push(out("opP", "at a pressure of", "airPressure", op.P));
            results.push(out("opPct", "Share of the airflow you need", "percent", op.Q / v.Q));
            if (op.Q < v.Q) warnings.push("The fan you entered falls short of the airflow you need. Pick a larger fan or a faster speed (fan laws: airflow rises with speed, pressure with speed squared).");
          } else warnings.push("The fan curve and the system curve don't cross. Check the fan's catalog numbers.");
        }
      }
      const curve = systemCurve(items, v.Q, air, Math.max(1.5, fan ? (v.Qmax / v.Q) * 1.05 : 1.5));
      return { results, warnings, visual: { type: "fan", rows: sys.rows, air, curve, fan, design: { Q: v.Q, P: sys.total } } };
    },
    formula: [
      "Duct: Δp = f (L / D_h) ρ v² / 2,   f from Colebrook,   D_h = 2ab / (a + b)",
      "Fitting: Δp = C ρ v² / 2",
      "ρ from the standard atmosphere pressure at your elevation, plus temperature and humidity",
      "Standard-air pressure = actual pressure × 1.204 / ρ",
      "Brake power = Q Δp / η_fan,   input = brake power / (η_drive η_motor)",
      "Fan curve: p = p₀ (1 − (Q / Q_max)^k), scaled by ρ / 1.204",
    ],
    about:
      "Lay out the critical path: the run from the fan to the outlet with the most resistance, plus the return or intake side if this fan pulls through it. Add every coil, filter and grille the fan must push through. Ducts can carry less air than the fan (a branch), so give each run its own airflow. The friction method is the same as the ASHRAE duct design method. Fitting coefficients are typical first-pass values. For final design, use the coefficient for your exact fitting from the ASHRAE Duct Fitting Database or the manufacturer, and use the actual pressure drops of the coils and filters you've selected. At altitude the air is thinner, so the ductwork loses less pressure but the fan also makes less. Fan catalogs are printed for standard air (0.075 lb/ft³), so you select the fan at the standard-air pressure shown here and the actual airflow. The motor needs less power than at sea level for the same fan.",
    sources: "ASHRAE Handbook—Fundamentals, Duct Design chapter (method); AMCA Publication 200, Air Systems; Colebrook (1939).",
    related: ["duct-size", "air-heat", "standard-atmosphere"],
  },
];
