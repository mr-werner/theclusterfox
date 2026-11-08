// Fluid property data. Water values follow the IAPWS formulations as tabulated in
// standard heat-transfer and fluid-mechanics references; air values are calculated
// (ideal gas + Sutherland's law); everything is in SI.

import { interp } from "../model/math.js";

// Water: T °C, density kg/m³, viscosity mPa·s, cp kJ/(kg·K), k W/(m·K),
// vapour pressure kPa, latent heat of vaporization kJ/kg.
// Above 100 °C the liquid values are for saturated (pressurized) water.
const WATER_RAW = [
  [0.01, 999.84, 1.792, 4.217, 0.561, 0.6117, 2501],
  [4, 999.97, 1.567, 4.205, 0.57, 0.8135, 2491],
  [10, 999.7, 1.306, 4.192, 0.58, 1.2282, 2477],
  [15, 999.1, 1.138, 4.186, 0.589, 1.7057, 2465],
  [20, 998.21, 1.002, 4.182, 0.598, 2.3392, 2454],
  [25, 997.05, 0.89, 4.18, 0.607, 3.1699, 2442],
  [30, 995.65, 0.797, 4.178, 0.615, 4.2469, 2430],
  [40, 992.22, 0.653, 4.179, 0.631, 7.3851, 2407],
  [50, 988.03, 0.547, 4.181, 0.644, 12.352, 2383],
  [60, 983.2, 0.466, 4.185, 0.654, 19.947, 2358],
  [70, 977.76, 0.404, 4.19, 0.663, 31.202, 2333],
  [80, 971.79, 0.354, 4.197, 0.67, 47.416, 2309],
  [90, 965.31, 0.315, 4.205, 0.675, 70.183, 2283],
  [100, 958.35, 0.282, 4.216, 0.679, 101.42, 2257],
  [120, 943.1, 0.232, 4.244, 0.683, 198.67, 2203],
  [150, 917.0, 0.183, 4.311, 0.682, 476.16, 2114],
  [200, 864.7, 0.134, 4.497, 0.665, 1554.9, 1941],
];

export const WATER = WATER_RAW.map(([T, rho, mu, cp, k, pv, hfg]) => {
  const muSI = mu * 1e-3;
  return {
    T: T + 273.15,
    rho,
    mu: muSI,
    nu: muSI / rho,
    cp: cp * 1e3,
    k,
    Pr: (cp * 1e3 * muSI) / k,
    pv: pv * 1e3,
    hfg: hfg * 1e3,
  };
});

/** Water property at temperature T (K), linearly interpolated. */
export function waterAt(prop, T) {
  return interp(WATER.map((r) => r.T), WATER.map((r) => r[prop]), T);
}

// Air at 1 atm. Ideal gas density; Sutherland's law for viscosity and conductivity.
export const R_AIR = 287.05;
const CP_AIR = [
  [200, 1002.3], [250, 1003.1], [300, 1004.9], [350, 1008.2], [400, 1013.5], [450, 1020.6],
  [500, 1029.5], [600, 1051.1], [700, 1075.2], [800, 1098.7], [1000, 1141.1],
];
export const airCp = (T) => interp(CP_AIR.map((r) => r[0]), CP_AIR.map((r) => r[1]), T);
export const airMu = (T) => (1.716e-5 * (T / 273.15) ** 1.5 * (273.15 + 110.4)) / (T + 110.4);
export const airK = (T) => (0.02414 * (T / 273.15) ** 1.5 * (273.15 + 194)) / (T + 194);
export const airRho = (T, p = 101325) => p / (R_AIR * T);

export function airAt(T, p = 101325) {
  const rho = airRho(T, p);
  const mu = airMu(T);
  const cp = airCp(T);
  const k = airK(T);
  return { T, rho, mu, nu: mu / rho, cp, k, Pr: (cp * mu) / k, a: Math.sqrt(1.4 * R_AIR * T) };
}

export const AIR = [-50, -25, 0, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 400, 500].map((c) => airAt(c + 273.15));

// Common liquids near 20 °C: density kg/m³, viscosity mPa·s, cp kJ/(kg·K), boiling point °C.
// Fuels and oils vary with blend; treat those as typical.
const LIQ = [
  ["Water", 998.2, 1.002, 4.182, 100],
  ["Seawater", 1025, 1.08, 3.99, 100.6],
  ["Ethanol", 789, 1.2, 2.44, 78.4],
  ["Methanol", 792, 0.59, 2.53, 64.7],
  ["Isopropyl alcohol", 786, 2.4, 2.6, 82.6],
  ["Acetone", 791, 0.32, 2.15, 56.1],
  ["Ethylene glycol", 1113, 19.9, 2.39, 197.3],
  ["Propylene glycol", 1036, 56, 2.5, 188.2],
  ["Glycol 50/50 with water (ethylene)", 1070, 3.8, 3.3, 107],
  ["Glycerol", 1261, 1412, 2.43, 290],
  ["Mercury", 13546, 1.55, 0.14, 356.7],
  ["Gasoline (typical)", 740, 0.6, 2.22, null],
  ["Diesel (typical)", 840, 3, 2.0, null],
  ["Kerosene / Jet A", 800, 1.6, 2.01, null],
  ["Engine oil SAE 30 (typical)", 880, 290, 1.88, null],
  ["Hydraulic oil ISO VG 46 (typical)", 870, 110, 1.9, null],
  ["Olive oil", 911, 84, 1.97, null],
  ["Benzene", 879, 0.65, 1.74, 80.1],
  ["Toluene", 867, 0.59, 1.7, 110.6],
  ["Liquid ammonia (sat., 20 °C)", 610, 0.13, 4.74, -33.3],
];

export const LIQUIDS = LIQ.map(([name, rho, mu, cp, bp]) => ({
  name,
  rho,
  mu: mu * 1e-3,
  nu: (mu * 1e-3) / rho,
  cp: cp * 1e3,
  bp: bp == null ? null : bp + 273.15,
}));

// Gases: molar mass g/mol, cp kJ/(kg·K) at 25 °C, ratio of specific heats, normal boiling point °C.
const GAS = [
  ["Air", 28.966, 1.005, 1.4, -194.3],
  ["Nitrogen (N₂)", 28.013, 1.04, 1.4, -195.8],
  ["Oxygen (O₂)", 31.999, 0.918, 1.395, -183],
  ["Carbon dioxide (CO₂)", 44.01, 0.846, 1.289, -78.5],
  ["Carbon monoxide (CO)", 28.01, 1.04, 1.4, -191.5],
  ["Hydrogen (H₂)", 2.016, 14.31, 1.405, -252.9],
  ["Helium", 4.003, 5.193, 1.667, -268.9],
  ["Argon", 39.948, 0.52, 1.667, -185.8],
  ["Neon", 20.18, 1.03, 1.667, -246],
  ["Methane (CH₄)", 16.043, 2.226, 1.299, -161.5],
  ["Ethane (C₂H₆)", 30.07, 1.766, 1.186, -88.6],
  ["Propane (C₃H₈)", 44.097, 1.679, 1.126, -42.1],
  ["n-Butane (C₄H₁₀)", 58.123, 1.716, 1.091, -0.5],
  ["Ammonia (NH₃)", 17.031, 2.13, 1.31, -33.3],
  ["Water vapor (H₂O)", 18.015, 1.872, 1.33, 100],
  ["Sulfur dioxide (SO₂)", 64.066, 0.624, 1.29, -10],
];

export const RU = 8.314462618; // J/(mol·K)

export const GASES = GAS.map(([name, M, cp, k, bp]) => {
  const R = RU / (M / 1000);
  return {
    name,
    M: M / 1000,
    R,
    cp: cp * 1e3,
    cv: (cp * 1e3) / k,
    k,
    rhoStd: 101325 / (R * 288.15),
    bp: bp + 273.15,
  };
});

// Presets for calculators that need a fluid (density and viscosity at about 20 °C, 1 atm).
export const FLUID_PRESETS = [
  { label: "Water, 20 °C", set: { rho: 998.2, mu: 1.002e-3 } },
  { label: "Water, 4 °C", set: { rho: 1000, mu: 1.567e-3 } },
  { label: "Water, 60 °C", set: { rho: 983.2, mu: 0.466e-3 } },
  { label: "Water, 80 °C", set: { rho: 971.8, mu: 0.354e-3 } },
  { label: "Seawater", set: { rho: 1025, mu: 1.08e-3 } },
  { label: "Glycol 50/50", set: { rho: 1070, mu: 3.8e-3 } },
  { label: "Diesel", set: { rho: 840, mu: 3e-3 } },
  { label: "Gasoline", set: { rho: 740, mu: 0.6e-3 } },
  { label: "Hydraulic oil ISO VG 46", set: { rho: 870, mu: 0.11 } },
  { label: "Air, 20 °C, 1 atm", set: { rho: 1.204, mu: 1.825e-5 } },
  { label: "Natural gas (methane), 15 °C", set: { rho: 0.678, mu: 1.1e-5 } },
];
