// Equations in one variable, with worked steps where a method applies:
// linear, quadratic (three methods), higher polynomials (rational roots),
// rational equations, literal equations, and isolating |u|, √u, b^u, ln u.
// Anything else is solved numerically.

import { Frac, gcd, lcm } from "../engine/frac.js";
import {
  add,
  depends,
  div,
  fn,
  fn1,
  freeVars,
  key,
  mul,
  neg,
  num,
  pow,
  sub,
  substitute,
  sym,
  evaluate,
} from "../engine/expr.js";
import { expand, simplify } from "../engine/simplify.js";
import { eqTex, tex } from "../engine/tex.js";
import {
  degree,
  integerize,
  numericRoots,
  polyDiv,
  polyFrom,
  polyMul,
  polySub,
  polyToExpr,
  rationalCandidates,
  rationalRoots,
  trim,
} from "../engine/poly.js";
import { findRoots, recognize } from "../engine/numeric.js";
import { S, dec, flipRel, ft, radicalRoots, result } from "./common.js";

const F = v => Frac.from(v);
const lin = (a, b, v) => polyToExpr([b, a], v);
const isIneq = rel => rel !== "=" && rel !== "!=";
const isNegTermE = t => (t.t === "num" && t.v.sign < 0) || (t.t === "mul" && t.a[0]?.t === "num" && t.a[0].v.sign < 0);

// ---------- linear core (shared with inequalities) ----------

export function linearCore(pl, pr, v, rel = "=") {
  const steps = [];
  let bl = pl[0] ?? F(0);
  let al = pl[1] ?? F(0);
  let br = pr[0] ?? F(0);
  let ar = pr[1] ?? F(0);
  const show = () => eqTex(lin(al, bl, v), lin(ar, br, v), rel);

  const m = [al, bl, ar, br].reduce((acc, c) => lcm(acc, c.d), 1);
  if (m > 1) {
    const work = `${m}\\left(${tex(lin(al, bl, v))}\\right) ${relSym(rel)} ${m}\\left(${tex(lin(ar, br, v))}\\right)`;
    [al, bl, ar, br] = [al, bl, ar, br].map(c => c.mul(m));
    steps.push(S(`Multiply both sides by ${m}, the least common denominator, to clear the fractions.`, show(), work));
  }

  if (!ar.isZero()) {
    const term = lin(ar, F(0), v);
    const work = eqTex(add(lin(al, bl, v), neg(term)), add(lin(ar, br, v), neg(term)), rel);
    const text = ar.sign > 0 ? `Subtract $${tex(term)}$ from both sides.` : `Add $${tex(neg(term))}$ to both sides.`;
    al = al.sub(ar);
    ar = F(0);
    steps.push(S(text, show(), work));
  }

  if (al.isZero()) {
    const holds = compare(bl, br, rel);
    steps.push(
      S(
        holds
          ? `The variable cancels and what's left is always true, so every value of $${v}$ works.`
          : `The variable cancels and what's left is false, so no value of $${v}$ works.`,
        eqTex(num(bl), num(br), rel)
      )
    );
    return { steps, special: holds ? "all" : "none", rel };
  }

  if (!bl.isZero()) {
    const work = eqTex(add(lin(al, bl, v), num(bl.neg())), add(num(br), num(bl.neg())), rel);
    const text = bl.sign > 0 ? `Subtract $${ft(bl)}$ from both sides.` : `Add $${ft(bl.neg())}$ to both sides.`;
    br = br.sub(bl);
    bl = F(0);
    steps.push(S(text, show(), work));
  }

  if (!al.isOne()) {
    const flips = isIneq(rel) && al.sign < 0;
    let text;
    let work;
    if (al.eq(-1)) {
      text = "Multiply both sides by $-1$.";
    } else if (al.isInt()) {
      text = `Divide both sides by $${ft(al)}$.`;
      work = `\\frac{${tex(lin(al, F(0), v))}}{${ft(al)}} ${relSym(rel)} \\frac{${ft(br)}}{${ft(al)}}`;
    } else {
      text = `Multiply both sides by $${ft(al.inv())}$, the reciprocal of $${ft(al)}$.`;
    }
    if (flips) {
      text += " Because that number is negative, the inequality sign flips.";
      rel = flipRel(rel);
    }
    br = br.div(al);
    al = F(1);
    steps.push(S(text, eqTex(sym(v), num(br), rel), work));
  }
  return { steps, value: br, rel };
}

function compare(a, b, rel) {
  const c = a.cmp(b);
  return { "=": c === 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0, "!=": c !== 0 }[rel];
}
const relSym = rel => ({ "=": "=", "<": "<", ">": ">", "<=": "\\le", ">=": "\\ge" })[rel] ?? rel;

// ---------- graph helper ----------

export function equationGraph(L, R, v, xs) {
  if (!v) return null;
  const fns = [];
  const rConst = !depends(R, v);
  if (rConst && evaluate(R) === 0) fns.push({ e: L, label: `y = ${tex(L)}` });
  else {
    fns.push({ e: L, label: `y = ${tex(L)}` });
    fns.push({ e: R, label: `y = ${tex(R)}` });
  }
  const f = fn1(L, v);
  return {
    v,
    fns,
    points: xs.filter(Number.isFinite).map(x => ({ x, y: f(x), label: "solution" })),
  };
}

// ---------- main entry ----------

export function solveEquation(L, R, v, opts = {}) {
  const problem = eqTex(L, R);
  const pl = polyFrom(L, v);
  const pr = polyFrom(R, v);
  const others = [...freeVars(add(L, R))].filter(x => x !== v);

  if (pl && pr && !others.length) {
    const D = polySub(pl, pr);
    const deg = degree(D);
    if (deg <= 1) return linearEquation(L, R, v, pl, pr, problem);
    if (deg === 2) return polyEquation(L, R, v, pl, pr, problem, "Quadratic equation");
    return polyEquation(L, R, v, pl, pr, problem, "Polynomial equation");
  }

  if (!others.length) {
    const rat = rationalEquation(L, R, v, problem);
    if (rat) return rat;
    const iso = isolate(L, R, v, problem, opts);
    if (iso) return iso;
    const literal = literalEquation(L, R, v, problem);
    if (literal) return literal;
    return numericEquation(L, R, v, problem);
  }

  const literal = literalEquation(L, R, v, problem);
  if (literal) return literal;
  return result({
    topic: "Equation",
    problem,
    answers: [],
    notes: [`I can only solve for $${v}$ here when it appears to the first power. Try giving numbers for the other letters.`],
  });
}

// ---------- linear ----------

function simplifyStep(L, R, pl, pr, v, rel = "=") {
  const lt = tex(polyToExpr(pl, v));
  const rt = tex(polyToExpr(pr, v));
  if (lt === tex(L) && rt === tex(R)) return null;
  const distributes = JSON.stringify([L, R]).includes('"t":"add"') && /"mul"|"pow"/.test(JSON.stringify([L, R]));
  return S(
    distributes ? "Simplify each side: distribute and combine like terms." : "Simplify each side by combining like terms.",
    `${lt} ${relSym(rel)} ${rt}`
  );
}

function linearEquation(L, R, v, pl, pr, problem) {
  const steps = [];
  // x^2 terms that cancel from both sides
  const high = pr.map((c, k) => (k >= 2 ? c : F(0)));
  if (pl.length > 2 || pr.length > 2) {
    steps.push(simplifyStep(L, R, pl, pr, v) ?? S("Write both sides in order.", eqTex(polyToExpr(pl, v), polyToExpr(pr, v))));
    const H = polyToExpr(trim(high), v);
    pl = trim(polySub(pl, high));
    pr = trim(polySub(pr, high));
    steps.push(S(`Subtract $${tex(H)}$ from both sides; those terms cancel.`, eqTex(polyToExpr(pl, v), polyToExpr(pr, v))));
  } else {
    const s = simplifyStep(L, R, pl, pr, v);
    if (s) steps.push(s);
  }
  const core = linearCore(pl, pr, v);
  steps.push(...core.steps);
  const fL = fn1(L, v);
  if (core.special) {
    return result({
      topic: "Linear equation",
      problem,
      answers: [core.special === "all" ? "\\text{All real numbers}" : "\\text{No solution}"],
      methods: [{ name: "Solve", steps }],
      graph: equationGraph(L, R, v, []),
      notes: [core.special === "all" ? "Both sides are the same line, so they meet everywhere." : "The two sides are parallel lines that never meet."],
    });
  }
  const val = core.value;
  const lv = simplify(substitute(L, v, num(val)));
  const rv = simplify(substitute(R, v, num(val)));
  steps.push(
    S(
      `Check: put $${v} = ${ft(val)}$ back into the original equation. Both sides match.`,
      `${tex(lv)} = ${tex(rv)} \\;\\checkmark`
    )
  );
  return result({
    topic: "Linear equation",
    problem,
    answers: [`${v} = ${ft(val)}`],
    approx: val.isInt() ? [] : [`${v} \\approx ${dec(val.valueOf())}`],
    methods: [{ name: "Solve", steps }],
    graph: equationGraph(L, R, v, [val.valueOf()].filter(() => Number.isFinite(fL(val.valueOf())))),
  });
}

// ---------- quadratics ----------

function scaleText(scale, v) {
  if (scale.eq(-1)) return `Multiply both sides by $-1$ so the $${v}^2$ term is positive.`;
  if (scale.isInt() && scale.sign > 0) return `Multiply both sides by $${scale.n}$ to clear the fractions.`;
  if (scale.n === 1 && scale.d > 1) return `Divide both sides by $${scale.d}$, a factor shared by every term.`;
  if (scale.n === -1) return `Divide both sides by $${-scale.d}$, a factor shared by every term.`;
  return `Multiply both sides by $${ft(scale)}$ to get whole-number coefficients.`;
}

function findPair(product, sum) {
  const P = Math.abs(product);
  if (P > 1e8) return null;
  if (product === 0) return sum === 0 ? [0, 0] : [0, sum];
  for (let i = 1; i <= Math.sqrt(P) + 1; i++) {
    if (P % i) continue;
    const j = P / i;
    for (const [r, s] of [
      [i, j],
      [-i, -j],
      [i, -j],
      [-i, j],
    ])
      if (r * s === product && r + s === sum) return [r, s];
  }
  return null;
}

const xTerm = (c, v, k = 1) => polyToExpr([...Array(k).fill(F(0)), F(c)], v);
const binom = (a, b, v) => lin(F(a), F(b), v);

// Standard-form quadratic a x^2 + b x + c = 0 with integer a > 0, b, c.
export function quadraticMethods(a, b, c, v) {
  const std = eqTex(polyToExpr([F(c), F(b), F(a)], v), num(0));
  const X = sym(v);
  const methods = [];
  let realRoots = []; // {tex, value}
  let complexTex = null;

  if (c === 0) {
    const g = gcd(a, b);
    const inner = binom(a / g, b / g, v);
    const outer = g === 1 ? X : mul(num(g), X);
    const r = new Frac(-b, a);
    methods.push({
      name: "Factoring",
      steps: [
        S(`Every term has a factor of $${tex(outer)}$, so factor it out.`, `${tex(outer)}\\left(${tex(inner)}\\right) = 0`),
        S("If a product is zero, one of the factors must be zero.", `${v} = 0 \\quad\\text{or}\\quad ${tex(inner)} = 0`),
        S(`Solve $${tex(inner)} = 0$.`, `${v} = 0 \\quad\\text{or}\\quad ${v} = ${ft(r)}`),
      ],
    });
    realRoots = [F(0), r].sort((p, q) => p.cmp(q)).map(f => ({ tex: ft(f), value: f.valueOf() }));
    return { methods, realRoots, complexTex, std };
  }

  if (b === 0) {
    const k = new Frac(-c, a);
    const steps = [S(`Move the constant to the right side.`, eqTex(xTerm(a, v, 2), num(-c)))];
    if (a !== 1) steps.push(S(`Divide both sides by $${a}$.`, eqTex(pow(X, num(2)), num(k))));
    if (k.sign < 0) {
      const root = simplify(pow(num(k.neg()), num(new Frac(1, 2))));
      const rt = tex(root);
      complexTex = `${v} = \\pm ${rt === "1" ? "" : rt}\\,i`;
      steps.push(
        S(
          `A real number squared can't be negative, so there are no real solutions. Using the imaginary unit $i = \\sqrt{-1}$:`,
          complexTex
        )
      );
      methods.push({ name: "Square roots", steps });
      return { methods, realRoots, complexTex, std };
    }
    const root = simplify(pow(num(k), num(new Frac(1, 2))));
    steps.push(S("Take the square root of both sides. Remember both the positive and negative root.", `${v} = \\pm ${tex(root)}`));
    const val = Math.sqrt(k.valueOf());
    realRoots = [
      { tex: tex(neg(root)), value: -val },
      { tex: tex(root), value: val },
    ];
    if (k.isZero()) realRoots = [{ tex: "0", value: 0 }];
    methods.push({ name: "Square roots", steps });
    return { methods, realRoots, complexTex, std };
  }

  const disc = b * b - 4 * a * c;
  const R = radicalRoots(b, disc, a);

  // --- factoring ---
  if (R.rational) {
    const steps = [];
    if (a === 1) {
      const [r, s] = findPair(c, b);
      steps.push(
        S(`Find two numbers that multiply to $${c}$ and add to $${b}$. They are $${r}$ and $${s}$.`, `${r} \\times ${paren(s)} = ${c}, \\quad ${r} + ${paren(s)} = ${b}`)
      );
      const f1 = binom(1, r, v);
      const f2 = binom(1, s, v);
      const same = r === s;
      steps.push(S("Write the factored form.", same ? `\\left(${tex(f1)}\\right)^2 = 0` : `\\left(${tex(f1)}\\right)\\left(${tex(f2)}\\right) = 0`));
      factorFinish(steps, [[1, r], [1, s]], v, same);
    } else {
      const ac = a * c;
      const [r, s] = findPair(ac, b);
      steps.push(
        S(
          `Multiply $a \\cdot c = ${a} \\cdot ${paren(c)} = ${ac}$. Find two numbers that multiply to $${ac}$ and add to $${b}$: $${r}$ and $${s}$.`,
          `${r} \\times ${paren(s)} = ${ac}, \\quad ${r} + ${paren(s)} = ${b}`
        )
      );
      const split = add(xTerm(a, v, 2), xTerm(r, v), xTerm(s, v), num(c));
      steps.push(S(`Split the middle term $${tex(xTerm(b, v))}$ into $${tex(xTerm(r, v))}$ and $${tex(xTerm(s, v))}$.`, `${tex(split)} = 0`));
      // group
      let g1 = gcd(a, r);
      let inner = [a / g1, r / g1];
      let g2 = s / inner[0];
      if (!Number.isInteger(g2) || g2 * inner[1] !== c) {
        g1 = -g1;
        inner = [a / g1, r / g1];
        g2 = s / inner[0];
      }
      const innerE = binom(inner[0], inner[1], v);
      const left = mul(g1 === 1 ? [] : [num(g1)], sym(v));
      steps.push(
        S(
          "Group the terms in pairs and factor each pair.",
          `${tex(left)}\\left(${tex(innerE)}\\right) ${g2 < 0 ? "-" : "+"} ${Math.abs(g2) === 1 ? "" : Math.abs(g2)}\\left(${tex(innerE)}\\right) = 0`
        )
      );
      const outerE = binom(g1, g2, v);
      steps.push(S(`Factor out the shared binomial $\\left(${tex(innerE)}\\right)$.`, `\\left(${tex(outerE)}\\right)\\left(${tex(innerE)}\\right) = 0`));
      factorFinish(steps, [[g1, g2], inner], v, false);
    }
    methods.push({ name: "Factoring", steps });
  }

  // --- quadratic formula ---
  {
    const steps = [];
    steps.push(S(`Read off the coefficients from $${std}$.`, `a = ${a}, \\quad b = ${b}, \\quad c = ${c}`));
    steps.push(S("Use the quadratic formula.", `${v} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}`));
    steps.push(
      S(
        "Substitute the values.",
        `${v} = \\frac{-${paren(b)} \\pm \\sqrt{${paren(b)}^2 - 4 \\cdot ${paren(a)} \\cdot ${paren(c)}}}{2 \\cdot ${paren(a)}}`
      )
    );
    const meaning =
      disc > 0 ? "It's positive, so there are two real solutions." : disc === 0 ? "It's zero, so there is exactly one (repeated) solution." : "It's negative, so there are no real solutions, only complex ones.";
    steps.push(S(`Work out the discriminant: $b^2 - 4ac = ${b * b} - ${paren(4 * a * c)} = ${disc}$. ${meaning}`, `${v} = \\frac{${-b} \\pm \\sqrt{${disc}}}{${2 * a}}`));
    if (R.rational) {
      const k = Math.sqrt(disc);
      if (disc === 0) {
        steps.push(S("The square root of zero is zero.", `${v} = \\frac{${-b}}{${2 * a}} = ${ft(R.roots[0])}`));
      } else {
        steps.push(S(`$\\sqrt{${disc}} = ${k}$. Split into the $+$ and $-$ cases.`, `${v} = \\frac{${-b} + ${k}}{${2 * a}} \\quad\\text{or}\\quad ${v} = \\frac{${-b} - ${k}}{${2 * a}}`));
        steps.push(S("Simplify each one.", `${v} = ${ft(R.roots[1])} \\quad\\text{or}\\quad ${v} = ${ft(R.roots[0])}`));
      }
    } else {
      if (R.imag) steps.push(S(`Use $\\sqrt{-1} = i$: $\\sqrt{${disc}} = ${R.k === 1 ? "" : R.k}${R.m === 1 ? "" : `\\sqrt{${R.m}}`}\\,i$.`, `${v} = \\frac{${-b} \\pm ${R.k === 1 ? "" : R.k}${R.m === 1 ? "" : `\\sqrt{${R.m}}`}\\,i}{${2 * a}}`));
      else if (R.k > 1) steps.push(S(`Simplify the square root: $\\sqrt{${disc}} = \\sqrt{${R.k * R.k} \\cdot ${R.m}} = ${R.k}\\sqrt{${R.m}}$.`, `${v} = \\frac{${-b} \\pm ${R.k}\\sqrt{${R.m}}}{${2 * a}}`));
      if (R.g > 1) steps.push(S(`Divide the top and bottom by $${R.g}$.`, `${v} = ${R.pm}`));
      else steps.push(S("This is as simple as it gets.", `${v} = ${R.pm}`));
    }
    methods.push({ name: "Quadratic formula", steps });
  }

  // --- completing the square ---
  {
    const steps = [];
    const B = new Frac(b, a);
    const C = new Frac(c, a);
    if (a !== 1) steps.push(S(`Divide every term by $${a}$ so the $${v}^2$ term has coefficient 1.`, eqTex(polyToExpr([C, B, F(1)], v), num(0))));
    steps.push(S("Move the constant term to the right side.", eqTex(polyToExpr([F(0), B, F(1)], v), num(C.neg()))));
    const half = B.div(2);
    const h = half.mul(half);
    const K = C.neg().add(h);
    steps.push(
      S(
        `Take half of the $${v}$ coefficient, $\\frac{1}{2} \\cdot ${ft(B)} = ${ft(half)}$, square it to get $${ft(h)}$, and add that to both sides.`,
        `${tex(polyToExpr([h, B, F(1)], v))} = ${ft(C.neg())} + ${ft(h)}`
      )
    );
    const sq = pow(lin(F(1), half, v), num(2));
    steps.push(S("The left side is now a perfect square.", `${tex(sq)} = ${ft(K)}`));
    const shift = lin(F(1), half, v);
    if (K.isZero()) {
      steps.push(S("Take the square root of both sides.", `${tex(shift)} = 0`));
      steps.push(S("Solve.", `${v} = ${ft(half.neg())}`));
    } else {
      const root = simplify(pow(num(K.abs()), num(new Frac(1, 2))));
      const rt = K.sign < 0 ? `${tex(root) === "1" ? "" : tex(root)}\\,i` : tex(root);
      steps.push(S(`Take the square root of both sides${K.sign < 0 ? ", using $\\sqrt{-1} = i$" : ""}. Keep both signs.`, `${tex(shift)} = \\pm ${rt}`));
      const lead = half.isZero() ? "" : `${ft(half.neg())} `;
      steps.push(S(`${half.sign > 0 ? "Subtract" : "Add"} $${ft(half.abs())}$ ${half.sign > 0 ? "from" : "to"} both sides.`, `${v} = ${lead}\\pm ${rt}`));
      if (!R.rational) steps.push(S("Written as one fraction:", `${v} = ${R.pm}`));
      else steps.push(S("So the two solutions are:", `${v} = ${ft(R.roots[0])} \\quad\\text{or}\\quad ${v} = ${ft(R.roots[1])}`));
    }
    methods.push({ name: "Completing the square", steps });
  }

  if (R.rational) {
    const uniq = R.roots[0].eq(R.roots[1]) ? [R.roots[0]] : R.roots;
    realRoots = uniq.map(f => ({ tex: ft(f), value: f.valueOf() }));
  } else if (R.imag) {
    complexTex = `${v} = ${R.pm}`;
  } else {
    realRoots = [
      { tex: R.texMinus, value: R.values[0] },
      { tex: R.texPlus, value: R.values[1] },
    ];
    if (2 * a < 0) realRoots.reverse();
  }
  return { methods, realRoots, complexTex, std };
}

const paren = n => (n < 0 ? `(${n})` : String(n));

function factorFinish(steps, factors, v, same) {
  const sols = factors.map(([p, q]) => new Frac(-q, p));
  if (same) {
    steps.push(S("Set the factor equal to zero and solve.", `${tex(binom(factors[0][0], factors[0][1], v))} = 0 \\;\\Rightarrow\\; ${v} = ${ft(sols[0])}`));
    return;
  }
  steps.push(
    S(
      "If a product is zero, one of the factors must be zero. Set each factor equal to zero.",
      factors.map(([p, q]) => `${tex(binom(p, q, v))} = 0`).join(" \\quad\\text{or}\\quad ")
    )
  );
  steps.push(S("Solve each one.", sols.map(s => `${v} = ${ft(s)}`).join(" \\quad\\text{or}\\quad ")));
}

// ---------- polynomial equations (degree >= 2) ----------

function toStandard(L, R, pl, pr, v, steps) {
  const D = polySub(pl, pr);
  const isStd = pr.length === 1 && pr[0].isZero() && tex(L) === tex(polyToExpr(pl, v));
  if (!isStd) {
    const s = simplifyStep(L, R, pl, pr, v);
    if (s && !(pr.length === 1 && pr[0].isZero())) steps.push(s);
    steps.push(S(pr.length === 1 && pr[0].isZero() ? "Expand and combine like terms." : "Move every term to the left side so the right side is zero.", eqTex(polyToExpr(D, v), num(0))));
  }
  const { ints, scale } = integerize(D);
  let sc = scale;
  let P = ints;
  if (P[P.length - 1] < 0) {
    P = P.map(c => -c || 0);
    sc = sc.neg();
  }
  if (!sc.isOne()) steps.push(S(scaleText(sc, v), eqTex(polyToExpr(P.map(F), v), num(0))));
  return P;
}

function polyEquation(L, R, v, pl, pr, problem, topic) {
  const pre = [];
  const P = toStandard(L, R, pl, pr, v, pre);
  const deg = P.length - 1;

  if (deg === 2) {
    const [c, b, a] = P;
    const q = quadraticMethods(a, b, c, v);
    q.methods.forEach(m => (m.steps = [...pre, ...m.steps]));
    return finishPoly(L, R, v, problem, topic, q.methods, q.realRoots, q.complexTex ? [q.complexTex] : []);
  }

  const steps = [...pre];
  let roots = []; // {tex, value, mult}
  let complex = [];
  let Q = P.map(F);
  let lowest = 0;
  while (Q[lowest].isZero()) lowest++;
  const factors = [];
  if (lowest > 0) {
    Q = trim(Q.slice(lowest));
    const xk = lowest === 1 ? sym(v) : pow(sym(v), num(lowest));
    factors.push(tex(xk));
    steps.push(S(`Every term has a factor of $${tex(xk)}$. Factor it out.`, `${tex(xk)}\\left(${tex(polyToExpr(Q, v))}\\right) = 0`));
    steps.push(S(`So $${v} = 0$ is a solution${lowest > 1 ? ` (it repeats ${lowest} times)` : ""}. Now solve what's left.`, eqTex(polyToExpr(Q, v), num(0))));
    roots.push({ tex: "0", value: 0, mult: lowest });
  }

  if (degree(Q) >= 3) {
    const cands = rationalCandidates(Q);
    const shown = cands.filter(c => c.sign > 0).map(ft);
    steps.push(
      S(
        `By the rational root theorem, any rational solution is $\\pm\\frac{p}{q}$, where $p$ divides the constant term and $q$ divides the leading coefficient.`,
        `\\pm\\left\\{${shown.slice(0, 16).join(", ")}${shown.length > 16 ? ", \\ldots" : ""}\\right\\}`
      )
    );
  }
  while (degree(Q) >= 3) {
    const r = rationalCandidates(Q).find(c => evalFrac(Q, c).isZero());
    if (!r) break;
    const { q } = polyDiv(Q, [r.neg(), F(1)]);
    const factor = r.isInt() ? lin(F(1), r.neg(), v) : lin(F(r.d), F(-r.n), v);
    const qq = r.isInt() ? q : q.map(c => c.div(r.d));
    steps.push(S(`Test $${v} = ${ft(r)}$: it makes the polynomial zero, so $\\left(${tex(factor)}\\right)$ is a factor.`, `${tex(polyToExpr(Q, v))}\\Big|_{${v} = ${ft(r)}} = 0`));
    steps.push(S(`Divide by $\\left(${tex(factor)}\\right)$ (synthetic division).`, `\\left(${tex(factor)}\\right)\\left(${tex(polyToExpr(qq, v))}\\right) = 0`));
    factors.push(`\\left(${tex(factor)}\\right)`);
    addRoot(roots, r);
    Q = q;
  }
  if (degree(Q) === 2) {
    const { ints } = integerize(Q);
    let [c, b, a] = ints;
    if (a < 0) [c, b, a] = [-c, -b, -a];
    const q = quadraticMethods(a, b, c, v);
    const m = q.methods[0];
    steps.push(S(`Solve the remaining quadratic $${tex(polyToExpr([c, b, a].map(F), v))} = 0$ by ${m.name.toLowerCase()}.`, eqTex(polyToExpr([c, b, a].map(F), v), num(0))));
    steps.push(...m.steps.map(s => ({ ...s, sub: true })));
    for (const r of q.realRoots) {
      const hit = roots.find(x => Math.abs(x.value - r.value) < 1e-12);
      if (hit) hit.mult++;
      else roots.push({ ...r, mult: 1 });
    }
    if (q.complexTex) complex.push(q.complexTex);
  } else if (degree(Q) === 1) {
    const r = Q[0].neg().div(Q[1]);
    if (!roots.length || degree(P.map(F)) !== 1) {
      steps.push(S("Solve the remaining linear factor.", `${v} = ${ft(r)}`));
    }
    addRoot(roots, r);
  } else if (degree(Q) >= 3) {
    const { real, complex: cx } = numericRoots(Q);
    steps.push(
      S(
        `What's left, $${tex(polyToExpr(Q, v))}$, has no rational roots, so its solutions are found numerically.`,
        real.length ? real.map(x => `${v} \\approx ${dec(x)}`).join(", \\quad ") : "\\text{no real roots}"
      )
    );
    real.forEach(x => roots.push({ tex: null, value: x, mult: 1 }));
    if (cx.length) complex.push(`\\text{plus } ${cx.length} \\text{ complex roots}`);
  }
  roots.sort((a, b) => a.value - b.value);
  return finishPoly(L, R, v, problem, topic, [{ name: "Factor and solve", steps }], roots, complex);
}

function evalFrac(p, x) {
  let r = F(0);
  for (let k = p.length - 1; k >= 0; k--) r = r.mul(x).add(p[k]);
  return r;
}

function addRoot(roots, r) {
  const hit = roots.find(x => Math.abs(x.value - r.valueOf()) < 1e-12);
  if (hit) hit.mult++;
  else roots.push({ tex: ft(r), value: r.valueOf(), mult: 1 });
}

function finishPoly(L, R, v, problem, topic, methods, roots, complex) {
  const answers = roots.map(r => `${v} ${r.tex ? `= ${r.tex}` : `\\approx ${dec(r.value)}`}${r.mult > 1 ? `\\;\\text{(multiplicity ${r.mult})}` : ""}`);
  const approx = roots.filter(r => r.tex && /sqrt|frac/.test(r.tex)).map(r => `${v} \\approx ${dec(r.value)}`);
  if (!roots.length && !complex.length) answers.push("\\text{No real solutions}");
  if (!roots.length && complex.length) answers.push("\\text{No real solutions}");
  return result({
    topic,
    problem,
    answers: [...answers, ...complex],
    approx,
    methods,
    graph: equationGraph(L, R, v, roots.map(r => r.value)),
    notes: complex.length && !roots.length ? ["The graph never crosses the x-axis, which is why there are no real solutions."] : [],
  });
}

// ---------- rational equations ----------

// e as N/D with polynomial N, D in v.
export function toRational(e, v) {
  const one = [F(1)];
  const walk = n => {
    switch (n.t) {
      case "num":
        return { n: [n.v], d: one };
      case "sym":
        if (n.n === v) return { n: [F(0), F(1)], d: one };
        return null;
      case "add": {
        let acc = { n: [F(0)], d: one };
        for (const c of n.a) {
          const r = walk(c);
          if (!r) return null;
          acc = { n: polyAddR(polyMul(acc.n, r.d), polyMul(r.n, acc.d)), d: polyMul(acc.d, r.d) };
        }
        return acc;
      }
      case "mul": {
        let acc = { n: one, d: one };
        for (const c of n.a) {
          const r = walk(c);
          if (!r) return null;
          acc = { n: polyMul(acc.n, r.n), d: polyMul(acc.d, r.d) };
        }
        return acc;
      }
      case "pow": {
        if (n.e.t !== "num" || !n.e.v.isInt() || Math.abs(n.e.v.n) > 12) return null;
        const r = walk(n.b);
        if (!r) return null;
        let k = n.e.v.n;
        let base = k < 0 ? { n: r.d, d: r.n } : r;
        k = Math.abs(k);
        let acc = { n: one, d: one };
        for (let i = 0; i < k; i++) acc = { n: polyMul(acc.n, base.n), d: polyMul(acc.d, base.d) };
        return acc;
      }
      default:
        return null;
    }
  };
  return walk(e);
}
const polyAddR = (a, b) => {
  const n = Math.max(a.length, b.length);
  return trim(Array.from({ length: n }, (_, i) => (a[i] ?? F(0)).add(b[i] ?? F(0))));
};

function denominators(e, v, out = []) {
  if (e.t === "pow" && e.e.t === "num" && e.e.v.sign < 0 && depends(e.b, v)) out.push(e.e.v.eq(-1) ? e.b : pow(e.b, num(e.e.v.neg())));
  if (e.t === "add" || e.t === "mul") e.a.forEach(c => denominators(c, v, out));
  if (e.t === "pow") denominators(e.b, v, out);
  return out;
}

function rationalEquation(L, R, v, problem) {
  const rl = toRational(L, v);
  const rr = toRational(R, v);
  if (!rl || !rr) return null;
  const dens = [...denominators(L, v), ...denominators(R, v)];
  if (!dens.length) return null;
  const steps = [];
  // restrictions
  const bad = [];
  for (const d of dens) {
    const p = polyFrom(d, v);
    if (!p) continue;
    const { roots } = rationalRoots(p);
    roots.forEach(({ r }) => {
      if (!bad.some(b => b.eq(r))) bad.push(r);
    });
  }
  bad.sort((a, b) => a.cmp(b));
  if (bad.length)
    steps.push(S("First note which values are not allowed: a denominator can't be zero.", bad.map(b => `${v} \\ne ${ft(b)}`).join(", \\quad ")));

  // Unique denominators, multiply through.
  const uniq = [];
  for (const d of dens) if (!uniq.some(u => key(simplify(u)) === key(simplify(d)))) uniq.push(d);
  const lcd = uniq.length === 1 ? uniq[0] : mul(uniq);
  const times = side => {
    const terms = side.t === "add" ? side.a : [side];
    return expand(add(terms.map(t => simplify(mul(t, lcd)))));
  };
  let lhs, rhs;
  try {
    lhs = times(L);
    rhs = times(R);
  } catch {
    return null;
  }
  const pl = polyFrom(lhs, v);
  const pr = polyFrom(rhs, v);
  if (!pl || !pr) return null;
  const lcdTex = uniq.map(u => (u.t === "add" ? `\\left(${tex(u)}\\right)` : tex(u))).join("");
  steps.push(S(`Multiply both sides by $${lcdTex}$ to clear the denominators.`, eqTex(lhs, rhs)));

  const D = polySub(pl, pr);
  const deg = degree(D);
  let candidates;
  if (deg <= 0) {
    steps.push(S("The variable drops out entirely.", eqTex(polyToExpr(pl, v), polyToExpr(pr, v))));
    candidates = D[0].isZero() ? null : [];
  } else if (deg === 1) {
    const core = linearCore(pl, pr, v);
    steps.push(...core.steps);
    candidates = core.value ? [{ tex: ft(core.value), value: core.value.valueOf(), frac: core.value }] : [];
  } else {
    const sub = polyEquation(lhs, rhs, v, pl, pr, "", "");
    const m = sub.methods[0];
    steps.push(...m.steps);
    candidates = parseRootAnswers(sub);
  }
  if (candidates === null) {
    return result({
      topic: "Rational equation",
      problem,
      answers: [bad.length ? `\\text{All real numbers except } ${bad.map(ft).join(", ")}` : "\\text{All real numbers}"],
      methods: [{ name: "Solve", steps }],
      graph: equationGraph(L, R, v, []),
    });
  }
  const kept = [];
  const rejected = [];
  for (const c of candidates) {
    const f = fn1(add(L, neg(R)), v);
    const ok = !bad.some(b => Math.abs(b.valueOf() - c.value) < 1e-12) && Math.abs(f(c.value)) < 1e-7 * Math.max(1, Math.abs(fn1(L, v)(c.value)));
    (ok ? kept : rejected).push(c);
  }
  if (rejected.length)
    steps.push(
      S(
        `Check against the restrictions: ${rejected.map(c => `$${v} = ${c.tex ?? dec(c.value)}$`).join(" and ")} would make a denominator zero, so ${rejected.length > 1 ? "they are" : "it is"} rejected (extraneous).`,
        kept.length ? kept.map(c => `${v} = ${c.tex ?? `\\approx ${dec(c.value)}`}`).join(", \\quad ") : "\\text{No solution}"
      )
    );
  else if (kept.length) steps.push(S("None of these make a denominator zero, so they all work.", kept.map(c => `${v} = ${c.tex ?? `\\approx ${dec(c.value)}`}`).join(", \\quad ")));
  return result({
    topic: "Rational equation",
    problem,
    answers: kept.length ? kept.map(c => `${v} = ${c.tex ?? `\\approx ${dec(c.value)}`}`) : ["\\text{No solution}"],
    approx: kept.filter(c => c.tex && /frac|sqrt/.test(c.tex)).map(c => `${v} \\approx ${dec(c.value)}`),
    methods: [{ name: "Solve", steps }],
    graph: equationGraph(L, R, v, kept.map(c => c.value)),
  });
}

function parseRootAnswers(res) {
  // Recover root values from a polynomial result's graph points and answers.
  const pts = res.graph?.points ?? [];
  return pts.map((p, i) => {
    const a = res.answers[i] ?? "";
    const m = /= (.*?)(\\;|$)/.exec(a);
    const t = m && !m[1].startsWith("\\approx") ? m[1] : null;
    return { tex: t, value: p.x };
  });
}

// ---------- literal equations: solve for one letter ----------

function literalEquation(L, R, v, problem) {
  let E;
  try {
    E = expand(sub(L, R));
  } catch {
    return null;
  }
  const terms = E.t === "add" ? E.a : [E];
  const withV = [];
  const without = [];
  for (const t of terms) {
    if (!depends(t, v)) {
      without.push(t);
      continue;
    }
    // must be v^1 times something free of v
    const coef = simplify(div(t, sym(v)));
    if (depends(coef, v)) return null;
    withV.push({ t, coef });
  }
  if (!withV.length) return null;
  const steps = [];
  // keep the leading coefficient positive when every v-term is negative
  const flip = withV.every(w => isNegTermE(w.t));
  if (flip) {
    withV.forEach(w => {
      w.t = neg(w.t);
      w.coef = simplify(neg(w.coef));
    });
  }
  const leftE = withV.length === 1 ? withV[0].t : add(withV.map(w => w.t));
  const rightE = without.length ? expand(flip ? add(without) : neg(add(without))) : num(0);
  if (eqTex(leftE, rightE) !== problem) steps.push(S(`Collect the terms with $${v}$ on ${flip ? "one side" : "the left"} and everything else on the other side.`, eqTex(leftE, rightE)));
  const coef = simplify(add(withV.map(w => w.coef)));
  if (withV.length > 1) steps.push(S(`Factor out $${v}$.`, `${v}\\left(${tex(coef)}\\right) = ${tex(rightE)}`));
  const ans = coef.t === "num" ? expand(div(rightE, coef)) : simplify(div(rightE, coef));
  const isOne = coef.t === "num" && coef.v.isOne();
  if (!isOne) steps.push(S(`Divide both sides by $${coef.t === "add" ? `\\left(${tex(coef)}\\right)` : tex(coef)}$.`, eqTex(sym(v), ans)));
  const numeric = freeVars(ans).size === 0 ? evaluate(ans) : NaN;
  return result({
    topic: freeVars(add(L, R)).size > 1 ? "Solving for a variable" : "Equation",
    problem,
    answers: [eqTex(sym(v), ans)],
    approx: Number.isFinite(numeric) && ans.t !== "num" ? [`${v} \\approx ${dec(numeric)}`] : [],
    graph: Number.isFinite(numeric) ? equationGraph(L, R, v, [numeric]) : null,
    methods: [{ name: "Isolate", steps }],
    notes: isOne || coef.t === "num" ? [] : [`This assumes $${tex(coef)} \\ne 0$.`],
  });
}

// ---------- isolating |u|, √u, b^u, ln u, sin u ----------

function findTarget(e, v) {
  // the single non-polynomial piece containing v
  const found = [];
  const walk = n => {
    if (!depends(n, v)) return;
    if (n.t === "fn" && ["abs", "ln", "log", "sin", "cos", "tan"].includes(n.n)) return found.push(n);
    if (n.t === "pow" && depends(n.e, v) && !depends(n.b, v)) return found.push(n);
    if (n.t === "pow" && n.e.t === "num" && !n.e.v.isInt() && depends(n.b, v)) return found.push(n);
    if (n.t === "add" || n.t === "mul") n.a.forEach(walk);
    if (n.t === "pow") walk(n.b);
  };
  walk(e);
  return found;
}

function isolate(L, R, v, problem, opts) {
  const targets = [...findTarget(L, v), ...findTarget(R, v)];
  if (!targets.length) return null;
  const k0 = key(targets[0]);
  if (!targets.every(t => key(t) === k0)) return null;
  const T = targets[0];
  const tmp = { t: "sym", n: "__T", tx: tex(T) };
  const L2 = substitute(L, T, tmp);
  const R2 = substitute(R, T, tmp);
  if (depends(L2, v) || depends(R2, v)) {
    if (T.t === "pow" && T.e.t === "num" && T.e.v.n === 1 && T.e.v.d <= 3 && !depends(T.e, v)) return radicalBySquaring(L, R, T, v, problem, opts);
    return null;
  }
  const pl = polyFrom(L2, "__T");
  const pr = polyFrom(R2, "__T");
  if (!pl || !pr || degree(polySub(pl, pr)) !== 1) return null;
  const steps = [];
  const core = linearCore(pl, pr, "__T");
  // re-label: the core prints __T via sym name; patch display
  const relabel = s => (s ? s.replaceAll("\\mathrm{__T}", tex(T)).replaceAll("__T", tex(T)) : s);
  core.steps.forEach(s => steps.push({ text: relabel(s.text), tex: relabel(s.tex), work: relabel(s.work) }));
  if (core.special || !core.value) return null;
  const c = core.value;
  const inner = T.t === "fn" ? T.a : T.t === "pow" && depends(T.e, v) ? T.e : T.b;
  const rest = [];
  let topic;
  let sub;
  const solveInner = (rhs, label) => {
    const r = solveEquation(inner, rhs, v, { depth: (opts.depth ?? 0) + 1 });
    return { r, label };
  };

  if (T.t === "fn" && T.n === "abs") {
    topic = "Absolute value equation";
    if (c.sign < 0) {
      steps.push(S("An absolute value is never negative, so there is no solution.", "\\text{No solution}"));
      return result({ topic, problem, answers: ["\\text{No solution}"], methods: [{ name: "Solve", steps }], graph: equationGraph(L, R, v, []) });
    }
    steps.push(S(`$${tex(T)} = ${ft(c)}$ means the inside is $${ft(c)}$ or $${ft(c.neg())}$. Solve both cases.`, `${tex(inner)} = ${ft(c)} \\quad\\text{or}\\quad ${tex(inner)} = ${ft(c.neg())}`));
    sub = c.isZero() ? [solveInner(num(0), "Case")] : [solveInner(num(c), `Case 1: $${tex(inner)} = ${ft(c)}$`), solveInner(num(c.neg()), `Case 2: $${tex(inner)} = ${ft(c.neg())}$`)];
  } else if (T.t === "pow" && depends(T.e, v)) {
    topic = "Exponential equation";
    if (c.sign <= 0) {
      steps.push(S("A positive base raised to any power is positive, so there is no solution.", "\\text{No solution}"));
      return result({ topic, problem, answers: ["\\text{No solution}"], methods: [{ name: "Solve", steps }], graph: equationGraph(L, R, v, []) });
    }
    const base = T.b;
    const isE = base.t === "sym" && base.n === "e";
    const logged = isE ? simplify(fn("ln", num(c))) : simplify(div(fn("ln", num(c)), fn("ln", base)));
    // exact when c is a power of the base
    steps.push(
      S(
        isE ? "Take the natural log of both sides; $\\ln(e^u) = u$." : `Take the logarithm of both sides and bring the exponent down: $u = \\frac{\\ln ${ft(c)}}{\\ln ${tex(base)}}$.`,
        `${tex(inner)} = ${tex(niceLog(logged, base, c))}`
      )
    );
    sub = [solveInner(niceLog(logged, base, c), null)];
  } else if (T.t === "pow") {
    topic = "Radical equation";
    const q = T.e.v;
    if (q.d % 2 === 0 && c.sign < 0) {
      steps.push(S("An even root can't be negative, so there is no solution.", "\\text{No solution}"));
      return result({ topic, problem, answers: ["\\text{No solution}"], methods: [{ name: "Solve", steps }], graph: equationGraph(L, R, v, []) });
    }
    const powered = c.pow(q.d);
    const rhs = q.n === 1 ? num(powered) : simplify(pow(num(c), num(q.inv())));
    steps.push(S(q.n === 1 ? `Raise both sides to the power $${q.d}$ to undo the root.` : `Raise both sides to the power $${ft(q.inv())}$.`, `${tex(inner)} = ${tex(rhs)}`));
    sub = [solveInner(rhs, null)];
  } else if (T.t === "fn" && (T.n === "ln" || T.n === "log")) {
    topic = "Logarithmic equation";
    const rhs = T.n === "ln" ? simplify(pow(sym("e"), num(c))) : simplify(pow(num(10), num(c)));
    steps.push(S(`Rewrite in exponential form: $${T.n === "ln" ? "\\ln u = c \\iff u = e^c" : "\\log u = c \\iff u = 10^c"}$.`, `${tex(inner)} = ${tex(rhs)}`));
    sub = [solveInner(rhs, null)];
  } else if (T.t === "fn" && ["sin", "cos", "tan"].includes(T.n)) {
    return trigEquation(T, c, inner, v, steps, L, R, problem);
  } else return null;

  // combine sub-results
  const answers = [];
  const values = [];
  for (const { r, label } of sub) {
    if (label) rest.push(S(label, null));
    const m = r.methods[0];
    if (m) rest.push(...m.steps.filter(s => !s.text.startsWith("Check")).map(s => ({ ...s, sub: !!label })));
    for (const p of r.graph?.points ?? []) values.push(p.x);
    answers.push(...r.answers.filter(a => !/No (real )?solution/.test(a)));
  }
  steps.push(...rest);
  // verify in the original (catches extraneous roots after squaring)
  const f = fn1(sub0(L, R), v);
  const good = [];
  const goodAns = [];
  values.forEach((x, i) => {
    if (Math.abs(f(x)) < 1e-7 * Math.max(1, Math.abs(fn1(L, v)(x)))) {
      good.push(x);
      if (answers[i]) goodAns.push(answers[i]);
    }
  });
  if (good.length < values.length)
    steps.push(S("Check each answer in the original equation. Some don't work (they're extraneous), so they're dropped.", goodAns.join(", \\quad ") || "\\text{No solution}"));
  else if (good.length) steps.push(S("Check: each answer works in the original equation.", goodAns.join(", \\quad ")));
  return result({
    topic,
    problem,
    answers: goodAns.length ? goodAns : ["\\text{No solution}"],
    approx: good.length && goodAns.some(a => /ln|sqrt|frac|log|e\^|pi/.test(a)) ? good.map(x => `${v} \\approx ${dec(x)}`) : [],
    methods: [{ name: "Solve", steps }],
    graph: equationGraph(L, R, v, good),
  });
}

const sub0 = (L, R) => add(L, neg(R));

// √u = (something with x): raise both sides to the root's power, solve, drop extraneous roots.
function radicalBySquaring(L, R, T, v, problem, opts) {
  let [rad, other] = key(simplify(L)) === key(T) ? [L, R] : key(simplify(R)) === key(T) ? [R, L] : [null, null];
  if (!rad) {
    // a·√u + b = rest: move b and divide by a when the rest is free of the root
    const side = depends(substitute(L, T, num(0)), v) || !findTarget(L, v).length ? R : L;
    const otherSide = side === L ? R : L;
    const tmp = { t: "sym", n: "__T" };
    const p = polyFrom(substitute(side, T, tmp), "__T", { expandFirst: true });
    if (!p || p.length !== 2 || p[1].isZero()) return null;
    rad = T;
    other = simplify(expand(div(sub(otherSide, num(p[0])), num(p[1]))));
  }
  const q = T.e.v.d;
  const steps = [];
  if (rad !== L && rad !== R) steps.push(S("Get the root by itself on one side.", eqTex(T, other)));
  const inner = T.b;
  const raised = expand(pow(other, num(q)));
  steps.push(S(`${q === 2 ? "Square" : "Cube"} both sides to remove the root.`, `${tex(inner)} = ${q === 2 ? `\\left(${tex(other)}\\right)^2` : `\\left(${tex(other)}\\right)^3`} = ${tex(raised)}`));
  const r = solveEquation(inner, raised, v, { depth: (opts.depth ?? 0) + 1 });
  const m = r.methods[0];
  if (m) steps.push(...m.steps.filter(s => !s.text.startsWith("Check")).map(s => ({ ...s, sub: true })));
  const vals = (r.graph?.points ?? []).map(p => p.x);
  const answers = r.answers.filter(a => !/No (real )?solution|text\{plus/.test(a));
  const f = fn1(sub0(L, R), v);
  const keep = [];
  const drop = [];
  vals.forEach((x, i) => (Math.abs(f(x)) < 1e-7 * Math.max(1, Math.abs(fn1(L, v)(x))) ? keep : drop).push({ x, a: answers[i] ?? `${v} \\approx ${dec(x)}` }));
  steps.push(
    S(
      drop.length
        ? `Squaring can create false solutions, so check each one in the original equation. ${drop.map(d => `$${d.a}$`).join(" and ")} ${drop.length > 1 ? "don't" : "doesn't"} work.`
        : "Check each one in the original equation. They all work.",
      keep.length ? keep.map(k => k.a).join(", \\quad ") : "\\text{No solution}"
    )
  );
  return result({
    topic: "Radical equation",
    problem,
    answers: keep.length ? keep.map(k => k.a) : ["\\text{No solution}"],
    approx: keep.some(k => /sqrt|frac/.test(k.a)) ? keep.map(k => `${v} \\approx ${dec(k.x)}`) : [],
    methods: [{ name: "Solve", steps }],
    graph: equationGraph(L, R, v, keep.map(k => k.x)),
  });
}

function niceLog(logged, base, c) {
  // log_b(c) is a whole number when c is a power of b
  const val = evaluate(logged);
  const r = Math.round(val);
  if (Math.abs(val - r) < 1e-12 && base.t === "num" && F(base.v).pow(r).eq(c)) return num(r);
  return logged;
}

function trigEquation(T, c, inner, v, steps, L, R, problem) {
  const cv = c.valueOf();
  const name = T.n;
  if ((name === "sin" || name === "cos") && Math.abs(cv) > 1) {
    steps.push(S(`$\\${name}$ only takes values between $-1$ and $1$, so there is no solution.`, "\\text{No solution}"));
    return result({ topic: "Trigonometric equation", problem, answers: ["\\text{No solution}"], methods: [{ name: "Solve", steps }], graph: equationGraph(L, R, v, []) });
  }
  const base = simplify(fn("a" + name, num(c)));
  const period = name === "tan" ? sym("pi") : mul(num(2), sym("pi"));
  const nT = e => {
    const ct = tex(e.c);
    const pt = tex(simplify(mul(e.p, sym("n"))));
    if (ct === "0") return pt;
    return `${ct} ${pt.startsWith("-") ? "- " + pt.slice(1) : "+ " + pt}`;
  };
  let consts = name === "sin" ? [base, simplify(sub(sym("pi"), base))] : name === "cos" ? [base, simplify(neg(base))] : [base];
  if (consts.length === 2 && key(consts[0]) === key(consts[1])) consts = [consts[0]];
  if (name === "cos" && Math.abs(evaluate(consts[0]) - Math.PI) < 1e-12) consts = [consts[0]];
  const families = consts.map(c0 => ({ c: c0, p: period }));
  const fname = name === "sin" ? "arcsin" : name === "cos" ? "arccos" : "arctan";
  steps.push(
    S(
      `The basic angle is $\\${fname}\\left(${ft(c)}\\right) = ${tex(base)}$. ${
        name === "tan" ? "Tangent repeats every $\\pi$." : `${name === "sin" ? "Sine" : "Cosine"} repeats every $2\\pi$${consts.length > 1 ? " and has a second matching angle in each turn" : ""}.`
      }`,
      families.map(f => `${tex(inner)} = ${nT(f)}`).join(" \\quad\\text{or}\\quad ")
    )
  );
  const pin = polyFrom(inner, v);
  if (!pin || degree(pin) !== 1) {
    return result({ topic: "Trigonometric equation", problem, answers: families.map(f => `${tex(inner)} = ${nT(f)}`), methods: [{ name: "Solve", steps }], graph: equationGraph(L, R, v, []), notes: ["$n$ is any integer."] });
  }
  const a = pin[1];
  const b = pin[0];
  const sols = families.map(f => ({ c: simplify(expand(div(sub(f.c, num(b)), num(a)))), p: simplify(div(f.p, num(a))) }));
  if (!(a.isOne() && b.isZero())) steps.push(S(`Solve each for $${v}$.`, sols.map(s => `${v} = ${nT(s)}`).join(" \\quad\\text{or}\\quad ")));
  const f = fn1(sub0(L, R), v);
  const xs = findRoots(f, -2 * Math.PI, 2 * Math.PI, 3000);
  return result({
    topic: "Trigonometric equation",
    problem,
    answers: sols.map(s => `${v} = ${nT(s)}`),
    methods: [{ name: "Solve", steps }],
    graph: equationGraph(L, R, v, xs),
    notes: ["$n$ can be any integer, so there are infinitely many solutions. The graph marks the ones near zero."],
  });
}

// ---------- numeric fallback ----------

export function numericEquation(L, R, v, problem) {
  const f = fn1(sub0(L, R), v);
  let xs = findRoots(f, -50, 50, 6000);
  if (!xs.length) xs = findRoots(f, -1000, 1000, 20000);
  const answers = xs.slice(0, 12).map(x => {
    const r = recognize(x);
    return r ? `${v} = ${r.tex}` : `${v} \\approx ${dec(x)}`;
  });
  return result({
    topic: "Equation",
    problem,
    answers: answers.length ? answers : ["\\text{No real solutions found}"],
    approx: xs.slice(0, 12).filter(x => recognize(x)).map(x => `${v} \\approx ${dec(x)}`),
    methods: [],
    graph: equationGraph(L, R, v, xs.slice(0, 12)),
    notes: [
      answers.length
        ? "There isn't a standard step-by-step method for this one, so the solutions were found numerically (they're where the two graphs cross)."
        : "I searched from −1000 to 1000 and the two sides never meet.",
      ...(xs.length > 12 ? ["Only the first 12 solutions are listed."] : []),
    ],
  });
}

export { polyMul };
