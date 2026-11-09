// Inequalities: linear (with the sign flip explained), compound a < u < b,
// and polynomial or rational ones by a sign chart. Others use a numeric sign chart.

import { Frac } from "../engine/frac.js";
import { add, depends, fn1, neg, num, sym } from "../engine/expr.js";
import { eqTex, relTex, tex } from "../engine/tex.js";
import { simplify } from "../engine/simplify.js";
import { degree, integerize, numericRoots, polyFrom, polySub, polyToExpr, rationalRoots } from "../engine/poly.js";
import { findRoots } from "../engine/numeric.js";
import { linearCore, toRational, quadraticMethods } from "./equation.js";
import { S, dec, flipRel, ft, result } from "./common.js";

const F = v => Frac.from(v);

// ---------- interval helpers ----------

// intervals: [{ lo, hi, loTex, hiTex, loIn, hiIn }] with lo/hi numbers (±Infinity allowed)
export function intervalTex(ints) {
  if (!ints.length) return "\\varnothing";
  return ints
    .map(I => {
      if (I.lo === I.hi) return `\\{${I.loTex}\\}`;
      const l = I.lo === -Infinity ? "(-\\infty" : `${I.loIn ? "[" : "("}${I.loTex}`;
      const r = I.hi === Infinity ? "\\infty)" : `${I.hiTex}${I.hiIn ? "]" : ")"}`;
      return `${l}, ${r}`;
    })
    .join(" \\cup ");
}

export function setBuilderTex(ints, v) {
  if (!ints.length) return "\\text{No solution}";
  if (ints.length === 1 && ints[0].lo === -Infinity && ints[0].hi === Infinity) return "\\text{All real numbers}";
  return ints
    .map(I => {
      if (I.lo === I.hi) return `${v} = ${I.loTex}`;
      if (I.lo === -Infinity) return `${v} ${I.hiIn ? "\\le" : "<"} ${I.hiTex}`;
      if (I.hi === Infinity) return `${v} ${I.loIn ? "\\ge" : ">"} ${I.loTex}`;
      return `${I.loTex} ${I.loIn ? "\\le" : "<"} ${v} ${I.hiIn ? "\\le" : "<"} ${I.hiTex}`;
    })
    .join(" \\;\\text{or}\\; ");
}

function fromRel(value, valueTex, rel) {
  const inc = rel.includes("=");
  if (rel.startsWith("<")) return [{ lo: -Infinity, hi: value, hiTex: valueTex, hiIn: inc }];
  return [{ lo: value, hi: Infinity, loTex: valueTex, loIn: inc }];
}

const holds = (y, rel) => ({ "<": y < 0, ">": y > 0, "<=": y <= 0, ">=": y >= 0, "!=": y !== 0 })[rel];

function lineGraph(L, R, v, ints) {
  return {
    v,
    fns: [
      { e: L, label: `y = ${tex(L)}` },
      ...(depends(R, v) || evaluate0(R) !== 0 ? [{ e: R, label: `y = ${tex(R)}` }] : []),
    ],
    points: [],
    shade: ints.map(I => ({ lo: I.lo, hi: I.hi })),
  };
}
const evaluate0 = e => fn1(e, "x")(0);

// ---------- main ----------

export function solveInequality(L, R, rel, v) {
  const problem = eqTex(L, R, rel);
  const pl = polyFrom(L, v);
  const pr = polyFrom(R, v);
  if (pl && pr && degree(polySub(pl, pr)) <= 1) return linearIneq(L, R, rel, v, pl, pr, problem);
  return signChartIneq(L, R, rel, v, problem);
}

function linearIneq(L, R, rel, v, pl, pr, problem) {
  const steps = [];
  const lt = tex(polyToExpr(pl, v));
  const rt = tex(polyToExpr(pr, v));
  if (lt !== tex(L) || rt !== tex(R)) steps.push(S("Simplify each side.", `${lt} ${relTex(rel)} ${rt}`));
  const high = pr.map((c, k) => (k >= 2 ? c : F(0)));
  const core = linearCore(polySub(pl, high), polySub(pr, high), v, rel);
  steps.push(...core.steps);
  let ints;
  if (core.special) ints = core.special === "all" ? [{ lo: -Infinity, hi: Infinity }] : [];
  else ints = fromRel(core.value.valueOf(), ft(core.value), core.rel);
  steps.push(S("Write the answer in interval notation.", intervalTex(ints)));
  return result({
    topic: "Linear inequality",
    problem,
    answers: [setBuilderTex(ints, v), intervalTex(ints)],
    methods: [{ name: "Solve", steps }],
    numberLine: { v, ints },
    graph: lineGraph(L, R, v, ints),
  });
}

// Compound: lo rel1 middle rel2 hi, middle linear in v.
export function solveCompound(parts, rels, v) {
  const problem = parts.map((p, i) => tex(p) + (i < rels.length ? ` ${relTex(rels[i])} ` : "")).join("");
  const [A, M, B] = parts;
  const pm = polyFrom(M, v);
  const pa = polyFrom(A, v);
  const pb = polyFrom(B, v);
  if (!pm || !pa || !pb || degree(pm) !== 1 || degree(pa) > 0 || degree(pb) > 0) {
    // split into two inequalities and intersect numerically
    const r1 = solveInequality(A, M, rels[0], v);
    const r2 = solveInequality(M, B, rels[1], v);
    const ints = intersect(r1.numberLine?.ints ?? [], r2.numberLine?.ints ?? []);
    return result({
      topic: "Compound inequality",
      problem,
      answers: [setBuilderTex(ints, v), intervalTex(ints)],
      methods: [
        { name: "Solve", steps: [S("Split into two inequalities and solve each.", null), ...r1.methods.flatMap(m => m.steps), ...r2.methods.flatMap(m => m.steps), S("Keep the values that satisfy both.", intervalTex(ints))] },
      ],
      numberLine: { v, ints },
    });
  }
  let a = pa[0];
  let b = pb[0];
  let c1 = pm[1];
  let c0 = pm[0];
  let [r1, r2] = rels;
  const steps = [];
  const show = () => `${ft(a)} ${relTex(r1)} ${tex(polyToExpr([c0, c1], v))} ${relTex(r2)} ${ft(b)}`;
  if (!c0.isZero()) {
    a = a.sub(c0);
    b = b.sub(c0);
    steps.push(S(`${c0.sign > 0 ? "Subtract" : "Add"} $${ft(c0.abs())}$ ${c0.sign > 0 ? "from" : "to"} all three parts.`, ((c0 = F(0)), show())));
  }
  if (!c1.isOne()) {
    const flips = c1.sign < 0;
    a = a.div(c1);
    b = b.div(c1);
    const d = c1;
    c1 = F(1);
    if (flips) {
      [a, b] = [b, a];
      [r1, r2] = [flipRel(r2), flipRel(r1)];
    }
    steps.push(S(`Divide all three parts by $${ft(d)}$.${flips ? " It's negative, so both inequality signs flip." : ""}`, show()));
  }
  const ints = a.cmp(b) < 0 || (a.eq(b) && r1 === "<=" && r2 === "<=") ? [{ lo: a.valueOf(), hi: b.valueOf(), loTex: ft(a), hiTex: ft(b), loIn: r1 === "<=", hiIn: r2 === "<=" }] : [];
  steps.push(S("In interval notation:", intervalTex(ints)));
  return result({
    topic: "Compound inequality",
    problem,
    answers: [setBuilderTex(ints, v), intervalTex(ints)],
    methods: [{ name: "Solve", steps }],
    numberLine: { v, ints },
  });
}

function intersect(A, B) {
  const out = [];
  for (const a of A)
    for (const b of B) {
      const lo = Math.max(a.lo, b.lo);
      const hi = Math.min(a.hi, b.hi);
      if (lo > hi) continue;
      const loFrom = a.lo > b.lo || (a.lo === b.lo && !a.loIn) ? a : b;
      const hiFrom = a.hi < b.hi || (a.hi === b.hi && !a.hiIn) ? a : b;
      const I = { lo, hi, loTex: loFrom.loTex, hiTex: hiFrom.hiTex, loIn: lo === -Infinity ? false : loFrom.loIn, hiIn: hi === Infinity ? false : hiFrom.hiIn };
      if (lo === hi && !(I.loIn && I.hiIn)) continue;
      out.push(I);
    }
  return out;
}

// ---------- sign chart ----------

function signChartIneq(L, R, rel, v, problem) {
  const steps = [];
  const D = add(L, neg(R));
  const f = fn1(D, v);
  let zeros = []; // {value, tex}
  let poles = [];
  let exact = false;
  const rat = toRational(D, v);
  let movedTex;
  if (rat) {
    exact = true;
    const pn = rat.n;
    const pd = rat.d;
    const numE = polyToExpr(pn, v);
    const denE = polyToExpr(pd, v);
    const isPoly = degree(pd) === 0;
    const shown = isPoly ? polyToExpr(pn.map(c => c.div(pd[0])), v) : null;
    movedTex = isPoly ? `${tex(shown)} ${relTex(rel)} 0` : `\\frac{${tex(numE)}}{${tex(denE)}} ${relTex(rel)} 0`;
    if (movedTex !== problem) steps.push(S(isPoly ? "Move everything to one side so the other side is zero." : "Move everything to one side and combine into a single fraction.", movedTex));
    const rootsOf = p => {
      if (degree(p) < 1) return [];
      const { roots, rest } = rationalRoots(p);
      const out = roots.map(({ r }) => ({ value: r.valueOf(), tex: ft(r) }));
      if (degree(rest) === 2) {
        let [c, b, a] = integerize(rest).ints;
        if (a < 0) [c, b, a] = [-c, -b, -a];
        const q = quadraticMethods(a, b, c, v);
        q.realRoots.forEach(r => out.push(r));
      } else if (degree(rest) > 2) numericRoots(rest).real.forEach(x => out.push({ value: x, tex: dec(x) }));
      return out;
    };
    zeros = rootsOf(pn);
    poles = rootsOf(pd);
  } else {
    zeros = findRoots(f, -100, 100, 8000).map(x => ({ value: x, tex: dec(x) }));
    steps.push(S("Move everything to one side.", `${tex(D)} ${relTex(rel)} 0`));
  }
  zeros = dedupe(zeros);
  poles = dedupe(poles).filter(p => !zeros.some(z => Math.abs(z.value - p.value) < 1e-12) || true);
  const crit = dedupe([...zeros.map(z => ({ ...z, kind: "zero" })), ...poles.map(p => ({ ...p, kind: "pole" }))]).sort((a, b) => a.value - b.value);
  if (crit.length)
    steps.push(
      S(
        `Find the critical points, where the expression is zero${poles.length ? " or undefined" : ""}. They split the number line into intervals.`,
        [zeros.length ? `\\text{zero at } ${zeros.map(z => `${v} = ${z.tex}`).join(", ")}` : "", poles.length ? `\\text{undefined at } ${poles.map(z => `${v} = ${z.tex}`).join(", ")}` : ""].filter(Boolean).join("; \\quad ")
      )
    );
  else steps.push(S("The expression is never zero, so it has the same sign everywhere.", null));

  // test each interval
  const bounds = [-Infinity, ...crit.map(c => c.value), Infinity];
  const segs = [];
  const rows = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const lo = bounds[i];
    const hi = bounds[i + 1];
    const t = testPoint(lo, hi);
    const y = f(t);
    const ok = Number.isFinite(y) && holds(y, rel);
    segs.push({ lo, hi, ok, loC: crit[i - 1 + 0] ?? null });
    rows.push(`${intervalTex([{ lo, hi, loTex: crit[i - 1]?.tex, hiTex: crit[i]?.tex }])}: & ${v} = ${dec(t)} \\Rightarrow ${y > 0 ? "+" : y < 0 ? "-" : "0"} & ${ok ? "\\checkmark" : "\\times"}`);
  }
  steps.push(S("Test one value in each interval to see the sign there.", `\\begin{array}{lll} ${rows.join(" \\\\ ")} \\end{array}`));

  const inclusive = rel.includes("=");
  const ints = [];
  segs.forEach((s, i) => {
    const left = crit[i - 1];
    const right = crit[i];
    if (!s.ok) {
      // an isolated zero can still count for <= / >=
      return;
    }
    const I = {
      lo: s.lo,
      hi: s.hi,
      loTex: left?.tex,
      hiTex: right?.tex,
      loIn: !!left && inclusive && left.kind === "zero",
      hiIn: !!right && inclusive && right.kind === "zero",
    };
    const prev = ints[ints.length - 1];
    if (prev && prev.hi === I.lo && (prev.hiIn || I.loIn)) {
      prev.hi = I.hi;
      prev.hiTex = I.hiTex;
      prev.hiIn = I.hiIn;
    } else ints.push(I);
  });
  if (inclusive)
    zeros.forEach(z => {
      if (!ints.some(I => (I.lo < z.value && z.value < I.hi) || (I.lo === z.value && I.loIn) || (I.hi === z.value && I.hiIn)) && !poles.some(p => Math.abs(p.value - z.value) < 1e-12))
        ints.push({ lo: z.value, hi: z.value, loTex: z.tex, hiTex: z.tex, loIn: true, hiIn: true });
    });
  ints.sort((a, b) => a.lo - b.lo);
  steps.push(
    S(
      inclusive ? "Keep the intervals that work. The zeros are included because of the “or equal to”; points where it's undefined never are." : "Keep the intervals that work. The endpoints are not included.",
      intervalTex(ints)
    )
  );
  return result({
    topic: exact ? (degree(polyFrom(D, v) ?? [F(0), F(0), F(0)]) === 2 ? "Quadratic inequality" : "Inequality") : "Inequality",
    problem,
    answers: [setBuilderTex(ints, v), intervalTex(ints)],
    methods: [{ name: "Sign chart", steps }],
    numberLine: { v, ints },
    graph: { v, fns: [{ e: D, label: `y = ${tex(simplify(D))}` }], points: zeros.map(z => ({ x: z.value, y: 0, label: "zero" })), shade: ints.map(I => ({ lo: I.lo, hi: I.hi })) },
    notes: exact ? [] : ["The critical points were found numerically, so the endpoints are rounded."],
  });
}

function testPoint(lo, hi) {
  if (lo === -Infinity && hi === Infinity) return 0;
  if (lo === -Infinity) return Math.floor(hi) - 1 < hi - 0.5 ? Math.floor(hi - 1) : hi - 1;
  if (hi === Infinity) return Math.ceil(lo + 1);
  const mid = (lo + hi) / 2;
  const r = Math.round(mid);
  return r > lo && r < hi ? r : Number(mid.toPrecision(3)) > lo && Number(mid.toPrecision(3)) < hi ? Number(mid.toPrecision(3)) : mid;
}

function dedupe(list) {
  const out = [];
  for (const x of list.sort((a, b) => a.value - b.value)) if (!out.some(o => Math.abs(o.value - x.value) < 1e-10)) out.push(x);
  return out;
}

export { sym, num };
