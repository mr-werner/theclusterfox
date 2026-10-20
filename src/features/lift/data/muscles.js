// Muscle groups and the shapes that draw them on the body map. Each shape is
// the left half (viewer's left) of a 200 × 430 figure; the map mirrors it.

export const muscles = [
  { id: "chest", name: "Chest", region: "upper" },
  { id: "shoulders", name: "Shoulders", region: "upper" },
  { id: "traps", name: "Traps", region: "upper" },
  { id: "lats", name: "Back (lats)", region: "upper" },
  { id: "biceps", name: "Biceps", region: "arms" },
  { id: "triceps", name: "Triceps", region: "arms" },
  { id: "forearms", name: "Forearms", region: "arms" },
  { id: "abs", name: "Abs", region: "core" },
  { id: "obliques", name: "Obliques", region: "core" },
  { id: "lowerBack", name: "Lower back", region: "core" },
  { id: "glutes", name: "Glutes", region: "lower" },
  { id: "quads", name: "Quads", region: "lower" },
  { id: "hamstrings", name: "Hamstrings", region: "lower" },
  { id: "calves", name: "Calves", region: "lower" },
];

export const musclesById = new Map(muscles.map(m => [m.id, m]));
export const muscleName = id => musclesById.get(id)?.name ?? id;

export const REGIONS = [
  { id: "upper", name: "Upper body" },
  { id: "arms", name: "Arms" },
  { id: "core", name: "Core" },
  { id: "lower", name: "Legs" },
];

// The figure's outline: torso and leg, arm, then head.
export const BODY_HALF = [
  "M100 52 L92 52 Q91 60 88 63 Q74 66 64 70 Q56 76 58 92 Q66 104 68 118 Q66 150 70 180 Q66 196 66 212 Q64 250 66 290 Q68 306 70 318 Q64 345 68 375 Q70 395 70 404 Q63 414 66 422 L87 422 Q89 411 86 402 Q90 372 90 344 Q90 326 93 316 Q97 290 98 250 L100 226 Z",
  "M62 70 Q48 74 46 92 Q44 108 48 120 Q44 136 46 150 Q38 172 38 200 Q40 216 42 228 Q40 242 46 252 Q52 255 55 246 Q56 236 56 228 Q64 196 66 162 Q68 146 67 128 Q66 104 64 90 Z",
];

export const HEAD = { cx: 100, cy: 30, rx: 16, ry: 20 };

export const FRONT_SHAPES = [
  { muscle: "traps", d: "M92 56 Q84 63 70 69 Q80 71 86 70 Q92 66 94 60 Z" },
  { muscle: "shoulders", d: "M68 71 Q52 72 48 88 Q47 101 51 111 Q57 100 65 92 Q72 82 77 74 Z" },
  { muscle: "chest", d: "M78 74 Q71 84 69 96 Q71 111 84 115 Q95 116 98 110 L98 77 Q89 72 78 74 Z" },
  { muscle: "biceps", d: "M52 115 Q47 129 49 145 Q55 151 61 146 Q66 128 64 103 Q57 106 52 115 Z" },
  { muscle: "forearms", d: "M49 153 Q42 172 42 197 Q44 214 47 223 L55 223 Q61 196 64 161 Q59 150 49 153 Z" },
  { muscle: "abs", d: "M87 120 L98 120 L98 192 Q91 192 87 186 Q85 152 87 120 Z" },
  { muscle: "obliques", d: "M71 114 Q67 140 71 170 Q75 185 84 189 Q82 150 84 120 Q78 118 71 114 Z" },
  { muscle: "quads", d: "M72 212 Q66 242 68 280 Q72 301 84 307 Q94 303 96 289 Q98 250 96 214 Q86 207 72 212 Z" },
  { muscle: "calves", d: "M72 324 Q66 346 70 372 Q74 390 80 394 Q86 378 86 350 Q86 332 83 322 Z" },
];

export const BACK_SHAPES = [
  { muscle: "traps", d: "M99 52 L92 55 Q85 63 68 70 Q80 76 89 90 Q95 108 99 128 Z" },
  { muscle: "shoulders", d: "M67 71 Q52 72 48 88 Q47 101 51 111 Q57 100 65 92 Q71 84 75 76 Z" },
  { muscle: "lats", d: "M72 94 Q68 121 72 150 Q78 171 92 182 Q96 160 97 141 Q90 121 85 102 Q79 95 72 94 Z" },
  { muscle: "triceps", d: "M51 113 Q46 129 48 145 Q54 152 60 146 Q66 128 64 101 Q56 103 51 113 Z" },
  { muscle: "forearms", d: "M49 153 Q42 172 42 197 Q44 214 47 223 L55 223 Q61 196 64 161 Q59 150 49 153 Z" },
  { muscle: "lowerBack", d: "M89 170 Q85 186 87 201 L98 203 L98 156 Q95 166 89 170 Z" },
  { muscle: "glutes", d: "M71 207 Q66 227 72 244 Q84 254 98 248 L98 211 Q86 203 71 207 Z" },
  { muscle: "hamstrings", d: "M71 253 Q66 277 70 300 Q76 311 86 309 Q95 299 95 270 Q95 258 93 253 Q82 257 71 253 Z" },
  { muscle: "calves", d: "M71 322 Q64 341 68 363 Q74 379 80 381 Q88 369 88 346 Q86 328 84 320 Z" },
];
