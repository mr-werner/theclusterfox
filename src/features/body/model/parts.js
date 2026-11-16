// Plain helpers about body parts: names, sides, colours, search and the
// "take apart" direction for each part. No three.js here, so tests can run
// in Node.

export const LAYERS = [
  { id: "skin", name: "Skin", short: "Skin", color: "#d9a88b", blurb: "The outer covering" },
  { id: "muscles", name: "Muscles", short: "Muscles", color: "#b84a3e", blurb: "What moves you" },
  { id: "skeleton", name: "Skeleton", short: "Bones", color: "#e8dcc2", blurb: "Bones, joints and cartilage" },
  { id: "organs", name: "Organs", short: "Organs", color: "#cf8a6b", blurb: "Lungs, gut, liver, eyes" },
  { id: "vessels", name: "Heart & vessels", short: "Heart", color: "#c3303b", blurb: "Arteries red, veins blue" },
  { id: "nervous", name: "Brain & nerves", short: "Nerves", color: "#e4c36a", blurb: "Brain, eye nerves" },
];
export const layerById = new Map(LAYERS.map(l => [l.id, l]));

/** "Long head of right biceps brachii" → "long head of biceps brachii". */
export function baseName(name) {
  return name
    .toLowerCase()
    .replace(/\b(left|right)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function sideOf(name) {
  const n = name.toLowerCase();
  if (/\bleft\b/.test(n)) return "left";
  if (/\bright\b/.test(n)) return "right";
  return null;
}

/** "set of lumbricals of right hand" → "Set of lumbricals of right hand", tidy for display. */
export function displayName(name) {
  const n = name.replace(/\s+/g, " ").trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// Colours are textbook-atlas colours, picked from what a part is.
const COLOR_RULES = [
  [/vein|venous|vena cava|sinus\b/, "#3f63b8"],
  [/portal/, "#6a4fb0"],
  [/pulmonary arter|pulmonary trunk/, "#4f6fc4"],
  [/pulmonary vein/, "#c7414a"],
  [/arter|aorta|arch\b|trunk$|coronary|celiac/, "#c62f37"],
  [/valve|cusp|leaflet|chordae/, "#efe0c8"],
  [/papillary|wall of|atrium|ventricle of heart|heart/, "#a8363b"],
  [/nerve|ganglion|optic tract|chiasm/, "#e9c55a"],
  [/white matter|corpus callosum|internal capsule|fornix|commissure/, "#efe6dc"],
  [/ventricle|aqueduct|canal|foramen|choroid plexus/, "#7fb7d6"],
  [/gyrus|lobule|lobe|insula|cerebell|hippocamp|amygdal|thalam|putamen|caudate|nucleus|pallidus|colliculus|midbrain|pons|medulla|brain|peduncle|hypothalam/, "#d8a7a2"],
  [/tooth/, "#f6f1e2"],
  [/disk|cartilage|meniscus/, "#bcd3dc"],
  [/ligament|membrane|retinaculum|tendon|aponeurosis|linea alba|raphe|fascia|iliotibial/, "#e5dccb"],
  [/liver|caudate lobe/, "#8a3a2b"],
  [/lung|bronch|trachea/, "#e19aa0"],
  [/kidney|spleen/, "#7d2e2e"],
  [/adrenal|pancrea|thymus|gland|prostate/, "#d9a35b"],
  [/stomach|esophagus|duodenum|jejunum|ileum|colon|rectum|appendix|cecum|ileocecal|mesentery|mesocolon|mesoappendix/, "#e3a08e"],
  [/gallbladder|biliary|hepatic duct|cystic duct|bile/, "#5f8f45"],
  [/bladder|ureter|urethra/, "#e0b25e"],
  [/sclera|vitreous|lens|cornea|anterior chamber/, "#f2f1ea"],
  [/iris|choroid/, "#5b7a8e"],
  [/retina/, "#d36e5f"],
  [/hair|eyebrow/, "#4a3426"],
  [/tongue|lip|gingiva/, "#c86c6c"],
  [/skin/, "#d9a88b"],
];

export function partColor(part) {
  const n = baseName(part.name);
  if (part.layer === "muscles" && !/tendon|aponeurosis|fascia|iliotibial|linea alba|raphe/.test(n)) return "#b84a3e";
  if (part.layer === "skeleton" && !/disk|cartilage|ligament|meniscus|tooth|membrane|retinaculum/.test(n)) return "#e8dcc2";
  for (const [re, color] of COLOR_RULES) if (re.test(n)) return color;
  return layerById.get(part.layer)?.color ?? "#cccccc";
}

/** A small, steady brightness change per part so neighbours read apart. */
export function partShade(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return 0.88 + ((h >>> 0) % 1000) / 1000 * 0.22;
}

export const boxCenter = box => [0, 1, 2].map(a => (box[0][a] + box[1][a]) / 2);
export const boxSize = box => Math.max(...[0, 1, 2].map(a => box[1][a] - box[0][a]));

export function unionBox(boxes) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let a = 0; a < 3; a++) {
      lo[a] = Math.min(lo[a], b[0][a]);
      hi[a] = Math.max(hi[a], b[1][a]);
    }
  }
  return [lo, hi];
}

// How far each layer travels when the body is taken apart, so the outer
// layers clear the inner ones.
const LAYER_SPREAD = { skin: 1.9, muscles: 1.35, skeleton: 0.7, organs: 1.05, vessels: 0.95, nervous: 0.85 };

/**
 * Where a part moves when the body is fully taken apart, in metres.
 * Parts move out from the body's centre line, mostly sideways and forward,
 * with a little vertical spread so stacked parts separate too.
 */
export function explodeOffset(part, body) {
  const c = boxCenter(part.box);
  const mid = boxCenter(body);
  const spread = LAYER_SPREAD[part.layer] ?? 1;
  const dx = c[0] - mid[0];
  const dy = c[1] - mid[1];
  const dz = c[2] - mid[2];
  // Organs come forward, out of the chest and belly, where you can see them.
  const forward = part.layer === "organs" ? 0.12 : part.layer === "muscles" && dz > 0 ? 0.04 : 0;
  return [dx * 0.95 * spread, dy * 0.22 * spread, dz * 1.6 * spread + forward];
}

/** Search names. Every word must match the start of a word in the name. */
export function searchParts(parts, query, limit = 40) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const seen = new Set();
  const hits = [];
  for (const p of parts) {
    const n = p.name.toLowerCase();
    const tokens = n.split(/[\s,-]+/);
    if (!words.every(w => tokens.some(t => t.startsWith(w)))) continue;
    const key = baseName(p.name);
    if (seen.has(key)) continue;
    seen.add(key);
    // Shorter names and names that start with the query rank first.
    const score = (n.startsWith(words[0]) ? 0 : 100) + n.length;
    hits.push({ part: p, score });
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, limit).map(h => h.part);
}

/** The other side's copy of a part, if any: "Right femur" ↔ "Left femur". */
export function mirrorOf(part, parts) {
  const side = sideOf(part.name);
  if (!side) return null;
  const other = side === "left" ? "right" : "left";
  const target = part.name.toLowerCase().replace(new RegExp(`\\b${side}\\b`), other);
  return parts.find(p => p.name.toLowerCase() === target) ?? null;
}

// Whole structures people look for that the data splits into pieces, like
// "heart" (walls and valves) or "brain" (folds and nuclei).
export const STRUCTURES = [
  { id: "heart", name: "Heart", words: ["heart", "cardiac"], match: /wall of (atrium|ventricle)|valve|cusp|leaflet|papillary/ },
  { id: "brain", name: "Brain", words: ["brain", "cerebrum", "cortex"], match: /gyrus|lobule|occipital lobe|insula|white matter of|corpus callosum|cerebellum|thalamus|hippocampus|amygdala|caudate nucleus|putamen|globus pallidus|midbrain|pons|medulla oblongata/ },
  { id: "lungs", name: "Lungs", words: ["lung", "lungs"], match: /lobe of lung/ },
  { id: "airways", name: "Airways", words: ["airway", "airways", "bronchi", "bronchus", "windpipe"], match: /trachea|bronch/ },
  { id: "skull", name: "Skull", words: ["skull", "cranium"], match: /^(frontal|parietal|occipital|temporal|sphenoid|zygomatic|nasal|lacrimal|palatine) bone|^ethmoid|^maxilla|^mandible|^vomer|inferior nasal concha/ },
  { id: "spine", name: "Spine", words: ["spine", "backbone", "vertebrae", "spinal column"], match: /vertebra|^atlas|^axis|^sacrum|intervertebral/ },
  { id: "ribcage", name: "Rib cage", words: ["ribs", "rib cage", "ribcage", "breastbone"], match: /\brib\b|costal cartilage|sternum|manubrium|xiphoid/ },
  { id: "pelvis", name: "Pelvis", words: ["pelvis", "hips"], match: /^hip bone|^sacrum/ },
  { id: "hand", name: "Hand bones", words: ["hand", "hands", "fingers"], match: /phalanx of (thumb|.*finger)|metacarpal|scaphoid|lunate|trapezium|trapezoid|capitate|triquetral|pisiform|hamate/ },
  { id: "foot", name: "Foot bones", words: ["foot", "feet", "toes"], match: /phalanx of .*toe|metatarsal|talus|calcaneus|cuboid|navicular bone of foot|cuneiform bone|sesamoid bone of foot/ },
  { id: "intestines", name: "Intestines", words: ["intestine", "intestines", "gut", "bowel", "colon"], match: /duodenum|jejunum|ileum|colon|rectum|appendix|ileocecal/ },
  { id: "eye", name: "Eye", words: ["eye", "eyes", "eyeball"], match: /sclera|cornea|^lens|^iris|retina|vitreous|^choroid|anterior chamber|corona ciliaris/ },
  { id: "teeth", name: "Teeth", words: ["teeth", "tooth"], match: /tooth/ },
  { id: "rotator-cuff", name: "Rotator cuff", words: ["rotator cuff"], match: /supraspinatus|infraspinatus|teres minor|subscapularis/ },
  { id: "abs", name: "Abs (belly wall)", words: ["abs", "abdominals", "core", "six pack"], match: /rectus abdominis|external oblique|internal oblique|transversus abdominis/ },
  { id: "quads", name: "Quadriceps", words: ["quads", "quadriceps"], match: /rectus femoris|vastus/ },
  { id: "hamstrings", name: "Hamstrings", words: ["hamstrings", "hamstring"], match: /biceps femoris|semitendinosus|semimembranosus/ },
  { id: "glutes", name: "Glutes", words: ["glutes", "butt", "buttocks"], match: /gluteus/ },
  { id: "calves", name: "Calves", words: ["calf", "calves"], match: /gastrocnemius|soleus|plantaris/ },
  { id: "erectors", name: "Spine muscles (erector spinae)", words: ["erector spinae", "erectors", "back muscles"], match: /iliocostalis|longissimus|spinalis|multifidus/ },
];

/** Whole structures matching a query, each with its parts. */
export function searchStructures(parts, query) {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return [];
  return STRUCTURES.filter(s => s.words.some(w => w.startsWith(q) || q.startsWith(w)))
    .map(s => ({ ...s, parts: parts.filter(p => s.match.test(baseName(p.name)) && !/arter|vein/.test(baseName(p.name))) }))
    .filter(s => s.parts.length > 0);
}
