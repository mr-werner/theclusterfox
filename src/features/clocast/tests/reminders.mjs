import assert from 'node:assert/strict';
import { REMINDERS, dayReminders, defaultReminderSettings, normalizeReminderSettings } from '../model/reminders.js';
import { normalizeData } from '../state/clocastStore.js';
import {
  bestAltitude,
  cloudBaseFt,
  densityAltitudeFt,
  fdCode,
  fdRows,
  hourNearest,
  parseWindsAloft,
  pressureAltitudeFt,
  windAt,
  windComponents,
  windsAloftVariables,
} from '../../../services/weather/windsAloft.js';

// ---- Reminder settings ----

const defaults = defaultReminderSettings();
assert.deepEqual(defaults.on, ['sunscreen', 'sunglasses', 'clothing', 'air', 'umbrella'], 'starting reminders');
assert.deepEqual(normalizeReminderSettings(null), defaults, 'missing settings fall back to defaults');
assert.deepEqual(normalizeReminderSettings({ on: ['bugs', 'nope', 'air'] }).on, ['air', 'bugs'], 'unknown ids dropped, catalog order kept');
assert.deepEqual(normalizeReminderSettings({ on: [] }).on, [], 'everything off stays off');
assert.equal(normalizeData({}).reminders.on.length, defaults.on.length, 'SkyFox data starts with the default reminders');
assert.equal(normalizeData({ aviation: true }).aviation, true, 'aviation switch is remembered');
assert.equal(normalizeData({ aviation: 'yes' }).aviation, false, 'aviation must be a real true');

// ---- Reminders for a day ----

const DAY = '2026-07-01';
const hourAt = (localHour, extra = {}) => ({
  time: new Date(Date.UTC(2026, 6, 1, localHour)),
  localHour,
  localDay: DAY,
  temp: 24,
  apparent: 24,
  rh: 50,
  wind: 2,
  gust: 4,
  precipProb: 0,
  precip: 0,
  code: 1,
  uv: 0,
  isDay: localHour >= 6 && localHour <= 20,
  global: 0,
  directNormal: 0,
  diffuse: 0,
  cloud: 80,
  ...extra,
});
const place = { latitude: 40, longitude: -105 };
const days = [{ day: DAY, code: 1, high: 30, low: 15, precip: 0, sunrise: { hour: 5, minute: 40 }, sunset: { hour: 20, minute: 31 } }];
const all = REMINDERS.map(r => r.id);
const run = (hours, on = all, extra = {}) => dayReminders({ hours, days, day: DAY, settings: { on, ...extra }, place, units: 'us' });
const ids = list => list.map(r => r.id);

// A calm, cloudy, mild day: only the clothing and sunset reminders.
const calm = Array.from({ length: 24 }, (_, h) => hourAt(h));
assert.deepEqual(ids(run(calm)), ['clothing', 'daylight'], 'quiet day only gets the outfit and sunset');
assert.equal(run(calm, [])?.length, 0, 'nothing when everything is off');

// Strong sun.
const sunny = calm.map(h => (h.localHour >= 10 && h.localHour <= 16 ? { ...h, uv: h.localHour === 13 ? 9 : 5, directNormal: 800, cloud: 5, global: 800 } : h));
const sun = run(sunny, ['sunscreen', 'sunglasses']);
assert.deepEqual(ids(sun), ['sunscreen', 'sunglasses']);
assert.match(sun[0].title, /10 AM–5 PM/, 'sunscreen window spans the UV hours');
assert.match(sun[0].text, /SPF 50/, 'very high UV asks for SPF 50');
assert.equal(sun[0].tone, 'warn');

// Rain, bad air, heat, gusts and bugs.
const rough = calm.map(h => ({
  ...h,
  precipProb: h.localHour >= 14 && h.localHour <= 17 ? 80 : 10,
  precip: h.localHour >= 14 && h.localHour <= 17 ? 2 : 0,
  aqi: h.localHour >= 12 && h.localHour <= 18 ? 160 : 40,
  apparent: h.localHour === 15 ? 36 : 24,
  gust: h.localHour === 16 ? 18 : 4,
  temp: h.localHour >= 18 ? 22 : 24,
  rh: h.localHour >= 18 ? 80 : 50,
  wind: h.localHour >= 18 ? 1 : 2,
}));
const list = run(rough, ['umbrella', 'air', 'heat', 'wind', 'bugs']);
assert.deepEqual(ids(list), ['air', 'umbrella', 'heat', 'wind', 'bugs'], 'catalog order');
assert.match(list.find(r => r.id === 'umbrella').title, /2 PM/, 'umbrella from when rain starts');
assert.equal(list.find(r => r.id === 'air').tone, 'warn', 'AQI 160 is a warning');
assert.match(list.find(r => r.id === 'air').text, /Cleanest air/, 'points to the cleanest hour');

// Air sensitivity lowers the bar.
const moderate = calm.map(h => ({ ...h, aqi: 70 }));
assert.equal(run(moderate, ['air']).length, 0, 'AQI 70 is fine for most people');
assert.equal(run(moderate, ['air'], { airSensitive: true }).length, 1, 'AQI 70 reminds sensitive people');

// Frost, then ice after rain.
const frosty = calm.map(h => ({ ...h, temp: h.localHour <= 8 ? -2 : 6, apparent: h.localHour <= 8 ? -5 : 4 }));
assert.match(run(frosty, ['frost'])[0].title, /Frost/);
const icy = frosty.map(h => (h.localHour === 2 ? { ...h, precip: 1 } : h));
assert.match(run(icy, ['frost'])[0].title, /Ice/);

// Hours already gone today are left out.
const late = run(sunny, ['sunscreen'], {});
const afterSun = dayReminders({ hours: sunny, days, day: DAY, settings: { on: ['sunscreen'] }, place, notBefore: Date.UTC(2026, 6, 1, 18) });
assert.equal(late.length, 1);
assert.equal(afterSun.length, 0, 'no sunscreen reminder once the sun is gone');

// ---- Winds aloft ----

assert(windsAloftVariables().includes('wind_speed_850hPa'), 'asks for pressure-level wind');
assert(windsAloftVariables().includes('geopotential_height_500hPa'), 'asks for level heights');

// FB codes, including the edge cases pilots learn.
assert.equal(fdCode({ dir: 270, speedKt: 15, tempC: 5 }, 6000), '2715+05');
assert.equal(fdCode({ dir: 270, speedKt: 15, tempC: -8 }, 12000), '2715-08');
assert.equal(fdCode({ dir: 120, speedKt: 3, tempC: -2 }, 9000), '9900-02', 'light and variable');
assert.equal(fdCode({ dir: 250, speedKt: 115, tempC: -45 }, 34000), '751545', '100+ kt adds 50 to the direction, no sign up high');
assert.equal(fdCode({ dir: 4, speedKt: 20 }, 3000), '3620', 'north is 36, wind only at 3000');
assert.equal(fdCode({ dir: 300, speedKt: 250, tempC: -60 }, 39000), '809960', 'caps at 199 kt');

// Components: a wind straight down the course is all headwind.
const nose = windComponents(90, 20, 90);
assert(Math.abs(nose.headwind - 20) < 1e-9 && Math.abs(nose.crosswind) < 1e-9);
const right = windComponents(180, 10, 90);
assert(Math.abs(right.crosswind - 10) < 1e-9, 'wind from the right is positive crosswind');
const tail = windComponents(270, 15, 90);
assert(Math.abs(tail.headwind + 15) < 1e-9, 'tailwind is negative headwind');

// Standard atmosphere checks.
assert(Math.abs(pressureAltitudeFt(1013.25)) < 1, 'sea level');
assert(Math.abs(pressureAltitudeFt(843.1) - 5000) < 60, '843 hPa is about 5,000 ft');
assert(Math.abs(densityAltitudeFt(1013.25, 15)) < 1, 'standard day DA = 0');
assert(Math.abs(densityAltitudeFt(843.1, 30) - 7950) < 150, 'hot day at 5,000 ft is about 8,000 ft DA');
assert.equal(cloudBaseFt(20, 10), 4000, '10°C spread is about 4,000 ft');

// Parsing a small response and interpolating between levels.
const seconds = [1782910800, 1782914400];
const body = {
  elevation: 1600,
  utc_offset_seconds: -21600,
  timezone: 'America/Denver',
  hourly: {
    time: seconds,
    wind_speed_10m: [5, 6], wind_direction_10m: [180, 190], wind_gusts_10m: [12, 14],
    temperature_2m: [20, 22], dew_point_2m: [5, 6], surface_pressure: [840, 839], pressure_msl: [1015, 1014],
    freezing_level_height: [4200, 4300],
    wind_speed_850hPa: [8, 8], wind_direction_850hPa: [200, 200], temperature_850hPa: [18, 18], geopotential_height_850hPa: [1500, 1500],
    wind_speed_700hPa: [20, 22], wind_direction_700hPa: [350, 350], temperature_700hPa: [6, 6], geopotential_height_700hPa: [3100, 3100],
    wind_speed_500hPa: [40, 42], wind_direction_500hPa: [10, 10], temperature_500hPa: [-10, -10], geopotential_height_500hPa: [5800, 5800],
  },
};
const profile = parseWindsAloft(body, { levels: [850, 700, 500] });
assert.equal(profile.hours.length, 2);
assert(Math.abs(profile.elevationFt - 5249) < 1, 'elevation in feet');
const [first] = profile.hours;
assert.equal(first.localDay, '2026-07-01');
assert.equal(first.levels[0].belowGround, true, '850 hPa sits under a 1,600 m field');
assert.equal(first.levels[1].belowGround, false);
assert(Math.abs(first.freezingLevelFt - 13780) < 2);

// Halfway between 350° and 010° is north, not south.
const mid = windAt(first, (3100 + 5800) / 2 * 3.28084, { elevationFt: profile.elevationFt });
assert(mid.dir < 5 || mid.dir > 355, `vector blend keeps north (${mid.dir.toFixed(1)}°)`);
assert(Math.abs(mid.tempC - -2) < 0.01, 'temperature interpolates linearly');
assert.equal(windAt(first, 3000, { elevationFt: profile.elevationFt }), null, 'nothing below the ground');
assert.equal(windAt(first, 30000, { elevationFt: profile.elevationFt }), null, 'nothing above the top level');

// Between the ground and the lowest real level, blend from the surface wind.
const low = windAt(first, 7000, { elevationFt: profile.elevationFt });
assert(low && low.speedKt < 20, 'low wind blends the surface wind with 700 hPa');

const rows = fdRows(first, { elevationFt: profile.elevationFt, altitudes: [3000, 6000, 12000, 18000] });
assert.equal(rows[0].code, '', 'no 3,000 ft winds at a high field');
assert.equal(rows[1].code, '', 'no wind within 1,500 ft of the ground');
assert.match(rows[2].code, /^\d{4}[+-]\d{2}$/, '12,000 ft has wind and temperature');

const best = bestAltitude(first, 180, { elevationFt: profile.elevationFt, altitudes: [9000, 12000, 18000] });
assert.equal(best.altitudeFt, 18000, 'flying south, the strongest north wind behind you wins');

assert.equal(hourNearest(profile, new Date(seconds[1] * 1000 + 600_000)), profile.hours[1], 'nearest hour to an ETA');

console.log('reminders and winds aloft: all checks passed');
