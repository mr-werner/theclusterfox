// Engineer ToolFox in PlanFox: a planner item (a job, a study session) can
// open a calculator category. Kept small so the calculators themselves only
// load inside ToolFox.

export const planItems = () => [];

export const launchTargets = () => [
  { id: "home", title: "All tools", href: "/tools" },
  { id: "fluids", title: "Fluids & Piping", href: "/tools/c/fluids" },
  { id: "heat", title: "Heat & Energy", href: "/tools/c/heat" },
  { id: "air", title: "Air & HVAC", href: "/tools/c/air" },
  { id: "mech", title: "Mechanics & Structures", href: "/tools/c/mech" },
  { id: "elec", title: "Electrical", href: "/tools/c/elec" },
  { id: "geo", title: "Geometry & Math", href: "/tools/c/geo" },
  { id: "frame", title: "Frame builder", href: "/tools/frame" },
  { id: "convert", title: "Unit converter", href: "/tools/convert" },
];
