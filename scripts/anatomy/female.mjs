// The female body for BodyFox.
//
// BodyParts3D is one male body, and no free model has a complete female
// skeleton and muscles. So the female body keeps the same bones and muscles
// and swaps what differs: female reproductive organs and breasts from the NIH
// Human Reference Atlas (HRA) female model, CC BY 4.0
// (https://humanatlas.io/3d-reference-library), fitted into BodyParts3D's
// pelvis and chest, and a female skin made from the male one.

import { loadGlb, meshes, box } from "./glb.mjs";

// HRA node → BodyFox part. side: "R"/"L" names the part by where it sits,
// because a few HRA nodes have their sides swapped.
const FEMALE_PARTS = [
  { name: "Vagina", nodes: /^VH_F_vagina$/, layer: "organs", map: "pelvis" },
  { name: "Cervix of uterus", nodes: /^VH_F_cervix$/, layer: "organs", map: "pelvis" },
  { name: "Body of uterus", nodes: /^VH_F_body_of_uterus$/, layer: "organs", map: "pelvis" },
  { name: "Fundus of uterus", nodes: /^VH_F_fundus_of_uterus$/, layer: "organs", map: "pelvis" },
  { name: "uterine tube", nodes: /^VH_F_(ampulla_of_uterine_tube|isthmus_of_fallopian_tube|fibria_of_uterine_tube|uterine_tube_infundibulum)_(R|L)$/, layer: "organs", map: "pelvis", sided: true },
  { name: "ovary", nodes: /^VH_F_(left|right)_ovary$/, layer: "organs", map: "pelvis", sided: true },
  { name: "Broad ligament of uterus", nodes: /^VH_F_broad_ligament$/, layer: "organs", map: "pelvis" },
  { name: "round ligament of uterus", nodes: /^VH_F_(left|right)_round_ligament_of_uterus$/, layer: "organs", map: "pelvis", sided: true },
  { name: "ovarian ligament", nodes: /^VH_F_ovarian_ligament_(L|R)$/, layer: "organs", map: "pelvis", sided: true },
  { name: "suspensory ligament of ovary", nodes: /^VH_F_suspensory_ligament_of_ovary_(L|R)$/, layer: "organs", map: "pelvis", sided: true },
  { name: "mammary gland", nodes: /^VH_F_mammary_lobes_(L|R)$/, layer: "organs", map: "chest", sided: true },
  { name: "uterine artery", nodes: /^VH_F_(left|right)_uterine_artery$/, layer: "vessels", map: "pelvis", sided: true },
  { name: "uterine vein", nodes: /^VH_F_(left|right)_uterine_vein$/, layer: "vessels", map: "pelvis", sided: true },
];

// Parts only the male body has. Hidden when the female body is shown.
export const MALE_ONLY = /penis|testis|testicular|epididymis|deferent duct|seminal vesicle|prostate|^urethra$|pubic hair/i;

/** Per-axis scale and shift that carries box a onto box b. */
function boxMap(a, b, { uniform = false } = {}) {
  let s = [0, 1, 2].map(k => (b[1][k] - b[0][k]) / (a[1][k] - a[0][k]));
  if (uniform) s = [s[1], s[1], s[1]];
  const t = [0, 1, 2].map(k => (b[0][k] + b[1][k]) / 2 - s[k] * (a[0][k] + a[1][k]) / 2);
  return p => [p[0] * s[0] + t[0], p[1] * s[1] + t[1], p[2] * s[2] + t[2]];
}

export function partsBox(parts) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) for (let i = 0; i < p.positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], p.positions[i + a]);
      hi[a] = Math.max(hi[a], p.positions[i + a]);
    }
  }
  return [lo, hi];
}

function merge(list, map) {
  const pos = [], idx = [];
  for (const m of list) {
    const base = pos.length / 3;
    for (let i = 0; i < m.positions.length; i += 3) pos.push(...map([m.positions[i], m.positions[i + 1], m.positions[i + 2]]));
    for (const i of m.indices) idx.push(i + base);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) };
}

/**
 * Reads the HRA female model and returns its parts placed in BodyParts3D's
 * body, each { fid, name, layer, kind, sex: "f", positions, indices }.
 */
export function femaleParts(glbPath, parts) {
  const g = loadGlb(glbPath);
  const byName = n => parts.filter(p => p.name === n);

  // Pelvis: the hip bones and sacrum, box onto box.
  const hraPelvis = box(meshes(g, /^VH_F_(ilium|ischium|pubis)$|^VH_F_sacrum$/));
  const bpPelvis = partsBox([...byName("Right hip bone"), ...byName("Left hip bone"), ...byName("Sacrum")]);
  const pelvis = boxMap(hraPelvis, bpPelvis);

  // Chest: the twelve thoracic vertebrae give height and position; one
  // scale for all three axes keeps the breasts' shape.
  const hraSpine = box(meshes(g, /^VH_F_thoracic_vertebra_\d+$/));
  const bpSpine = partsBox(parts.filter(p => /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) thoracic vertebra$/i.test(p.name)));
  const chestRaw = boxMap(hraSpine, bpSpine, { uniform: true });
  // Then rest the breasts on the chest muscles: the back of the glands sits
  // on the front of pectoralis major.
  const glands = merge(meshes(g, /^VH_F_mammary_lobes_(L|R)$/), chestRaw);
  const pecFront = partsBox(parts.filter(p => /pectoralis major/i.test(p.name)))[1][2];
  const glandBack = partsBox([glands])[0][2];
  const dz = pecFront - 0.035 - glandBack;
  const chest = p => { const q = chestRaw(p); return [q[0], q[1], q[2] + dz]; };

  const maps = { pelvis, chest };
  const out = [];
  for (const def of FEMALE_PARTS) {
    const found = meshes(g, def.nodes);
    if (!found.length) throw new Error(`HRA female: nothing matches ${def.nodes}`);
    const groups = new Map();
    for (const m of found) {
      const merged = merge([m], maps[def.map]);
      const side = !def.sided ? "" : partsBox([merged])[0][0] + partsBox([merged])[1][0] < 0 ? "right" : "left";
      if (!groups.has(side)) groups.set(side, []);
      groups.get(side).push(merged);
    }
    for (const [side, list] of groups) {
      const mesh = merge(list, p => p);
      const name = side ? `${side.charAt(0).toUpperCase() + side.slice(1)} ${def.name}` : def.name;
      out.push({
        fid: `HRAF-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
        name,
        layer: def.layer,
        kind: null,
        sex: "f",
        ...mesh,
      });
    }
  }
  // Centre each breast over the chest muscle on its side: the HRA woman's
  // chest is narrower and shaped differently from this man's.
  for (const part of out.filter(p => /mammary/.test(p.name))) {
    const side = /^Right/.test(part.name) ? "right" : "left";
    const pec = partsBox(parts.filter(p => new RegExp(`^Sternocostal part of ${side} pectoralis major$`, "i").test(p.name)));
    const [lo, hi] = partsBox([part]);
    const dx = (pec[0][0] + pec[1][0]) / 2 - (lo[0] + hi[0]) / 2;
    const dy = (pec[0][1] + pec[1][1]) / 2 - 0.025 - (lo[1] + hi[1]) / 2;
    for (let i = 0; i < part.positions.length; i += 3) {
      part.positions[i] += dx;
      part.positions[i + 1] += dy;
    }
  }
  return out;
}
