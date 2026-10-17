// Human heat-balance models used to work out how much clothing insulation
// someone needs. Plain functions, no React, so they can be tested in Node.
//
//   ISO 7730 / ASHRAE 55  Predicted Mean Vote (PMV), for mild weather.
//   ISO 11079             Required clothing insulation (IREQ), for the cold.
//   ISO 9920              Clothing insulation and its loss to wind and motion.
//   ASHRAE 55 App. C      SolarCal: how much sunshine warms a person.

export const W_PER_MET = 58.15; // 1 met, seated at rest, per m² of skin
export const M2K_PER_CLO = 0.155; // 1 clo = 0.155 m²·K/W

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

// --- The body --------------------------------------------------------------

// The person assumed when no body details are given.
export const REFERENCE_BODY = { heightCm: 173, weightKg: 70, ageYears: 35, sex: null };

// Du Bois skin surface area, m².
export function bodySurfaceArea(heightCm, weightKg) {
  return 0.007184 * weightKg ** 0.425 * heightCm ** 0.725;
}

// Mifflin–St Jeor resting metabolic rate, in watts. Unknown sex uses the
// midpoint of the two equations.
export function restingMetabolicWatts({ heightCm, weightKg, ageYears, sex }) {
  const offset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const kcalPerDay = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + offset;
  return (kcalPerDay * 4184) / 86400;
}

// Fills gaps in what someone entered with typical values.
export function resolveBody(profile = {}) {
  const sex = profile.sex === "male" || profile.sex === "female" ? profile.sex : null;
  const typicalHeight = sex === "male" ? 177 : sex === "female" ? 163 : REFERENCE_BODY.heightCm;
  const typicalWeight = sex === "male" ? 82 : sex === "female" ? 68 : REFERENCE_BODY.weightKg;
  const heightCm = profile.heightCm > 100 && profile.heightCm < 250 ? profile.heightCm : typicalHeight;
  const weightKg = profile.weightKg > 25 && profile.weightKg < 300 ? profile.weightKg : typicalWeight;
  const ageYears = profile.ageYears >= 10 && profile.ageYears <= 110 ? profile.ageYears : REFERENCE_BODY.ageYears;
  return { heightCm, weightKg, ageYears, sex };
}

// Heat produced per m² of skin for an activity given in Compendium METs
// (multiples of resting metabolism). Activity METs scale this person's own
// resting rate, then the heat is spread over their skin area. A bigger body
// has less skin per kilogram, so it runs a little warmer.
export function metabolicRate(activityMets, profile) {
  const body = resolveBody(profile);
  const watts = activityMets * restingMetabolicWatts(body);
  const area = bodySurfaceArea(body.heightCm, body.weightKg);
  return { wattsPerM2: watts / area, met: watts / area / W_PER_MET, watts, area, body };
}

// --- The surroundings ------------------------------------------------------

// Weather stations measure wind 10 m up. Near the body, about 1.5 m up, it
// is slower; this is the log wind profile over suburban ground.
export function windAtBodyHeight(wind10m, roughness = 0.3) {
  return Math.max(0, wind10m) * (Math.log(1.5 / roughness) / Math.log(10 / roughness));
}

// Sun height above the horizon in degrees (NOAA approximation).
export function solarAltitude(date, latitude, longitude) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86400000;
  const hourUtc = date.getUTCHours() + date.getUTCMinutes() / 60;
  const gamma = ((2 * Math.PI) / 365) * (day - 1 + (hourUtc - 12) / 24);
  const decl =
    0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const solarMinutes = hourUtc * 60 + eqTime + 4 * longitude;
  const hourAngle = (solarMinutes / 4 - 180) * rad;
  const lat = latitude * rad;
  const cosZenith = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  return 90 - Math.acos(clamp(cosZenith, -1, 1)) / rad;
}

// How much sunshine raises the mean radiant temperature around a standing
// person (ASHRAE 55 Appendix C, SolarCal). Irradiance in W/m².
export function solarMrtIncrease({ directNormal = 0, diffuse = 0, global = 0, altitude, shaded = false }) {
  if (!(altitude > 0)) return 0;
  const fEff = 0.725; // share of skin that exchanges radiation, standing
  const absorptivity = 0.67; // average of skin and clothing, shortwave
  const emissivity = 0.95;
  const groundReflectance = 0.2;
  const hr = 6.012; // radiative heat transfer coefficient, W/m²K
  // Projected area factor for a standing person, averaged over sun azimuths.
  const fp = 0.308 * Math.cos((altitude * (0.998 - (altitude * altitude) / 50000) * Math.PI) / 180);
  const direct = shaded ? 0 : directNormal;
  const erf = (0.5 * fEff * (diffuse + global * groundReflectance) + fEff * fp * direct) * (absorptivity / emissivity);
  return erf / (fEff * hr);
}

// Saturated water vapour pressure, kPa.
const saturationKpa = t => 0.1333 * Math.exp(18.6686 - 4030.183 / (t + 235));

// --- ISO 7730 / ASHRAE 55: PMV ---------------------------------------------

/**
 * Predicted Mean Vote: -3 cold, 0 neutral, +3 hot.
 * ta air °C, tr mean radiant °C, vel relative air speed m/s, rh %,
 * met metabolic rate in met, clo clothing insulation.
 */
export function pmv({ ta, tr, vel, rh, met, clo, wme = 0 }) {
  const pa = rh * 10 * Math.exp(16.6536 - 4030.183 / (ta + 235));
  const icl = M2K_PER_CLO * clo;
  const m = met * W_PER_MET;
  const mw = m - wme * W_PER_MET;
  const fcl = icl <= 0.078 ? 1 + 1.29 * icl : 1.05 + 0.645 * icl;
  const hcf = 12.1 * Math.sqrt(vel);
  const taa = ta + 273;
  const tra = tr + 273;
  const tcla = taa + (35.5 - ta) / (3.5 * icl + 0.1);

  const p1 = icl * fcl;
  const p2 = p1 * 3.96;
  const p3 = p1 * 100;
  const p4 = p1 * taa;
  const p5 = 308.7 - 0.028 * mw + p2 * (tra / 100) ** 4;

  let xn = tcla / 100;
  let xf = tcla / 50;
  let hc = hcf;
  for (let n = 0; Math.abs(xn - xf) > 0.00015 && n < 150; n++) {
    xf = (xf + xn) / 2;
    const hcn = 2.38 * Math.abs(100 * xf - taa) ** 0.25;
    hc = Math.max(hcf, hcn);
    xn = (p5 + p4 * hc - p2 * xf ** 4) / (100 + p3 * hc);
  }
  const tcl = 100 * xn - 273;

  const skinDiffusion = 3.05e-3 * (5733 - 6.99 * mw - pa);
  const sweat = mw > W_PER_MET ? 0.42 * (mw - W_PER_MET) : 0;
  const latentResp = 1.7e-5 * m * (5867 - pa);
  const dryResp = 0.0014 * m * (34 - ta);
  const radiation = 3.96 * fcl * (xn ** 4 - (tra / 100) ** 4);
  const convection = fcl * hc * (tcl - ta);
  const ts = 0.303 * Math.exp(-0.036 * m) + 0.028;
  return ts * (mw - skinDiffusion - sweat - latentResp - dryResp - radiation - convection);
}

// Clothing (clo) that brings PMV to the target. PMV rises with clothing, so
// a bisection is enough. Returns 0 when even no clothing is too warm.
export function cloForPmv(conditions, target = 0, maxClo = 5) {
  const at = clo => pmv({ ...conditions, clo }) - target;
  if (at(0) >= 0) return 0;
  if (at(maxClo) < 0) return maxClo;
  let lo = 0;
  let hi = maxClo;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// --- ISO 11079: IREQ -------------------------------------------------------

/**
 * Required clothing insulation in the cold, in clo.
 * level "neutral" keeps skin at a comfortable temperature; "minimal"
 * accepts feeling slightly cool. M in W/m², va wind at the body m/s,
 * walk body motion m/s. Returns the resultant insulation (IREQ) and the
 * basic garment insulation it corresponds to (iclr), corrected for wind
 * and motion with air permeability p (l/m²s; 8 = windproof outer layer).
 */
export function ireq({ ta, tr, rh, va, M, walk = 0, level = "neutral", permeability = 8 }) {
  const m = clamp(M, 58, 400);
  const v = clamp(va, 0.4, 18);
  const w = clamp(walk, 0, 1.2);
  const p = clamp(permeability, 1, 1000);

  const tsk = level === "minimal" ? 33.34 - 0.0354 * m : 35.7 - 0.0285 * m;
  const wetness = level === "minimal" ? 0.06 : 0.001 * m;
  const tex = 29 + 0.2 * ta;
  const pex = saturationKpa(tex);
  const psks = saturationKpa(tsk);
  const pa = (rh / 100) * saturationKpa(ta);
  const ia = 0.092 * Math.exp(-0.15 * v - 0.22 * w) - 0.0045;
  const hres = 1.73e-2 * m * (pex - pa) + 1.4e-3 * m * (tex - ta);

  // Heat balance for a given resultant insulation (m²K/W).
  const balanceAt = req => {
    const fcl = 1 + 1.97 * req;
    const rt = (0.06 / 0.38) * (ia + req);
    const e = (wetness * (psks - pa)) / rt;
    const tcl = tsk - req * (m - e - hres);
    const hr = tcl === tr ? 4.6 : (5.67e-8 * 0.97 * 0.77 * ((273 + tcl) ** 4 - (273 + tr) ** 4)) / (tcl - tr);
    const hc = 1 / ia - hr;
    const r = fcl * hr * (tcl - tr);
    const c = fcl * hc * (tcl - ta);
    return { balance: m - e - hres - r - c, tcl, r, c };
  };

  // Heat surplus even with no clothing: nothing is required.
  if (balanceAt(0).balance >= 0) return { ireq: 0, iclr: 0 };

  let lo = 0;
  let hi = 1.2; // ≈ 7.7 clo
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (balanceAt(mid).balance > 0) hi = mid;
    else lo = mid;
  }
  const req = (lo + hi) / 2;

  // ISO 9920: wind and motion pump air through clothing, so garments need
  // more basic insulation than their resting value to deliver IREQ.
  const reduction = 0.54 * Math.exp(-0.15 * v - 0.22 * w) * p ** 0.075 - 0.06 * Math.log(p) + 0.5;
  let iclr = req;
  for (let i = 0; i < 20; i++) {
    const fcl = 1 + 1.97 * iclr;
    iclr = Math.max(0, (req + ia / fcl) / reduction - 0.085 / fcl);
  }
  return { ireq: req / M2K_PER_CLO, iclr: iclr / M2K_PER_CLO };
}

// --- Putting it together ---------------------------------------------------

// Below COLD_C the cold-weather standard (ISO 11079) is used, above MILD_C
// the comfort standard (ISO 7730), and in between the two are blended. Hard
// exercise is outside PMV's validated range, so it leans on ISO 11079 too.
const COLD_C = 5;
const MILD_C = 15;

function blendWeight(ta, met) {
  const byTemp = clamp((MILD_C - ta) / (MILD_C - COLD_C), 0, 1);
  const byWork = clamp((met - 3) / 2, 0, 1);
  return Math.max(byTemp, byWork);
}

/**
 * Clothing needed for one hour of weather.
 *
 * weather: { temp °C, rh %, wind m/s at 10 m, directNormal, diffuse,
 *            global W/m², time Date, latitude, longitude }
 * activity: { mets, speed m/s of travel, gait m/s of leg motion }
 * options: { profile, shaded, tolerance: "cold" | "normal" | "warm" }
 *
 * Returns the clothing need in clo plus the inputs that drove it.
 */
export function clothingNeed(weather, activity, { profile, shaded = false, tolerance = "normal" } = {}) {
  const metabolic = metabolicRate(activity.mets, profile);
  const wind = windAtBodyHeight(weather.wind ?? 0);
  const relativeAir = Math.sqrt(wind ** 2 + (activity.speed ?? 0) ** 2);
  const altitude =
    weather.time && weather.latitude != null ? solarAltitude(weather.time, weather.latitude, weather.longitude) : 0;
  const sunBoost = solarMrtIncrease({ ...weather, altitude, shaded });
  const ta = weather.temp;
  const tr = ta + sunBoost;
  const rh = clamp(weather.rh ?? 50, 0, 100);

  // PMV needs a little air movement even on a still day; activity adds some.
  // It is only validated up to 1 m/s, so stronger wind is left to ISO 11079.
  const pmvAir = clamp(Math.max(relativeAir, 0.1 + 0.3 * Math.max(0, metabolic.met - 1)), 0.1, 1);
  const pmvInputs = { ta, tr, vel: pmvAir, rh, met: metabolic.met };
  const ireqInputs = { ta, tr, rh, va: relativeAir, M: metabolic.wattsPerM2, walk: activity.gait ?? 0 };

  const weight = blendWeight(ta, metabolic.met);
  const need = (pmvTarget, level) => {
    const fromPmv = weight < 1 ? cloForPmv(pmvInputs, pmvTarget) : 0;
    const fromIreq = weight > 0 ? ireq({ ...ireqInputs, level }).iclr : 0;
    return weight * fromIreq + (1 - weight) * fromPmv;
  };

  // The comfortable band runs from "neutral" down to "slightly cool" (PMV
  // -0.5, IREQ minimal). Typical people are aimed at its middle; running
  // warm means the cool edge is fine, running cold means aiming past neutral.
  const neutral = need(0, "neutral");
  const cool = Math.min(neutral, need(-0.5, "minimal"));
  const band = neutral - cool;
  const clo =
    tolerance === "warm" ? cool : tolerance === "cold" ? neutral + band / 2 : cool + band / 2;

  // Wind-blocking matters when porous clothing would need much more.
  const porous = weight > 0 ? ireq({ ...ireqInputs, permeability: 150 }).iclr : 0;
  const windproofHelps = weight > 0 && porous - ireq(ireqInputs).iclr > 0.25;

  // How a person feels in almost nothing: above 0.5 PMV they will sweat.
  const minimalFeel = pmv({ ...pmvInputs, clo: 0.3 });

  return {
    clo: Math.max(0, clo),
    neutral,
    cool,
    met: metabolic.met,
    wattsPerM2: metabolic.wattsPerM2,
    airSpeed: relativeAir,
    windAtBody: wind,
    sunBoost,
    mrt: tr,
    model: weight >= 1 ? "ISO 11079" : weight <= 0 ? "ISO 7730" : "ISO 7730 + ISO 11079",
    windproofHelps,
    minimalFeel,
  };
}
