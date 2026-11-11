// Everything Engineer ToolFox offers: categories, calculators and reference tables.

import { Droplets, Flame, Wind, Cog, Zap, Shapes, DraftingCompass } from "lucide-react";
import { CALLOUTS as GDT_CALLOUTS, BASICS as GDT_BASICS } from "./design/gdtModel.js";
import { PROCESSES } from "./design/processes.js";
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
  {
    id: "design",
    name: "Design & Manufacturing",
    short: "Design",
    icon: DraftingCompass,
    hue: "#ffb86b",
    blurb: "GD&T callouts you can play with, and the processes and machines that make a part to tolerance.",
    count: `${GDT_CALLOUTS.length} GD&T callouts · ${PROCESSES.length} processes`,
  },
];

/** Full-page builders that don't fit the one-form calculator layout. */
export const BUILDERS = [
  {
    id: "frame",
    cat: "mech",
    name: "Frame builder",
    blurb: "Draw a 2D frame or truss from standard sizes, pick connections and supports, load it, and get axial, shear, moment, deflection and member checks.",
    keywords: "frame builder structure structural analysis portal frame truss braced frame stiffness method 2d frame members joints connections pinned rigid moment connection supports wide flange w shape hss ipe hea lumber timber steel aluminum axial force shear moment diagram deflected shape reactions buckling utilization",
    path: "/tools/frame",
  },
  {
    id: "gdt",
    cat: "design",
    name: "GD&T explorer",
    blurb: "Every geometric tolerance symbol with a drawing you can change: edit the callout or the part and watch the zone and the accept / reject verdict.",
    keywords: "gd&t gdt geometric dimensioning tolerancing feature control frame callout datum tolerance zone flatness straightness circularity roundness cylindricity perpendicularity parallelism angularity position true position concentricity symmetry profile runout mmc lmc rfs bonus asme y14.5 iso 1101",
    path: "/tools/gdt",
  },
  {
    id: "make",
    cat: "design",
    name: "Manufacturing process finder",
    blurb: "Pick material, shape, features, tolerance, finish and quantity; get the processes and machines that make it and the finishing steps it needs.",
    keywords: "manufacturing process selection machining milling turning lathe cnc grinding honing lapping reaming boring edm laser waterjet casting molding injection forging extrusion 3d printing additive machine tolerance surface finish ra quantity",
    path: "/tools/make",
  },
  {
    id: "methods",
    cat: "design",
    name: "Manufacturing methods",
    blurb: "How each common process works, the machines that do it, and the tolerance and finish it holds.",
    keywords: "manufacturing methods processes machines library milling turning grinding edm sheet metal casting molding additive",
    path: "/tools/make/methods",
  },
];

/** Every GD&T page, so search finds "flatness" or "datums" directly. */
export const GDT_PAGES = [
  ...GDT_BASICS.map((b) => ({ id: `gdt-${b.id}`, name: b.name, blurb: b.summary, path: `/tools/gdt/${b.id}`, keywords: "gd&t gdt basics lesson datum frame mmc lmc mmb lmb rmb bonus datum shift pattern composite order 3-2-1" })),
  ...GDT_CALLOUTS.map((c) => ({ id: `gdt-${c.id}`, name: `${c.name} (GD&T)`, blurb: c.summary, path: `/tools/gdt/${c.id}`, keywords: `gd&t gdt ${c.group} ${c.name.toLowerCase()} tolerance callout symbol` })),
];

export const CALCS = [...fluids, ...heat, ...air, ...mechanics, ...electrical, ...geometry];

export { TABLES };

export const categoryById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const calcById = Object.fromEntries(CALCS.map((c) => [c.id, c]));

/**
 * Old calculator ids that now live inside another one. `params` are the old
 * calculator's defaults, so a saved link opens on the same beam it showed.
 */
export const CALC_ALIASES = {
  "beam-builder": { to: "beam", params: { setup: "custom", L: "8", model: "pin@0;roller@5;w6000@0-5;P12000@8", I: "2.77e-5", S: "2.52e-4" } },
};
export const builderById = Object.fromEntries(BUILDERS.map((b) => [b.id, b]));
export const tableById = Object.fromEntries(TABLES.map((t) => [t.id, t]));

/** Everything searchable, as { kind, id, name, blurb, cat, path, keywords }. */
export const SEARCH_INDEX = [
  ...BUILDERS.map((b) => ({ kind: "builder", id: b.id, name: b.name, blurb: b.blurb, cat: b.cat, path: b.path, keywords: b.keywords })),
  ...GDT_PAGES.map((g) => ({ kind: "guide", id: g.id, name: g.name, blurb: g.blurb, cat: "design", path: g.path, keywords: g.keywords })),
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
