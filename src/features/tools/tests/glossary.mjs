// Every calculator input and result has a plain-language definition, and
// every calculator says where its principle is used.
import assert from "node:assert/strict";
import { defaultsOf, run } from "../model/engine.js";
import { fluids } from "../calcs/fluids.js";
import { heat } from "../calcs/heat.js";
import { air } from "../calcs/air.js";
import { mechanics } from "../calcs/mechanics.js";
import { electrical } from "../calcs/electrical.js";
import { geometry } from "../calcs/geometry.js";
import { TERMS, FIELD_TERMS, USES, termFor, termsOnPage } from "../glossary/index.js";

const CALCS = [...fluids, ...heat, ...air, ...mechanics, ...electrical, ...geometry];
const missing = [];

for (const [key, t] of Object.entries(TERMS)) {
  for (const f of ["name", "what", "why"]) assert(typeof t[f] === "string" && t[f].length > 1, `term ${key} needs ${f}`);
}

for (const calc of CALCS) {
  assert(FIELD_TERMS[calc.id], `${calc.id}: no entry in glossary/fields.js`);
  const u = USES[calc.id];
  assert(u && u.fields.length >= 2 && u.examples.length >= 2, `${calc.id}: needs fields and examples in glossary/uses.js`);

  for (const input of calc.inputs) {
    if (input.type === "preset" || input.hidden) continue;
    if (!termFor(calc.id, "in", input.id)) missing.push(`${calc.id} input ${input.id} (${input.label})`);
  }

  // Results change with the choices, so try each option of each choice.
  const base = defaultsOf(calc);
  const tries = [base];
  for (const ch of calc.inputs.filter((i) => i.type === "choice")) for (const o of ch.options) tries.push({ ...base, [ch.id]: o.value });
  for (const v of tries) {
    let out;
    try {
      out = run(calc, v);
    } catch {
      continue;
    }
    for (const r of out.results) if (!termFor(calc.id, "out", r.id)) missing.push(`${calc.id} result ${r.id} (${r.label})`);
  }

  // Every key the map names must exist.
  for (const side of ["in", "out"])
    for (const [id, key] of Object.entries(FIELD_TERMS[calc.id][side])) assert(TERMS[key], `${calc.id} ${side} ${id}: unknown term ${key}`);
}

assert.deepEqual([...new Set(missing)], [], "fields without a definition");
for (const id of Object.keys(FIELD_TERMS)) assert(CALCS.some((c) => c.id === id), `glossary/fields.js names unknown calc ${id}`);

// Numbered results (Reaction 1, 2…) share one term.
assert.equal(termFor("beam", "out", "R3")?.key, "reaction");
// The same id can mean different things as an input and a result.
assert.equal(termFor("section-properties", "in", "Sy").key, "yieldStrength");
assert.equal(termFor("section-properties", "out", "Sy").key, "sectionModulus");
// A page lists each term once.
const beam = CALCS.find((c) => c.id === "beam");
const terms = termsOnPage("beam", beam.inputs, run(beam, defaultsOf(beam)).results);
assert.equal(new Set(terms.map((t) => t.key)).size, terms.length);
assert(terms.some((t) => t.key === "inertia"));

console.log(`glossary: ${Object.keys(TERMS).length} terms cover ${CALCS.length} calculators`);
