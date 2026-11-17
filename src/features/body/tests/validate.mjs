// Checks BodyFox's data and helpers: node src/features/body/tests/validate.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

import { LAYERS, baseName, explodeOffset, mirrorOf, partColor, searchParts, searchStructures, sideOf, unionBox } from "../model/parts.js";
import { LIFT_GROUPS, liftGroupFor, liftHref, partsInGroup } from "../model/liftLink.js";
import { KINDS, kindInfo } from "../data/kinds.js";
import { noteFor } from "../data/notes.js";
import { muscles } from "../../lift/data/muscles.js";
import { decodeLayer } from "../viewer/loadLayer.js";
import { buildSystems, systemOf } from "../model/systems.js";
import { LEVELS, explain } from "../data/explain.js";

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

const root = new URL("../../../../public/anatomy/", import.meta.url);
const index = JSON.parse(fs.readFileSync(new URL("index.json", root), "utf8"));
const parts = index.parts;
const byName = name => parts.find(p => p.name === name);

await test("every layer has parts and a model file, light and full", () => {
  for (const l of LAYERS) {
    assert.ok(parts.some(p => p.layer === l.id), `no parts in ${l.id}`);
    assert.ok(fs.existsSync(new URL(`${l.id}.bin`, root)), `${l.id}.bin missing`);
    assert.ok(fs.existsSync(new URL(`${l.id}-lite.bin`, root)), `${l.id}-lite.bin missing`);
    assert.ok(parts.filter(p => p.layer === l.id).length <= 4096, "a layer fits the 64 × 64 part texture");
  }
});

await test("the whole body stays small enough for phones", () => {
  const size = suffix => LAYERS.reduce((s, l) => s + fs.statSync(new URL(`${l.id}${suffix}.bin`, root)).size, 0);
  // (The female skin replaces the male one, so one body is still this size.)
  assert.ok(size("") < 4 * 1024 * 1024, `full body is ${size("")} bytes`);
  assert.ok(size("-lite") < 1.2 * 1024 * 1024, `light body is ${size("-lite")} bytes`);
});

await test("a layer file decodes into the parts the index lists", async () => {
  const buf = fs.readFileSync(new URL("skeleton-lite.bin", root));
  const layer = await decodeLayer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const count = parts.filter(p => p.layer === "skeleton").length;
  assert.equal(layer.index.length % 3, 0);
  assert.ok(layer.index.every(i => i < layer.positions.length / 3), "indices stay in range");
  const ids = new Set(layer.partIndex);
  assert.equal(ids.size, count, "every skeleton part has geometry");
  assert.ok(Math.max(...ids) < count);
  // The femur sits where the index says it does.
  const femurIdx = parts.filter(p => p.layer === "skeleton").findIndex(p => p.name === "Right femur");
  const box = byName("Right femur").box;
  for (let v = 0; v < layer.partIndex.length; v++) {
    if (layer.partIndex[v] !== femurIdx) continue;
    for (let a = 0; a < 3; a++) {
      assert.ok(layer.positions[v * 3 + a] >= box[0][a] - 0.002 && layer.positions[v * 3 + a] <= box[1][a] + 0.002);
    }
  }
});

await test("the body stands upright, facing forward, right side on -x", () => {
  const body = unionBox(parts.map(p => p.box));
  assert.ok(body[1][1] - body[0][1] > 1.5, "about 1.7 m tall");
  const skull = byName("Frontal bone").box;
  const heel = byName("Right calcaneus").box;
  assert.ok(skull[0][1] > heel[1][1] + 1.2, "head is above the feet");
  assert.ok(byName("Right femur").box[1][0] < 0 && byName("Left femur").box[0][0] > 0);
  assert.ok(byName("Sternocostal part of right pectoralis major").box[1][2] > byName("Right latissimus dorsi").box[1][2], "chest is in front of the back");
});

await test("big organs and muscles the 4.0 data lacks are filled in", () => {
  for (const name of ["Liver", "Upper lobe of right lung", "Right rectus abdominis", "Right latissimus dorsi", "Right temporalis"]) {
    assert.ok(byName(name), `${name} missing`);
  }
  assert.equal(byName("Liver").layer, "organs");
  assert.equal(byName("Right latissimus dorsi").layer, "muscles");
});

await test("parts land in sensible layers", () => {
  const expect = {
    "Right femur": "skeleton",
    "Mandible": "skeleton",
    "Right gluteus maximus": "muscles",
    "Diaphragm": "muscles",
    "Arch of aorta": "vessels",
    "Right renal vein": "vessels",
    "Corpus callosum": "nervous",
    "Midbrain": "nervous",
    "Stomach": "organs",
    "Right kidney": "organs",
    "Skin": "skin",
  };
  for (const [name, layer] of Object.entries(expect)) {
    const p = byName(name);
    assert.ok(p, `${name} not found`);
    assert.equal(p.layer, layer, name);
  }
  // Nothing from the liver ends up in the brain, and no brain part with the gut.
  assert.ok(!parts.some(p => p.layer === "nervous" && /liver|hepatic/i.test(p.name)));
  assert.ok(!parts.some(p => p.layer === "organs" && /gyrus|globus pallidus|internal capsule/i.test(p.name)));
});

await test("names: base name, side and mirror", () => {
  assert.equal(baseName("Long head of right biceps brachii"), "long head of biceps brachii");
  assert.equal(sideOf("Right femur"), "right");
  assert.equal(sideOf("Left lobe of thymus"), "left");
  assert.equal(sideOf("Liver"), null);
  assert.equal(mirrorOf(byName("Right femur"), parts).name, "Left femur");
  assert.equal(mirrorOf(byName("Liver"), parts), null);
});

await test("search finds parts by the start of any word, one per name", () => {
  const femur = searchParts(parts, "fem");
  assert.ok(femur.some(p => /femur/i.test(p.name)));
  const biceps = searchParts(parts, "biceps br");
  assert.ok(biceps.length >= 2 && biceps.every(p => /biceps brachii/i.test(p.name)));
  const names = biceps.map(p => baseName(p.name));
  assert.equal(new Set(names).size, names.length, "left and right show once");
  assert.deepEqual(searchParts(parts, "   "), []);
});

await test("whole structures: heart, brain, lungs and skull gather their pieces", () => {
  const find = q => searchStructures(parts, q)[0];
  assert.equal(find("heart").id, "heart");
  assert.ok(find("heart").parts.length >= 4 && find("heart").parts.every(p => p.layer === "vessels"));
  assert.ok(find("brain").parts.length > 20 && find("brain").parts.every(p => p.layer === "nervous"));
  assert.equal(find("lungs").parts.length, 5, "three right lobes, two left");
  assert.ok(find("skull").parts.some(p => p.name === "Mandible"));
  assert.ok(find("skull").parts.every(p => p.layer === "skeleton"));
  assert.deepEqual(searchStructures(parts, "he"), [], "too short to guess");
});

await test("veins are blue, arteries red, bones ivory", () => {
  assert.equal(partColor(byName("Right renal vein")), "#3f63b8");
  assert.equal(partColor(byName("Arch of aorta")), "#c62f37");
  assert.equal(partColor(byName("Right femur")), "#e8dcc2");
});

await test("taking apart moves parts outward from the middle", () => {
  const body = unionBox(parts.map(p => p.box));
  const right = explodeOffset(byName("Right humerus"), body);
  const left = explodeOffset(byName("Left humerus"), body);
  assert.ok(right[0] < 0 && left[0] > 0);
  const liver = explodeOffset(byName("Liver"), body);
  assert.ok(liver[2] > 0, "organs come forward");
});

await test("every kind used in the data has a write-up", () => {
  for (const kind of new Set(parts.map(p => p.kind).filter(Boolean))) {
    assert.ok(KINDS[kind], `no write-up for kind "${kind}"`);
    assert.ok(kindInfo(kind).text.length > 40);
  }
});

await test("well-known parts get their own write-up", () => {
  for (const name of ["Right femur", "Liver", "Stomach", "Right gluteus maximus", "Diaphragm", "Corpus callosum", "Arch of aorta", "Skin", "Right kidney", "Midbrain"]) {
    assert.ok(noteFor(baseName(name)), `${name} has no note`);
  }
  assert.match(noteFor("intervertebral disk of fifth lumbar vertebra"), /herniated/);
});

await test("LiftFox: muscles map to LiftFox's own groups", () => {
  const liftIds = new Set(muscles.map(m => m.id));
  for (const g of LIFT_GROUPS) assert.ok(liftIds.has(g), `${g} is not a LiftFox group`);
  assert.equal(liftGroupFor(byName("Sternocostal part of right pectoralis major")), "chest");
  assert.equal(liftGroupFor(byName("Long head of right biceps brachii")), "biceps");
  assert.equal(liftGroupFor(byName("Long head of right biceps femoris")), "hamstrings");
  assert.equal(liftGroupFor(byName("Right extensor digitorum longus")), null, "leg extensor isn't a forearm");
  assert.equal(liftGroupFor(byName("Right femur")), null, "bones aren't trained");
  for (const g of LIFT_GROUPS) assert.ok(partsInGroup(parts, g).length > 0, `no muscles for ${g}`);
  assert.equal(liftHref("lowerBack"), "/lift?muscles=lowerBack");
});

await test("male and female bodies: each has its own parts and skin", () => {
  assert.ok(fs.existsSync(new URL("skin-female.bin", root)) && fs.existsSync(new URL("skin-female-lite.bin", root)));
  for (const name of ["Body of uterus", "Right ovary", "Left ovary", "Vagina", "Right mammary gland", "Left mammary gland"]) {
    assert.equal(byName(name)?.sex, "f", `${name} is female-only`);
  }
  for (const name of ["Prostate", "Right testis", "Glans penis"]) assert.equal(byName(name)?.sex, "m", `${name} is male-only`);
  assert.equal(byName("Right femur").sex, undefined, "bones are shared");
  // The uterus sits inside the pelvis.
  const pelvis = unionBox([byName("Right hip bone").box, byName("Left hip bone").box]);
  const [lo, hi] = byName("Body of uterus").box;
  const c = [0, 1, 2].map(a => (lo[a] + hi[a]) / 2);
  for (let a = 0; a < 3; a++) assert.ok(c[a] > pelvis[0][a] && c[a] < pelvis[1][a], "uterus inside the pelvis");
});

await test("systems: every part lands in a named group of its layer", () => {
  const tree = buildSystems(parts);
  assert.equal(systemOf(byName("Right femur")).group, "legs");
  assert.equal(systemOf(byName("Long head of right biceps brachii")).sub, "upper-arm");
  assert.equal(systemOf(byName("Liver")).group, "digestive");
  assert.equal(systemOf(byName("Body of uterus")).sub, "female");
  for (const l of LAYERS) {
    const n = tree[l.id].reduce((s, g) => s + g.ids.length, 0);
    assert.equal(n, parts.filter(p => p.layer === l.id).length, `${l.id}: all parts grouped`);
  }
});

await test("explanations: every part has text at every level", () => {
  for (const p of parts) for (const lvl of LEVELS) assert.ok(explain(p, lvl.id).lead.length > 20, `${p.name} @ ${lvl.id}`);
  assert.notEqual(explain(byName("Right femur"), "kid").lead, explain(byName("Right femur"), "bio").lead);
});

console.log(`\n${passed} BodyFox checks passed`);
