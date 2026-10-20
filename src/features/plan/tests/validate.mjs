import assert from 'node:assert/strict';
import { addDays, dayRange, monthGrid, occurrences, relativeDay, formatTime } from '../model/dates.js';
import { easter, usHolidays, parseNager } from '../model/holidays.js';
import { carChecks, gardenTips, eventConflicts, gameInPlace, itemNotes, headsUp, wearFor, trainingAdvice } from '../model/insights.js';
import { buildEntries, expandItems } from '../model/entries.js';
import { normalizeData, mergeData, PRESETS, LAYERS, togglePreset } from '../state/planStore.js';
import { parseIcs, expandIcs, parseIcsDate } from '../../../services/plan/ics.js';
import { feedUrl, isPublicHost } from '../../../../api/plan/feed.js';
import { parseScoreboard } from '../../../services/watch/parse.js';

// Dates
assert.equal(addDays('2026-10-31', 1), '2026-11-01');
assert.equal(addDays('2026-03-07', 2), '2026-03-09', 'across the DST change');
assert.equal(dayRange('2026-12-30', '2027-01-02').length, 4);
const oct = monthGrid(2026, 9);
assert.equal(oct[0][0], '2026-09-27', 'October 2026 grid starts on the Sunday before the 1st');
assert(oct.flat().includes('2026-10-31'));
assert(oct.every(w => w.length === 7));
assert.equal(relativeDay('2026-10-20', '2026-10-19'), 'Tomorrow');
assert.equal(formatTime('19:30'), '7:30 PM');
assert.equal(formatTime('00:00'), '12 AM');

// Repeats
assert.deepEqual(occurrences({ day: '2026-10-05', repeat: 'none' }, '2026-10-01', '2026-10-31'), ['2026-10-05']);
assert.deepEqual(occurrences({ day: '2026-09-01', repeat: 'weekly' }, '2026-10-01', '2026-10-15'), ['2026-10-06', '2026-10-13']);
assert.deepEqual(occurrences({ day: '2026-09-01', repeat: 'biweekly' }, '2026-10-01', '2026-10-31'), ['2026-10-13', '2026-10-27']);
assert.deepEqual(occurrences({ day: '2026-01-31', repeat: 'monthly' }, '2026-02-01', '2026-04-30'), ['2026-02-28', '2026-03-31', '2026-04-30'], 'month-end bills land on the last day');
assert.deepEqual(occurrences({ day: '2020-06-15', repeat: 'yearly' }, '2026-01-01', '2026-12-31'), ['2026-06-15']);
assert.deepEqual(occurrences({ day: '2026-10-01', repeat: 'daily', until: '2026-10-03' }, '2026-09-01', '2026-10-31'), ['2026-10-01', '2026-10-02', '2026-10-03']);
assert.deepEqual(occurrences({ day: '2026-11-01', repeat: 'monthly' }, '2026-10-01', '2026-10-31'), [], 'nothing before it starts');

// Holidays
assert.equal(easter(2026).toDateString(), new Date(2026, 3, 5).toDateString());
assert.equal(easter(2027).toDateString(), new Date(2027, 2, 28).toDateString());
const h26 = usHolidays(2026);
const find = name => h26.find(h => h.name === name)?.day;
assert.equal(find('Thanksgiving'), '2026-11-26');
assert.equal(find('Columbus Day / Indigenous Peoples\' Day'), '2026-10-12');
assert.equal(find('Independence Day (observed)'), '2026-07-03', 'July 4 2026 is a Saturday');
assert.equal(find('Daylight saving time ends'), '2026-11-01');
assert.equal(find('Election Day'), '2026-11-03');
assert.equal(find('Memorial Day'), '2026-05-25');
assert.equal(h26.find(h => h.name === 'Independence Day').closed, undefined, 'the Saturday itself is not the closure day');
const nager = parseNager([{ date: '2026-10-12', localName: 'Thanksgiving', name: 'Thanksgiving', global: true, types: ['Public'] }]);
assert.deepEqual(nager[0], { day: '2026-10-12', name: 'Thanksgiving', kind: 'holiday', closed: true, note: null });

// Car and garden tips
const days = [
  { day: '2026-10-19', high: 18, low: 6, code: 1, precip: 0, precipProb: 10, wind: 4 },
  { day: '2026-10-20', high: 5, low: -1, code: 3, precip: 0, precipProb: 10, wind: 5 },
  { day: '2026-10-21', high: 3, low: -3, code: 73, precip: 4, precipProb: 80, wind: 15 },
];
const car = carChecks(days);
assert(car.some(t => t.day === '2026-10-20' && /First freeze/.test(t.title)), 'first freeze');
assert(car.some(t => t.day === '2026-10-20' && /temperature drop/.test(t.title)), 'big drop');
assert(car.some(t => t.day === '2026-10-21' && /Snow/.test(t.title)), 'snow');
assert(car.some(t => t.day === '2026-10-21' && /High winds/.test(t.title)), 'wind');
assert.equal(car.filter(t => /First freeze/.test(t.title)).length, 1, 'first freeze only once');
const garden = gardenTips(days);
assert(garden.some(t => t.day === '2026-10-20' && /Frost/.test(t.title)));
assert(garden.some(t => t.day === '2026-10-21' && /Hard freeze/.test(t.title)));

// Games near personal events
const games = parseScoreboard({
  events: [{
    id: '1', date: '2026-10-25T17:00Z', name: 'Packers at Bears',
    status: { type: { state: 'pre' } },
    competitions: [{
      venue: { fullName: 'Soldier Field', address: { city: 'Chicago', state: 'IL' } },
      competitors: [
        { homeAway: 'home', team: { displayName: 'Chicago Bears', shortDisplayName: 'Bears' } },
        { homeAway: 'away', team: { displayName: 'Green Bay Packers', shortDisplayName: 'Packers' } },
      ],
    }],
  }],
}, 'nfl').map(g => ({ ...g, day: '2026-10-25' }));
assert.equal(games[0].venueCity, 'Chicago');
assert(gameInPlace(games[0], { name: 'Chicago' }));
assert(!gameInPlace(games[0], { name: 'Green Bay' }));
const conflicts = eventConflicts([{ day: '2026-10-25', title: 'Lunch with Sam', place: { name: 'Chicago' } }], games);
assert.equal(conflicts.length, 1);
assert.match(conflicts[0].text, /Lunch with Sam/);

// Bills due on a weekend or holiday
const notes = itemNotes([{ kind: 'bill', title: 'Rent', day: '2026-11-01', repeat: 'monthly', done: false }], h26, '2026-10-19');
assert.match(notes[0].text, /Friday, Oct 30/, 'Nov 1 2026 is a Sunday: pay Friday');
const overdue = itemNotes([{ kind: 'task', title: 'Oil change', day: '2026-10-10', repeat: 'none', done: false }], [], '2026-10-19');
assert.match(overdue[0].title, /Overdue/);
assert.equal(itemNotes([{ kind: 'task', title: 'Daily', day: '2026-10-10', repeat: 'daily', done: false }], [], '2026-10-19').length, 0, 'repeating tasks are not nagged');

// Weather-driven advice with a synthetic forecast
const place = { name: 'Chicago', latitude: 41.88, longitude: -87.63 };
const hours = [];
for (let h = 0; h < 24; h++) {
  const temp = 4 + 8 * Math.sin(((h - 9) / 24) * Math.PI * 2);
  hours.push({
    time: new Date(Date.UTC(2026, 9, 21, h + 5)), localHour: h, localDay: '2026-10-21', temp, apparent: temp - 2, rh: 70,
    wind: 4, gust: 7, precipProb: h >= 15 ? 70 : 5, precip: h >= 15 ? 1 : 0, code: h >= 15 ? 61 : 1, uv: h > 9 && h < 16 ? 3 : 0,
    isDay: h >= 7 && h <= 18, global: 200, directNormal: 300, diffuse: 80,
  });
}
const wear = wearFor(hours, '2026-10-21', place);
assert(wear && wear.name && wear.layers.length, 'outfit for the day');
const training = trainingAdvice(hours, '2026-10-21', place, { activityId: 'run-easy', time: '18:00', minutes: 60 });
assert(training.best.startHour < 15, 'best run is before the rain');
assert(training.better, 'a better time than 6 PM in the rain');

const heads = headsUp({
  today: '2026-10-19', forecast: { days, hours }, place,
  instances: [
    { kind: 'training', title: 'Evening run', day: '2026-10-21', time: '18:00', minutes: 60, activityId: 'run-easy', repeat: 'none', done: false },
    { kind: 'event', title: 'Lunch with Sam', day: '2026-10-25', place: { name: 'Chicago' }, repeat: 'none', done: false },
    { kind: 'bill', title: 'Rent', amount: 1200, day: '2026-10-24', repeat: 'none', done: false },
  ],
  games, holidays: h26, layers: { garden: true }, now: 0,
});
assert(heads.some(t => t.kind === 'train'), 'suggests a better training time');
assert(heads.some(t => t.kind === 'traffic'), 'flags the game near lunch');
assert(heads.some(t => t.kind === 'bill' && /1200\.00/.test(t.title)), 'bill coming up');
assert(heads.some(t => t.kind === 'car'), 'car checks');
assert(heads.every((t, i) => i === 0 || heads[i - 1].day <= t.day), 'sorted by day');

// Store
const data = normalizeData({ items: [{ id: 'a', kind: 'bill', title: 'Rent', day: '2026-10-01', amount: '1200.555', repeat: 'monthly', done: ['2026-10-01', 'x'] }, { id: 'b', day: 'nope' }], layers: { games: true, bogus: true } });
assert.equal(data.items.length, 1);
assert.equal(data.items[0].amount, 1200.56);
assert.deepEqual(data.items[0].done, ['2026-10-01']);
assert.equal(data.layers.games, true);
assert.equal(data.layers.bogus, undefined);
const merged = mergeData(
  { items: [{ id: 'a', title: 'Old', day: '2026-10-01', updatedAt: '2026-10-01T00:00:00Z' }], updatedAt: '2026-10-01T00:00:00Z' },
  { items: [{ id: 'a', title: 'New', day: '2026-10-01', updatedAt: '2026-10-02T00:00:00Z' }, { id: 'c', title: 'Gone', day: '2026-10-03', updatedAt: '2026-10-01T00:00:00Z' }], deletedItemIds: [{ id: 'c', at: '2026-10-05T00:00:00Z' }] }
);
assert.deepEqual(merged.items.map(i => i.title), ['New'], 'newest edit wins, deletions stick');

// Entries
const inst = expandItems(data.items, '2026-10-01', '2026-11-30');
assert.deepEqual(inst.map(i => [i.day, i.done]), [['2026-10-01', true], ['2026-11-01', false]]);
const byDay = buildEntries({ layers: { bills: true, holidays: true, sports: true }, instances: inst, holidays: h26, games, teams: ['bears'] });
assert.equal(byDay.get('2026-10-01')[0].layer, 'bills');
assert.equal(byDay.get('2026-10-25')[0].minor, true, 'games are minor until a team is picked');
assert.equal(buildEntries({ layers: { sports: true }, games: games.map(g => ({ ...g, favorite: true })), teams: ['bears'] }).get('2026-10-25')[0].minor, false);

// Calendar links
const ics = [
  'BEGIN:VCALENDAR',
  'X-WR-CALNAME:School',
  'BEGIN:VEVENT',
  'UID:1',
  'SUMMARY:Parent-teacher\\, conferences',
  'DTSTART;VALUE=DATE:20261022',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:2',
  'SUMMARY:Soccer practice',
  'LOCATION:North Field',
  'DTSTART;TZID=America/Chicago:20261006T170000',
  'DTEND;TZID=America/Chicago:20261006T183000',
  'RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20261031T000000Z',
  'EXDATE;TZID=America/Chicago:20261015T170000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:3',
  'SUMMARY:Cancelled thing',
  'STATUS:CANCELLED',
  'DTSTART:20261023T150000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:4',
  'SUMMARY:Long',
  '  title',
  'DTSTART:20261024T150000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');
const events = parseIcs(ics);
assert.equal(events.length, 3, 'cancelled events dropped');
assert.equal(events[0].title, 'Parent-teacher, conferences');
assert.equal(events[0].start.allDay, true);
assert.equal(events[2].title, 'Long title', 'folded lines join');
assert.deepEqual(parseIcsDate('20261024T150000Z'), { day: '2026-10-24', time: '15:00', utc: '2026-10-24T15:00:00Z', allDay: false });
const expanded = expandIcs(events, '2026-10-01', '2026-10-31').filter(e => e.uid === '2');
assert.deepEqual(expanded.map(e => e.day), ['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29'], 'Tue/Thu, minus the exception');
assert.equal(expanded[0].time, '17:00');
assert.equal(expanded[0].endTime, '18:30');

// Only public calendar links are fetched
assert(feedUrl('webcal://calendar.google.com/calendar/ical/x/basic.ics'));
assert.equal(feedUrl('webcal://calendar.google.com/x.ics').protocol, 'https:');
for (const bad of ['http://localhost/x.ics', 'http://127.0.0.1/x', 'http://10.0.0.5/x', 'http://192.168.1.2/x', 'http://169.254.169.254/latest', 'http://[::1]/x', 'file:///etc/passwd', 'http://printer.local/x', 'https://example.com:8080/x', 'https://user:pw@example.com/x', 'http://intranet/x']) {
  assert.equal(feedUrl(bad), null, bad);
}
assert(isPublicHost('8.8.8.8'));

// Quick setups only name real layers
const layerIds = new Set(LAYERS.map(l => l.id));
assert(PRESETS.every(p => p.layers.every(id => layerIds.has(id))));
assert.equal(normalizeData({}).setupDone, false);
assert.equal(normalizeData({ items: [{ id: 'x', day: '2026-10-01' }] }).setupDone, true, 'people who already use it skip setup');

const start = normalizeData({}).layers;
const fan = PRESETS.find(p => p.id === 'fan');
const trainingSetup = PRESETS.find(p => p.id === 'training');
const both = togglePreset(togglePreset(start, fan), trainingSetup);
assert(both.sports && both.training, 'setups add layers');
const fanOff = togglePreset(both, fan);
assert(!fanOff.sports && fanOff.weather && fanOff.events, 'unpicking keeps layers another setup needs');

console.log('PlanFox checks passed.');
