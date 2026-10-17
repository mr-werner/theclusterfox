import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildActivityGroups, validateActivityManifest } from '../data/activityGroups.js';

const read = name => JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url)));
const records = read('compendiumActivities.json');
const manifest = read('activityGroupManifest.json');
const byId = new Map(records.map(a => [a.id, a]));

assert.deepEqual(validateActivityManifest(records.map(a => ({ ...a })), manifest), []);

const used = new Set();
const keys = new Set();
for (const g of manifest) {
  assert(!keys.has(g.key), `duplicate key ${g.key}`); keys.add(g.key);
  assert(g.ids.length >= 2, g.title);
  assert(g.ids.length === g.optionLabels.length, g.title);
  assert.equal(new Set(g.optionLabels.map(l => l.trim())).size, g.ids.length, `${g.title}: repeated option labels`);
  for (const id of g.ids) {
    assert(byId.has(id), `missing ${id}`);
    assert.equal(byId.get(id).category, g.category, `${g.title}: wrong category`);
    assert(!used.has(id), `duplicate ${id}`); used.add(id);
  }
}
assert.equal(new Set(records.map(a => a.category)).size, 22);
assert.equal(records.length, 1111);

// Every record shows up on exactly one card.
const groups = buildActivityGroups(records.map(a => ({ ...a })), manifest);
const shown = groups.flatMap(g => g.options.map(o => o.id));
assert.equal(shown.length, records.length);
assert.equal(new Set(shown).size, records.length);

for (const [id, group] of [
  ['12508', 'Running — weighted backpack, speed'],
  ['01019', 'Bicycling — road speed'],
  ['01060', 'Bicycling — road speed'],
  ['11250', 'Forestry — axe chopping, blows per minute'],
  ['17434', 'Walking — treadmill with load, temperature'],
  ['02150', 'Yoga'],
  ['10070', 'Playing a musical instrument'],
]) {
  assert(manifest.some(g => g.title === group && g.ids.includes(id)), `${id} should be in ${group}`);
}
assert(!used.has('15597'), 'Ambiguous longboarding must remain standalone');

// Numeric adjustments run low to high so the +/- controls make sense.
const road = groups.find(g => g.key === 'curated-01018');
assert.deepEqual(road.options.map(o => o.id), ['01018', '01019', '01020', '01030', '01040', '01050', '01060']);

console.log(`PASS: ${records.length} records, 22 categories, ${manifest.length} groups, ${used.size} grouped records, ${records.length - used.size} standalone, ${groups.length} cards.`);
