// CribFox pairing codes, loudness and the noise alert:
// node src/features/crib/tests/validate.mjs
import assert from "node:assert/strict";
import { ALPHABET, CODE_LENGTH, cleanCode, isCode, loudness, newCode, noiseAlarm, showCode } from "../lib/code.js";

// Codes avoid the look-alikes and come out the right length.
for (const c of "01OIL") assert.equal(ALPHABET.includes(c), false, `${c} isn't used`);
let seed = 3;
const random = (n) => Uint32Array.from({ length: n }, () => (seed = (seed * 48271) % 2147483647));
const seen = new Set();
for (let i = 0; i < 500; i++) {
  const code = newCode(random);
  assert.equal(code.length, CODE_LENGTH);
  assert.equal(isCode(code), true);
  seen.add(code);
}
assert.equal(seen.size, 500, "codes don't repeat");
assert.equal(isCode(newCode()), true, "the real random source works");

assert.equal(showCode("K7QM3XRA"), "K7QM-3XRA");
assert.equal(cleanCode(" k7qm-3xra "), "K7QM3XRA");
assert.equal(cleanCode(showCode("K7QM3XRA")), "K7QM3XRA", "typing the shown code round-trips");
assert.equal(cleanCode("K7QM3XRAZZZ"), "K7QM3XRA");
assert.equal(isCode("K7QM3XR"), false, "too short");
assert.equal(isCode("K7QM3XR0"), false, "0 is never issued");

// Loudness: silence is 0, full scale is 100, quiet rooms sit low.
assert.equal(loudness(0), 0);
assert.equal(loudness(NaN), 0);
assert.equal(loudness(1), 100);
assert.equal(loudness(0.001), 0);
assert.ok(loudness(0.01) > 15 && loudness(0.01) < 50, "a quiet room");
assert.ok(loudness(0.2) > 70, "crying");

// The alert waits for sustained noise, then rests before firing again.
const alarm = noiseAlarm({ holdMs: 1500, coolMs: 20000 });
assert.equal(alarm(80, 50, 0), false, "a single bang doesn't alert");
assert.equal(alarm(80, 50, 1000), false);
assert.equal(alarm(80, 50, 1600), true, "1.5 s of crying does");
assert.equal(alarm(80, 50, 5000), false, "no repeat right away");
assert.equal(alarm(10, 50, 6000), false);
assert.equal(alarm(80, 50, 7000), false);
assert.equal(alarm(80, 50, 9000), false, "still cooling down");
assert.equal(alarm(80, 50, 22000), true, "after the rest it can fire again");
assert.equal(alarm(30, 50, 23000), false, "below the line is quiet");

console.log("cribfox ok");
