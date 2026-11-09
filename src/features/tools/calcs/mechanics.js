import { num, choice, preset, out, text } from "./define.js";
import { G } from "../model/units.js";
import { solveBeam, section, solveFreeBeam, parseBeamModel } from "../model/structures.js";
import { MATERIALS } from "../data/materials.js";
import { BOLT_SIZES, BOLT_GRADES, NUT_FACTORS } from "../data/electrical.js";

const SECTION_SHAPES = [
  { value: "rect", label: "Solid rectangle" },
  { value: "round", label: "Solid round" },
  { value: "tube", label: "Round tube" },
  { value: "rhs", label: "Rectangular tube" },
  { value: "ibeam", label: "I-beam" },
  { value: "tee", label: "Tee" },
  { value: "channel", label: "Channel" },
  { value: "angle", label: "Angle" },
  { value: "triangle", label: "Triangle" },
  { value: "hex", label: "Hex bar" },
];
const has = (v, ...shapes) => shapes.includes(v.shape);

const metalPresets = (fields) =>
  MATERIALS.filter((m) => fields.every((f) => m[f] != null)).map((m) => ({ label: m.name, set: Object.fromEntries(fields.map((f) => [f, m[f]])) }));

export const mechanics = [
  {
    id: "beam",
    cat: "mech",
    name: "Beam deflection, shear and moment",
    blurb: "Simply supported, cantilever and fixed beams with live diagrams.",
    keywords: "beam deflection bending moment shear diagram cantilever simply supported fixed point load uniform load",
    inputs: [
      choice("support", "Supports", [{ value: "ss", label: "Simply supported" }, { value: "cant", label: "Cantilever" }, { value: "fixed", label: "Fixed both ends" }]),
      choice("load", "Load", [{ value: "point", label: "Point load" }, { value: "udl", label: "Uniform load" }]),
      num("L", "Span", "length", 4, { min: 0 }),
      num("P", "Point load", "force", 10000, { when: (v) => v.load === "point" }),
      num("a", "Load distance from left end", "length", 2, { min: 0, when: (v) => v.load === "point" }),
      num("w", "Uniform load", "linearLoad", 5000, { when: (v) => v.load === "udl" }),
      preset("mat", "Material", metalPresets(["E"])),
      num("E", "Young's modulus", "modulus", 200e9, { min: 0 }),
      num("I", "Moment of inertia", "inertia", 8.69e-6, { min: 0, hint: "Defaults are an IPE 160 steel beam. Use the section properties tool for your own shape." }),
      num("S", "Section modulus (for stress, optional)", "sectionModulus", 1.09e-4, { min: 0 }),
    ],
    compute: (v) => {
      if (v.load === "point" && v.a > v.L) return { results: [], warnings: ["The load must sit on the beam: its distance has to be less than the span."] };
      const r = solveBeam(v);
      const results = [
        out("y", "Maximum deflection", "smallLength", Math.abs(r.maxY), { primary: true }),
        out("ratio", "Span / deflection", "none", v.L / Math.abs(r.maxY)),
        out("M", "Maximum bending moment", "moment", Math.abs(r.maxM)),
        out("V", "Maximum shear", "force", Math.abs(r.maxV)),
        out("RA", "Left reaction", "force", r.RA),
        out("RB", "Right reaction", "force", r.RB),
      ];
      if (r.MA) results.push(out("MA", "Fixed-end moment (left)", "moment", Math.abs(r.MA)));
      if (v.S > 0) results.push(out("sigma", "Maximum bending stress", "stress", Math.abs(r.maxM) / v.S));
      results.push(out("xY", "Max deflection at", "length", r.xMaxY));
      const warnings = [];
      const ratio = v.L / Math.abs(r.maxY);
      if (ratio < 360 && v.support !== "cant") warnings.push(`Deflection is L/${Math.round(ratio)}. Floors are usually limited to L/360 for live load and L/240 for total load.`);
      return { results, warnings, visual: { type: "beam", ...r, support: v.support, load: v.load, L: v.L, a: v.a } };
    },
    formula: ["Simply supported, center load: δ = P L³ / 48 E I,  M = P L / 4", "Simply supported, uniform: δ = 5 w L⁴ / 384 E I,  M = w L² / 8", "Cantilever, end load: δ = P L³ / 3 E I,  M = P L", "Cantilever, uniform: δ = w L⁴ / 8 E I,  M = w L² / 2", "σ = M / S"],
    about: "These are the classic Euler–Bernoulli beam results: small deflections, linear elastic material, and the beam's own weight left out (add it as a uniform load if it matters). The diagrams update as you type, so you can see where the beam is working hardest.",
    sources: "Roark's Formulas for Stress and Strain; AISC Steel Construction Manual, beam diagrams and formulas.",
    related: ["beam-builder", "section-properties", "stress-strain"],
  },
  {
    id: "beam-builder",
    cat: "mech",
    name: "Beam builder (any loads and supports)",
    blurb: "Free-form beams: as many supports, point loads, moments and distributed loads as you like.",
    keywords: "beam builder continuous beam multiple supports overhang point loads distributed load moment reactions shear moment diagram indeterminate",
    inputs: [
      num("L", "Beam length", "length", 8, { min: 0 }),
      text("model", "Supports and loads", "pin@0;roller@5;w6000@0-5;P12000@8", { hidden: true }),
      preset("mat", "Material", metalPresets(["E"])),
      num("E", "Young's modulus", "modulus", 200e9, { min: 0 }),
      num("I", "Moment of inertia", "inertia", 2.77e-5, { min: 0, hint: "Default is an IPE 220 steel beam. Use the section properties tool for your own shape." }),
      num("S", "Section modulus (for stress, optional)", "sectionModulus", 2.52e-4, { min: 0 }),
    ],
    compute: (v) => {
      const items = parseBeamModel(v.model);
      const r = solveFreeBeam({ L: v.L, E: v.E, I: v.I, items });
      if (r.error) return { results: [], warnings: [r.error], visual: { type: "beam", free: true, items, L: v.L } };
      const Mabs = Math.max(r.maxM, -r.minM);
      const results = [
        out("y", "Maximum deflection", "smallLength", Math.abs(r.maxY), { primary: true }),
        out("xY", "Max deflection at", "length", r.xMaxY),
        out("Mpos", "Largest sagging moment (+)", "moment", r.maxM),
        out("Mneg", "Largest hogging moment (−)", "moment", -r.minM),
        out("V", "Maximum shear", "force", Math.abs(r.maxV)),
      ];
      if (v.S > 0) results.push(out("sigma", "Maximum bending stress", "stress", Mabs / v.S));
      const seen = new Set();
      const sorted = r.reactions.map((s, i) => ({ ...s, i })).sort((p, q) => p.x - q.x);
      let n = 0;
      for (const s of sorted) {
        const key = s.x.toPrecision(9);
        if (seen.has(key)) continue;
        seen.add(key);
        n += 1;
        results.push(out(`R${n}`, `Reaction ${n} (${s.kind})`, "force", s.R));
        if (s.kind === "fixed") results.push(out(`MR${n}`, `Fixed-end moment ${n}`, "moment", Math.abs(s.M)));
      }
      results.push(out("total", "Total load", "force", r.totalLoad));
      const warnings = [];
      if (items.some((it) => (it.x ?? 0) > v.L || (it.x2 ?? 0) > v.L)) warnings.push("Some items sit past the end of the beam; they're treated as being at the end.");
      return { results, warnings, visual: { type: "beam", free: true, items, ...r, L: v.L } };
    },
    formula: ["K u = F   (stiffness method, Euler–Bernoulli beam elements)", "V(x) = Σ forces left of x", "M(x) = Σ (force × lever arm) + Σ couples left of x", "σ = M / S"],
    about: "Build any straight beam: continuous spans, overhangs, propped cantilevers, partial and sloped distributed loads, and applied moments. Beams with more supports than statics alone can solve (statically indeterminate) are handled by the stiffness method, the same way frame-analysis programs do it. Pins and rollers both stop the beam moving up or down; a fixed support also stops it rotating. Loads are positive downward and moments positive clockwise. Sagging moment (smile shape) is positive.",
    sources: "Hibbeler, Structural Analysis; Przemieniecki, Theory of Matrix Structural Analysis.",
    related: ["beam", "section-properties"],
  },
  {
    id: "section-properties",
    cat: "mech",
    name: "Section properties",
    blurb: "Area, moment of inertia, section modulus and radius of gyration of common shapes.",
    keywords: "section properties moment of inertia second moment area section modulus radius of gyration i beam tube tee channel angle triangle hex bar centroid principal",
    inputs: [
      choice("shape", "Shape", SECTION_SHAPES),
      num("b", "Width b", "smallLength", 0.05, { min: 0, when: (v) => has(v, "rect", "ibeam", "tee", "channel", "angle", "triangle") }),
      num("h", "Height h", "smallLength", 0.1, { min: 0, when: (v) => has(v, "rect", "ibeam", "tee", "channel", "angle", "triangle") }),
      num("D", "Outside diameter", "smallLength", 0.06, { min: 0, when: (v) => has(v, "round", "tube") }),
      num("B", "Width B", "smallLength", 0.1, { min: 0, when: (v) => has(v, "rhs") }),
      num("H", "Height H", "smallLength", 0.15, { min: 0, when: (v) => has(v, "rhs") }),
      num("s", "Width across flats", "smallLength", 0.03, { min: 0, when: (v) => has(v, "hex") }),
      num("t", "Wall thickness", "smallLength", 0.005, { min: 0, when: (v) => has(v, "tube", "rhs", "angle") }),
      num("tf", "Flange thickness", "smallLength", 0.008, { min: 0, when: (v) => has(v, "ibeam", "tee", "channel") }),
      num("tw", "Web thickness", "smallLength", 0.005, { min: 0, when: (v) => has(v, "ibeam", "tee", "channel") }),
      preset("mat", "Material (for weight)", MATERIALS.map((m) => ({ label: m.name, set: { rho: m.rho } }))),
      num("rho", "Density", "density", 7850, { min: 0 }),
    ],
    compute: (v) => {
      const s = section(v.shape, v);
      if (!s || !(s.A > 0)) return { results: [], warnings: ["Check the dimensions: walls and flanges must be thinner than the shape they belong to."] };
      const results = [
        out("Ix", "Moment of inertia I (x axis)", "inertia", s.Ix, { primary: true }),
        out("Sx", "Section modulus S (x axis)", "sectionModulus", s.Sx),
        out("A", "Area", "smallArea", s.A),
        out("Iy", "Moment of inertia I (y axis)", "inertia", s.Iy),
        out("Sy", "Section modulus S (y axis)", "sectionModulus", s.Sy),
        out("rx", "Radius of gyration r (x axis)", "smallLength", s.rx),
        out("ry", "Radius of gyration r (y axis)", "smallLength", s.ry),
      ];
      if (s.Imin < Math.min(s.Ix, s.Iy) * 0.999) {
        results.push(out("Imin", "Least moment of inertia (principal axis)", "inertia", s.Imin));
        results.push(out("rmin", "Least radius of gyration", "smallLength", Math.sqrt(s.Imin / s.A)));
      }
      if (s.yc !== undefined && v.shape !== "triangle") results.push(out("yc", "Centroid from bottom", "smallLength", s.yc));
      if (v.shape === "triangle") results.push(out("yc", "Centroid from base", "smallLength", s.yc));
      if (s.xc !== undefined && Math.abs(s.xc - (v.b || 0) / 2) > 1e-12) results.push(out("xc", "Centroid from left", "smallLength", s.xc));
      results.push(out("J", "Torsion constant J", "inertia", s.J));
      results.push(out("wt", "Weight per length", "linearMass", s.A * v.rho));
      return { results, visual: { type: "section", shape: v.shape, dims: v, props: s } };
    },
    formula: ["Rectangle: I = b h³ / 12", "Round: I = π D⁴ / 64,  J = π D⁴ / 32", "Built-up shapes: I = Σ (I₀ + A d²)   (parallel axis)", "S = I / c   (c = distance to extreme fibre)", "r = √(I / A)", "I_min = (Iₓ + I_y)/2 − √(((Iₓ − I_y)/2)² + Iₓᵧ²)"],
    about: "The moment of inertia measures how well a shape resists bending: material far from the center counts most, which is why I-beams and tubes are efficient. The section modulus turns a bending moment into a stress; for shapes that aren't symmetric (tee, channel, angle, triangle) it uses the fibre farthest from the centroid, which gives the larger stress. Angles bend most easily about a tilted principal axis, so their least moment of inertia is lower than both Iₓ and I_y; use it for buckling. Corners are taken as sharp, so rolled shapes with root fillets come out slightly lighter than the catalogue.",
    related: ["beam", "buckling"],
  },
  {
    id: "stress-strain",
    cat: "mech",
    name: "Axial stress and stretch",
    blurb: "Stress, strain, elongation and safety factor of a rod in tension or compression.",
    keywords: "stress strain elongation hooke tension compression factor of safety rod",
    inputs: [
      num("F", "Axial force", "force", 20000),
      num("A", "Cross-section area", "smallArea", 1e-4, { min: 0 }),
      num("L", "Length", "length", 1, { min: 0 }),
      preset("mat", "Material", metalPresets(["E", "Sy"])),
      num("E", "Young's modulus", "modulus", 200e9, { min: 0 }),
      num("Sy", "Yield strength", "stress", 250e6, { min: 0 }),
    ],
    compute: ({ F, A, L, E, Sy }) => {
      const s = F / A;
      return {
        results: [
          out("s", "Stress", "stress", s, { primary: true }),
          out("dL", "Change in length", "smallLength", (s / E) * L),
          out("e", "Strain", "none", s / E),
          out("fos", "Factor of safety on yield", "none", Sy / Math.abs(s)),
          out("k", "Axial stiffness EA/L", "springRate", (E * A) / L),
        ],
        warnings: Math.abs(s) > Sy ? ["The stress is above yield: the part will bend or stretch permanently."] : [],
      };
    },
    formula: ["σ = F / A", "ε = σ / E", "δ = F L / (A E)", "FoS = S_y / σ"],
    about: "Hooke's law for a straight bar: stress is force over area and the bar stretches in proportion to the stress until it yields. Slender bars in compression can buckle well before they yield; check that too.",
    related: ["buckling", "thermal-expansion"],
  },
  {
    id: "buckling",
    cat: "mech",
    name: "Column buckling (Euler)",
    blurb: "Critical load at which a slender column bows sideways.",
    keywords: "euler buckling column critical load slenderness effective length",
    inputs: [
      choice("ends", "End conditions", [
        { value: "1", label: "Pinned – pinned (K = 1.0)" },
        { value: "2", label: "Fixed – free (K = 2.0)" },
        { value: "0.7", label: "Fixed – pinned (K = 0.7)" },
        { value: "0.5", label: "Fixed – fixed (K = 0.5)" },
      ]),
      num("L", "Column length", "length", 3, { min: 0 }),
      preset("mat", "Material", metalPresets(["E"])),
      num("E", "Young's modulus", "modulus", 200e9, { min: 0 }),
      num("I", "Least moment of inertia", "inertia", 1e-6, { min: 0 }),
      num("A", "Cross-section area", "smallArea", 1e-3, { min: 0 }),
    ],
    compute: ({ ends, L, E, I, A }) => {
      const K = Number(ends);
      const Le = K * L;
      const P = (Math.PI ** 2 * E * I) / Le ** 2;
      const r = Math.sqrt(I / A);
      return {
        results: [
          out("P", "Critical buckling load", "force", P, { primary: true }),
          out("s", "Critical stress", "stress", P / A),
          out("lam", "Slenderness ratio KL/r", "none", Le / r),
          out("Le", "Effective length", "length", Le),
        ],
        warnings: ["Euler's formula only holds for slender columns, where the critical stress is well below yield. Stocky columns fail by crushing first; use Johnson's parabola or a design code there."],
      };
    },
    formula: ["P_cr = π² E I / (K L)²", "σ_cr = P_cr / A", "λ = K L / r"],
    about: "A perfectly straight, elastic column stays straight until the load reaches Euler's critical value, then bows out. Fixing the ends shortens the effective length and raises the load. Real columns have imperfections, so codes apply generous factors.",
    related: ["section-properties", "stress-strain"],
  },
  {
    id: "torque-power",
    cat: "mech",
    name: "Torque, power and shaft size",
    blurb: "Convert between power, speed and torque, and size a solid shaft.",
    keywords: "torque power rpm horsepower shaft diameter motor",
    inputs: [
      num("P", "Power", "power", 7500, { min: 0 }),
      num("n", "Speed", "rotation", 1750 / 60, { min: 0 }),
      num("tau", "Allowable shear stress (for shaft size)", "stress", 40e6, { min: 0 }),
    ],
    compute: ({ P, n, tau }) => {
      const T = P / (2 * Math.PI * n);
      return {
        results: [
          out("T", "Torque", "torque", T, { primary: true }),
          out("d", "Minimum solid shaft diameter", "smallLength", Math.cbrt((16 * T) / (Math.PI * tau))),
          out("w", "Angular speed", "frequency", n, { unit: "rad/s" }),
        ],
      };
    },
    formula: ["T = P / ω = P / (2π n)", "d = ∛( 16 T / (π τ_allow) )"],
    about: "Power is torque times angular speed, so the same motor gives more torque at lower speed. The shaft size is from pure torsion only; shafts with bending loads from belts or gears need a combined-stress check.",
    related: ["gear-ratio"],
  },
  {
    id: "gear-ratio",
    cat: "mech",
    name: "Gear and pulley ratio",
    blurb: "Output speed and torque through a gear pair or belt drive.",
    keywords: "gear ratio pulley belt sprocket speed reduction torque teeth",
    inputs: [
      num("N1", "Driver teeth (or pulley diameter)", "none", 20, { min: 0 }),
      num("N2", "Driven teeth (or pulley diameter)", "none", 60, { min: 0 }),
      num("n1", "Input speed", "rotation", 1750 / 60, { min: 0 }),
      num("T1", "Input torque", "torque", 40),
      num("eta", "Efficiency", "percent", 0.97, { min: 0, max: 1 }),
    ],
    compute: ({ N1, N2, n1, T1, eta }) => {
      const i = N2 / N1;
      return {
        results: [
          out("i", "Ratio (driven : driver)", "none", i, { primary: true }),
          out("n2", "Output speed", "rotation", n1 / i),
          out("T2", "Output torque", "torque", T1 * i * eta),
          out("P", "Power through", "power", T1 * 2 * Math.PI * n1),
        ],
      };
    },
    formula: ["i = N_driven / N_driver", "n₂ = n₁ / i", "T₂ = T₁ · i · η"],
    about: "A small gear driving a big one slows the output and multiplies torque by the same ratio, minus friction losses. Belts and chains work the same way with pulley diameters or sprocket teeth.",
    related: ["torque-power"],
  },
  {
    id: "bolt-torque",
    cat: "mech",
    name: "Bolt tightening torque",
    blurb: "Torque to reach a target preload in metric and inch bolts.",
    keywords: "bolt torque preload clamp load nut factor proof strength fastener",
    inputs: [
      choice("size", "Bolt size", BOLT_SIZES.map((b) => b.label), "M10"),
      choice("grade", "Grade", BOLT_GRADES.map((g) => g.label), "Class 8.8"),
      num("pct", "Target preload (% of proof load)", "percent", 0.75, { min: 0, max: 1 }),
      preset("cond", "Thread condition", NUT_FACTORS.map((n) => ({ label: n.label, set: { K: n.K } }))),
      num("K", "Nut factor K", "none", 0.2, { min: 0 }),
    ],
    compute: ({ size, grade, pct, K }) => {
      const b = BOLT_SIZES.find((x) => x.label === size);
      const g = BOLT_GRADES.find((x) => x.label === grade);
      const proof = g.proofSmall && b.d <= 0.016 ? g.proofSmall : g.proof;
      const Fp = proof * b.As;
      const F = pct * Fp;
      const warnings = [];
      if (b.metric !== g.metric) warnings.push("Mixing a metric bolt with an SAE grade (or the reverse) is unusual; check the grade marking.");
      return {
        results: [
          out("T", "Tightening torque", "torque", K * F * b.d, { primary: true }),
          out("F", "Preload (clamp force)", "force", F),
          out("Fp", "Proof load", "force", Fp),
          out("As", "Tensile stress area", "smallArea", b.As),
        ],
        warnings,
      };
    },
    formula: ["F_proof = S_proof · A_s", "F_i = (0.75) · F_proof", "T = K · F_i · d"],
    about: "Most of the torque you apply goes into thread and under-head friction, so the nut factor K matters as much as the torque itself: lubricated threads reach the same clamp force with about 25% less torque. 75% of proof load is the usual target for reusable joints.",
    sources: "Shigley's Mechanical Engineering Design; ISO 898-1; SAE J429.",
    related: ["stress-strain"],
  },
  {
    id: "spring",
    cat: "mech",
    name: "Coil spring rate",
    blurb: "Stiffness and stress of a helical compression spring.",
    keywords: "spring rate stiffness helical compression coil wire",
    inputs: [
      num("d", "Wire diameter", "smallLength", 0.002, { min: 0 }),
      num("Dm", "Mean coil diameter", "smallLength", 0.016, { min: 0 }),
      num("Na", "Active coils", "none", 8, { min: 0 }),
      num("Gm", "Shear modulus", "modulus", 79.3e9, { min: 0, hint: "Music wire and spring steel ≈ 79 GPa, stainless ≈ 69 GPa." }),
      num("F", "Load", "force", 20),
    ],
    compute: ({ d, Dm, Na, Gm, F }) => {
      const k = (Gm * d ** 4) / (8 * Dm ** 3 * Na);
      const C = Dm / d;
      const Kw = (4 * C - 1) / (4 * C - 4) + 0.615 / C;
      return {
        results: [
          out("k", "Spring rate", "springRate", k, { primary: true }),
          out("x", "Deflection at load", "smallLength", F / k),
          out("tau", "Shear stress (Wahl corrected)", "stress", (Kw * 8 * F * Dm) / (Math.PI * d ** 3)),
          out("C", "Spring index D/d", "none", C),
        ],
        warnings: C < 4 || C > 12 ? ["Spring index outside 4–12 is hard to manufacture."] : [],
      };
    },
    formula: ["k = G d⁴ / (8 D³ N_a)", "τ = K_w · 8 F D / (π d³)", "K_w = (4C − 1)/(4C − 4) + 0.615 / C"],
    about: "A coil spring is a twisted wire, so its stiffness depends on the wire's shear modulus. Doubling the wire diameter makes it 16 times stiffer; doubling the coil diameter makes it 8 times softer.",
    related: ["stress-strain"],
  },
  {
    id: "energy-motion",
    cat: "mech",
    name: "Kinetic and potential energy",
    blurb: "Energy of a moving or raised mass, and the speed it reaches falling.",
    keywords: "kinetic energy potential energy speed height mass momentum fall",
    inputs: [num("m", "Mass", "mass", 1000, { min: 0 }), num("v", "Speed", "velocity", 50 / 3.6, { min: 0 }), num("h", "Height", "length", 10)],
    compute: ({ m, v, h }) => ({
      results: [
        out("KE", "Kinetic energy", "energy", 0.5 * m * v * v, { primary: true }),
        out("PE", "Potential energy", "energy", m * G * h),
        out("p", "Momentum (kg·m/s)", "none", m * v),
        out("vf", "Speed after falling the height", "velocity", Math.sqrt(Math.max(0, 2 * G * h))),
        out("heq", "Drop height with the same energy as the speed", "length", (v * v) / (2 * G)),
      ],
    }),
    formula: ["KE = ½ m v²", "PE = m g h", "v = √(2 g h)"],
    about: "Kinetic energy grows with the square of speed: a car at 100 km/h carries four times the energy it has at 50 km/h, which is why stopping distances grow so fast.",
    related: ["torque-power"],
  },
];
