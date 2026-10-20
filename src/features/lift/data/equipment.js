// Gear someone might have. Bodyweight needs nothing, so it is always on.

export const equipment = [
  { id: "dumbbells", name: "Dumbbells" },
  { id: "barbell", name: "Barbell & rack" },
  { id: "bench", name: "Bench" },
  { id: "pullupBar", name: "Pull-up bar" },
  { id: "kettlebell", name: "Kettlebell" },
  { id: "bands", name: "Resistance bands" },
  { id: "cable", name: "Cable machine" },
  { id: "machines", name: "Gym machines" },
];

export const equipmentById = new Map(equipment.map(e => [e.id, e]));

export const GEAR_PRESETS = [
  { id: "none", name: "No gear", gear: [] },
  { id: "home", name: "Home basics", gear: ["dumbbells", "bands", "pullupBar"] },
  { id: "gym", name: "Full gym", gear: equipment.map(e => e.id) },
];
