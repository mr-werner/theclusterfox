import { num, choice, out, say } from "./define.js";

function tank({ shape, D, L, W, H, h }) {
  const r = D / 2;
  switch (shape) {
    case "vcyl": {
      const A = Math.PI * r * r;
      return { total: A * H, fill: A * Math.min(h, H), height: H };
    }
    case "hcyl": {
      const hh = Math.min(h, D);
      const seg = r * r * Math.acos((r - hh) / r) - (r - hh) * Math.sqrt(Math.max(0, 2 * r * hh - hh * hh));
      return { total: Math.PI * r * r * L, fill: seg * L, height: D };
    }
    case "rect":
      return { total: L * W * H, fill: L * W * Math.min(h, H), height: H };
    case "sphere": {
      const hh = Math.min(h, D);
      return { total: (4 / 3) * Math.PI * r ** 3, fill: (Math.PI * hh * hh * (3 * r - hh)) / 3, height: D };
    }
    default:
      return null;
  }
}

export const geometry = [
  {
    id: "tank-volume",
    cat: "geo",
    name: "Tank volume and fill level",
    blurb: "Total and partly filled volume of vertical, horizontal, rectangular and spherical tanks.",
    keywords: "tank volume fill level horizontal cylinder gallons liters partially filled sphere",
    inputs: [
      choice("shape", "Tank", [
        { value: "hcyl", label: "Horizontal cylinder" },
        { value: "vcyl", label: "Vertical cylinder" },
        { value: "rect", label: "Rectangular" },
        { value: "sphere", label: "Sphere" },
      ]),
      num("D", "Diameter", "length", 1.5, { min: 0, when: (v) => v.shape !== "rect" }),
      num("L", "Length", "length", 3, { min: 0, when: (v) => v.shape === "hcyl" || v.shape === "rect" }),
      num("W", "Width", "length", 1.5, { min: 0, when: (v) => v.shape === "rect" }),
      num("H", "Height", "length", 2, { min: 0, when: (v) => v.shape === "vcyl" || v.shape === "rect" }),
      num("h", "Liquid level", "length", 0.5, { min: 0 }),
    ],
    compute: (v) => {
      const t = tank(v);
      const frac = t.fill / t.total;
      return {
        results: [
          out("fill", "Liquid volume", "volume", t.fill, { primary: true }),
          out("total", "Total capacity", "volume", t.total),
          out("pct", "Full", "percent", frac),
          out("space", "Room left", "volume", t.total - t.fill),
        ],
        warnings: v.h > t.height ? ["The level is above the top of the tank; showing it full."] : [],
        visual: { type: "tank", shape: v.shape, frac: Math.min(1, v.h / t.height) },
      };
    },
    formula: ["Horizontal cylinder: V = L · ( r² acos((r − h)/r) − (r − h) √(2 r h − h²) )", "Sphere: V = π h² (3r − h) / 3", "Vertical / rectangular: V = area × h"],
    about: "A horizontal tank isn't linear: the first and last few centimetres hold much less than the middle. This gives the exact volume at any dip reading, so you can make your own dip chart. Heads (end caps) are taken as flat.",
    related: ["shapes", "tank-drain"],
  },
  {
    id: "shapes",
    cat: "geo",
    name: "Areas and volumes",
    blurb: "Area, perimeter, volume and surface area of everyday shapes and solids.",
    keywords: "area volume surface circle triangle sphere cone cylinder perimeter geometry",
    inputs: [
      choice("shape", "Shape", [
        { value: "circle", label: "Circle" },
        { value: "rect", label: "Rectangle" },
        { value: "triangle", label: "Triangle (base × height)" },
        { value: "ellipse", label: "Ellipse" },
        { value: "annulus", label: "Ring (annulus)" },
        { value: "cylinder", label: "Cylinder" },
        { value: "sphere", label: "Sphere" },
        { value: "cone", label: "Cone" },
        { value: "box", label: "Box" },
        { value: "pyramid", label: "Square pyramid" },
      ]),
      num("a", "Diameter / width / base", "length", 1, { min: 0 }),
      num("b", "Height / length / second axis", "length", 2, { min: 0, when: (v) => !["circle", "sphere"].includes(v.shape) }),
      num("c", "Depth / inner diameter", "length", 0.5, { min: 0, when: (v) => v.shape === "box" || v.shape === "annulus" }),
    ],
    compute: ({ shape, a, b, c }) => {
      const r = a / 2;
      const P = Math.PI;
      switch (shape) {
        case "circle": return { results: [out("A", "Area", "area", P * r * r, { primary: true }), out("C", "Circumference", "length", P * a)] };
        case "rect": return { results: [out("A", "Area", "area", a * b, { primary: true }), out("C", "Perimeter", "length", 2 * (a + b)), out("d", "Diagonal", "length", Math.hypot(a, b))] };
        case "triangle": return { results: [out("A", "Area", "area", (a * b) / 2, { primary: true })] };
        case "ellipse": {
          const x = a / 2, y = b / 2, hh = ((x - y) / (x + y)) ** 2;
          return { results: [out("A", "Area", "area", P * x * y, { primary: true }), out("C", "Perimeter (Ramanujan)", "length", P * (x + y) * (1 + (3 * hh) / (10 + Math.sqrt(4 - 3 * hh))))] };
        }
        case "annulus": return { results: [out("A", "Area", "area", (P * (a * a - c * c)) / 4, { primary: true })], warnings: c >= a ? ["The inner diameter must be smaller than the outer."] : [] };
        case "cylinder": return { results: [out("V", "Volume", "volume", P * r * r * b, { primary: true }), out("S", "Surface area", "area", 2 * P * r * (r + b)), out("Sl", "Side area", "area", 2 * P * r * b)] };
        case "sphere": return { results: [out("V", "Volume", "volume", (4 / 3) * P * r ** 3, { primary: true }), out("S", "Surface area", "area", 4 * P * r * r)] };
        case "cone": {
          const s = Math.hypot(r, b);
          return { results: [out("V", "Volume", "volume", (P * r * r * b) / 3, { primary: true }), out("S", "Surface area", "area", P * r * (r + s)), out("s", "Slant height", "length", s)] };
        }
        case "box": return { results: [out("V", "Volume", "volume", a * b * c, { primary: true }), out("S", "Surface area", "area", 2 * (a * b + b * c + a * c)), out("d", "Space diagonal", "length", Math.hypot(a, b, c))] };
        case "pyramid": {
          const slant = Math.hypot(a / 2, b);
          return { results: [out("V", "Volume", "volume", (a * a * b) / 3, { primary: true }), out("S", "Surface area", "area", a * a + 2 * a * slant)] };
        }
        default: return { results: [] };
      }
    },
    formula: ["Circle: A = π d² / 4", "Sphere: V = π d³ / 6", "Cone: V = π r² h / 3", "Ellipse perimeter ≈ π (a + b)(1 + 3h / (10 + √(4 − 3h)))"],
    about: "The everyday formulas in one place. For a cone or pyramid, the second value is the vertical height.",
    related: ["tank-volume"],
  },
  {
    id: "slope",
    cat: "geo",
    name: "Slope, grade and angle",
    blurb: "Convert rise and run into percent grade, angle, ratio and length.",
    keywords: "slope grade percent angle pitch ramp rise run roof",
    inputs: [num("rise", "Rise", "length", 1, {}), num("run", "Run", "length", 12, { min: 0 })],
    compute: ({ rise, run }) => {
      const ang = Math.atan2(rise, run);
      return {
        results: [
          out("pct", "Grade", "percent", rise / run, { primary: true }),
          out("ang", "Angle", "angle", ang),
          say("ratio", "Ratio", `1 : ${(run / rise).toFixed(2)}`),
          say("pitch", "Roof pitch", `${((rise / run) * 12).toFixed(2)} in 12`),
          out("len", "Sloped length", "length", Math.hypot(rise, run)),
        ],
      };
    },
    formula: ["grade = rise / run × 100%", "angle = atan(rise / run)", "length = √(rise² + run²)"],
    about: "The same slope written five ways. Accessible ramps in the US are limited to 1:12 (8.33%); drain pipes are usually laid at 1–2%.",
    related: ["shapes"],
  },
  {
    id: "interpolate",
    cat: "geo",
    name: "Linear interpolation",
    blurb: "Read between two rows of a table.",
    keywords: "interpolation linear table lookup between values",
    inputs: [
      num("x1", "x₁", "none", 20),
      num("y1", "y₁", "none", 998.21),
      num("x2", "x₂", "none", 30),
      num("y2", "y₂", "none", 995.65),
      num("x", "x", "none", 24),
    ],
    compute: ({ x1, y1, x2, y2, x }) => ({
      results: [out("y", "y", "none", y1 + ((x - x1) * (y2 - y1)) / (x2 - x1), { primary: true })],
      warnings: x < Math.min(x1, x2) || x > Math.max(x1, x2) ? ["x is outside the two points, so this is extrapolation. Treat it with care."] : [],
    }),
    formula: ["y = y₁ + (x − x₁)(y₂ − y₁) / (x₂ − x₁)"],
    about: "The everyday way to read a property table between two listed rows. The example finds the density of water at 24 °C from the 20 °C and 30 °C rows.",
    related: [],
  },
];
