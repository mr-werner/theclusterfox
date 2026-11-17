// The engineering disciplines that also stand on their own as apps on the
// ClusterFox home screen. Each one is a themed front door onto the same
// tools Engineer ToolFox has: nothing is copied, a discipline app only
// lists tool ids, so a change to a tool shows up everywhere at once.
//
// `cat` is the ToolFox category the app shows. `alsoUse` adds tools from
// other categories that people in that field reach for all the time.
// Colors give each app its own feel: `bg` is the drafting sheet, `accent`
// matches the category color ToolFox already uses, and `grid` (an "r, g, b"
// string) tints the sheet's grid lines.

export const DISCIPLINES = [
  {
    id: "fluids",
    cat: "fluids",
    path: "/fluids",
    name: "Fluids & Piping",
    tagline: "Pipes • Pumps • Flow",
    alsoUse: ["calc:tank-volume", "calc:slope", "calc:thermal-expansion", "calc:interpolate"],
    bg: "#062236",
    accent: "#5cc8ff",
    grid: "120, 205, 255",
  },
  {
    id: "heat",
    cat: "heat",
    path: "/heat",
    name: "Heat & Energy",
    tagline: "Conduction • Exchangers • Fuel",
    alsoUse: ["calc:building-loads", "calc:air-heat", "calc:interpolate"],
    bg: "#24110a",
    accent: "#ff8a4c",
    grid: "255, 160, 110",
  },
  {
    id: "hvac",
    cat: "air",
    path: "/hvac",
    name: "Air & HVAC",
    tagline: "Psychrometrics • Ducts • Loads",
    alsoUse: ["calc:heat-energy", "calc:conduction", "table:insulation", "table:fuels", "calc:voltage-drop", "calc:interpolate"],
    bg: "#082622",
    accent: "#7be0c3",
    grid: "140, 235, 205",
  },
  {
    id: "mechanics",
    cat: "mech",
    path: "/mechanics",
    name: "Mechanics & Structures",
    tagline: "Beams • Frames • Bolts",
    alsoUse: ["calc:thermal-expansion", "calc:shapes", "calc:interpolate"],
    bg: "#181430",
    accent: "#c6a6ff",
    grid: "200, 175, 255",
  },
  {
    id: "electrical",
    cat: "elec",
    path: "/electrical",
    name: "Electrical",
    tagline: "Ohm's law • Wire • Power",
    alsoUse: ["calc:conduction", "calc:convection"],
    bg: "#14130a",
    accent: "#ffd25c",
    grid: "255, 215, 110",
  },
  {
    id: "manufacturing",
    cat: "design",
    path: "/manufacturing",
    name: "Design & Manufacturing",
    tagline: "GD&T • Processes • Machines",
    alsoUse: ["calc:thermal-expansion", "calc:shapes", "table:materials", "table:friction", "calc:interpolate"],
    bg: "#211709",
    accent: "#ffb86b",
    grid: "255, 195, 130",
  },
];

export const disciplineById = Object.fromEntries(DISCIPLINES.map((d) => [d.id, d]));
export const disciplineForCat = Object.fromEntries(DISCIPLINES.map((d) => [d.cat, d]));
