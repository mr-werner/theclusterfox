// Simplify, expand and factor with steps, plus "tell me about this function"
// (intercepts, vertex, slope, turning points) for graphing.

import { Frac, gcd } from "../engine/frac.js";
import { add, depends, fn1, freeVars, isNum, key, mul, num, pow, sym } from "../engine/expr.js";
import { expand, simplify, splitCoef } from "../engine/simplify.js";
import { tex } from "../engine/tex.js";
import { degree, integerize, numericRoots, polyDiv, polyFrom, polyToExpr, rationalRoots, trim } from "../engine/poly.js";
import { findExtrema, findRoots, recognize } from "../engine/numeric.js";
import { toRational, quadraticMethods } from "./equation.js";
import { S, dec, ft, result } from "./common.js";

const F = v => Frac.from(v);

// ---------- expand ----------

// Multiply out without combining like terms, so the step is visible.
function distributeShown(e) {
  if (e.t === "add") return e.a.flatMap(distributeShown);
  if (e.t === "mul" && e.a.some(f => f.t === "add" || (f.t === "pow" && f.b.t === "add"))) {
    const parts = e.a.flatMap(f => (f.t === "pow" && f.b.t === "add" && isNum(f.e) && f.e.v.isInt() && f.e.v.n >= 2 && f.e.v.n <= 3 ? Array(f.e.v.n).fill(f.b) : [f]));
    let terms = [[]];
    for (const f of parts) {
      const opts = f.t === "add" ? f.a : [f];
      terms = terms.flatMap(t => opts.map(o => [...t, o]));
      if (terms.length > 64) return [e];
    }
    return terms.map(fs => simplify(mul(fs)));
  }
  if (e.t === "pow" && e.b.t === "add" && isNum(e.e) && e.e.v.isInt() && e.e.v.n >= 2 && e.e.v.n <= 3) return distributeShown(mul(Array(e.e.v.n).fill(e.b)));
  return [e];
}

export function expandSteps(e) {
  const steps = [];
  const special = squarePattern(e);
  if (special) steps.push(special);
  const shown = distributeShown(e);
  const shownE = shown.length === 1 ? shown[0] : add(shown);
  const final = expand(e);
  if (!special && tex(shownE) !== tex(e) && tex(shownE) !== tex(final)) steps.push(S("Distribute: multiply each term in one bracket by each term in the other.", tex(shownE)));
  if (tex(final) !== tex(shownE) || !steps.length) steps.push(S(shown.length > 1 ? "Combine like terms." : "Simplify.", tex(final)));
  return { steps, final };
}

function squarePattern(e) {
  if (e.t === "pow" && e.b.t === "add" && e.b.a.length === 2 && isNum(e.e, 2)) {
    const [a, b] = e.b.a;
    const neg = splitCoef(b)[0].sign < 0;
    return S(
      `Use the pattern $(a ${neg ? "-" : "+"} b)^2 = a^2 ${neg ? "-" : "+"} 2ab + b^2$ with $a = ${tex(a)}$ and $b = ${tex(neg ? simplify(mul(num(-1), b)) : b)}$.`,
      `\\left(${tex(a)}\\right)^2 ${neg ? "-" : "+"} 2\\left(${tex(a)}\\right)\\left(${tex(neg ? simplify(mul(num(-1), b)) : b)}\\right) + \\left(${tex(neg ? simplify(mul(num(-1), b)) : b)}\\right)^2`
    );
  }
  if (e.t === "mul" && e.a.length === 2 && e.a.every(f => f.t === "add" && f.a.length === 2)) {
    const [p, q] = e.a;
    if (key(p.a[0]) === key(q.a[0]) && key(simplify(add(p.a[1], q.a[1]))) === "0")
      return S(`This is a difference of squares: $(a + b)(a - b) = a^2 - b^2$.`, `\\left(${tex(p.a[0])}\\right)^2 - \\left(${tex(p.a[1].t === "num" ? num(p.a[1].v.abs()) : p.a[1])}\\right)^2`);
  }
  return null;
}

// ---------- factor ----------

export function factorSteps(e, v) {
  const steps = [];
  const p = v ? polyFrom(e, v) : null;
  if (!p || degree(p) < 1) return factorCommon(e);
  const { ints, scale } = integerize(p);
  let content = scale.inv(); // p = content * ints
  let P = ints;
  if (P[P.length - 1] < 0) {
    P = P.map(c => -c || 0);
    content = content.neg();
  }
  let low = 0;
  while (P[low] === 0) low++;
  const factors = [];
  const pieceE = poly => polyToExpr(poly.map(F), v);
  if (!content.isOne() || low > 0) {
    const g = low > 0 ? (low === 1 ? sym(v) : pow(sym(v), num(low))) : null;
    const lead = content.isOne() ? g : g ? simplify(mul(num(content), g)) : num(content);
    P = P.slice(low);
    steps.push(S(`Factor out the greatest common factor, $${tex(lead)}$.`, `${tex(lead)}\\left(${tex(pieceE(P))}\\right)`));
    factors.push(lead);
  }
  let rest = P.map(F);
  const lin = (a, b) => polyToExpr([F(b), F(a)], v);
  if (degree(rest) === 2) {
    const [c, b, a] = rest.map(x => x.valueOf());
    const disc = b * b - 4 * a * c;
    const r = Math.sqrt(disc);
    if (disc >= 0 && Number.isInteger(r)) {
      const q = quadraticMethods(a, b, c, v);
      const fm = q.methods.find(m => m.name === "Factoring");
      if (b === 0 && c < 0 && Number.isInteger(Math.sqrt(a)) && Number.isInteger(Math.sqrt(-c))) {
        const sa = Math.sqrt(a);
        const sc = Math.sqrt(-c);
        steps.push(S(`This is a difference of squares, $a^2 - b^2 = (a - b)(a + b)$, with $a = ${tex(lin(sa, 0))}$ and $b = ${sc}$.`, `\\left(${tex(lin(sa, -sc))}\\right)\\left(${tex(lin(sa, sc))}\\right)`));
        factors.push(lin(sa, -sc), lin(sa, sc));
      } else if (disc === 0 && Number.isInteger(Math.sqrt(a))) {
        const sa = Math.sqrt(a);
        const sb = b / (2 * sa);
        steps.push(S(`This is a perfect square trinomial: $a^2 + 2ab + b^2 = (a + b)^2$.`, tex(pow(lin(sa, sb), num(2)))));
        factors.push(pow(lin(sa, sb), num(2)));
      } else if (fm) {
        // reuse the factoring steps up to the factored form
        const idx = fm.steps.findIndex(s => /Factor out the shared|Write the factored form/.test(s.text));
        fm.steps.slice(0, idx + 1).forEach(s => steps.push({ ...s, tex: s.tex.replace(/ = 0$/, "") }));
        const roots = [(-b - r) / (2 * a), (-b + r) / (2 * a)].map(x => new Frac(Math.round(x * 2 * a), 2 * a));
        const fs = roots.map(rt => lin(rt.d, -rt.n));
        // fix up leading constant
        const k = a / (roots[0].d * roots[1].d);
        if (k !== 1) factors.push(num(k));
        factors.push(...fs);
      }
      rest = null;
    } else {
      steps.push(S(disc < 0 ? "The discriminant is negative, so this quadratic can't be factored over the real numbers." : `The discriminant $${disc}$ isn't a perfect square, so this doesn't factor with whole numbers.`, tex(pieceE(rest.map(x => x.valueOf())))));
    }
  } else if (degree(rest) >= 3) {
    const { roots } = rationalRoots(rest);
    let cur = rest;
    const prefix = () => factors.map(f => (f.t === "add" ? `\\left(${tex(f)}\\right)` : tex(f))).join("");
    outer: for (const { r, mult } of roots)
      for (let m = 0; m < mult; m++) {
        if (degree(cur) <= 2) break outer;
        const { q } = polyDiv(cur, [r.neg(), F(1)]);
        const f = lin(r.d, -r.n);
        const nq = r.isInt() ? q : q.map(c => c.div(r.d));
        steps.push(S(`Try $${v} = ${ft(r)}$: it makes the polynomial zero, so $\\left(${tex(f)}\\right)$ is a factor. Divide it out.`, `${prefix()}\\left(${tex(f)}\\right)\\left(${tex(polyToExpr(nq, v))}\\right)`));
        factors.push(f);
        cur = nq;
      }
    rest = trim(cur);
    if (degree(rest) === 2) {
      const sub = factorSteps(polyToExpr(rest, v), v);
      const pre = prefix();
      steps.push(...sub.steps.map(st => ({ ...st, tex: st.tex && pre && !/=|\\times/.test(st.tex) ? `${pre}${/^\\left\(/.test(st.tex) || !/[+-]/.test(st.tex.replace(/^-/, "")) ? st.tex : `\\left(${st.tex}\\right)`}` : st.tex })));
      factors.push(...(sub.factors ?? [sub.final]));
      rest = null;
    } else if (!roots.length) steps.push(S("No rational number makes this zero, so it has no linear factors with whole-number coefficients.", tex(polyToExpr(rest, v))));
  }
  if (rest && degree(rest) >= 1) factors.push(polyToExpr(rest, v));
  const final = combineFactors(factors);
  if (steps.length && tex(final) !== steps[steps.length - 1].tex) steps.push(S("Put it all together.", tex(final)));
  if (!steps.length) steps.push(S("There's nothing to factor out; it's already as factored as it gets.", tex(final)));
  return { steps, final, factors };
}

function combineFactors(fs) {
  // merge repeated factors into powers
  const out = [];
  for (const f of fs) {
    const hit = out.find(o => key(o.f) === key(f));
    if (hit) hit.k++;
    else out.push({ f, k: 1 });
  }
  const parts = out.map(({ f, k }) => (k === 1 ? f : pow(f, num(k))));
  if (parts.length === 1) return parts[0];
  return mul(parts);
}

function factorCommon(e) {
  const s = expand(e);
  const terms = s.t === "add" ? s.a : [s];
  if (terms.length < 2) return { steps: [S("There's nothing to factor.", tex(s))], final: s };
  // numeric gcd and shared variables with lowest powers
  let g = 0;
  for (const t of terms) g = gcd(g, Math.abs(splitCoef(t)[0].n));
  const vars = [...freeVars(s)];
  const common = [];
  for (const v of vars) {
    const powers = terms.map(t => varPower(t, v));
    const m = Math.min(...powers);
    if (m > 0) common.push(m === 1 ? sym(v) : pow(sym(v), num(m)));
  }
  const lead = simplify(mul(num(g || 1), ...common));
  if (isNum(lead, 1)) return { steps: [S("The terms share no common factor.", tex(s))], final: s };
  const inner = simplify(add(terms.map(t => simplify(mul(t, pow(lead, num(-1)))))));
  const final = mul(lead, inner);
  return { steps: [S(`Each term shares a factor of $${tex(lead)}$. Factor it out.`, tex(final))], final };
}

function varPower(t, v) {
  if (t.t === "sym") return t.n === v ? 1 : 0;
  if (t.t === "pow" && t.b.t === "sym" && t.b.n === v && isNum(t.e) && t.e.v.isInt()) return t.e.v.n;
  if (t.t === "mul") return t.a.reduce((s, f) => s + varPower(f, v), 0);
  return 0;
}

// ---------- simplify ----------

export function simplifySteps(e, v) {
  const steps = [];
  // rational function in one variable: factor and cancel
  if (v && freeVars(e).size === 1) {
    const rat = toRational(e, v);
    const hasDen = JSON.stringify(e).includes('"v":{"n":-');
    if (rat && degree(rat.d) >= 1 && hasDen) {
      const N = rat.n;
      const D = rat.d;
      const nf = factorSteps(polyToExpr(N, v), v).final;
      const df = factorSteps(polyToExpr(D, v), v).final;
      const tN = tex(polyToExpr(N, v));
      const tD = tex(polyToExpr(D, v));
      if (`\\frac{${tN}}{${tD}}` !== tex(e)) steps.push(S("Combine into a single fraction.", `\\frac{${tN}}{${tD}}`));
      steps.push(S("Factor the top and the bottom.", `\\frac{${tex(nf)}}{${tex(df)}}`));
      // cancel via polynomial gcd
      const { roots: rn } = rationalRoots(N);
      const { roots: rd } = rationalRoots(D);
      const common = rn.filter(a => rd.some(b => b.r.eq(a.r)));
      if (common.length) {
        let n2 = N;
        let d2 = D;
        const cancelled = [];
        for (const { r } of common) {
          const k = Math.min(rn.find(x => x.r.eq(r)).mult, rd.find(x => x.r.eq(r)).mult);
          for (let i = 0; i < k; i++) {
            n2 = polyDiv(n2, [r.neg(), F(1)]).q;
            d2 = polyDiv(d2, [r.neg(), F(1)]).q;
          }
          cancelled.push(r);
        }
        const res = simplify(mul(polyToExpr(n2, v), pow(polyToExpr(d2, v), num(-1))));
        const nice = degree(d2) === 0 ? polyToExpr(n2.map(c => c.div(d2[0])), v) : res;
        steps.push(
          S(
            `Cancel the common factor${cancelled.length > 1 ? "s" : ""} ${cancelled.map(r => `$\\left(${tex(polyToExpr([r.neg(), F(1)], v))}\\right)$`).join(", ")}.`,
            tex(nice)
          )
        );
        return { steps, final: nice, notes: [`This matches the original for every $${v}$ except ${cancelled.map(r => `$${v} = ${ft(r)}$`).join(", ")}, where the original is undefined.`] };
      }
      const combined = simplify(mul(polyToExpr(N, v), pow(polyToExpr(D, v), num(-1))));
      steps.push(S("The top and bottom share no factors, so nothing cancels.", tex(combined)));
      return { steps, final: combined, notes: [] };
    }
  }
  const s = simplify(e);
  let x;
  try {
    x = expand(e);
  } catch {
    x = s;
  }
  const isPoly = v ? !!polyFrom(e, v) : false;
  if (isPoly || (tex(x).length < tex(s).length && JSON.stringify(x).length < JSON.stringify(s).length * 1.2)) {
    const ex = expandSteps(e);
    return { steps: ex.steps, final: ex.final, notes: [] };
  }
  if (tex(s) !== tex(e)) steps.push(S("Combine like terms and simplify.", tex(s)));
  return { steps, final: s, notes: [] };
}

// ---------- function facts for graphing ----------

export function analyzeFunction(f0, v) {
  const facts = [];
  const points = [];
  const fx = fn1(f0, v);
  const p = polyFrom(f0, v);
  const y0 = fx(0);
  if (Number.isFinite(y0)) {
    const e = simplify(f0.t ? substituteZero(f0, v) : f0);
    facts.push({ label: "y-intercept", tex: `(0, ${e.t === "num" ? tex(e) : dec(y0)})` });
    points.push({ x: 0, y: y0, label: "y-intercept" });
  }
  let roots = [];
  if (p && degree(p) >= 1) {
    const deg = degree(p);
    if (deg === 1) {
      facts.unshift({ label: "Slope", tex: ft(p[1]) });
      roots = [{ value: p[0].neg().div(p[1]).valueOf(), tex: ft(p[0].neg().div(p[1])) }];
    } else {
      const { roots: rr, rest } = rationalRoots(p);
      roots = rr.map(({ r }) => ({ value: r.valueOf(), tex: ft(r) }));
      if (degree(rest) === 2) {
        let [c, b, a] = integerize(rest).ints;
        if (a < 0) [c, b, a] = [-c, -b, -a];
        quadraticMethods(a, b, c, v).realRoots.forEach(r => roots.push(r));
      } else if (degree(rest) > 2) numericRoots(rest).real.forEach(x => roots.push({ value: x, tex: dec(x) }));
      if (deg === 2) {
        const a = p[2];
        const b = p[1];
        const h = b.neg().div(a.mul(2));
        const k = p[0].sub(b.mul(b).div(a.mul(4)));
        facts.unshift({ label: "Vertex", tex: `\\left(${ft(h)}, ${ft(k)}\\right)` }, { label: "Opens", tex: a.sign > 0 ? "\\text{upward (minimum)}" : "\\text{downward (maximum)}" }, { label: "Axis of symmetry", tex: `${v} = ${ft(h)}` });
        points.push({ x: h.valueOf(), y: k.valueOf(), label: "vertex" });
      }
    }
    roots.sort((a, b) => a.value - b.value);
  } else {
    roots = findRoots(fx, -50, 50, 6000).map(x => ({ value: x, tex: recognize(x)?.tex ?? dec(x) }));
  }
  if (roots.length) facts.push({ label: roots.length > 1 ? "x-intercepts (roots)" : "x-intercept (root)", tex: roots.slice(0, 8).map(r => `(${r.tex}, 0)`).join(", ") + (roots.length > 8 ? ", \\ldots" : "") });
  else facts.push({ label: "x-intercepts", tex: "\\text{none}" });
  roots.slice(0, 20).forEach(r => points.push({ x: r.value, y: 0, label: "root" }));
  if (!p || degree(p) > 2) {
    const lo = roots.length ? Math.min(-10, roots[0].value - 3) : -10;
    const hi = roots.length ? Math.max(10, roots[roots.length - 1].value + 3) : 10;
    const ex = findExtrema(fx, lo, hi).slice(0, 8);
    if (ex.length) {
      facts.push({ label: "Turning points", tex: ex.map(e => `\\text{${e.kind}} \\; (${dec(e.x)}, ${dec(e.y)})`).join(", \\;") });
      ex.forEach(e => points.push({ x: e.x, y: e.y, label: e.kind === "max" ? "local max" : "local min" }));
    }
  }
  return { facts, points, roots };
}

function substituteZero(e, v) {
  const walk = n => {
    if (n.t === "sym" && n.n === v) return num(0);
    if (n.t === "add") return add(n.a.map(walk));
    if (n.t === "mul") return mul(n.a.map(walk));
    if (n.t === "pow") return pow(walk(n.b), walk(n.e));
    if (n.t === "fn") return { ...n, a: walk(n.a) };
    return n;
  };
  try {
    return walk(e);
  } catch {
    return e;
  }
}

export function functionResult(f, v, problemTex, topic = "Function") {
  const { facts, points } = analyzeFunction(f, v);
  return result({
    topic,
    problem: problemTex,
    answers: [],
    table: facts,
    graph: { v, fns: [{ e: f, label: `y = ${tex(f)}` }], points },
  });
}

export function expressionResult(e, mode, v) {
  const problem = tex(e);
  let r;
  let topic;
  if (mode === "factor") {
    r = factorSteps(e, v);
    topic = "Factoring";
  } else if (mode === "expand") {
    r = expandSteps(e);
    topic = "Expanding";
  } else {
    r = simplifySteps(e, v);
    topic = "Simplifying";
  }
  const vars = [...freeVars(e)];
  const extra = vars.length === 1 && depends(e, vars[0]) ? analyzeFunction(r.final, vars[0]) : null;
  const unchanged = tex(r.final) === problem;
  return result({
    topic,
    problem,
    answers: [tex(r.final)],
    methods: r.steps.length && !(unchanged && r.steps.length === 1) ? [{ name: topic === "Factoring" ? "Factor" : topic === "Expanding" ? "Expand" : "Simplify", steps: r.steps }] : [],
    notes: [...(r.notes ?? []), ...(unchanged && mode !== "factor" ? ["This is already in simplest form."] : [])],
    table: extra?.facts ?? null,
    graph: extra ? { v: vars[0], fns: [{ e, label: `y = ${problem}` }], points: extra.points } : null,
  });
}
