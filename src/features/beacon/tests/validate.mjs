// Checks BeaconFox's Morse code, signals, player and offline worker:
// node src/features/beacon/tests/validate.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

import { MORSE, SOS_CODE, decode, encode, lettersToUnits, messageSegments, normalizeText, readKeying, toMorseString, totalMs, unitMs } from "../model/morse.js";
import { SIGNALS, flashesTooFast, signalById } from "../model/signals.js";
import { createPlayer } from "../model/player.js";
import { normalizePrefs } from "../state/prefs.js";
import { filesFor, renderWorker } from "../../../../scripts/beacon/offline-plugin.mjs";

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

await test("the Morse table is complete and every code is unique", () => {
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") assert.ok(MORSE[ch], `${ch} has a code`);
  const codes = Object.values(MORSE);
  assert.equal(new Set(codes).size, codes.length);
  for (const c of codes) assert.match(c, /^[.-]+$/);
});

await test("text turns into Morse and back", () => {
  assert.equal(toMorseString("sos"), "... --- ...");
  assert.equal(toMorseString("Help me"), ".... . .-.. .--. / -- .");
  assert.equal(decode(toMorseString("HELP 2 PEOPLE AT TRAILHEAD")), "HELP 2 PEOPLE AT TRAILHEAD");
  assert.equal(decode(SOS_CODE), "SOS");
  assert.equal(normalizeText("  café   “ok”  "), 'CAFE "OK"');
  const enc = encode("a#b");
  assert.deepEqual(enc.map(l => l.code), [".-", null, "-..."], "unknown characters are marked, not dropped silently");
});

await test("timing follows the standard: dot 1, dash 3, gaps 1 / 3 / 7", () => {
  const steps = lettersToUnits(encode("ET A"));
  assert.deepEqual(
    steps.map(s => [s.on ? 1 : 0, s.units]),
    [[1, 1], [0, 3], [1, 3], [0, 7], [1, 1], [0, 1], [1, 3], [0, 7]]
  );
  // PARIS is 50 units: one word a minute is 1200 ms a unit.
  assert.equal(unitMs(1), 1200);
  assert.equal(unitMs(6), 200);
  const paris = lettersToUnits(encode("PARIS")).reduce((s, x) => s + x.units, 0);
  assert.equal(paris, 50);
  assert.equal(totalMs(messageSegments("PARIS", 10)), 50 * 120);
  assert.deepEqual(messageSegments("", 6), []);
});

await test("SOS is one run of nine with no letter gaps", () => {
  const sos = signalById.get("sos").build(6);
  const ons = sos.filter(s => s.on).map(s => s.ms);
  assert.deepEqual(ons, [200, 200, 200, 600, 600, 600, 200, 200, 200]);
  const offs = sos.filter(s => !s.on).map(s => s.ms);
  assert.deepEqual(offs, [200, 200, 200, 200, 200, 200, 200, 200, 1400]);
});

await test("every signal is a sane pattern and none flash too fast", () => {
  for (const s of SIGNALS) {
    const segs = s.build(6);
    assert.ok(segs.length > 0, s.id);
    assert.ok(segs.some(x => x.on), `${s.id} lights up`);
    assert.equal(flashesTooFast(segs), false, `${s.id} is slow enough`);
    assert.ok(s.name && s.what && s.short);
  }
  assert.equal(flashesTooFast([{ on: true, ms: 50 }, { on: false, ms: 50 }]), true);
  // At the fastest speed BeaconFox allows, the Morse tab shows its warning.
  assert.equal(flashesTooFast(signalById.get("sos").build(12)), true, "12 wpm counts as fast, so the warning shows");
});

await test("tapped Morse reads back as letters", () => {
  const u = 200;
  const tap = (code, gapAfter) => [...code].map((c, i, all) => ({ down: c === "." ? u : 3 * u, gapAfter: i < all.length - 1 ? u : gapAfter }));
  const presses = [...tap("....", 3 * u), ...tap(".", 7 * u), ...tap("..", null)];
  assert.deepEqual(readKeying(presses, u), { text: "HE ", pending: ".." });
  const done = [...tap("...", 3 * u), ...tap("---", 3 * u), ...tap("...", 3 * u)];
  assert.equal(readKeying(done, u).text, "SOS");
});

await test("the player keeps time and loops", async () => {
  const seen = [];
  const player = createPlayer(s => seen.push(s.on));
  await new Promise(resolve => {
    player.start([{ on: true, ms: 20 }, { on: false, ms: 20 }], { loop: false, onEnd: resolve });
  });
  assert.deepEqual(seen, [true, false, false]);
  const looped = [];
  const p2 = createPlayer(s => looped.push(s.on));
  p2.start([{ on: true, ms: 10 }, { on: false, ms: 10 }]);
  await new Promise(r => setTimeout(r, 75));
  p2.stop();
  assert.ok(looped.filter(Boolean).length >= 3, "repeats until stopped");
  assert.equal(looped[looped.length - 1], false, "stopping turns the light off");
  assert.equal(p2.isRunning(), false);
});

await test("saved settings are cleaned up", () => {
  assert.deepEqual(normalizePrefs(null).wpm, 6);
  const p = normalizePrefs({ wpm: 99, color: "purple", screen: "yes", message: "x".repeat(500) });
  assert.equal(p.wpm, 12);
  assert.equal(p.color, "white");
  assert.equal(p.screen, true);
  assert.equal(p.message.length, 120);
});

await test("the offline worker lists what /beacon needs and nothing else", () => {
  const bundle = {
    "assets/index-a.js": { type: "chunk", fileName: "assets/index-a.js", isEntry: true, imports: ["assets/vendor-b.js"], viteMetadata: { importedCss: new Set(["assets/index-a.css"]), importedAssets: new Set() } },
    "assets/vendor-b.js": { type: "chunk", fileName: "assets/vendor-b.js", imports: [], viteMetadata: { importedCss: new Set(), importedAssets: new Set() } },
    "assets/BeaconPage-c.js": { type: "chunk", fileName: "assets/BeaconPage-c.js", facadeModuleId: "/x/src/features/beacon/BeaconPage.jsx", imports: ["assets/vendor-b.js"], viteMetadata: { importedCss: new Set(["assets/BeaconPage-c.css"]), importedAssets: new Set() } },
    "assets/BodyPage-d.js": { type: "chunk", fileName: "assets/BodyPage-d.js", facadeModuleId: "/x/src/features/body/BodyPage.jsx", imports: [], viteMetadata: { importedCss: new Set(), importedAssets: new Set() } },
    "assets/index-a.css": { type: "asset", fileName: "assets/index-a.css" },
    "assets/BeaconPage-c.css": { type: "asset", fileName: "assets/BeaconPage-c.css" },
  };
  const files = filesFor(bundle);
  assert.deepEqual(files, ["/assets/BeaconPage-c.css", "/assets/BeaconPage-c.js", "/assets/index-a.css", "/assets/index-a.js", "/assets/vendor-b.js"]);
  const sw = renderWorker(files);
  assert.ok(!sw.includes("__FILES__") && !sw.includes("__VERSION__"), "placeholders are filled");
  assert.ok(sw.includes('"/assets/BeaconPage-c.js"') && sw.includes('"/apps/beaconfox.webmanifest"'));
  assert.ok(!sw.includes("BodyPage"), "other apps are not saved");
  for (const extra of JSON.parse(sw.match(/const FILES = (\[.*?\]);/)[1]).filter(f => !f.startsWith("/assets/"))) {
    assert.ok(fs.existsSync(new URL(`../../../../public${extra}`, import.meta.url)), `${extra} exists`);
  }
  assert.throws(() => filesFor({}), /BeaconPage chunk not found/);
});

await test("the install manifest points at /beacon", () => {
  const m = JSON.parse(fs.readFileSync(new URL("../../../../public/apps/beaconfox.webmanifest", import.meta.url), "utf8"));
  assert.equal(m.start_url, "/beacon");
  assert.equal(m.scope, "/beacon");
});

console.log(`BeaconFox: ${passed} checks passed`);
