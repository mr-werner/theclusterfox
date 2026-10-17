import assert from 'node:assert/strict';
import { outfitLadders } from '../data/garments.js';
import { activities, activitiesById } from '../data/activities.js';
import { pmv, cloForPmv, ireq, clothingNeed, metabolicRate, solarMrtIncrease } from '../model/thermal.js';
import { planOutfit, windChill, heatIndex } from '../model/plan.js';
import { mergeData, normalizeData } from '../state/clocastStore.js';
import { parseForecast } from '../../../services/weather/openMeteo.js';
import { windowHours, partAvailable, describeWindow } from '../when.js';

const near = (actual, expected, tolerance, label) =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: got ${actual.toFixed(3)}, expected ${expected} ± ${tolerance}`);

// ISO 7730 Annex D reference values.
near(pmv({ ta: 22, tr: 22, vel: 0.1, rh: 60, met: 1.2, clo: 0.5 }), -0.75, 0.05, 'ISO 7730 case 1');
near(pmv({ ta: 27, tr: 27, vel: 0.1, rh: 60, met: 1.2, clo: 0.5 }), 0.77, 0.05, 'ISO 7730 case 2');
near(pmv({ ta: 23.5, tr: 25.5, vel: 0.1, rh: 60, met: 1.2, clo: 0.5 }), -0.01, 0.05, 'ISO 7730 case 4');
near(pmv({ ta: 19, tr: 19, vel: 0.1, rh: 40, met: 1.2, clo: 1.0 }), -0.6, 0.05, 'ISO 7730 case 6');

// Solving for clothing gives back the clothing used.
near(cloForPmv({ ta: 22, tr: 22, vel: 0.1, rh: 60, met: 1.2 }, -0.75), 0.5, 0.02, 'cloForPmv round trip');

// IREQ: more cold, more wind, less work → more insulation; minimal < neutral.
const cold = { ta: -10, tr: -10, rh: 50, va: 0.4, M: 115 };
near(ireq(cold).ireq, 2.6, 0.3, 'IREQ neutral at -10 °C, 115 W/m²');
assert(ireq({ ...cold, level: 'minimal' }).ireq < ireq(cold).ireq, 'IREQ minimal below neutral');
assert(ireq({ ...cold, ta: -20 }).ireq > ireq(cold).ireq, 'colder needs more');
assert(ireq({ ...cold, va: 5 }).iclr > ireq(cold).iclr, 'wind needs more basic insulation');
assert(ireq({ ...cold, M: 300 }).ireq < ireq(cold).ireq, 'harder work needs less');
assert.equal(ireq({ ...cold, ta: 30, tr: 30 }).ireq, 0, 'no insulation needed when hot');

// Sunshine warms; shade removes the direct part.
const sun = { directNormal: 800, diffuse: 100, global: 700, altitude: 60 };
assert(solarMrtIncrease(sun) > 15, 'full sun adds radiant warmth');
assert(solarMrtIncrease({ ...sun, shaded: true }) < solarMrtIncrease(sun) / 2, 'shade blocks direct sun');
assert.equal(solarMrtIncrease({ ...sun, altitude: -5 }), 0, 'no sun at night');

// Bigger bodies make a bit more heat per m² of skin.
assert(metabolicRate(4, { heightCm: 180, weightKg: 110, sex: 'male' }).wattsPerM2 >
  metabolicRate(4, { heightCm: 155, weightKg: 50, sex: 'female' }).wattsPerM2, 'body size matters');
near(metabolicRate(1.3, {}).met, 0.9, 0.1, 'sitting quietly is about 1 met');

// Whole-model behaviour across temperatures and activities.
const act = id => activitiesById.get(id);
const need = (temp, id, opts) => clothingNeed({ temp, rh: 60, wind: 3 }, act(id), opts).clo;
for (const id of ['sitting', 'brisk', 'run-easy', 'bike-road']) {
  let previous = Infinity;
  for (let t = -20; t <= 30; t += 5) {
    const value = need(t, id);
    assert(value <= previous + 1e-9, `${id}: need should fall as it warms (${t} °C)`);
    previous = value;
  }
}
assert(need(0, 'sitting') > need(0, 'brisk'), 'sitting needs more than walking');
assert(need(0, 'brisk') > need(0, 'run-easy'), 'walking needs more than running');
assert(need(5, 'brisk', { tolerance: 'cold' }) > need(5, 'brisk') && need(5, 'brisk') > need(5, 'brisk', { tolerance: 'warm' }),
  'running cold or warm shifts the need');

// Outfit ladders climb steadily.
for (const [name, ladder] of Object.entries(outfitLadders)) {
  for (let i = 1; i < ladder.length; i++) {
    assert(ladder[i].clo > ladder[i - 1].clo, `${name} ladder: ${ladder[i].name} should be warmer than ${ladder[i - 1].name}`);
  }
}
for (const a of activities) assert(outfitLadders[a.wardrobe], `${a.id} has a wardrobe`);

// Weather indices.
near(windChill(-10, 20), -17.9, 0.2, 'wind chill');
near(heatIndex(32, 70), 40.6, 1, 'heat index');

// Parsing and planning from an Open-Meteo shaped response.
const base = Date.UTC(2026, 0, 15, 13) / 1000;
const n = 6;
const series = f => Array.from({ length: n }, (_, i) => f(i));
const body = {
  utc_offset_seconds: -5 * 3600,
  timezone: 'America/New_York',
  hourly: {
    time: series(i => base + i * 3600),
    temperature_2m: series(i => -6 + i),
    apparent_temperature: series(i => -11 + i),
    relative_humidity_2m: series(() => 70),
    wind_speed_10m: series(() => 6),
    wind_gusts_10m: series(() => 12),
    precipitation_probability: series(i => (i > 3 ? 60 : 10)),
    precipitation: series(() => 0),
    weather_code: series(i => (i > 3 ? 73 : 3)),
    uv_index: series(() => 1),
    is_day: series(() => 1),
    shortwave_radiation: series(() => 100),
    direct_normal_irradiance: series(() => 0),
    diffuse_radiation: series(() => 100),
  },
};
const { hours } = parseForecast(body);
assert.equal(hours.length, n);
assert.equal(hours[0].localHour, 8, 'local hour uses the place offset');
const place = { latitude: 40.7, longitude: -74 };
const walk = planOutfit(hours, place, act('dog'));
assert(walk.outfit.level >= 6, `cold dog walk should be a winter outfit, got ${walk.outfit.name}`);
assert(walk.extras.some(e => e.kind === 'hat') && walk.extras.some(e => e.kind === 'gloves'), 'hat and gloves in the cold');
assert(walk.extras.some(e => e.kind === 'snow'), 'snow boots when snow is forecast');
const run = planOutfit(hours, place, act('run-easy'));
assert.equal(run.wardrobe, 'active');
assert(run.outfit.clo < walk.outfit.clo, 'running needs less than walking the dog');
assert(run.warnings.some(w => w.tone === 'info'), 'runners are told to bring a layer for stops');

const hot = planOutfit(hours.map(h => ({ ...h, temp: 34, rh: 60, code: 0, precipProb: 0, uv: 9, directNormal: 800 })), place, act('brisk'));
assert.equal(hot.outfit.level, 0, 'lightest outfit in the heat');
assert(hot.warnings.some(w => /Heat index/.test(w.text)), 'heat warning');
assert(hot.extras.some(e => e.kind === 'sun'), 'sun protection');

// Saved data survives junk and merges without losing places.
assert.deepEqual(normalizeData({ units: 'nope', hours: 99 }).units, 'us');
const a = normalizeData({ savedPlaces: [{ id: '1', name: 'A', latitude: 1, longitude: 2 }], updatedAt: '2026-01-01T00:00:00Z', profile: { weightKg: 70 } });
const b = normalizeData({ savedPlaces: [{ id: '2', name: 'B', latitude: 3, longitude: 4 }], updatedAt: '2026-02-01T00:00:00Z', profile: { heightCm: 180 } });
const merged = mergeData(a, b, { combine: true });
assert.deepEqual(merged.savedPlaces.map(p => p.id), ['2', '1']);
assert.equal(merged.profile.weightKg, 70);
assert.equal(merged.profile.heightCm, 180);
assert.deepEqual(mergeData(a, b).savedPlaces.map(p => p.id), ['2'], 'newer copy wins outside first sign-in');

// Picking a time: parts of the day and "now".
{
  const start = Date.UTC(2026, 0, 15, 6) / 1000; // 1 AM local at UTC-5
  const len = 48;
  const ser = f => Array.from({ length: len }, (_, i) => f(i));
  const parsed = parseForecast({
    utc_offset_seconds: -5 * 3600,
    hourly: { time: ser(i => start + i * 3600), temperature_2m: ser(() => 5) },
    daily: { time: [start - 3600, start + 23 * 3600], temperature_2m_max: [8, 9], temperature_2m_min: [1, 2] },
  });
  const days = parsed.days.map(d => d.day);
  assert.deepEqual(days, ['2026-01-15', '2026-01-16'], 'daily dates are local');
  const noonLocal = Date.UTC(2026, 0, 15, 17, 30); // 12:30 PM local
  const now = windowHours(parsed.hours, days, { day: 0, part: 'now', duration: 2 }, noonLocal);
  assert.deepEqual(now.map(h => h.localHour), [12, 13], 'now starts with the current hour');
  assert.equal(describeWindow(now), '12 PM–2 PM');
  assert(!partAvailable(parsed.hours, days, 0, 'morning', noonLocal), 'this morning has passed');
  assert.deepEqual(windowHours(parsed.hours, days, { day: 0, part: 'midday' }, noonLocal).map(h => h.localHour), [12, 13], 'midday trims passed hours');
  assert.deepEqual(windowHours(parsed.hours, days, { day: 1, part: 'morning' }, noonLocal).map(h => h.localHour), [6, 7, 8, 9]);
  assert(!partAvailable(parsed.hours, days, 1, 'now', noonLocal), 'now only applies to today');
}

console.log(`PASS: CloCast model, ${activities.length} activities, ${Object.values(outfitLadders).flat().length} outfits.`);
