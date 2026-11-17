// Checks the home screen layout rules: node src/features/home/tests/validate.mjs
import assert from "node:assert/strict";

import {
  addKey,
  cleanLayout,
  emptyLayout,
  homeKeys,
  mergeLayout,
  moveKey,
  removeKey,
} from "../state/homeStore.js";

const originals = ["f4t", "watch", "cook"];
let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

const apply = (layout, fn) => fn(layout, homeKeys(layout, originals));

test("new visitors get every original and no alternatives", () => {
  assert.deepEqual(homeKeys(emptyLayout(), originals), ["o:f4t", "o:watch", "o:cook"]);
});

test("adding an alternative puts it at the end", () => {
  const l = apply(emptyLayout(), (l, cur) => addKey(l, cur, "a:Blender"));
  assert.deepEqual(homeKeys(l, originals), ["o:f4t", "o:watch", "o:cook", "a:Blender"]);
});

test("removing an original stays removed, and adding it back works", () => {
  let l = apply(emptyLayout(), (l, cur) => removeKey(l, cur, "o:watch"));
  assert.deepEqual(homeKeys(l, originals), ["o:f4t", "o:cook"]);
  l = apply(l, (l, cur) => addKey(l, cur, "o:watch"));
  assert.deepEqual(homeKeys(l, originals), ["o:f4t", "o:cook", "o:watch"]);
  assert.deepEqual(l.removed, []);
});

test("originals launched later appear after the other originals", () => {
  let l = apply(emptyLayout(), (l, cur) => addKey(l, cur, "a:GIMP"));
  assert.deepEqual(homeKeys(l, [...originals, "math"]), ["o:f4t", "o:watch", "o:cook", "o:math", "a:GIMP"]);
});

test("originals removed from the site disappear, and alternatives can be filtered", () => {
  let l = apply(emptyLayout(), (l, cur) => addKey(l, cur, "a:Gone"));
  assert.deepEqual(homeKeys(l, ["f4t"], name => name !== "Gone"), ["o:f4t"]);
});

test("moving puts an app where the target was", () => {
  let l = apply(emptyLayout(), (l, cur) => moveKey(l, cur, "o:cook", "o:f4t"));
  assert.deepEqual(homeKeys(l, originals), ["o:cook", "o:f4t", "o:watch"]);
  l = apply(l, (l, cur) => moveKey(l, cur, "o:cook", "o:watch"));
  assert.deepEqual(homeKeys(l, originals), ["o:f4t", "o:watch", "o:cook"]);
});

test("the newest copy wins when syncing, and an untouched browser takes the account's", () => {
  const remote = { order: ["o:cook"], removed: ["o:f4t", "o:watch"], updatedAt: "2026-11-02T00:00:00Z" };
  assert.deepEqual(mergeLayout(emptyLayout(), remote).order, ["o:cook"]);
  const newer = { ...emptyLayout(), order: ["o:f4t"], updatedAt: "2026-11-05T00:00:00Z" };
  assert.deepEqual(mergeLayout(newer, remote).order, ["o:f4t"]);
  const older = { ...newer, updatedAt: "2026-11-01T00:00:00Z" };
  assert.deepEqual(mergeLayout(older, remote).order, ["o:cook"]);
});

test("bad saved data is cleaned up", () => {
  assert.deepEqual(cleanLayout(null), emptyLayout());
  const l = cleanLayout({ order: ["o:f4t", "o:f4t", 3, "x:bad", "a:GIMP"], removed: ["a:GIMP", "o:cook"] });
  assert.deepEqual(l.order, ["o:f4t", "a:GIMP"]);
  assert.deepEqual(l.removed, ["o:cook"]);
});

// Categories: PlanFox is the hub; every other app sits in exactly one section.
const { apps, categories } = await import("../../../app/apps.js");
const { groupOriginals, sectionOf } = await import("../categories.js");
const byId = new Map(apps.map(app => [app.id, app]));
const allKeys = homeKeys(emptyLayout(), apps.map(app => app.id));

test("PlanFox is the hub and every other app is in one category", () => {
  const { hub, sections } = groupOriginals(allKeys, byId);
  assert.equal(hub, "o:planfox");
  const placed = sections.flatMap(s => s.keys);
  assert.equal(placed.length, apps.length - 1);
  assert.equal(new Set(placed).size, placed.length);
  const known = new Set(categories.map(c => c.id));
  for (const app of apps) {
    if (app.id !== "planfox") assert.ok(known.has(app.category), `${app.id} has a known category`);
  }
});

test("categories keep the person's order, and new apps without one land in More", () => {
  const custom = [...byId.values(), { id: "newfox", category: "nope" }];
  const map = new Map(custom.map(a => [a.id, a]));
  const keys = ["o:cookfox", "o:f4t", "o:newfox", "o:planfox"];
  const { hub, sections } = groupOriginals(keys, map);
  assert.equal(hub, "o:planfox");
  assert.deepEqual(sections.map(s => s.id), ["food", "more"]);
  assert.deepEqual(sections[0].keys, ["o:cookfox", "o:f4t"]);
});

test("drags stay inside a category", () => {
  assert.equal(sectionOf("o:cookfox", byId), sectionOf("o:f4t", byId));
  assert.notEqual(sectionOf("o:cookfox", byId), sectionOf("o:liftfox", byId));
  assert.equal(sectionOf("a:GIMP", byId), "alts");
});

console.log(`Home screen: ${passed} checks passed.`);
