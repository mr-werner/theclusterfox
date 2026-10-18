import assert from 'node:assert/strict';
import { outfitLadders } from '../data/garments.js';
import { activities, activitiesById } from '../data/activities.js';
import { pmv, cloForPmv, ireq, clothingNeed, metabolicRate, solarMrtIncrease } from '../model/thermal.js';
import { planOutfit, windChill, heatIndex } from '../model/plan.js';
import { mergeData, normalizeData } from '../state/clocastStore.js';
import { parseForecast, parseAirQuality, withAirQuality, aqiCategory } from '../../../services/weather/openMeteo.js';
import { scoreHour, scoreWindow, rankStarts, compareWindows, sessionAdvice } from '../model/score.js';
import { suggestSessions } from '../model/coach.js';
import { dailyBriefing } from '../model/briefing.js';
import { evaluatePlan } from '../model/planner.js';
import { formatTemp } from '../units.js';
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

// Planner and coach: a hot, sunny week with smoky afternoons.
{
  const start = Date.UTC(2026, 6, 6, 5) / 1000; // midnight local (UTC-5)
  const len = 24 * 8;
  const ser = f => Array.from({ length: len }, (_, i) => f(i));
  const localHour = i => i % 24;
  const temp = i => 22 + 12 * Math.max(0, Math.sin(((localHour(i) - 8) / 12) * Math.PI));
  const parsed = parseForecast({
    utc_offset_seconds: -5 * 3600,
    hourly: {
      time: ser(i => start + i * 3600),
      temperature_2m: ser(temp),
      relative_humidity_2m: ser(() => 55),
      wind_speed_10m: ser(() => 2),
      precipitation_probability: ser(i => (i >= 24 && i < 48 ? 80 : 0)),
      precipitation: ser(i => (i >= 24 && i < 48 ? 2 : 0)),
      weather_code: ser(i => (i >= 24 && i < 48 ? 63 : 0)),
      uv_index: ser(i => Math.max(0, 9 * Math.sin(((localHour(i) - 7) / 13) * Math.PI))),
      is_day: ser(i => (localHour(i) >= 6 && localHour(i) < 20 ? 1 : 0)),
      shortwave_radiation: ser(() => 0),
    },
    daily: { time: ser(i => start + i * 86400).slice(0, 8), temperature_2m_max: Array(8).fill(34), temperature_2m_min: Array(8).fill(22) },
  });
  const air = parseAirQuality({
    hourly: { time: ser(i => start + i * 3600), us_aqi: ser(i => (localHour(i) >= 13 && localHour(i) <= 19 ? 140 : 35)) },
    current: { us_aqi: 40 },
  });
  assert.equal(air.current.aqi, 40, 'current AQI');
  assert.equal(aqiCategory(140).tone, 'usg');
  assert.equal(aqiCategory(20).label, 'Good');
  const hours = withAirQuality(parsed.hours, air);
  assert.equal(hours[15].aqi, 140, 'AQI joins onto hours');
  const days = parsed.days.map(d => d.day);
  const place = { latitude: 40.7, longitude: -74 };
  const runner = act('run-easy');

  const morning = scoreHour(hours[7], place, runner);
  const afternoon = scoreHour(hours[16], place, runner);
  assert(morning.score > afternoon.score + 30, `cool clean morning beats hot smoky afternoon (${morning.score} vs ${afternoon.score})`);
  assert(afternoon.factors.some(f => f.kind === 'heat') && afternoon.factors.some(f => f.kind === 'air'), 'afternoon names heat and air');
  assert(scoreHour(hours[24 + 7], place, runner).factors.some(f => f.kind === 'rain'), 'rainy day is marked');
  assert(scoreHour(hours[2], place, runner).factors.some(f => f.kind === 'dark'), 'night is marked');
  assert(scoreHour(hours[16], place, act('sitting')).score > afternoon.score, 'sitting minds the heat less than running');

  const window = scoreWindow(hours.slice(7, 10), place, runner);
  assert(window.score <= Math.max(...window.hours.map(h => h.score)), 'window score is held back by its worst hour');

  const ranked = rankStarts(hours, place, runner, { day: days[0], duration: 1, earliest: 5, latest: 21 });
  assert(ranked[0].startHour <= 8, `best run start is early (${ranked[0].startHour})`);
  assert(rankStarts(hours, place, runner, { day: days[0], duration: 2, notBefore: (start + 12 * 3600) * 1000 }).every(r => r.startHour >= 12), 'passed hours are skipped');

  const fmt = (c, o) => formatTemp(c, 'us', o);
  const worse = scoreWindow(hours.slice(16, 17), place, runner);
  const reasons = compareWindows(ranked[0], worse, fmt);
  assert(reasons.some(r => r.includes('cooler')), `reasons mention cooler: ${reasons}`);
  assert(reasons.some(r => r.includes('cleaner air')), `reasons mention air: ${reasons}`);
  assert.equal(formatTemp(5, 'us', { delta: true }), '9°F', 'temperature differences convert without the 32° offset');

  const advice = sessionAdvice(hours.slice(12, 14), place, runner, { formatTemp: fmt });
  assert(advice.tips.some(t => t.kind === 'sun' && t.text.includes('SPF 50')), 'strong UV asks for SPF 50');
  assert(advice.tips.some(t => t.kind === 'water'), 'long runs get a water tip');
  assert(sessionAdvice(hours.slice(15, 17), place, runner).tips.some(t => t.kind === 'air'), 'smoky session gets an air tip');
  assert(!sessionAdvice(hours.slice(12, 14), place, runner, { shaded: true }).tips.some(t => t.kind === 'sun'), 'no sunscreen nag in the shade');

  const brief = dailyBriefing(hours.slice(0, 24), { formatTemp: c => formatTemp(c, 'us') });
  for (const kind of ['sun', 'air', 'rain', 'heat']) assert(brief.some(t => t.kind === kind), `briefing covers ${kind}`);
  assert(brief.find(t => t.kind === 'rain').tone === 'good', 'dry day says so');
  assert(dailyBriefing(hours.slice(24, 48)).find(t => t.kind === 'rain').title.startsWith('Rain likely'), 'wet day warns');

  const goal = { activityId: 'run-easy', perWeek: 3, minutes: 45, timeOfDay: 'any' };
  const coached = suggestSessions(hours, days, place, goal, runner, []);
  assert.equal(coached.sessions.length, 3, 'three sessions suggested');
  assert(!coached.sessions.some(s => s.day === days[1]), 'rainy day avoided');
  const gaps = coached.sessions.map(s => days.indexOf(s.day));
  assert(gaps.every((d, i) => i === 0 || d - gaps[i - 1] >= 2), `sessions are spread out (${gaps})`);
  assert(coached.sessions.every(s => s.startHour <= 9), 'sessions dodge the heat and smoke');
  const withPlan = suggestSessions(hours, days, place, goal, runner, [{ activityId: 'run-easy', day: days[0], startHour: 7, hours: 1 }]);
  assert.equal(withPlan.needed, 2, 'planned runs count toward the goal');
  assert(!withPlan.sessions.some(s => s.day === days[0]), 'no second run on a planned day');
  const evening = suggestSessions(hours, days, place, { ...goal, timeOfDay: 'evening' }, runner, []);
  assert(evening.sessions.every(s => s.startHour >= 16), 'evening goals stay in the evening');

  const evaluated = evaluatePlan({ id: 'p', activityId: 'run-easy', day: days[0], startHour: 16, hours: 1 }, hours, place, {}, 'us', 0);
  assert(evaluated.better && evaluated.better.startHour < 12, 'an afternoon run gets a better morning time');
  assert.equal(evaluatePlan({ id: 'q', activityId: 'run-easy', day: '2027-01-01', startHour: 7, hours: 1 }, hours, place, {}, 'us', 0), null, 'no forecast, no score');
}

// Plans and goals merge item by item, and deletions stick.
{
  const t1 = '2026-07-01T00:00:00Z';
  const t2 = '2026-07-02T00:00:00Z';
  const plan = (id, startHour, updatedAt) => ({ id, activityId: 'run-easy', title: '', day: '2026-07-10', startHour, hours: 1, updatedAt });
  const local = normalizeData({ updatedAt: t1, plans: [plan('a', 7, t2), plan('b', 8, t1)], goals: [{ id: 'g', activityId: 'hike', perWeek: 1, minutes: 120, timeOfDay: 'any', updatedAt: t1 }] });
  const remote = normalizeData({ updatedAt: t2, plans: [plan('a', 9, t1), plan('c', 6, t1)], deletedPlanIds: [{ id: 'b', at: t2 }], goals: [] });
  const both = mergeData(local, remote);
  assert.deepEqual(both.plans.map(p => p.id), ['c', 'a'], 'merged plans, sorted by time, deleted one gone');
  assert.equal(both.plans.find(p => p.id === 'a').startHour, 7, 'newer edit wins');
  assert.equal(both.goals.length, 1, 'goal kept');
  assert.equal(normalizeData({ plans: [{ id: 'x', activityId: 'run-easy', day: 'nope', startHour: 7, hours: 1 }] }).plans.length, 0, 'bad plans dropped');
  assert.equal(normalizeData({ goals: [{ id: 'y', activityId: 'run-easy', perWeek: 12, minutes: 45, timeOfDay: 'any' }] }).goals[0].perWeek, 7, 'perWeek capped');
}

console.log(`PASS: CloCast model, ${activities.length} activities, ${Object.values(outfitLadders).flat().length} outfits.`);
