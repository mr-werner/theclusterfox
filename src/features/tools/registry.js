// Everything Engineering ToolFox offers: categories, calculators and reference tables.

import { Droplets, Flame, Wind, Cog, Zap, Shapes } from "lucide-react";
import { fluids } from "./calcs/fluids.js";
import { heat } from "./calcs/heat.js";
import { air } from "./calcs/air.js";
import { mechanics } from "./calcs/mechanics.js";
import { electrical } from "./calcs/electrical.js";
import { geometry } from "./calcs/geometry.js";
import { TABLES } from "./tables.js";

export const CATEGORIES = [
  { id: "fluids", name: "Fluids & Piping", short: "Fluids", icon: Droplets, hue: "#5cc8ff", blurb: "Pipe sizing, pressure drop, pumps, flow meters and channels." },
  { id: "heat", name: "Heat & Energy", short: "Heat", icon: Flame, hue: "#ff8a4c", blurb: "Conduction, convection, radiation, expansion and heat exchangers." },
  { id: "air", name: "Air & HVAC", short: "Air", icon: Wind, hue: "#7be0c3", blurb: "Psychrometrics, airflow loads, ducts, altitude and gases." },
  { id: "mech", name: "Mechanics & Structures", short: "Mechanics", icon: Cog, hue: "#c6a6ff", blurb: "Beams, sections, buckling, bolts, springs, torque and gears." },
  { id: "elec", name: "Electrical", short: "Electrical", icon: Zap, hue: "#ffd25c", blurb: "Ohm's law, voltage drop, three-phase, batteries and components." },
  { id: "geo", name: "Geometry & Math", short: "Geometry", icon: Shapes, hue: "#ff7aa8", blurb: "Tanks, areas, volumes, slopes and interpolation." },
];

export const CALCS = [...fluids, ...heat, ...air, ...mechanics, ...electrical, ...geometry];

export { TABLES };

export const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const calcById = Object.fromEntries(CALCS.map((c) => [c.id, c]));
export const tableById = Object.fromEntries(TABLES.map((t) => [t.id, t]));

/** Everything searchable, as { kind, id, name, blurb, cat, path, keywords }. */
export const SEARCH_INDEX = [
  ...CALCS.map((c) => ({ kind: "calc", id: c.id, name: c.name, blurb: c.blurb, cat: c.cat, path: `/tools/calc/${c.id}`, keywords: c.keywords || "" })),
  ...TABLES.map((t) => ({ kind: "table", id: t.id, name: t.name, blurb: t.blurb, cat: t.cat, path: `/tools/data/${t.id}`, keywords: t.keywords || "" })),
];

/** Rank search results: name matches first, then words anywhere. */
export function search(query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/);
  const scored = [];
  for (const item of SEARCH_INDEX) {
    const name = item.name.toLowerCase();
    const hay = `${name} ${item.blurb} ${item.keywords} ${categoryById[item.cat]?.name ?? ""}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 0;
    if (name.startsWith(q)) score += 100;
    if (name.includes(q)) score += 50;
    for (const w of words) {
      if (name.includes(w)) score += 10;
      if (item.keywords.includes(w)) score += 4;
    }
    scored.push({ ...item, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
