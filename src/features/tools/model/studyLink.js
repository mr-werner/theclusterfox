// What Engineer ToolFox shares with StudyFox: the GD&T symbols and lessons,
// the manufacturing processes, and the formulas behind each calculator
// family, with practice problems worked by the calculators themselves.
// StudyFox loads this on demand (see src/app/studyLinks.js) and always
// reads the live definitions, so a fixed formula shows up there too.
import { CATEGORIES, CALCS, calcById } from "../registry.js";
import { BASICS, CALLOUTS, GROUPS } from "../design/gdtModel.js";
import { PROCESSES } from "../design/processes.js";
import { defaultUnit, fmt, fromSI, toSI, unitLabel } from "./units.js";

const CALC_CATS = CATEGORIES.filter(c => c.id !== "design");
const groupName = id => GROUPS.find(g => g.id === id)?.name ?? id;

export function decks() {
  return [
    { id: "gdt", title: "GD&T symbols", blurb: "All 14 geometric tolerance symbols: what each controls, sorted by family.", group: "Design" },
    { id: "gdt-basics", title: "GD&T fundamentals", blurb: "Feature control frames, datums, MMC and bonus, datum shift and hole patterns.", group: "Design" },
    { id: "processes", title: "Manufacturing processes", blurb: "How each process works and what it's good for.", group: "Design" },
    ...CALC_CATS.map(c => ({ id: `calc-${c.id}`, title: `${c.name} formulas`, blurb: `${c.blurb} With practice problems.`, group: "Formulas" })),
  ];
}

export function deck(id) {
  if (id === "gdt") {
    return {
      id,
      title: "GD&T symbols",
      blurb: "Every geometric tolerance symbol in ASME Y14.5-2018.",
      href: "/tools/gdt",
      cards: CALLOUTS.map(c => ({ id: c.id, front: c.name, back: c.summary, group: groupName(c.group), href: `/tools/gdt/${c.id}` })),
      facts: CALLOUTS.flatMap(c => (c.text?.datums ? [{ id: `${c.id}-datums`, text: `${c.name} and datums: ${c.text.datums}` }] : [])),
      diagrams: CALLOUTS.map(c => ({ title: c.name, href: `/tools/gdt/${c.id}`, blurb: "Change the callout and the part, and watch it pass or fail." })),
    };
  }
  if (id === "gdt-basics") {
    return {
      id,
      title: "GD&T fundamentals",
      href: "/tools/gdt",
      cards: [
        ...BASICS.map(b => ({ id: b.id, front: b.name, back: b.summary, href: `/tools/gdt/${b.id}` })),
        ...GROUPS.map(g => ({ id: `group-${g.id}`, front: `${g.name} controls`, back: g.blurb })),
      ],
      diagrams: BASICS.map(b => ({ title: b.name, href: `/tools/gdt/${b.id}`, blurb: b.summary })),
    };
  }
  if (id === "processes") {
    return {
      id,
      title: "Manufacturing processes",
      href: "/tools/make/methods",
      cards: PROCESSES.map(p => ({ id: p.id, front: p.name, back: p.how, group: p.family })),
      facts: PROCESSES.filter(p => p.good).map(p => ({ id: `${p.id}-good`, text: `${p.name} is good for: ${p.good}`, blank: p.name })),
      diagrams: [{ title: "Process finder", href: "/tools/make", blurb: "Describe a part and see which processes can hold its tolerances." }],
    };
  }
  const cat = CALC_CATS.find(c => `calc-${c.id}` === id);
  if (!cat) return null;
  const calcs = CALCS.filter(c => c.cat === cat.id && c.formula?.length);
  const solvable = calcs.filter(c => makeProblem(c, 1));
  return {
    id,
    title: `${cat.name} formulas`,
    blurb: cat.blurb,
    href: `/tools/c/${cat.id}`,
    cards: calcs.map(c => ({ id: c.id, front: c.name, back: `${c.formula.join("\n")}\n\n${c.blurb}`, href: `/tools/calc/${c.id}` })),
    facts: calcs.filter(c => c.about).map(c => ({ id: `${c.id}-about`, text: firstSentence(c.about) })),
    problems: solvable.length ? seed => makeProblem(solvable[seed % solvable.length], seed) : undefined,
    diagrams: calcs.map(c => ({ title: c.name, href: `/tools/calc/${c.id}`, blurb: c.blurb })),
  };
}

function firstSentence(text) {
  const m = /^(.{30,260}?[.!?])(\s|$)/.exec(text);
  return m ? m[1] : text.slice(0, 260);
}

// ── Practice problems: the calculator's own example, with new numbers ──

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round3 = v => (v === 0 ? 0 : Number(v.toPrecision(3)));

/** A worked problem from one calculator, or null when it can't make a clean one. */
export function makeProblem(calc, seed) {
  if (!calc || typeof calc.compute !== "function") return null;
  const r = rng(seed * 7919 + calc.id.length);
  // Inputs a preset fills (like a fluid's density) keep their values so the case stays real.
  const fromPreset = new Set(calc.inputs.filter(i => i.type === "preset").flatMap(i => i.options.flatMap(o => Object.keys(o.set ?? {}))));
  const values = {};
  const givens = [];
  for (const input of calc.inputs) {
    let v = input.value;
    const visible = !input.hidden && (!input.when || input.when({ ...Object.fromEntries(calc.inputs.map(i => [i.id, i.value])), ...values }));
    if (input.type === "num" && Number.isFinite(v)) {
      const unit = defaultUnit(input.dim, "si");
      let shown = fromSI(v, input.dim, unit);
      if (!fromPreset.has(input.id) && shown > 0 && input.dim !== "none") shown = round3(shown * (0.6 + r() * 0.9));
      else shown = round3(shown);
      v = toSI(shown, input.dim, unit);
      if (input.min !== undefined && v < input.min) return null;
      if (input.max !== undefined && v > input.max) return null;
      if (visible) givens.push(`${input.label} = ${fmt(shown)} ${unitLabel(input.dim, unit)}`.trim());
    } else if (input.type === "choice" && visible) {
      givens.push(`${input.label}: ${input.options.find(o => o.value === v)?.label ?? v}`);
    }
    values[input.id] = v;
  }
  let result;
  try {
    result = calc.compute(values) ?? {};
  } catch {
    return null;
  }
  const primary = (result.results ?? []).find(x => x.primary) ?? (result.results ?? [])[0];
  if (!primary || !Number.isFinite(primary.value) || primary.value === 0 || !primary.dim) return null;
  const unit = defaultUnit(primary.dim, "si");
  const answer = fromSI(primary.value, primary.dim, unit);
  if (!Number.isFinite(answer) || Math.abs(answer) > 1e12 || Math.abs(answer) < 1e-9) return null;
  const label = unitLabel(primary.dim, unit);
  return {
    id: `${calc.id}#${seed}`,
    text: `${calc.name}. Given ${givens.join("; ")}. Find the ${primary.label.toLowerCase()}${label ? ` in ${label}` : ""}.`,
    answer,
    unit: label,
    tolerance: 0.02,
    why: `${calc.formula.join("   ")}\n${primary.label} = ${fmt(answer)} ${label}`.trim(),
    href: `/tools/calc/${calc.id}`,
  };
}

export { calcById };
