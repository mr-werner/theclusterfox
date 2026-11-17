// Discipline apps and profession kits point at real tools, and links swap
// between ToolFox and a discipline app cleanly: node src/features/tools/tests/disciplines.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fluids } from "../calcs/fluids.js";
import { heat } from "../calcs/heat.js";
import { air } from "../calcs/air.js";
import { mechanics } from "../calcs/mechanics.js";
import { electrical } from "../calcs/electrical.js";
import { geometry } from "../calcs/geometry.js";
import { TABLES } from "../tables.js";
import { DISCIPLINES } from "../disciplines.js";
import { PROFESSIONS, PROFESSION_GROUPS, professionsUsing } from "../professions.js";
import { rebase, canonical } from "../paths.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

const CALCS = [...fluids, ...heat, ...air, ...mechanics, ...electrical, ...geometry];
const BUILDER_IDS = ["frame", "gdt", "make", "methods"];
const CATS = ["fluids", "heat", "air", "mech", "elec", "geo", "design"];
const exists = (key) => {
  if (key === "convert") return true;
  const [kind, id] = key.split(":");
  if (kind === "calc") return CALCS.some((c) => c.id === id);
  if (kind === "table") return TABLES.some((t) => t.id === id);
  if (kind === "builder") return BUILDER_IDS.includes(id);
  return false;
};

test("every discipline shows a real ToolFox category, at its own address", () => {
  const paths = new Set();
  for (const d of DISCIPLINES) {
    assert(CATS.includes(d.cat), `${d.id}: category ${d.cat}`);
    assert.equal(d.path, `/${d.id}`);
    assert(!paths.has(d.path));
    paths.add(d.path);
    assert.match(d.bg, /^#[0-9a-f]{6}$/i);
    assert.match(d.grid, /^\d{1,3}, \d{1,3}, \d{1,3}$/);
    for (const k of d.alsoUse) assert(exists(k), `${d.id} alsoUse ${k}`);
  }
});

test("every ToolFox category except geometry has a discipline app", () => {
  const covered = new Set(DISCIPLINES.map((d) => d.cat));
  for (const c of CATS.filter((c) => c !== "geo")) assert(covered.has(c), c);
});

test("discipline apps are on the home screen, routed and installable", () => {
  const apps = readFileSync(new URL("../../../app/apps.js", import.meta.url), "utf8");
  const app = readFileSync(new URL("../../../App.jsx", import.meta.url), "utf8");
  const themes = JSON.parse(readFileSync(new URL("../../../app/appThemes.json", import.meta.url), "utf8"));
  for (const d of DISCIPLINES) {
    assert(apps.includes(`id: "${d.id}"`) && apps.includes(`path: "${d.path}"`), `${d.id} in apps.js`);
    assert(app.includes(`"${d.id}"`), `${d.id} routed in App.jsx`);
    assert.equal(themes[d.id], d.bg, `${d.id} theme color`);
    const manifest = JSON.parse(readFileSync(new URL(`../../../../public/apps/${d.id}.webmanifest`, import.meta.url), "utf8"));
    assert.equal(manifest.start_url, d.path);
  }
});

test("every profession kit lists only real tools, without repeats", () => {
  const groups = new Set(PROFESSION_GROUPS.map((g) => g.id));
  const ids = new Set();
  for (const p of PROFESSIONS) {
    assert(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert(groups.has(p.group), `${p.id} group`);
    assert(p.tools.length >= 3, `${p.id} has tools`);
    assert.equal(new Set(p.tools).size, p.tools.length, `${p.id} repeats a tool`);
    for (const k of p.tools) assert(exists(k), `${p.id}: ${k}`);
  }
});

test("tools shared between jobs are found from either side", () => {
  const names = professionsUsing("calc:voltage-drop").map((p) => p.id);
  assert(names.includes("electrician") && names.includes("hvac-tech"));
});

test("links move into a discipline app and back out unchanged", () => {
  assert.equal(rebase("/tools/calc/beam?L=3", "/tools"), "/tools/calc/beam?L=3");
  assert.equal(rebase("/tools/calc/beam?L=3", "/mechanics"), "/mechanics/calc/beam?L=3");
  assert.equal(rebase("/tools", "/mechanics"), "/mechanics");
  assert.equal(rebase("/toolshed", "/mechanics"), "/toolshed");
  assert.equal(rebase("/lift", "/mechanics"), "/lift");
  assert.equal(rebase("../x", "/mechanics"), "../x");
  assert.deepEqual(rebase({ pathname: "/tools/gdt", search: "?a" }, "/manufacturing"), { pathname: "/manufacturing/gdt", search: "?a" });
  assert.equal(canonical("/mechanics/calc/beam?L=3", "/mechanics"), "/tools/calc/beam?L=3");
  assert.equal(canonical("/mechanics", "/mechanics"), "/tools");
  assert.equal(canonical("/mechanicsx/a", "/mechanics"), "/mechanicsx/a");
  assert.equal(canonical("/tools/frame", "/tools"), "/tools/frame");
});

console.log(`\n${passed} discipline and kit checks passed`);
