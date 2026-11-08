// International Standard Atmosphere and moist-air psychrometrics.

import { bisect } from "./math.js";

const G0 = 9.80665;
const R = 287.05287;
const EARTH_R = 6356766;

// ISA layers: base geopotential altitude m, base temperature K, lapse rate K/m, base pressure Pa.
const LAYERS = [
  [0, 288.15, -0.0065, 101325],
  [11000, 216.65, 0, 22632.06],
  [20000, 216.65, 0.001, 5474.889],
  [32000, 228.65, 0.0028, 868.0187],
  [47000, 270.65, 0, 110.9063],
  [51000, 270.65, -0.0028, 66.93887],
  [71000, 214.65, -0.002, 3.95642],
];

/** ISA at geometric altitude z (m), with an optional temperature offset dT (K). */
export function standardAtmosphere(z, dT = 0) {
  const h = (EARTH_R * z) / (EARTH_R + z);
  let layer = LAYERS[0];
  for (const l of LAYERS) if (h >= l[0]) layer = l;
  const [hb, Tb, L, pb] = layer;
  const Tstd = Tb + L * (h - hb);
  const p = L === 0 ? pb * Math.exp((-G0 * (h - hb)) / (R * Tb)) : pb * (Tb / Tstd) ** (G0 / (R * L));
  const T = Tstd + dT;
  const rho = p / (R * T);
  const mu = (1.458e-6 * T ** 1.5) / (T + 110.4);
  return { h, T, p, rho, a: Math.sqrt(1.4 * R * T), mu, sigma: rho / 1.225, delta: p / 101325 };
}

/** Saturation vapour pressure (Pa) at T (K), ASHRAE Hyland–Wexler. Over ice below 0 °C. */
export function satPressure(T) {
  if (T < 273.15) {
    return Math.exp(
      -5.6745359e3 / T + 6.3925247 - 9.677843e-3 * T + 6.2215701e-7 * T ** 2 + 2.0747825e-9 * T ** 3 - 9.484024e-13 * T ** 4 + 4.1635019 * Math.log(T)
    );
  }
  return Math.exp(-5.8002206e3 / T + 1.3914993 - 4.8640239e-2 * T + 4.1764768e-5 * T ** 2 - 1.4452093e-8 * T ** 3 + 6.5459673 * Math.log(T));
}

export const humidityRatio = (pw, p) => (0.621945 * pw) / (p - pw);

/** Moist air state from dry-bulb T (K), relative humidity (0–1) and pressure (Pa). */
export function psychrometrics(T, rh, p = 101325) {
  const t = T - 273.15;
  const pws = satPressure(T);
  const pw = rh * pws;
  const W = humidityRatio(pw, p);
  const h = (1.006 * t + W * (2501 + 1.86 * t)) * 1000; // J/kg dry air
  const v = (287.042 * T * (1 + 1.607858 * W)) / p; // m³/kg dry air
  const dew = pw > 0 ? bisect((x) => satPressure(x) - pw, 173.15, T + 1e-9, 1e-7) : NaN;
  const wet = wetBulb(T, W, p);
  return { W, h, v, rho: (1 + W) / v, pw, pws, dew, wet };
}

function wetBulb(T, W, p) {
  const t = T - 273.15;
  const f = (Tw) => {
    const tw = Tw - 273.15;
    const Ws = humidityRatio(satPressure(Tw), p);
    const Wcalc =
      tw >= 0
        ? ((2501 - 2.326 * tw) * Ws - 1.006 * (t - tw)) / (2501 + 1.86 * t - 4.186 * tw)
        : ((2830 - 0.24 * tw) * Ws - 1.006 * (t - tw)) / (2830 + 1.86 * t - 2.1 * tw);
    return Wcalc - W;
  };
  return bisect(f, 173.15, T + 1e-9, 1e-9);
}
