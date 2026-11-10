// The two ways the top of the forecast dresses you. Casual covers relaxing,
// errands and strolling (like the Compendium's "walking, household errands", about 2.5 METs).
// Sports is a steady workout such as a jog, a ride or a game (about 6 METs),
// and switches to active wear, which breathes and layers differently.
export const attireModes = [
  {
    id: "casual",
    title: "Casual Attire",
    short: "Casual",
    hint: "Relaxing, errands, a stroll",
    activity: { id: "casual", name: "Casual", mets: 2.5, speed: 0.6, gait: 0.6, wardrobe: "everyday" },
  },
  {
    id: "sports",
    title: "Sports Attire",
    short: "Sports",
    hint: "A jog, a ride, a game",
    activity: { id: "sports", name: "Sports", mets: 6.0, speed: 2.0, gait: 1.0, wardrobe: "active" },
  },
];

export const attireById = new Map(attireModes.map(mode => [mode.id, mode]));

// Which drawing stands for each garment (see components/GarmentIcon.jsx).
const GARMENT_ICONS = {
  tee: "tee",
  techTee: "tee",
  longSleeve: "longsleeve",
  techLong: "longsleeve",
  thermalTop: "longsleeve",
  thermalBase: "longsleeve",
  thinSweater: "sweater",
  thickSweater: "sweater",
  fleece: "sweater",
  gridFleece: "sweater",
  lightJacket: "jacket",
  shell: "jacket",
  insulatedShell: "jacket",
  puffer: "coat",
  parka: "coat",
  windVest: "vest",
  puffyVest: "vest",
  shorts: "shorts",
  runShorts: "shorts",
  trousers: "pants",
  jeans: "pants",
  thermalBottoms: "pants",
  snowPants: "pants",
  tights: "pants",
  thermalTights: "pants",
  windPants: "pants",
};

/**
 * The few pictures that sum up an outfit plan: what you'd see on someone
 * (the outermost top and the outermost legs), then a hat, gloves, an
 * umbrella or sunglasses when the plan calls for them.
 * garments: the garment table from data/garments.js.
 */
export function attireIcons(plan, garments) {
  if (!plan) return [];
  const worn = plan.outfit.items.map(id => ({ id, ...garments[id] }));
  const last = region => worn.filter(g => g.region === region && GARMENT_ICONS[g.id]).at(-1);
  const upper = last("outer") ?? last("top");
  const legs = last("legs");
  const icons = [upper, legs].filter(Boolean).map(g => ({ kind: GARMENT_ICONS[g.id], label: g.name }));

  for (const extra of plan.extras) {
    if (extra.kind === "hat") icons.push({ kind: "beanie", label: extra.text });
    if (extra.kind === "gloves") icons.push({ kind: "gloves", label: extra.text });
    if (extra.kind === "rain") icons.push({ kind: "umbrella", label: extra.text });
    if (extra.kind === "sun" && /sunglasses/i.test(extra.text)) icons.push({ kind: "sunglasses", label: "Sunglasses" });
  }
  return icons;
}
