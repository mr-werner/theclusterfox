// Shared pieces for solvers: step records, results, number formatting.

import { Frac, extractRoot, fmtNum, gcd } from "../engine/frac.js";
import { num } from "../engine/expr.js";
import { tex } from "../engine/tex.js";

export const S = (text, texStr, work) => ({ text, tex: texStr, work });

export const ft = f => tex(num(f)); // Frac -> TeX

export function result(r) {
  return {
    topic: r.topic,
    problem: r.problem,
    answers: r.answers ?? [],
    approx: r.approx ?? [],
    methods: r.methods ?? [],
    graph: r.graph ?? null,
    numberLine: r.numberLine ?? null,
    notes: r.notes ?? [],
    table: r.table ?? null,
    stats: r.stats ?? null,
  };
}

export const flipRel = rel => ({ "<": ">", ">": "<", "<=": ">=", ">=": "<=" })[rel] ?? rel;

// ±-pair of roots (-b ± √disc) / (2a), all integers, as tidy TeX.
export function radicalRoots(b, disc, a) {
  const imag = disc < 0;
  const { outside: k, inside: m } = extractRoot(Math.abs(disc), 2);
  let P = -b;
  let Q = k;
  let D = 2 * a;
  const g = gcd(gcd(P, Q), D) || 1;
  P /= g;
  Q /= g;
  D /= g;
  if (D < 0) {
    P = -P;
    D = -D;
  }
  if (m === 1 && !imag) {
    const r1 = new Frac(P - Q, D);
    const r2 = new Frac(P + Q, D);
    return { rational: true, roots: [r1, r2] };
  }
  const rad = `${Q === 1 ? "" : Q}${m === 1 ? "" : `\\sqrt{${m}}`}${imag ? (m === 1 ? "i" : "\\,i") : ""}` || "1";
  const one = sign => {
    const top = P === 0 ? `${sign === "-" ? "-" : ""}${rad}` : `${P} ${sign} ${rad}`;
    return D === 1 ? top : `\\frac{${top}}{${D}}`;
  };
  const pmTop = P === 0 ? `\\pm ${rad}` : `${P} \\pm ${rad}`;
  const s = Math.sqrt(Math.abs(disc));
  return {
    rational: false,
    imag,
    pm: D === 1 ? pmTop : `\\frac{${pmTop}}{${D}}`,
    texMinus: one("-"),
    texPlus: one("+"),
    values: imag ? [] : [(-b - s) / (2 * a), (-b + s) / (2 * a)].sort((x, y) => x - y),
    re: -b / (2 * a),
    im: s / (2 * Math.abs(a)),
    k,
    m,
    g,
  };
}

export const dec = v => fmtNum(v, 8);
