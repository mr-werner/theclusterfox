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

console.log(`Home screen: ${passed} checks passed.`);
