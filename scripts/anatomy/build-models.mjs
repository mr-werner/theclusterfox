// Builds BodyFox's 3D body from the BodyParts3D anatomy database.
//
// BodyParts3D, © The Database Center for Life Science, licensed under
// CC Attribution 4.0 International (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/).
//
// The raw data is ~6.7 million triangles in 2,200 OBJ files (460 MB), which
// is why browser atlases built on it crawl. This script makes it light:
//   1. Sorts every part into one of six layers (skin, muscles, skeleton,
//      organs, heart & vessels, brain & nerves).
//   2. Simplifies each part with meshoptimizer to a fixed error in millimetres,
//      so big smooth bones lose most triangles and small detailed parts keep
//      their shape.
//   3. Packs each layer into ONE mesh with a part number on every vertex, so
//      the whole layer draws in a single call and parts are hidden, picked and
//      pulled apart in the shader instead of as thousands of separate objects.
//   4. Quantizes positions to 16 bits and compresses with meshopt codecs,
//      which decode in a few milliseconds in the browser.
// Each layer is its own file and loads only when it is first switched on.
//
// Usage:
//   1. Download isa_BP3D_4.0_obj_99.zip, isa_element_parts.txt and
//      isa_inclusion_relation_list.txt from
//      https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/
//   2. Version 4.0 leaves out a few big structures (liver, lungs, face and
//      belly muscles), so also download BodyParts3D_3.0_obj_99.zip,
//      parts_list_e.txt and composite_parts.txt from
//      https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/
//   3. Unzip both sets of OBJs.
//   4. Download the HRA female model (3d-vh-f-united.glb, CC BY 4.0) from
//      https://humanatlas.io/3d-reference-library
//   5. node scripts/anatomy/build-models.mjs <folder with the txt files> <4.0 OBJ folder> <3.0 OBJ folder> <female .glb>

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MeshoptSimplifier, MeshoptEncoder } from "meshoptimizer";
import { femaleParts, partsBox, MALE_ONLY } from "./female.mjs";

const [dataDir, objDir, v3Dir, femaleGlb] = process.argv.slice(2);
if (!dataDir || !objDir || !v3Dir || !femaleGlb) {
  console.error("usage: node scripts/anatomy/build-models.mjs <data dir> <4.0 obj dir> <3.0 obj dir> <HRA female .glb>");
  process.exit(1);
}
const OUT = path.resolve("public/anatomy");
fs.mkdirSync(OUT, { recursive: true });

// Allowed surface error in millimetres for each layer. Larger is lighter.
const LAYERS = [
  { id: "skin", error: 1.2 },
  { id: "muscles", error: 0.6 },
  { id: "skeleton", error: 0.32 },
  { id: "organs", error: 0.45 },
  { id: "vessels", error: 0.4 },
  { id: "nervous", error: 0.35 },
];
// Phones get a second, lighter copy of each layer.
const LITE_SCALE = 3;

// ---- The is-a tree: what kind of thing each part is ----
const readTsv = file => fs.readFileSync(path.join(dataDir, file), "utf8").split(/\r?\n/).slice(1).filter(Boolean).map(l => l.split("\t"));
const parents = new Map();
const conceptName = new Map();
for (const [p, pn, c, cn] of readTsv("isa_inclusion_relation_list.txt")) {
  if (!parents.has(c)) parents.set(c, new Set());
  parents.get(c).add(p);
  conceptName.set(p, pn);
  conceptName.set(c, cn);
}
const elementConcepts = new Map();
for (const [c, n, f] of readTsv("isa_element_parts.txt")) {
  if (!elementConcepts.has(f)) elementConcepts.set(f, []);
  elementConcepts.get(f).push(c);
  if (!conceptName.has(c)) conceptName.set(c, n);
}
const ancestorCache = new Map();
function ancestors(c) {
  if (ancestorCache.has(c)) return ancestorCache.get(c);
  const seen = new Set();
  const stack = [c];
  while (stack.length) {
    for (const p of parents.get(stack.pop()) ?? []) {
      if (!seen.has(p)) { seen.add(p); stack.push(p); }
    }
  }
  ancestorCache.set(c, seen);
  return seen;
}

// The most specific kind we have a write-up for (see src/features/body/data/kinds.js).
const KINDS = [
  "vertebra", "rib", "tooth", "costal cartilage", "intervertebral disk", "phalanx of finger", "phalanx of toe",
  "carpal bone", "tarsal bone", "metacarpal bone", "metatarsal bone", "sesamoid bone", "long bone", "short bone",
  "flat bone", "irregular bone", "bone organ", "cartilage organ", "ligament",
  "extra-ocular muscle", "muscle of face", "muscle of head", "muscle of neck", "muscle of pectoral girdle",
  "muscle of upper limb", "muscle of lower limb", "muscle of trunk", "muscle of back", "muscle organ",
  "coronary artery", "branch of right coronary artery", "branch of left coronary artery", "cardiac vein",
  "pulmonary artery", "pulmonary vein", "systemic artery", "artery", "portal vein", "systemic vein", "vein",
  "gyrus of neuraxis", "segment of brain", "segment of neural tree organ", "nerve",
  "segment of bronchial tree", "segment of tracheobronchial tree", "zone of small intestine", "segment of biliary tree",
];

function layerOf(name, anc) {
  const n = name.toLowerCase();
  const has = s => anc.has(s);
  if (n === "skin" || has("integument") || /hair|eyebrow/.test(n)) return "skin";
  if (/liver|hepatic|lobe of (left |right )?lung/.test(n) && !/arter|vein/.test(n)) return "organs";
  if (/arter|vein|venous|aorta|vena cava|sinus\b|coronary|^(thyrocervical|costocervical|celiac|pulmonary) trunk|palmar arch|plantar arch/.test(n)) return "vessels";
  if (/muscle|tendon|aponeurosis|fascia|iliotibial tract|levator|interossei|lumbrical|intertransversarii|interspinales|levatores|trapezius|linea alba/.test(n) || [...anc].some(a => /muscle/.test(a))) {
    // Papillary muscles and the heart wall stay with the heart.
    if (/papillary|ventric|atri/.test(n)) return "vessels";
    return "muscles";
  }
  if (has("bone organ") || has("cartilage organ") || has("tooth") || has("cartilage organ component") ||
      /ligament|disk|cartilage|meniscus|tooth|bone|vertebra|\brib\b|sacrum|coccyx|mandible|skull|manubrium|sternum|xiphoid|interosseous membrane|retinaculum/.test(n)) return "skeleton";
  if (/heart|atrium|ventricle of heart|valve|cusp|leaflet|wall of (left |right )?(ventricle|atrium)|chordae|septum of heart|pericardi/.test(n) || has("heart")) return "vessels";
  if (has("segment of neuraxis") || has("segment of neural tree organ") || has("nerve") || has("neuraxis") ||
      /nerve|brain|cerebr|cerebell|gyrus|lobule|spinal cord|medulla oblongata|pons|midbrain|thalam|hippocamp|ganglion|fornix|colliculus|insula|optic tract|chiasm|amygdal|corpus callosum|putamen|caudate|aqueduct|stria terminalis|ventricle|peduncle|internal capsule|telencephalon|interventricular foramen|globus pallidus|commissure|lamina terminalis|habenula|pineal|geniculate|mammillary|tuber cinereum|septum pellucidum/.test(n)) return "nervous";
  return "organs";
}

const kindOf = anc => KINDS.find(k => anc.has(k)) ?? null;

// ---- Read OBJ files ----
function readObj(file) {
  const text = fs.readFileSync(file, "utf8");
  const head = {};
  const pos = [];
  const idx = [];
  for (const line of text.split("\n")) {
    const c = line.charCodeAt(0);
    if (c === 35) { // #
      const m = /^# ([^:]+) : (.+)$/.exec(line.trim());
      if (m) head[m[1].trim()] = m[2].trim();
    } else if (c === 118 && line.charCodeAt(1) === 32) { // "v "
      const p = line.split(/\s+/);
      // BodyParts3D: millimetres, Z up, front is -Y. Ours: metres, Y up, front is +Z.
      pos.push(+p[1] / 1000, +p[3] / 1000, -p[2] / 1000);
    } else if (c === 102) { // f
      const p = line.trim().split(/\s+/).slice(1).map(s => parseInt(s, 10) - 1);
      for (let i = 1; i + 1 < p.length; i++) idx.push(p[0], p[i], p[i + 1]);
    }
  }
  return { head, positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const files = fs.readdirSync(objDir).filter(f => f.endsWith(".obj")).sort();
const parts = [];
const seenBounds = new Set();
let raw = 0;
for (const f of files) {
  const fid = f.slice(0, -4);
  const obj = readObj(path.join(objDir, f));
  // A handful of elements are exact duplicates of others.
  const key = crypto.createHash("md5").update(obj.positions).update(obj.indices).digest("hex");
  if (seenBounds.has(key)) continue;
  seenBounds.add(key);
  let concept = obj.head["Concept ID"];
  if (!concept) {
    const cands = elementConcepts.get(fid) ?? [];
    concept = cands.reduce((best, c) => (!best || ancestors(c).size > ancestors(best).size ? c : best), null);
  }
  const anc = new Set([...ancestors(concept)].map(c => conceptName.get(c)));
  const rawName = obj.head["English name"] || conceptName.get(concept) || fid;
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  raw += obj.indices.length / 3;
  parts.push({ fid, concept, name, layer: layerOf(name, anc), kind: kindOf(anc), ...obj });
}

// ---- Fill the gaps from version 3.0 ----
const V3_TAKE = /^(liver|(upper|middle|lower) lobe of (left |right )?lung|.*(buccinator|corrugator|depressor anguli|depressor labii|depressor septi|frontalis|occipitalis|procerus|nasalis|mentalis|risorius|zygomaticus|levator labii|levator anguli|orbicularis|temporalis|masseter|pterygoid|temporoparietalis|epicranius|internal oblique|transversus abdominis|rectus abdominis|pyramidalis|latissimus dorsi|quadratus lumborum|multifidus|inguinal ligament))/;
const FACE = /buccinator|corrugator|depressor|frontalis|occipitalis|procerus|nasalis|mentalis|risorius|zygomaticus|levator labii|levator anguli|orbicularis|temporoparietalis|epicranius/;
const CHEW = /temporalis|masseter|pterygoid/;
const TRUNK = /oblique|transversus abdominis|rectus abdominis|pyramidalis|latissimus|quadratus lumborum|multifidus/;
const v3Names = new Map();
for (const [id, name] of readTsv("parts_list_e.txt")) v3Names.set(id, name);
for (const [cid, cname, pid, pname] of readTsv("composite_parts.txt")) {
  v3Names.set(cid, cname);
  v3Names.set(pid, pname);
}
const have = new Set(parts.map(p => p.name.toLowerCase()));
for (const f of fs.readdirSync(v3Dir).filter(f => f.endsWith(".obj")).sort()) {
  const fid = f.slice(0, -4);
  const rawName = (v3Names.get(fid) ?? "").replace(/, nsn$/, "");
  if (!V3_TAKE.test(rawName) || have.has(rawName)) continue;
  have.add(rawName);
  const obj = readObj(path.join(v3Dir, f));
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const layer = /liver|lung/.test(rawName) ? "organs" : /ligament/.test(rawName) ? "skeleton" : "muscles";
  const kind = layer === "skeleton" ? "ligament" : layer === "organs" ? null
    : FACE.test(rawName) ? "muscle of face" : CHEW.test(rawName) ? "muscle of head" : TRUNK.test(rawName) ? "muscle of trunk"
    : /foot/.test(rawName) ? "muscle of lower limb" : "muscle organ";
  raw += obj.indices.length / 3;
  parts.push({ fid: `v3-${fid}`, concept: fid, name, layer, kind, ...obj });
}
console.log(`${parts.length} parts, ${raw.toLocaleString()} raw triangles`);

// Points bucketed in a grid of cubes, for nearest-point lookups.
class PointGrid {
  constructor(cell) { this.cell = cell; this.cells = new Map(); }
  key(i, j, k) { return `${i},${j},${k}`; }
  add(x, y, z, id) {
    const key = this.key(Math.floor(x / this.cell), Math.floor(y / this.cell), Math.floor(z / this.cell));
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push([x, y, z, id]);
  }
  // Nearest point within `rings` cells of (x, y, z), or null.
  nearest(x, y, z, rings) {
    const ci = Math.floor(x / this.cell), cj = Math.floor(y / this.cell), ck = Math.floor(z / this.cell);
    let best = null, bd = Infinity;
    for (let r = 0; r <= rings; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
        const cell = this.cells.get(this.key(ci + i, cj + j, ck + k));
        if (!cell) continue;
        for (const p of cell) {
          const d = (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2;
          if (d < bd) { bd = d; best = p; }
        }
      }
      // Anything in a farther ring is at least r cells away.
      if (best && Math.sqrt(bd) <= r * this.cell) break;
    }
    return best;
  }
}

// ---- Make the skin cover everything under it ----
// The skin and the muscles were drawn separately, so in places (thighs, upper
// arms, chest edge) muscle pokes through the skin. Push each skin point out
// along its normal far enough to clear whatever lies just under it, then
// spread the push to neighbours so the skin bulges smoothly instead of
// tenting over single points.
const HEAD_Y = 1.45; // metres up, about the bottom of the chin
function fitSkin(skin, under, { bones: boneParts = under.filter(p => p.layer === "skeleton"), marginM = 0.004, maxOut = 0.015, spread = 40, label = "skin" } = {}) {
  const remap = MeshoptSimplifier.generatePositionRemap(skin.positions, 3);
  const ids = [...new Set(remap)];
  const slot = new Map(ids.map((id, k) => [id, k]));
  const n = ids.length;
  const P = new Float64Array(n * 3);
  ids.forEach((id, k) => P.set(skin.positions.subarray(id * 3, id * 3 + 3), k * 3));
  const tri = Array.from(skin.indices, i => slot.get(remap[i]));
  const N = new Float64Array(n * 3);
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < tri.length; t += 3) {
    const [a, b, c] = [tri[t], tri[t + 1], tri[t + 2]];
    const u = [0, 1, 2].map(q => P[b * 3 + q] - P[a * 3 + q]);
    const v = [0, 1, 2].map(q => P[c * 3 + q] - P[a * 3 + q]);
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const w of [a, b, c]) for (let q = 0; q < 3; q++) N[w * 3 + q] += cr[q];
    nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b);
  }
  for (let k = 0; k < n; k++) {
    const l = Math.hypot(N[k * 3], N[k * 3 + 1], N[k * 3 + 2]) || 1;
    for (let q = 0; q < 3; q++) N[k * 3 + q] /= l;
  }
  // The skin is a thin closed shell: an outer surface facing the air and an
  // inner one facing the body. Only the outer one should move. Outer normals
  // point away from the nearest bone; inner ones point towards it.
  const bones = new PointGrid(0.04);
  for (const part of boneParts) {
    for (let i = 0; i < part.positions.length; i += 3 * 7) bones.add(part.positions[i], part.positions[i + 1], part.positions[i + 2], i);
  }
  let score = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const hit = bones.nearest(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], 6);
    if (!hit) continue;
    const dx = P[k * 3] - hit[0], dy = P[k * 3 + 1] - hit[1], dz = P[k * 3 + 2] - hit[2];
    score[k] = (dx * N[k * 3] + dy * N[k * 3 + 1] + dz * N[k * 3 + 2]) / (Math.hypot(dx, dy, dz) || 1);
  }
  // The two surfaces only meet at the rims of the eyes, mouth and so on, so
  // averaging over neighbours settles each surface on one answer.
  const ring = nb.map(s => [...s]);
  for (let it = 0; it < 30; it++) {
    const next = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      let s = score[k];
      for (const j of ring[k]) s += score[j];
      next[k] = s / (ring[k].length + 1);
    }
    score = next;
  }
  const outer = score.map(v => (v > 0 ? 1 : 0));
  // Outer skin points in a 2 cm grid, so each point under the skin finds its nearest skin point fast.
  const grid = new PointGrid(0.02);
  for (let k = 0; k < n; k++) if (outer[k]) grid.add(P[k * 3], P[k * 3 + 1], P[k * 3 + 2], k);
  const need = new Float64Array(n);
  for (const part of under) {
    const pos = part.positions;
    // In the head only the thin face muscles right under the skin count.
    const faceSkin = part.kind === "muscle of face";
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2];
      const hit = grid.nearest(x, y, z, 1);
      const best = hit ? hit[3] : -1;
      if (best < 0) continue;
      const out = (x - P[best * 3]) * N[best * 3] + (y - P[best * 3 + 1]) * N[best * 3 + 1] + (z - P[best * 3 + 2]) * N[best * 3 + 2];
      // Real pokes are at most about a centimetre. Anything farther in front
      // is a mismatch. In the head the skin dips into the eyes, nose and
      // mouth, which fools the nearest-point test, so only face muscles count.
      if (out > maxOut || (P[best * 3 + 1] > HEAD_Y && (!faceSkin || out > 0.01))) continue;
      if (out + marginM > need[best]) need[best] = out + marginM;
    }
  }
  // Spread: each point takes the larger of its own need and its neighbours' average.
  const adj = ring.map((s, k) => (outer[k] ? s.filter(j => outer[j]) : []));
  let push = Float64Array.from(need);
  for (let it = 0; it < spread; it++) {
    const next = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      let s = 0;
      for (const j of adj[k]) s += push[j];
      next[k] = Math.max(need[k], adj[k].length ? s / adj[k].length : 0);
    }
    push = next;
  }
  // Two plain smoothing passes take the edge off the peaks.
  for (let it = 0; it < 2; it++) {
    const next = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      let s = push[k];
      for (const j of adj[k]) s += push[j];
      next[k] = s / (adj[k].length + 1);
    }
    push = next.map((v, k) => Math.max(v, need[k]));
  }
  let moved = 0;
  for (let i = 0; i < remap.length; i++) {
    const k = slot.get(remap[i]);
    if (push[k] <= 0) continue;
    for (let q = 0; q < 3; q++) skin.positions[i * 3 + q] = P[k * 3 + q] + push[k] * N[k * 3 + q];
  }
  for (let k = 0; k < n; k++) if (need[k] > marginM + 0.0005) moved += 1;
  console.log(`${label}: pushed out ${moved.toLocaleString()} of ${n.toLocaleString()} points, up to ${(Math.max(...need) * 1000).toFixed(1)} mm`);
}
const skinPart = parts.find(p => p.name === "Skin");
fitSkin(skinPart, parts.filter(p => p.layer === "muscles" || p.layer === "skeleton"));

// ---- The female body ----
// Same bones and muscles; female organs and breasts from the HRA female
// model, and a female skin made from the male one: the genitals smoothed
// into the body, then the skin pushed out over the breasts.
for (const p of parts) if (MALE_ONLY.test(p.name)) p.sex = "m";
const female = femaleParts(femaleGlb, parts);
parts.push(...female);

/** Relax every skin point inside the box towards its neighbours' average, edges held still. */
function smoothRegion(skin, [lo, hi], iterations) {
  const remap = MeshoptSimplifier.generatePositionRemap(skin.positions, 3);
  const ring = new Map();
  const link = (a, b) => { if (!ring.has(a)) ring.set(a, new Set()); ring.get(a).add(b); };
  for (let t = 0; t < skin.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map(q => remap[skin.indices[t + q]]);
    link(a, b); link(a, c); link(b, a); link(b, c); link(c, a); link(c, b);
  }
  const P = skin.positions;
  const inside = v => [0, 1, 2].every(a => P[v * 3 + a] >= lo[a] && P[v * 3 + a] <= hi[a]);
  const free = [...ring.keys()].filter(inside);
  const adj = free.map(v => [...ring.get(v)]);
  for (let it = 0; it < iterations; it++) {
    free.forEach((v, k) => {
      const nb = adj[k];
      for (let a = 0; a < 3; a++) {
        let s = 0;
        for (const u of nb) s += P[u * 3 + a];
        P[v * 3 + a] = s / nb.length;
      }
    });
  }
  // Copies of a welded point follow it.
  for (let i = 0; i < remap.length; i++) if (remap[i] !== i) for (let a = 0; a < 3; a++) P[i * 3 + a] = P[remap[i] * 3 + a];
  console.log(`female skin: smoothed ${free.length.toLocaleString()} points`);
}
const femaleSkin = { ...skinPart, positions: skinPart.positions.slice() };
const genitals = partsBox(parts.filter(p => /penis|testis|epididymis/i.test(p.name)));
smoothRegion(femaleSkin, [[genitals[0][0] - 0.012, genitals[0][1] - 0.01, genitals[0][2] + 0.03], [genitals[1][0] + 0.012, genitals[1][1] + 0.012, 1]], 400);
/**
 * Breasts: a smooth dome over each mammary gland, fuller below than above,
 * on the front of the chest only.
 */
function addBreasts(skin, glands) {
  const P = skin.positions;
  const N = vertexNormals(skin);
  for (const gland of glands) {
    const [lo, hi] = partsBox([gland]);
    const cx = (lo[0] + hi[0]) / 2;
    const cy = (lo[1] + hi[1]) / 2 - 0.01;
    const rx = (hi[0] - lo[0]) / 2 * 1.45;
    const rUp = (hi[1] - lo[1]) / 2 * 1.35;
    const rDown = (hi[1] - lo[1]) / 2 * 1.3;
    // How far the chest skin already is in front, right over the gland.
    let front = -Infinity;
    for (let i = 0; i < P.length; i += 3) {
      if (Math.abs(P[i] - cx) < 0.015 && Math.abs(P[i + 1] - cy) < 0.015 && N[i + 2] > 0.3) front = Math.max(front, P[i + 2]);
    }
    const height = Math.max(0.025, hi[2] + 0.012 - front);
    for (let i = 0; i < P.length; i += 3) {
      if (N[i + 2] < 0.05 || P[i + 2] < front - 0.08) continue;
      const dx = (P[i] - cx) / rx;
      const dy = (P[i + 1] - cy) / (P[i + 1] > cy ? rUp : rDown);
      const r2 = dx * dx + dy * dy;
      if (r2 >= 1) continue;
      const lift = height * (1 - r2) ** 1.3;
      // Mostly forward, a little along the skin's own normal.
      const d = [N[i] * 0.3, N[i + 1] * 0.3, N[i + 2] * 0.3 + 0.7];
      const l = Math.hypot(...d);
      for (let a = 0; a < 3; a++) P[i + a] += lift * d[a] / l;
    }
  }
}

/** Area-weighted vertex normals, the same for every copy of a welded point. */
function vertexNormals(mesh) {
  const remap = MeshoptSimplifier.generatePositionRemap(mesh.positions, 3);
  const P = mesh.positions;
  const N = new Float64Array(P.length);
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map(q => remap[mesh.indices[t + q]]);
    const u = [0, 1, 2].map(q => P[b * 3 + q] - P[a * 3 + q]);
    const v = [0, 1, 2].map(q => P[c * 3 + q] - P[a * 3 + q]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const w of [a, b, c]) for (let q = 0; q < 3; q++) N[w * 3 + q] += n[q];
  }
  for (let i = 0; i < remap.length; i++) {
    const r = remap[i];
    const l = Math.hypot(N[r * 3], N[r * 3 + 1], N[r * 3 + 2]) || 1;
    for (let q = 0; q < 3; q++) N[i * 3 + q] = N[r * 3 + q] / l;
  }
  return N;
}
const glands = female.filter(p => /mammary/.test(p.name));
addBreasts(femaleSkin, glands);
// Then make sure the glands are fully inside.
fitSkin(femaleSkin, glands, { bones: parts.filter(p => p.layer === "skeleton"), maxOut: 0.04, label: "female skin" });

// ---- Simplify and pack each layer ----
function simplifyPart(part, errorMm) {
  // Weld vertices that share a position so the simplifier sees one surface.
  const weld = MeshoptSimplifier.generatePositionRemap(part.positions, 3);
  const welded = part.indices.map(i => weld[i]);
  const [out] = MeshoptSimplifier.simplify(welded, part.positions, 3, 36, errorMm / 1000, ["ErrorAbsolute", "Permissive", "Prune"]);
  const indices = (out.length ? out : welded).slice();
  // Reorders triangles for the GPU cache and renumbers vertices in place;
  // remap says where each old vertex went.
  const [remap, unique] = MeshoptEncoder.reorderMesh(indices, true, true);
  const positions = new Float32Array(unique * 3);
  for (let old = 0; old < remap.length; old++) {
    const nv = remap[old];
    if (nv === 0xffffffff) continue;
    positions.set(part.positions.subarray(old * 3, old * 3 + 3), nv * 3);
  }
  return { indices, positions };
}

function pack(layerParts, errorMm, bounds) {
  const meshes = layerParts.map(p => simplifyPart(p, errorMm));
  const vcount = meshes.reduce((s, m) => s + m.positions.length / 3, 0);
  const icount = meshes.reduce((s, m) => s + m.indices.length, 0);
  // 8 bytes a vertex: x, y, z as 16-bit steps across the layer's box, then the part number.
  const verts = new Uint16Array(vcount * 4);
  const idx = new Uint32Array(icount);
  const [min, max] = bounds;
  const scale = [0, 1, 2].map(a => 65535 / (max[a] - min[a]));
  const ranges = [];
  let v = 0;
  let i = 0;
  meshes.forEach((m, pi) => {
    const firstIndex = i;
    for (const ix of m.indices) idx[i++] = ix + v;
    const n = m.positions.length / 3;
    for (let k = 0; k < n; k++) {
      for (let a = 0; a < 3; a++) {
        verts[(v + k) * 4 + a] = Math.round((m.positions[k * 3 + a] - min[a]) * scale[a]);
      }
      verts[(v + k) * 4 + 3] = pi;
    }
    v += n;
    ranges.push([firstIndex, i - firstIndex]);
  });
  const vbuf = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(verts.buffer), vcount, 8);
  const ibuf = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(idx.buffer), icount, 4);
  const header = new TextEncoder().encode(JSON.stringify({ v: 1, vertexCount: vcount, indexCount: icount, min, max, vertexBytes: vbuf.length, indexBytes: ibuf.length }));
  const out = new Uint8Array(4 + header.length + vbuf.length + ibuf.length);
  new DataView(out.buffer).setUint32(0, header.length, true);
  out.set(header, 4);
  out.set(vbuf, 4 + header.length);
  out.set(ibuf, 4 + header.length + vbuf.length);
  return { bytes: out, triangles: icount / 3, ranges };
}

const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;
const index = { source: "BodyParts3D, © The Database Center for Life Science, CC BY 4.0; female organs from the HRA female model, NIH Human Reference Atlas, CC BY 4.0", layers: {}, parts: [] };
for (const layer of LAYERS) {
  const layerParts = parts.filter(p => p.layer === layer.id);
  // Order parts top to bottom so neighbours sit together in the file.
  for (const p of layerParts) {
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < p.positions.length; k += 3) {
      for (let a = 0; a < 3; a++) {
        lo[a] = Math.min(lo[a], p.positions[k + a]);
        hi[a] = Math.max(hi[a], p.positions[k + a]);
      }
    }
    p.box = [lo, hi];
  }
  layerParts.sort((a, b) => b.box[1][1] - a.box[1][1]);
  const min = [0, 1, 2].map(a => Math.min(...layerParts.map(p => p.box[0][a])));
  const max = [0, 1, 2].map(a => Math.max(...layerParts.map(p => p.box[1][a])));
  if (layer.id === "skin") {
    // Room for the female skin too, which shares this box.
    const f = partsBox([femaleSkin]);
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], f[0][a]); max[a] = Math.max(max[a], f[1][a]); }
  }
  const full = pack(layerParts, layer.error, [min, max]);
  const lite = pack(layerParts, layer.error * LITE_SCALE, [min, max]);
  fs.writeFileSync(path.join(OUT, `${layer.id}.bin`), full.bytes);
  fs.writeFileSync(path.join(OUT, `${layer.id}-lite.bin`), lite.bytes);
  if (layer.id === "skin") {
    // The female skin: same parts, different shape.
    const male = skinPart.positions;
    skinPart.positions = femaleSkin.positions;
    fs.writeFileSync(path.join(OUT, "skin-female.bin"), pack(layerParts, layer.error, [min, max]).bytes);
    fs.writeFileSync(path.join(OUT, "skin-female-lite.bin"), pack(layerParts, layer.error * LITE_SCALE, [min, max]).bytes);
    skinPart.positions = male;
  }
  index.layers[layer.id] = {
    parts: layerParts.length,
    triangles: full.triangles,
    bytes: full.bytes.length,
    liteTriangles: lite.triangles,
    liteBytes: lite.bytes.length,
  };
  for (const p of layerParts) {
    index.parts.push({
      id: p.fid,
      name: p.name,
      layer: layer.id,
      kind: p.kind,
      ...(p.sex ? { sex: p.sex } : {}),
      box: p.box.map(c => c.map(x => round(x))),
    });
  }
  console.log(`${layer.id}: ${layerParts.length} parts, ${full.triangles.toLocaleString()} tris, ${(full.bytes.length / 1024).toFixed(0)} KB | lite ${lite.triangles.toLocaleString()} tris, ${(lite.bytes.length / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
console.log(`index.json ${(fs.statSync(path.join(OUT, "index.json")).size / 1024).toFixed(0)} KB`);
