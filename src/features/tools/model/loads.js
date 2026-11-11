// Room-by-room heating and cooling loads.
//
// Cooling follows the structure of the ASHRAE Radiant Time Series method for
// a 24-hour design day: hourly sun position and clear-sky irradiance, sol-air
// temperatures, heat gains split into convective and radiant parts, and the
// radiant part spread over later hours. To stay free of licensed tables,
// three pieces use published simplified forms instead of tabulated data:
//  - wall and roof conduction: time lag and decrement factor by construction weight
//    (in place of tabulated conduction time series),
//  - radiant time series: an exponential decay by zone weight (in place of
//    tabulated RTS factors),
//  - outdoor temperature: a cosine daily swing peaking at 3 pm solar time.
// Heating is the usual steady-state design loss with no solar or internal credit.
// Everything is SI: m, m², W, K, m³/s.

import { satPressure, humidityRatio, standardAtmosphere } from "./air.js";

const RAD = Math.PI / 180;
const CP = 1006; // J/kg·K, dry air
const CPV = 1860; // J/kg·K, water vapour
const HFG = 2501e3; // J/kg

/** Compass orientations: azimuth of the outward normal, degrees from south, west positive. */
export const ORIENTATIONS = [
  { id: "N", label: "North", az: 180 },
  { id: "NE", label: "Northeast", az: -135 },
  { id: "E", label: "East", az: -90 },
  { id: "SE", label: "Southeast", az: -45 },
  { id: "S", label: "South", az: 0 },
  { id: "SW", label: "Southwest", az: 45 },
  { id: "W", label: "West", az: 90 },
  { id: "NW", label: "Northwest", az: 135 },
  { id: "H", label: "Horizontal (skylight)", az: 0, horizontal: true },
];
export const orientationById = Object.fromEntries(ORIENTATIONS.map((o) => [o.id, o]));

/** Construction weight: time lag (h) and decrement factor for walls and roofs, after Mackey and Wright. */
export const MASS = {
  light: { label: "Light (frame, metal)", lag: 1, dec: 0.9, tau: 1.5 },
  medium: { label: "Medium (block, brick veneer)", lag: 5, dec: 0.5, tau: 3.5 },
  heavy: { label: "Heavy (concrete, solid masonry)", lag: 9, dec: 0.25, tau: 7 },
};

/** Day of year of the 21st of each month. */
const DAY21 = [21, 52, 80, 111, 141, 172, 202, 233, 264, 294, 325, 355];

/** Sun position at solar hour h (0–24) on day n, latitude lat (deg). Returns altitude β and azimuth φ (rad, from south, west +). */
export function sunPosition(lat, n, h) {
  const decl = 23.45 * Math.sin(RAD * (360 * (284 + n)) / 365) * RAD;
  const H = 15 * (h - 12) * RAD;
  const L = lat * RAD;
  const sinB = Math.cos(L) * Math.cos(decl) * Math.cos(H) + Math.sin(L) * Math.sin(decl);
  const beta = Math.asin(Math.max(-1, Math.min(1, sinB)));
  const cosPhi = (Math.sin(beta) * Math.sin(L) - Math.sin(decl)) / (Math.cos(beta) * Math.cos(L) || 1e-9);
  const phi = Math.sign(H || 1e-9) * Math.acos(Math.max(-1, Math.min(1, cosPhi)));
  return { beta, phi, decl };
}

/** Clear-sky beam normal and horizontal diffuse irradiance, W/m² (ASHRAE 2009 clear-sky model form). */
export function clearSky(n, beta, taub, taud) {
  if (beta <= 0) return { Eb: 0, Ed: 0 };
  const E0 = 1367 * (1 + 0.033 * Math.cos(RAD * (360 * (n - 3)) / 365));
  const bdeg = beta / RAD;
  const m = 1 / (Math.sin(beta) + 0.50572 * (6.07995 + bdeg) ** -1.6364);
  const ab = 1.454 - 0.406 * taub - 0.268 * taud + 0.021 * taub * taud;
  const ad = 0.507 + 0.205 * taub - 0.08 * taud - 0.19 * taub * taud;
  return { Eb: E0 * Math.exp(-taub * m ** ab), Ed: E0 * Math.exp(-taud * m ** ad) };
}

/** Irradiance on a surface: beam, diffuse (sky + ground) and incidence angle cosine. */
export function surfaceIrradiance(sun, sky, orient, rhoG = 0.2) {
  const o = orientationById[orient] || orientationById.S;
  if (sun.beta <= 0) return { Eb: 0, Ed: 0, Et: 0, cosT: 0 };
  if (o.horizontal) {
    const cosT = Math.sin(sun.beta);
    return { Eb: sky.Eb * cosT, Ed: sky.Ed, Et: sky.Eb * cosT + sky.Ed, cosT };
  }
  const gamma = sun.phi - o.az * RAD;
  const cosT = Math.max(0, Math.cos(sun.beta) * Math.cos(gamma));
  const Y = Math.max(0.45, 0.55 + 0.437 * cosT + 0.313 * cosT * cosT);
  const Ed = sky.Ed * Y + (sky.Eb * Math.sin(sun.beta) + sky.Ed) * rhoG * 0.5;
  const Eb = sky.Eb * cosT;
  return { Eb, Ed, Et: Eb + Ed, cosT };
}

/** Fraction of the daily range below the peak at solar hour h: 0 at 3 pm, 1 at 3 am. */
export const rangeFraction = (h) => 0.5 * (1 - Math.cos((2 * Math.PI * (h - 15)) / 24));

/** Angular transmission of glazing relative to normal incidence. */
export const angularSHGC = (cosT) => (cosT <= 0 ? 0 : Math.min(1, 1.12 * cosT ** 0.35 - 0.12 * cosT ** 3.5));

/** Normalised radiant time series for a zone time constant tau (h). */
export function rts(tau) {
  const a = Math.exp(-1 / tau);
  const r = Array.from({ length: 24 }, (_, j) => (1 - a) * a ** j);
  const s = r.reduce((x, y) => x + y, 0);
  return r.map((x) => x / s);
}

/** Humidity ratio from dry bulb and wet bulb (K) at pressure p. */
export function wFromWetBulb(Tdb, Twb, p) {
  const tdb = Tdb - 273.15, twb = Twb - 273.15;
  const Ws = humidityRatio(satPressure(Twb), p);
  return ((2501 - 2.326 * twb) * Ws - 1.006 * (tdb - twb)) / (2501 + 1.86 * tdb - 4.186 * twb);
}

// ---- Model ---------------------------------------------------------------
// A project is a list of rooms. Each room:
// { n: name, A: floor area m², H: height m, mass: light|medium|heavy,
//   ppl: people, ps: W sensible/person, pl: W latent/person,
//   lt: lighting W/m², eq: equipment W/m², ach: infiltration air changes/h,
//   oap: outdoor air m³/s per person, oaa: outdoor air m³/s per m²,
//   w: [[orient, gross area m², U, mass, dark 0|1]],       walls (window area is taken out)
//   g: [[orient, area m², U, SHGC, interior shade factor]], windows
//   r: [area m², U, mass, dark 0|1] or 0,                   roof
//   f: [area m², U] or 0 }                                   floor over unconditioned space (heating only)

export const newRoom = (k = 1) => ({
  n: `Room ${k}`, A: 30, H: 2.7, mass: "medium", ppl: 3, ps: 75, pl: 55, lt: 10, eq: 10, ach: 0.3,
  oap: 0.0025, oaa: 0.0003,
  w: [["S", 25, 0.45, "medium", 0]], g: [["S", 4, 2.5, 0.4, 1]], r: 0, f: 0,
});

export function parseProject(text) {
  try {
    const p = JSON.parse(text);
    if (!Array.isArray(p)) return [];
    return p.filter((r) => r && typeof r === "object").map((r, k) => ({ ...newRoom(k + 1), ...r, w: Array.isArray(r.w) ? r.w : [], g: Array.isArray(r.g) ? r.g : [] }));
  } catch {
    return [];
  }
}

const tidy = (x) => (typeof x === "number" ? Number(x.toPrecision(6)) : Array.isArray(x) ? x.map(tidy) : x);
export const stringifyProject = (rooms) => JSON.stringify(rooms.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, tidy(v)]))));

// ---- Calculation ---------------------------------------------------------

const RADIANT = { wall: 0.46, roof: 0.6, window: 0.46, solar: 1, people: 0.6, lights: 0.67, equip: 0.3 };
const COMPONENTS = ["walls", "roof", "glassCond", "solar", "people", "lights", "equip", "infil"];

/**
 * Design conditions d: { lat, month (1–12), z, Tdb, Twb, DR, Twin, Ti, rhi, Tih, Ts, taub, taud,
 *   occ0, occ1 (occupied hours), offL (lighting fraction when unoccupied), offE (equipment fraction) }
 */
export function solveLoads(rooms, d) {
  const n = DAY21[Math.min(12, Math.max(1, Math.round(d.month))) - 1];
  const p = standardAtmosphere(d.z || 0).p;
  const Wo = wFromWetBulb(d.Tdb, Math.min(d.Twb, d.Tdb), p);
  const Wi = humidityRatio(d.rhi * satPressure(d.Ti), p);
  const rhoAt = (T, W) => p / (287.042 * T * (1 + 1.607858 * W)) * (1 + W);
  const rhoI = rhoAt(d.Ti, Wi);
  const cpm = CP + CPV * Wi;
  // Heating air is taken as dry at the indoor heating setpoint.
  const rhoH = rhoAt(d.Tih, 0);
  const hours = Array.from({ length: 24 }, (_, k) => k + 1);
  const To = hours.map((h) => d.Tdb - d.DR * rangeFraction(h));
  const sun = hours.map((h) => sunPosition(d.lat, n, h - 0.5));
  const sky = sun.map((s) => clearSky(n, s.beta, d.taub, d.taud));
  const occ = hours.map((h) => (d.occ1 > d.occ0 ? h > d.occ0 && h <= d.occ1 : h > d.occ0 || h <= d.occ1));
  const irr = {};
  const irrFor = (o) => (irr[o] ||= sun.map((s, k) => surfaceIrradiance(s, sky[k], o)));

  // Sol-air temperature: dark surfaces α/h_o = 0.052, light 0.026 m²K/W; roofs lose 3.9 K to the sky.
  const solAir = (o, dark, horizontal) =>
    irrFor(o).map((e, k) => To[k] + (dark ? 0.052 : 0.026) * e.Et - (horizontal ? 3.9 : 0));
  const lagged = (Te, U, A, massId) => {
    const m = MASS[massId] || MASS.medium;
    const mean = Te.reduce((a, b) => a + b, 0) / 24;
    return Te.map((_, k) => U * A * (mean - d.Ti + m.dec * (Te[(k - m.lag + 240) % 24] - mean)));
  };

  const results = rooms.map((room) => {
    const conv = Array(24).fill(0);
    const rad = Array(24).fill(0);
    const parts = Object.fromEntries(COMPONENTS.map((c) => [c, Array(24).fill(0)]));
    const add = (part, gains, fr) =>
      gains.forEach((q, k) => {
        conv[k] += q * (1 - fr);
        rad[k] += q * fr;
        parts[part][k] += q; // heat gain; converted to cooling load below
      });
    const glassBy = {};
    for (const [o, A, U, SHGC, iac] of room.g || []) {
      glassBy[o] = (glassBy[o] || 0) + A;
      add("glassCond", To.map((t) => U * A * (t - d.Ti)), RADIANT.window);
      const e = irrFor(o);
      // Diffuse SHGC is about 0.9 of the normal-incidence value for common glazing.
      const solar = e.map((x) => A * SHGC * (iac ?? 1) * (x.Eb * angularSHGC(x.cosT) + 0.9 * x.Ed));
      add("solar", solar, (iac ?? 1) < 1 ? 0.63 : RADIANT.solar);
    }
    for (const [o, Agross, U, mass, dark] of room.w || []) {
      const A = Math.max(0, Agross - (glassBy[o] || 0));
      glassBy[o] = Math.max(0, (glassBy[o] || 0) - Agross);
      add("walls", lagged(solAir(o, dark, false), U, A, mass), RADIANT.wall);
    }
    if (room.r) {
      const [A, U, mass, dark] = room.r;
      add("roof", lagged(solAir("H", dark, true), U, A, mass), RADIANT.roof);
    }
    add("people", occ.map((on) => (on ? room.ppl * room.ps : 0)), RADIANT.people);
    add("lights", occ.map((on) => room.lt * room.A * (on ? 1 : d.offL)), RADIANT.lights);
    add("equip", occ.map((on) => room.eq * room.A * (on ? 1 : d.offE)), RADIANT.equip);
    const Qinf = (room.ach * room.A * room.H) / 3600;
    const infS = To.map((t) => rhoI * Qinf * cpm * (t - d.Ti));
    infS.forEach((q, k) => {
      conv[k] += q;
      parts.infil[k] += q;
    });
    const latent = hours.map((_, k) => (occ[k] ? room.ppl * room.pl : 0) + rhoI * Qinf * HFG * Math.max(0, Wo - Wi));

    // Radiant gains reach the air over the following hours.
    const r = rts((MASS[room.mass] || MASS.medium).tau);
    const sens = conv.map((c, k) => c + r.reduce((acc, rj, j) => acc + rj * rad[(k - j + 24) % 24], 0));
    // Same split for each component, for the breakdown.
    const share = {};
    for (const c of COMPONENTS) {
      const fr = { walls: RADIANT.wall, roof: RADIANT.roof, glassCond: RADIANT.window, solar: RADIANT.solar, people: RADIANT.people, lights: RADIANT.lights, equip: RADIANT.equip, infil: 0 }[c];
      share[c] = parts[c].map((q, k) => q * (1 - fr) + r.reduce((acc, rj, j) => acc + rj * fr * parts[c][(k - j + 24) % 24], 0));
    }
    let peak = 0;
    sens.forEach((q, k) => q > sens[peak] && (peak = k));
    const Qsup = sens[peak] > 0 ? sens[peak] / (rhoI * cpm * (d.Ti - d.Ts)) : 0;
    const Qoa = room.oap * room.ppl + room.oaa * room.A;

    // Heating: steady state at the winter design temperature, no sun or internal credit.
    const dT = d.Tih - d.Twin;
    const hp = { walls: 0, glass: 0, roof: 0, floor: 0, infil: 0 };
    for (const [, A, U] of room.g || []) hp.glass += U * A * dT;
    const glassLeft = {};
    for (const [o, A] of room.g || []) glassLeft[o] = (glassLeft[o] || 0) + A;
    for (const [o, Ag, U] of room.w || []) {
      const A = Math.max(0, Ag - (glassLeft[o] || 0));
      glassLeft[o] = Math.max(0, (glassLeft[o] || 0) - Ag);
      hp.walls += U * A * dT;
    }
    if (room.r) hp.roof = room.r[1] * room.r[0] * dT;
    if (room.f) hp.floor = room.f[1] * room.f[0] * dT;
    hp.infil = rhoH * Qinf * CP * dT;
    const heat = hp.walls + hp.glass + hp.roof + hp.floor + hp.infil;

    return { name: room.n, sens, latent, peakHour: peak + 1, peakSens: sens[peak], peakLat: latent[peak], Qsup, Qoa, heat, heatParts: hp, share };
  });

  // Block load: all rooms together, at the hour the sum peaks.
  const block = hours.map((_, k) => results.reduce((a, r) => a + r.sens[k], 0));
  const blockLat = hours.map((_, k) => results.reduce((a, r) => a + r.latent[k], 0));
  let bk = 0;
  block.forEach((q, k) => q + blockLat[k] > block[bk] + blockLat[bk] && (bk = k));
  const Qoa = results.reduce((a, r) => a + r.Qoa, 0);
  const hi = (CP * (d.Ti - 273.15) + Wi * (HFG + CPV * (d.Ti - 273.15)));
  const hoAt = (k) => CP * (To[k] - 273.15) + Wo * (HFG + CPV * (To[k] - 273.15));
  const oaS = Qoa * rhoI * cpm * (To[bk] - d.Ti);
  const oaT = Qoa * rhoI * (hoAt(bk) - hi);
  const coil = block[bk] + blockLat[bk] + Math.max(0, oaT);
  const coilSens = block[bk] + Math.max(0, oaS);
  const oaHeat = Qoa * rhoH * CP * (d.Tih - d.Twin);
  const heatParts = Object.fromEntries(["walls", "glass", "roof", "floor", "infil"].map((c) => [c, results.reduce((a, r) => a + r.heatParts[c], 0)]));
  heatParts.oa = oaHeat;
  const breakdown = Object.fromEntries(COMPONENTS.map((c) => [c, results.reduce((a, r) => a + r.share[c][bk], 0)]));
  const area = rooms.reduce((a, r) => a + r.A, 0);
  return {
    rooms: results, block, blockLat, blockHour: bk + 1, To, Wo, Wi, Qoa, oaS, oaT, coil, coilSens, oaHeat,
    sumPeaks: results.reduce((a, r) => a + r.peakSens + r.peakLat, 0),
    Qsup: results.reduce((a, r) => a + r.Qsup, 0),
    heat: results.reduce((a, r) => a + r.heat, 0) + oaHeat,
    area, breakdown, heatParts, rho: rhoI,
    dTheat: d.Tih - d.Twin, dTcool: d.Tdb - d.Ti,
  };
}
