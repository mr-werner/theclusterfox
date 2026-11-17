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
//   4. node scripts/anatomy/build-models.mjs <folder with the txt files> <4.0 OBJ folder> <3.0 OBJ folder>

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { MeshoptSimplifier, MeshoptEncoder } from "meshoptimizer";

const [dataDir, objDir, v3Dir] = process.argv.slice(2);
if (!dataDir || !objDir || !v3Dir) {
  console.error("usage: node scripts/anatomy/build-models.mjs <data dir> <4.0 obj dir> <3.0 obj dir>");
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
const V3_TAKE = /^(liver|(upper|middle|lower) lobe of (left |right )?lung|.*(buccinator|corrugator|depressor anguli|depressor labii|depressor septi|frontalis|occipitalis|procerus|nasalis|mentalis|risorius|zygomaticus|levator labii|levator anguli|orbicularis|temporalis|masseter|pterygoid|temporoparietalis|epicranius|internal oblique|transversus abdominis|rectus abdominis|pyramidalis|latissimus dorsi|quadratus lumborum|multifidus|inguinal ligament|extensor digitorum brevis|dorsal interossei of (left|right) foot))/;
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
const index = { source: "BodyParts3D, © The Database Center for Life Science, CC BY 4.0", layers: {}, parts: [] };
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
  const full = pack(layerParts, layer.error, [min, max]);
  const lite = pack(layerParts, layer.error * LITE_SCALE, [min, max]);
  fs.writeFileSync(path.join(OUT, `${layer.id}.bin`), full.bytes);
  fs.writeFileSync(path.join(OUT, `${layer.id}-lite.bin`), lite.bytes);
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
      box: p.box.map(c => c.map(x => round(x))),
    });
  }
  console.log(`${layer.id}: ${layerParts.length} parts, ${full.triangles.toLocaleString()} tris, ${(full.bytes.length / 1024).toFixed(0)} KB | lite ${lite.triangles.toLocaleString()} tris, ${(lite.bytes.length / 1024).toFixed(0)} KB`);
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
console.log(`index.json ${(fs.statSync(path.join(OUT, "index.json")).size / 1024).toFixed(0)} KB`);
