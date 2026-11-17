// What GrowFox shares with StudyFox: the plant library, a deck per kind of
// plant, plus a deck for sorting plants into their kinds. Cards and
// questions come straight from the library, so they stay current.
// StudyFox loads this on demand (see src/app/studyLinks.js).
import { PLANTS, TYPES } from "../data/plants.js";

const SUN = { full: "Full sun", part: "Part sun", shade: "Shade" };
const SUN_CHOICES = ["Full sun", "Full sun to part sun", "Part sun", "Part sun to shade", "Full sun to shade"];
const WATER = { 1: "Dry-tolerant: water rarely", 2: "Average: water when the top inch is dry", 3: "Likes it moist: keep evenly watered" };

function sunLabel(sun) {
  const has = s => sun.includes(s);
  if (has("full") && has("shade")) return "Full sun to shade";
  if (has("full") && has("part")) return "Full sun to part sun";
  if (has("part") && has("shade")) return "Part sun to shade";
  return SUN[sun[0]] ?? "Full sun";
}

function card(p) {
  const lines = [
    p.latin,
    `Light: ${sunLabel(p.sun)}`,
    `Water: ${WATER[p.water] ?? "Average"}`,
    p.zones ? `Hardy in zones ${p.zones[0]}–${p.zones[1]}` : null,
    p.spacing ? `Spacing: ${p.spacing}` : null,
    p.tip,
  ].filter(Boolean);
  return { id: p.id, front: p.name, back: lines.join("\n"), group: TYPES.find(t => t.id === p.type)?.name, href: `/grow?plant=${p.id}` };
}

// A small seeded shuffle so a deck's questions are the same each time it loads.
function pick(list, n, seed) {
  const a = [...list];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function questionsFor(plants, pool) {
  const out = [];
  plants.forEach((p, i) => {
    const sun = sunLabel(p.sun);
    const sunWrong = pick(SUN_CHOICES.filter(c => c !== sun), 3, i + 7);
    out.push({ id: `${p.id}-sun`, text: `How much sun does ${p.name.toLowerCase()} want?`, choices: [sun, ...sunWrong], answer: 0, why: `${p.name}: ${sun.toLowerCase()}. ${p.tip ?? ""}`.trim() });
    const others = pick(pool.filter(o => o.id !== p.id && o.latin !== p.latin), 3, i + 11);
    if (others.length === 3) out.push({ id: `${p.id}-latin`, text: `Which plant is ${p.latin}?`, choices: [p.name, ...others.map(o => o.name)], answer: 0, why: `${p.latin} is ${p.name.toLowerCase()}.` });
  });
  return out;
}

export function decks() {
  return [
    ...TYPES.filter(t => PLANTS.some(p => p.type === t.id)).map(t => ({ id: t.id, title: t.name, blurb: `${PLANTS.filter(p => p.type === t.id).length} plants: light, water, zones and growing tips.`, group: "Plants" })),
    { id: "kinds", title: "Sort plants by kind", blurb: "Every plant in the library, for sorting vegetables from herbs, shrubs from trees.", group: "Plants" },
  ];
}

export function deck(id) {
  if (id === "kinds") {
    return { id, title: "Sort plants by kind", href: "/grow?tab=plants", cards: PLANTS.map(card) };
  }
  const type = TYPES.find(t => t.id === id);
  if (!type) return null;
  const plants = PLANTS.filter(p => p.type === id);
  if (!plants.length) return null;
  return {
    id,
    title: type.name,
    href: `/grow?tab=plants&type=${id}`,
    cards: plants.map(p => ({ ...card(p), group: undefined })),
    facts: plants.filter(p => p.tip).map(p => ({ id: `${p.id}-tip`, text: `${p.name}: ${p.tip}` })),
    questions: questionsFor(plants, PLANTS.filter(p => p.type === id).length >= 4 ? plants : PLANTS),
    diagrams: [{ title: "Your yard", href: "/grow?tab=yard", blurb: "Map your yard's sun and shade and see what fits each spot." }],
  };
}
