// Units. Every quantity is stored in SI; each unit is a factor (and an
// offset for absolute temperatures): SI = value * f + o.

const u = (id, label, f, o = 0) => ({ id, label, f, o });

const PRESSURE_UNITS = [
  u("Pa", "Pa", 1),
  u("kPa", "kPa", 1e3),
  u("MPa", "MPa", 1e6),
  u("GPa", "GPa", 1e9),
  u("bar", "bar", 1e5),
  u("mbar", "mbar", 100),
  u("atm", "atm", 101325),
  u("psi", "psi", 6894.757293),
  u("ksi", "ksi", 6894757.293),
  u("psf", "psf", 47.88025898),
  u("mmHg", "mmHg", 133.322387),
  u("inHg", "inHg", 3386.389),
  u("inH2O", "in H₂O", 249.08891),
  u("ftH2O", "ft H₂O", 2989.0669),
  u("mH2O", "m H₂O", 9806.65),
];

export const DIMS = {
  none: { label: "Number", units: [u("-", "", 1)], si: "-", us: "-" },
  percent: { label: "Percent", units: [u("%", "%", 0.01), u("frac", "fraction", 1)], si: "%", us: "%" },
  length: {
    label: "Length",
    units: [
      u("m", "m", 1), u("mm", "mm", 1e-3), u("cm", "cm", 1e-2), u("km", "km", 1e3), u("um", "µm", 1e-6),
      u("in", "in", 0.0254), u("ft", "ft", 0.3048), u("yd", "yd", 0.9144), u("mi", "mi", 1609.344),
      u("mil", "mil", 2.54e-5), u("nmi", "nmi", 1852),
    ],
    si: "m", us: "ft",
  },
  smallLength: { alias: "length", si: "mm", us: "in" },
  area: {
    label: "Area",
    units: [
      u("m2", "m²", 1), u("cm2", "cm²", 1e-4), u("mm2", "mm²", 1e-6), u("km2", "km²", 1e6), u("ha", "ha", 1e4),
      u("in2", "in²", 6.4516e-4), u("ft2", "ft²", 0.09290304), u("yd2", "yd²", 0.83612736), u("acre", "acre", 4046.8564224),
      u("mi2", "mi²", 2589988.110336), u("kcmil", "kcmil", 5.067074791e-7),
    ],
    si: "m2", us: "ft2",
  },
  smallArea: { alias: "area", si: "mm2", us: "in2" },
  volume: {
    label: "Volume",
    units: [
      u("m3", "m³", 1), u("L", "L", 1e-3), u("mL", "mL", 1e-6), u("cm3", "cm³", 1e-6), u("mm3", "mm³", 1e-9),
      u("gal", "US gal", 3.785411784e-3), u("qt", "US qt", 9.46352946e-4), u("floz", "US fl oz", 2.95735296e-5),
      u("ukgal", "UK gal", 4.54609e-3), u("in3", "in³", 1.6387064e-5), u("ft3", "ft³", 0.028316846592),
      u("yd3", "yd³", 0.764554857984), u("bbl", "bbl (oil)", 0.158987294928), u("acft", "acre·ft", 1233.48183754752),
    ],
    si: "m3", us: "gal",
  },
  mass: {
    label: "Mass",
    units: [
      u("kg", "kg", 1), u("g", "g", 1e-3), u("mg", "mg", 1e-6), u("t", "tonne", 1e3),
      u("lb", "lb", 0.45359237), u("oz", "oz", 0.028349523125), u("ton", "US ton", 907.18474),
      u("lton", "UK ton", 1016.0469088), u("slug", "slug", 14.59390294), u("gr", "grain", 6.479891e-5),
    ],
    si: "kg", us: "lb",
  },
  time: {
    label: "Time",
    units: [u("s", "s", 1), u("ms", "ms", 1e-3), u("us", "µs", 1e-6), u("min", "min", 60), u("h", "h", 3600), u("d", "day", 86400), u("yr", "year", 31557600)],
    si: "s", us: "s",
  },
  velocity: {
    label: "Speed",
    units: [u("m/s", "m/s", 1), u("km/h", "km/h", 1 / 3.6), u("ft/s", "ft/s", 0.3048), u("fpm", "ft/min", 0.00508), u("mph", "mph", 0.44704), u("kn", "knot", 1852 / 3600), u("mm/s", "mm/s", 1e-3)],
    si: "m/s", us: "ft/s",
  },
  accel: {
    label: "Acceleration",
    units: [u("m/s2", "m/s²", 1), u("g0", "g", 9.80665), u("ft/s2", "ft/s²", 0.3048)],
    si: "m/s2", us: "ft/s2",
  },
  force: {
    label: "Force",
    units: [u("N", "N", 1), u("kN", "kN", 1e3), u("MN", "MN", 1e6), u("lbf", "lbf", 4.4482216152605), u("kip", "kip", 4448.2216152605), u("kgf", "kgf", 9.80665), u("tonf", "US ton-force", 8896.443230521), u("dyn", "dyn", 1e-5)],
    si: "N", us: "lbf",
  },
  pressure: { label: "Pressure", units: PRESSURE_UNITS, si: "kPa", us: "psi" },
  stress: { alias: "pressure", label: "Stress", si: "MPa", us: "ksi" },
  modulus: { alias: "pressure", label: "Modulus", si: "GPa", us: "ksi" },
  energy: {
    label: "Energy",
    units: [
      u("J", "J", 1), u("kJ", "kJ", 1e3), u("MJ", "MJ", 1e6), u("GJ", "GJ", 1e9), u("Wh", "Wh", 3600), u("kWh", "kWh", 3.6e6),
      u("BTU", "BTU", 1055.05585262), u("MMBTU", "MMBtu", 1.05505585262e9), u("therm", "therm", 1.05505585262e8),
      u("cal", "cal", 4.184), u("kcal", "kcal", 4184), u("ftlbf", "ft·lbf", 1.3558179483), u("eV", "eV", 1.602176634e-19),
    ],
    si: "kJ", us: "BTU",
  },
  power: {
    label: "Power",
    units: [
      u("W", "W", 1), u("kW", "kW", 1e3), u("MW", "MW", 1e6), u("mW", "mW", 1e-3), u("hp", "hp", 745.69987158),
      u("PS", "hp (metric)", 735.49875), u("BTU/h", "BTU/h", 0.29307107017), u("MBH", "MBH", 293.07107017),
      u("TR", "ton (refrig.)", 3516.8528421), u("ftlbf/s", "ft·lbf/s", 1.3558179483), u("kcal/h", "kcal/h", 1.162222),
    ],
    si: "kW", us: "hp",
  },
  temp: {
    label: "Temperature",
    units: [u("C", "°C", 1, 273.15), u("F", "°F", 5 / 9, 459.67 * 5 / 9), u("K", "K", 1), u("R", "°R", 5 / 9)],
    si: "C", us: "F",
  },
  dtemp: {
    label: "Temperature difference",
    units: [u("dC", "°C", 1), u("dF", "°F", 5 / 9), u("dK", "K", 1)],
    si: "dC", us: "dF",
  },
  flow: {
    label: "Volume flow",
    units: [
      u("m3/s", "m³/s", 1), u("m3/h", "m³/h", 1 / 3600), u("L/s", "L/s", 1e-3), u("L/min", "L/min", 1e-3 / 60),
      u("gpm", "US gpm", 6.30901964e-5), u("cfm", "cfm", 4.719474432e-4), u("ft3/s", "ft³/s", 0.028316846592),
      u("MGD", "MGD", 0.0438126364), u("bpd", "bbl/day", 1.84013e-6), u("ukgpm", "UK gpm", 7.57682e-5),
    ],
    si: "L/s", us: "gpm",
  },
  airflow: { alias: "flow", si: "m3/h", us: "cfm" },
  massflow: {
    label: "Mass flow",
    units: [u("kg/s", "kg/s", 1), u("kg/h", "kg/h", 1 / 3600), u("g/s", "g/s", 1e-3), u("lb/s", "lb/s", 0.45359237), u("lb/h", "lb/h", 0.45359237 / 3600), u("t/h", "t/h", 1 / 3.6)],
    si: "kg/s", us: "lb/h",
  },
  density: {
    label: "Density",
    units: [u("kg/m3", "kg/m³", 1), u("g/cm3", "g/cm³", 1e3), u("g/L", "g/L", 1), u("lb/ft3", "lb/ft³", 16.01846337), u("lb/gal", "lb/US gal", 119.8264273), u("lb/in3", "lb/in³", 27679.90471), u("slug/ft3", "slug/ft³", 515.3788184)],
    si: "kg/m3", us: "lb/ft3",
  },
  dynvisc: {
    label: "Dynamic viscosity",
    units: [u("Pa.s", "Pa·s", 1), u("cP", "cP (mPa·s)", 1e-3), u("P", "poise", 0.1), u("lbfs/ft2", "lbf·s/ft²", 47.88025898), u("lb/fts", "lb/(ft·s)", 1.488163944), u("lb/fth", "lb/(ft·h)", 4.133788733e-4)],
    si: "cP", us: "cP",
  },
  kinvisc: {
    label: "Kinematic viscosity",
    units: [u("m2/s", "m²/s", 1), u("cSt", "cSt (mm²/s)", 1e-6), u("St", "stokes", 1e-4), u("ft2/s", "ft²/s", 0.09290304), u("ft2/h", "ft²/h", 0.09290304 / 3600)],
    si: "cSt", us: "cSt",
  },
  torque: {
    label: "Torque",
    units: [u("Nm", "N·m", 1), u("kNm", "kN·m", 1e3), u("Ncm", "N·cm", 0.01), u("lbfft", "lbf·ft", 1.3558179483), u("lbfin", "lbf·in", 0.112984829), u("kipft", "kip·ft", 1355.8179483), u("kgfm", "kgf·m", 9.80665)],
    si: "Nm", us: "lbfft",
  },
  moment: { alias: "torque", label: "Bending moment", si: "kNm", us: "kipft" },
  conductivity: {
    label: "Thermal conductivity",
    units: [u("W/mK", "W/(m·K)", 1), u("BTU/hftF", "BTU/(h·ft·°F)", 1.730734666), u("BTUin/hft2F", "BTU·in/(h·ft²·°F)", 0.1442278888), u("cal/scmC", "cal/(s·cm·°C)", 418.4)],
    si: "W/mK", us: "BTU/hftF",
  },
  htc: {
    label: "Heat transfer coefficient",
    units: [u("W/m2K", "W/(m²·K)", 1), u("BTU/hft2F", "BTU/(h·ft²·°F)", 5.678263341), u("kcal/hm2C", "kcal/(h·m²·°C)", 1.163)],
    si: "W/m2K", us: "BTU/hft2F",
  },
  rvalue: {
    label: "Thermal resistance (R-value)",
    units: [u("m2K/W", "m²·K/W (RSI)", 1), u("ft2Fh/BTU", "ft²·°F·h/BTU (R)", 0.1761101838)],
    si: "m2K/W", us: "ft2Fh/BTU",
  },
  heatflux: {
    label: "Heat flux",
    units: [u("W/m2", "W/m²", 1), u("kW/m2", "kW/m²", 1e3), u("BTU/hft2", "BTU/(h·ft²)", 3.154591186)],
    si: "W/m2", us: "BTU/hft2",
  },
  cp: {
    label: "Specific heat",
    units: [u("J/kgK", "J/(kg·K)", 1), u("kJ/kgK", "kJ/(kg·K)", 1e3), u("BTU/lbF", "BTU/(lb·°F)", 4186.8), u("cal/gC", "cal/(g·°C)", 4184)],
    si: "kJ/kgK", us: "BTU/lbF",
  },
  specEnergy: {
    label: "Energy per mass",
    units: [u("J/kg", "J/kg", 1), u("kJ/kg", "kJ/kg", 1e3), u("MJ/kg", "MJ/kg", 1e6), u("BTU/lb", "BTU/lb", 2326), u("kWh/kg", "kWh/kg", 3.6e6), u("kcal/kg", "kcal/kg", 4184)],
    si: "kJ/kg", us: "BTU/lb",
  },
  heatValue: { alias: "specEnergy", label: "Heating value", si: "MJ/kg", us: "BTU/lb" },
  expansion: {
    label: "Thermal expansion",
    units: [u("um/mK", "µm/(m·K)", 1e-6), u("1/K", "1/K", 1), u("uin/inF", "µin/(in·°F)", 1.8e-6), u("1/F", "1/°F", 1.8)],
    si: "um/mK", us: "uin/inF",
  },
  angle: {
    label: "Angle",
    units: [u("deg", "°", Math.PI / 180), u("rad", "rad", 1), u("grad", "grad", Math.PI / 200), u("arcmin", "arcmin", Math.PI / 10800), u("rev", "rev", 2 * Math.PI)],
    si: "deg", us: "deg",
  },
  frequency: {
    label: "Frequency & speed",
    units: [u("Hz", "Hz", 1), u("kHz", "kHz", 1e3), u("MHz", "MHz", 1e6), u("rpm", "rpm", 1 / 60), u("rad/s", "rad/s", 1 / (2 * Math.PI))],
    si: "Hz", us: "Hz",
  },
  rotation: { alias: "frequency", label: "Rotational speed", si: "rpm", us: "rpm" },
  inertia: {
    label: "Area moment of inertia",
    units: [u("m4", "m⁴", 1), u("cm4", "cm⁴", 1e-8), u("mm4", "mm⁴", 1e-12), u("in4", "in⁴", 4.162314256e-7), u("ft4", "ft⁴", 8.630974841e-3)],
    si: "cm4", us: "in4",
  },
  sectionModulus: {
    label: "Section modulus",
    units: [u("m3", "m³", 1), u("cm3", "cm³", 1e-6), u("mm3", "mm³", 1e-9), u("in3", "in³", 1.6387064e-5)],
    si: "cm3", us: "in3",
  },
  linearLoad: {
    label: "Force per length",
    units: [u("N/m", "N/m", 1), u("kN/m", "kN/m", 1e3), u("N/mm", "N/mm", 1e3), u("lbf/ft", "lbf/ft", 14.59390294), u("lbf/in", "lbf/in", 175.1268352), u("kip/ft", "kip/ft", 14593.90294)],
    si: "kN/m", us: "lbf/ft",
  },
  springRate: { alias: "linearLoad", label: "Spring rate", si: "N/mm", us: "lbf/in" },
  linearMass: {
    label: "Mass per length",
    units: [u("kg/m", "kg/m", 1), u("lb/ft", "lb/ft", 1.488163944), u("g/m", "g/m", 1e-3)],
    si: "kg/m", us: "lb/ft",
  },
  voltage: { label: "Voltage", units: [u("V", "V", 1), u("mV", "mV", 1e-3), u("kV", "kV", 1e3)], si: "V", us: "V" },
  current: { label: "Current", units: [u("A", "A", 1), u("mA", "mA", 1e-3), u("uA", "µA", 1e-6), u("kA", "kA", 1e3)], si: "A", us: "A" },
  resistance: { label: "Resistance", units: [u("ohm", "Ω", 1), u("mohm", "mΩ", 1e-3), u("kohm", "kΩ", 1e3), u("Mohm", "MΩ", 1e6)], si: "ohm", us: "ohm" },
  capacitance: { label: "Capacitance", units: [u("F", "F", 1), u("mF", "mF", 1e-3), u("uF", "µF", 1e-6), u("nF", "nF", 1e-9), u("pF", "pF", 1e-12)], si: "uF", us: "uF" },
  apparentPower: { label: "Apparent power", units: [u("VA", "VA", 1), u("kVA", "kVA", 1e3), u("MVA", "MVA", 1e6)], si: "kVA", us: "kVA" },
  reactivePower: { label: "Reactive power", units: [u("var", "var", 1), u("kvar", "kvar", 1e3), u("Mvar", "Mvar", 1e6)], si: "kvar", us: "kvar" },
  linearResistance: {
    label: "Resistance per length",
    units: [u("ohm/m", "Ω/m", 1), u("ohm/km", "Ω/km", 1e-3), u("ohm/kft", "Ω/1000 ft", 1 / 304.8)],
    si: "ohm/km", us: "ohm/kft",
  },
  charge: { label: "Battery capacity", units: [u("Ah", "Ah", 1), u("mAh", "mAh", 1e-3)], si: "Ah", us: "Ah" },
  humidityRatio: {
    label: "Humidity ratio",
    units: [u("kg/kg", "kg/kg", 1), u("g/kg", "g/kg", 1e-3), u("gr/lb", "grains/lb", 1 / 7000)],
    si: "g/kg", us: "gr/lb",
  },
  specVolume: {
    label: "Specific volume",
    units: [u("m3/kg", "m³/kg", 1), u("ft3/lb", "ft³/lb", 0.06242796)],
    si: "m3/kg", us: "ft3/lb",
  },
  resistivity: {
    label: "Resistivity",
    units: [u("ohm.m", "Ω·m", 1), u("uohm.cm", "µΩ·cm", 1e-8), u("ohm.mm2/m", "Ω·mm²/m", 1e-6), u("ohmcmil/ft", "Ω·cmil/ft", 1.662426e-9)],
    si: "uohm.cm", us: "uohm.cm",
  },
};

// Resolve aliases: an alias shares the units of its base but has its own defaults.
for (const [id, d] of Object.entries(DIMS)) {
  if (d.alias) {
    const base = DIMS[d.alias];
    DIMS[id] = { ...base, ...d, label: d.label || base.label, units: base.units };
  }
  DIMS[id].id = id;
  DIMS[id].byId = Object.fromEntries(DIMS[id].units.map((x) => [x.id, x]));
}

/** Dimensions offered in the unit converter, in order. */
export const CONVERTER_DIMS = [
  "length", "area", "volume", "mass", "temp", "pressure", "energy", "power", "force", "velocity", "flow", "massflow",
  "density", "torque", "dynvisc", "kinvisc", "conductivity", "htc", "rvalue", "cp", "specEnergy", "heatflux",
  "expansion", "angle", "frequency", "accel", "inertia", "dtemp", "time", "linearLoad", "humidityRatio",
];

export function unitOf(dim, unitId) {
  const d = DIMS[dim] || DIMS.none;
  return d.byId[unitId] || d.byId[d.si] || d.units[0];
}

export const toSI = (value, dim, unitId) => {
  const x = unitOf(dim, unitId);
  return value * x.f + x.o;
};

export const fromSI = (si, dim, unitId) => {
  const x = unitOf(dim, unitId);
  return (si - x.o) / x.f;
};

export const convert = (value, dim, from, to) => fromSI(toSI(value, dim, from), dim, to);

export const defaultUnit = (dim, system = "si") => {
  const d = DIMS[dim] || DIMS.none;
  return system === "us" ? d.us : d.si;
};

export const unitLabel = (dim, unitId) => unitOf(dim, unitId).label;

/** Format a number for reading: 4 significant figures, grouped, scientific when extreme. */
export function fmt(value, sig = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e9 || abs < 1e-4) {
    const [m, e] = value.toExponential(sig - 1).split("e");
    return `${trimZeros(m)} × 10${superscript(Number(e))}`;
  }
  const digits = Math.max(0, sig - 1 - Math.floor(Math.log10(abs)));
  const rounded = Number(value.toFixed(Math.min(digits, 10)));
  return rounded.toLocaleString("en-US", { maximumFractionDigits: Math.min(digits, 10) }).replace("-", "−");
}

/** Plain format for text inputs (no grouping, no unicode). */
export function fmtInput(value, sig = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e9 || abs < 1e-5) return trimZeros(value.toExponential(sig - 1).replace(/e\+?/, "e").replace(/\.?0+e/, "e"));
  return String(Number(value.toPrecision(sig)));
}

function trimZeros(s) {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
function superscript(n) {
  return String(n).split("").map((c) => SUP[c] ?? c).join("");
}

/** Parse a number a person typed: allows commas, spaces, SI prefixes (4.7k) and fractions (1/2, 1 1/4). */
export function parseNumber(text) {
  if (typeof text === "number") return text;
  if (text == null) return NaN;
  let s = String(text).trim().replace(/,/g, "").replace(/−/g, "-").replace(/×\s*10\^?/g, "e");
  if (!s) return NaN;
  const mixed = s.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const frac = Number(mixed[2]) / Number(mixed[3]);
    return whole < 0 ? whole - frac : whole + frac;
  }
  const frac = s.match(/^(-?\d*\.?\d+)\/(\d*\.?\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const pre = s.match(/^(-?\d*\.?\d+(?:e-?\d+)?)\s*([pnuµmkKMG])$/);
  if (pre) {
    const mult = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }[pre[2]];
    return Number(pre[1]) * mult;
  }
  s = s.replace(/\s+/g, "");
  return /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN;
}

export const G = 9.80665;
