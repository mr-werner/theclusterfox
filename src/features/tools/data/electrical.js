// Wire and fastener data.

export const RHO_CU = 1.724e-8; // Ω·m at 20 °C (IACS annealed copper)
export const RHO_AL = 2.826e-8; // Ω·m at 20 °C (EC-grade aluminum)
export const ALPHA_CU = 0.00393;
export const ALPHA_AL = 0.00403;

const AWG_NAMES = ["4/0", "3/0", "2/0", "1/0", ...Array.from({ length: 40 }, (_, i) => String(i + 1))];
const awgNumber = (name) => (name.includes("/") ? 1 - Number(name[0]) : Number(name));

/** AWG diameter in metres: d = 0.127 mm × 92^((36 − n) / 39). */
export const awgDiameter = (name) => 0.127e-3 * 92 ** ((36 - awgNumber(name)) / 39);

// NEC Table 310.16 ampacity, copper, 60/75/90 °C insulation, ≤3 current-carrying conductors, 30 °C ambient.
const NEC_CU = {
  14: [15, 20, 25], 12: [20, 25, 30], 10: [30, 35, 40], 8: [40, 50, 55], 6: [55, 65, 75], 4: [70, 85, 95],
  3: [85, 100, 115], 2: [95, 115, 130], 1: [110, 130, 145], "1/0": [125, 150, 170], "2/0": [145, 175, 195],
  "3/0": [165, 200, 225], "4/0": [195, 230, 260],
};

export const AWG = AWG_NAMES.map((name) => {
  const d = awgDiameter(name);
  const area = (Math.PI * d * d) / 4;
  const amp = NEC_CU[name] || [null, null, null];
  return {
    name,
    d,
    area,
    rCu: RHO_CU / area,
    rAl: RHO_AL / area,
    amp60: amp[0],
    amp75: amp[1],
    amp90: amp[2],
  };
});

// Sizes offered in the voltage drop calculator: AWG, kcmil and metric mm².
export const CONDUCTOR_SIZES = [
  ...["18", "16", "14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0"].map((n) => ({
    label: `${n} AWG`,
    area: (Math.PI * awgDiameter(n) ** 2) / 4,
  })),
  ...[250, 300, 350, 400, 500, 600, 750].map((k) => ({ label: `${k} kcmil`, area: k * 5.067074791e-7 })),
  ...[1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240].map((mm) => ({ label: `${mm} mm²`, area: mm * 1e-6 })),
];

// Bolts: tensile stress area As (m²) and nominal diameter (m).
export const BOLT_SIZES = [
  ...[
    ["M4", 4, 8.78], ["M5", 5, 14.2], ["M6", 6, 20.1], ["M8", 8, 36.6], ["M10", 10, 58], ["M12", 12, 84.3],
    ["M14", 14, 115], ["M16", 16, 157], ["M20", 20, 245], ["M24", 24, 353], ["M30", 30, 561], ["M36", 36, 817],
  ].map(([label, d, As]) => ({ label, d: d * 1e-3, As: As * 1e-6, metric: true })),
  ...[
    ["#10-24 UNC", 0.19, 0.0175], ["1/4-20 UNC", 0.25, 0.0318], ["5/16-18 UNC", 0.3125, 0.0524], ["3/8-16 UNC", 0.375, 0.0775],
    ["7/16-14 UNC", 0.4375, 0.1063], ["1/2-13 UNC", 0.5, 0.1419], ["5/8-11 UNC", 0.625, 0.226], ["3/4-10 UNC", 0.75, 0.334],
    ["7/8-9 UNC", 0.875, 0.462], ["1-8 UNC", 1, 0.606],
  ].map(([label, d, As]) => ({ label, d: d * 0.0254, As: As * 6.4516e-4, metric: false })),
];

// Proof strength, Pa. Metric property classes (ISO 898-1) and SAE J429 grades.
export const BOLT_GRADES = [
  { label: "Class 8.8", proof: 600e6, proofSmall: 580e6, metric: true },
  { label: "Class 10.9", proof: 830e6, metric: true },
  { label: "Class 12.9", proof: 970e6, metric: true },
  { label: "SAE grade 2", proof: 55 * 6.894757e6, metric: false },
  { label: "SAE grade 5", proof: 85 * 6.894757e6, metric: false },
  { label: "SAE grade 8", proof: 120 * 6.894757e6, metric: false },
];

export const NUT_FACTORS = [
  ["Dry, plain steel", 0.2],
  ["Zinc plated, dry", 0.2],
  ["Lightly oiled", 0.18],
  ["Lubricated (oil / grease)", 0.15],
  ["Anti-seize / moly paste", 0.12],
  ["Cadmium plated", 0.16],
].map(([label, K]) => ({ label, K }));

// Resistor color code.
export const RESISTOR_COLORS = [
  { name: "Black", hex: "#1b1b1b", digit: 0, mult: 1 },
  { name: "Brown", hex: "#7b4a26", digit: 1, mult: 10, tol: 1 },
  { name: "Red", hex: "#d63a2f", digit: 2, mult: 100, tol: 2 },
  { name: "Orange", hex: "#f08a24", digit: 3, mult: 1e3 },
  { name: "Yellow", hex: "#f2d33a", digit: 4, mult: 1e4 },
  { name: "Green", hex: "#3d9b4a", digit: 5, mult: 1e5, tol: 0.5 },
  { name: "Blue", hex: "#3566d6", digit: 6, mult: 1e6, tol: 0.25 },
  { name: "Violet", hex: "#8a4fd0", digit: 7, mult: 1e7, tol: 0.1 },
  { name: "Gray", hex: "#8c8c8c", digit: 8, mult: 1e8, tol: 0.05 },
  { name: "White", hex: "#f2f2f2", digit: 9, mult: 1e9 },
  { name: "Gold", hex: "#c9a43a", mult: 0.1, tol: 5 },
  { name: "Silver", hex: "#c0c0c0", mult: 0.01, tol: 10 },
];
