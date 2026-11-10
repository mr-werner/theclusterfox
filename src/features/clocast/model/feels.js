// What the air feels like in the sun and in the shade.
//
// Steadman's apparent temperature, as published by the Australian Bureau of
// Meteorology (Steadman 1994), has two forms: one for the shade, and one
// that adds the sunshine a person absorbs. The sunshine comes from the same
// SolarCal model used for the clothing picks (ASHRAE 55 Appendix C).

import { solarAltitude, solarMrtIncrease } from "./thermal.js";

const F_EFF = 0.725; // share of skin that exchanges radiation, standing
const H_R = 6.012; // radiative heat transfer coefficient, W/m²K

// Water vapour pressure in hPa from temperature °C and relative humidity %.
export function vapourPressure(tempC, rh) {
  return (Math.min(100, Math.max(0, rh)) / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
}

// Sunshine absorbed per m² of body surface, W/m² (the effective radiant field).
export function absorbedSun(hour, place) {
  if (!hour?.time || !place) return 0;
  const altitude = solarAltitude(hour.time, place.latitude, place.longitude);
  return solarMrtIncrease({ ...hour, altitude }) * F_EFF * H_R;
}

/**
 * hour: { temp °C, rh %, wind m/s at 10 m, time, directNormal, diffuse, global }
 * place: { latitude, longitude }
 * Returns { sun, shade } in °C. At night, or under thick cloud, they match.
 */
export function feelsLike(hour, place) {
  const ta = hour.temp;
  const ws = Math.max(0, hour.wind ?? 0);
  const e = vapourPressure(ta, hour.rh ?? 50);
  const shade = ta + 0.33 * e - 0.7 * ws - 4.0;
  const q = absorbedSun(hour, place);
  const sun = ta + 0.348 * e - 0.7 * ws + (0.7 * q) / (ws + 10) - 4.25;
  return { sun: Math.max(sun, shade), shade };
}
