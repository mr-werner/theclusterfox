// Systems of equations. Linear systems get elimination (and substitution for two
// unknowns); a linear equation paired with a nonlinear one is solved by substitution.

import { Frac, gcd, lcm } from "../engine/frac.js";
import { add, depends, div, evaluate, freeVars, mul, neg, num, substitute, sym } from "../engine/expr.js";
import { expand, simplify } from "../engine/simplify.js";
import { eqTex, tex } from "../engine/tex.js";
import { S, dec, ft, result } from "./common.js";
import { solveEquation } from "./equation.js";

const F = v => Frac.from(v);

// Coefficients of a linear equation L = R in vars, or null.
function linearRow(L, R, vars) {
  let E;
  try {
    E = expand(add(L, neg(R)));
  } catch {
    return null;
  }
  const coefs = vars.map(() => F(0));
  let constant = F(0);
  for (const t of E.t === "add" ? E.a : [E]) {
    if (t.t === "num") {
      constant = constant.add(t.v);
      continue;
    }
    const idx = vars.findIndex(v => depends(t, v));
    if (idx < 0) return null;
    const c = simplify(div(t, sym(vars[idx])));
    if (c.t !== "num") return null;
    coefs[idx] = coefs[idx].add(c.v);
  }
  return { a: coefs, c: constant.neg() };
}

function rowExpr(row, vars) {
  const terms = [];
  row.a.forEach((c, i) => {
    if (c.isZero()) return;
    terms.push(c.isOne() ? sym(vars[i]) : mul(num(c), sym(vars[i])));
  });
  return terms.length ? (terms.length === 1 ? terms[0] : add(terms)) : num(0);
}
const rowTex = (row, vars) => eqTex(rowExpr(row, vars), num(row.c));
const scaleRow = (row, k) => ({ a: row.a.map(c => c.mul(k)), c: row.c.mul(k) });
const addRows = (r, s) => ({ a: r.a.map((c, i) => c.add(s.a[i])), c: r.c.add(s.c) });
function tidyRow(row) {
  // clear fractions and common factors
  const L = [...row.a, row.c].reduce((m, c) => lcm(m, c.d), 1);
  let r = scaleRow(row, F(L));
  const g = [...r.a, r.c].reduce((m, c) => gcd(m, c.n), 0) || 1;
  if (g > 1) r = scaleRow(r, new Frac(1, g));
  return r;
}

export function solveSystem(statements, varsIn) {
  const eqs = statements.map(s => ({ L: s.exprs[0], R: s.exprs[1] }));
  const all = [...freeVars(add(eqs.flatMap(e => [e.L, e.R])))];
  const order = ["x", "y", "z", "w"];
  const vars = varsIn ?? all.sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9) || (a < b ? -1 : 1));
  const problem = `\\begin{cases} ${eqs.map(e => eqTex(e.L, e.R)).join(" \\\\ ")} \\end{cases}`;
  const rows = eqs.map(e => linearRow(e.L, e.R, vars));
  if (rows.every(Boolean)) {
    if (vars.length === 2 && rows.length === 2) {
      const elim = elimination2(rows, vars, eqs);
      const subst = substitution2(rows, vars);
      return finish(problem, vars, elim, [elim.method, subst?.method].filter(Boolean), eqs);
    }
    const g = gaussian(rows, vars, eqs);
    return finish(problem, vars, g, [g.method], eqs);
  }
  if (vars.length === 2 && eqs.length === 2) {
    const r = nonlinear2(eqs, rows, vars);
    if (r) return finish(problem, vars, r, [r.method], eqs);
  }
  return result({
    topic: "System of equations",
    problem,
    answers: [],
    notes: ["I can solve linear systems, or two equations where one of them is linear. This one is outside that, but the graph shows where the curves meet."],
    graph: vars.length === 2 ? systemGraph(eqs, vars, []) : null,
  });
}

function finish(problem, vars, r, methods, eqs) {
  let answers;
  if (r.kind === "none") answers = ["\\text{No solution}"];
  else if (r.kind === "many") answers = ["\\text{Infinitely many solutions}"];
  else answers = r.solutions.map(sol => (vars.length === 2 ? `\\left(${vars[0]}, ${vars[1]}\\right) = \\left(${sol.map(s => s.tex).join(", ")}\\right)` : vars.map((v, i) => `${v} = ${sol[i].tex}`).join(", \\; ")));
  const approx = r.solutions?.filter(sol => sol.some(s => /sqrt|frac/.test(s.tex))).map(sol => vars.map((v, i) => `${v} \\approx ${dec(sol[i].value)}`).join(", \\; ")) ?? [];
  return result({
    topic: r.topic ?? (vars.length === 2 ? "System of two equations" : `System of ${eqs.length} equations`),
    problem,
    answers,
    approx,
    methods,
    graph: vars.length === 2 ? systemGraph(eqs, vars, r.solutions ?? []) : null,
    notes: r.kind === "none" ? [vars.length === 2 ? "The lines are parallel, so they never cross." : "The equations contradict each other."] : r.kind === "many" ? [vars.length === 2 ? "Both equations describe the same line." : "The equations don't pin down a single point."] : [],
  });
}

export function systemGraph(eqs, vars, sols) {
  const [vx, vy] = vars;
  const fns = eqs.map(e => {
    const F2 = add(e.L, neg(e.R));
    // rename to x, y for plotting
    const G = substitute(substitute(F2, vx, sym("__X")), vy, sym("__Y"));
    const H = substitute(substitute(G, "__X", sym("x")), "__Y", sym("y"));
    return { implicit: H, label: eqTex(e.L, e.R) };
  });
  return {
    v: "x",
    axes: [vx, vy],
    fns,
    points: sols.filter(s => s.every(p => Number.isFinite(p.value))).map(s => ({ x: s[0].value, y: s[1].value, label: `(${s.map(p => dec(p.value)).join(", ")})` })),
  };
}

// ---------- 2x2 elimination ----------

function elimination2(rows0, vars, eqs) {
  const steps = [];
  let [r1, r2] = rows0.map(tidyRow);
  const changed = eqs.some((e, i) => eqTex(e.L, e.R) !== rowTex([r1, r2][i], vars));
  if (changed) steps.push(S("Write both equations in standard form, with the variables on the left.", `\\begin{aligned} &(1)\\quad ${rowTex(r1, vars)} \\\\ &(2)\\quad ${rowTex(r2, vars)} \\end{aligned}`));
  else steps.push(S("Label the equations.", `\\begin{aligned} &(1)\\quad ${rowTex(r1, vars)} \\\\ &(2)\\quad ${rowTex(r2, vars)} \\end{aligned}`));

  // choose the variable to eliminate
  const cost = i => {
    const a = Math.abs(r1.a[i].valueOf());
    const b = Math.abs(r2.a[i].valueOf());
    if (!a || !b) return Infinity;
    return lcm(a, b);
  };
  let k = cost(1) <= cost(0) ? 1 : 0;
  if (cost(k) === Infinity) k = cost(0) === Infinity ? 1 : 0;
  const keep = 1 - k;
  const a1 = r1.a[k].valueOf();
  const a2 = r2.a[k].valueOf();
  let e1 = r1;
  let e2 = r2;
  if (a1 && a2) {
    const L = lcm(Math.abs(a1), Math.abs(a2));
    const m1 = L / Math.abs(a1);
    const m2 = L / Math.abs(a2);
    if (m1 !== 1) {
      e1 = scaleRow(r1, F(m1));
      steps.push(S(`Multiply equation (1) by $${m1}$ so the $${vars[k]}$ terms line up.`, rowTex(e1, vars)));
    }
    if (m2 !== 1) {
      e2 = scaleRow(r2, F(m2));
      steps.push(S(`Multiply equation (2) by $${m2}$.`, rowTex(e2, vars)));
    }
    const same = Math.sign(a1) === Math.sign(a2);
    const combined = same ? addRows(e1, scaleRow(e2, F(-1))) : addRows(e1, e2);
    steps.push(
      S(
        `${same ? "Subtract" : "Add"} the equations. The $${vars[k]}$ terms cancel.`,
        rowTex(combined, vars),
        `\\left(${tex(rowExpr(e1, vars))}\\right) ${same ? "-" : "+"} \\left(${tex(rowExpr(e2, vars))}\\right) = ${ft(e1.c)} ${same ? "-" : "+"} ${paren(e2.c)}`
      )
    );
    if (combined.a[keep].isZero()) {
      const many = combined.c.isZero();
      steps.push(S(many ? "Everything cancels and $0 = 0$ is always true, so the equations are the same line." : `Everything cancels and leaves $0 = ${ft(combined.c)}$, which is impossible.`, null));
      return { kind: many ? "many" : "none", method: { name: "Elimination", steps } };
    }
    const val = combined.c.div(combined.a[keep]);
    if (!combined.a[keep].isOne()) steps.push(S(`Divide both sides by $${ft(combined.a[keep])}$.`, `${vars[keep]} = ${ft(val)}`));
    // back substitute into the original equation with the simpler coefficient on vars[k]
    const src = Math.abs(r1.a[k].valueOf()) <= Math.abs(r2.a[k].valueOf()) ? 0 : 1;
    const row = [r1, r2][src];
    const back = backSub(row, vars, keep, val, k, src + 1, steps);
    const sol = vars.map((_, i) => (i === keep ? val : back));
    steps.push(S("Check in the other equation.", checkTex([r1, r2][1 - src], vars, sol)));
    return { kind: "one", solutions: [sol.map(f => ({ tex: ft(f), value: f.valueOf() }))], method: { name: "Elimination", steps } };
  }
  // one equation has only one variable
  return gaussian(rows0, vars, eqs);
}

const paren = f => (f.sign < 0 ? `\\left(${ft(f)}\\right)` : ft(f));

function backSub(row, vars, known, val, unknown, label, steps) {
  const rest = row.a[known].mul(val);
  const res = row.c.sub(rest).div(row.a[unknown]);
  const parts = vars.map((v, i) => {
    const c = row.a[i];
    if (c.isZero()) return null;
    if (i === unknown) return { neg: c.sign < 0, t: tex(simplify(mul(num(c.abs()), sym(v)))) };
    const body = c.abs().isOne() ? paren(val) : `${ft(c.abs())} \\cdot ${paren(val)}`;
    return { neg: c.sign < 0, t: body };
  }).filter(Boolean);
  const lhs = parts.map((p, i) => (i === 0 ? (p.neg ? "-" : "") + p.t : ` ${p.neg ? "-" : "+"} ${p.t}`)).join("");
  steps.push(
    S(
      `Substitute $${vars[known]} = ${ft(val)}$ into equation (${label}) and solve for $${vars[unknown]}$.`,
      `${lhs} = ${ft(row.c)} \\;\\Rightarrow\\; ${vars[unknown]} = ${ft(res)}`
    )
  );
  return res;
}

function checkTex(row, vars, sol) {
  const lhs = row.a.reduce((s, c, i) => s.add(c.mul(sol[i])), F(0));
  const parts = row.a.map((c, i) => (c.isZero() ? null : `${c.isOne() ? "" : c.eq(-1) ? "-" : ft(c)}${c.isOne() || c.eq(-1) ? "" : " \\cdot "}${paren(sol[i])}`)).filter(Boolean);
  return `${parts.join(" + ").replace(/\+ -/g, "- ")} = ${ft(lhs)} \\;\\checkmark`;
}

// ---------- 2x2 substitution ----------

function substitution2(rows0, vars) {
  const rows = rows0.map(tidyRow);
  // pick an equation and variable with coefficient ±1, else the smallest
  let best = null;
  rows.forEach((r, i) =>
    r.a.forEach((c, j) => {
      if (c.isZero()) return;
      const score = Math.abs(c.valueOf()) === 1 ? 0 : Math.abs(c.valueOf());
      if (!best || score < best.score) best = { i, j, score };
    })
  );
  if (!best) return null;
  const { i, j } = best;
  const r = rows[i];
  const o = 1 - j;
  const steps = [];
  // vars[j] = (c - a_o vars[o]) / a_j
  const expr = expand(div(add(num(r.c), mul(num(r.a[o].neg()), sym(vars[o]))), num(r.a[j])));
  steps.push(S(`Solve equation (${i + 1}) for $${vars[j]}$.`, eqTex(sym(vars[j]), expr)));
  const other = rows[1 - i];
  const pluggedL = add(mul(num(other.a[j]), expr.t === "add" ? expr : expr), mul(num(other.a[o]), sym(vars[o])));
  const shown = `${ft(other.a[j]).replace(/^1$/, "").replace(/^-1$/, "-")}\\left(${tex(expr)}\\right) ${other.a[o].sign < 0 ? "-" : "+"} ${tex(simplify(mul(num(other.a[o].abs()), sym(vars[o]))))} = ${ft(other.c)}`;
  steps.push(S(`Substitute that into equation (${2 - i}).`, shown));
  const simplified = expand(pluggedL);
  steps.push(S("Distribute and combine like terms.", eqTex(simplified, num(other.c))));
  const coef = other.a[o].add(other.a[j].mul(r.a[o].neg().div(r.a[j])));
  const constPart = other.a[j].mul(r.c.div(r.a[j]));
  if (coef.isZero()) {
    const many = constPart.eq(other.c);
    steps.push(S(many ? "The variable cancels and the result is always true: infinitely many solutions." : "The variable cancels and the result is false: no solution.", null));
    return { method: { name: "Substitution", steps } };
  }
  const val = other.c.sub(constPart).div(coef);
  steps.push(S(`Solve for $${vars[o]}$.`, `${vars[o]} = ${ft(val)}`));
  const back = simplify(substitute(expr, vars[o], num(val)));
  steps.push(S(`Put $${vars[o]} = ${ft(val)}$ back into $${vars[j]} = ${tex(expr)}$.`, `${vars[j]} = ${tex(back)}`));
  return { method: { name: "Substitution", steps } };
}

// ---------- n x n elimination ----------

function gaussian(rows0, vars, eqs) {
  const steps = [];
  let rows = rows0.map(tidyRow);
  const labels = rows.map((_, i) => `(${i + 1})`);
  steps.push(
    S(
      eqs.some((e, i) => eqTex(e.L, e.R) !== rowTex(rows[i], vars)) ? "Write each equation in standard form and label them." : "Label the equations.",
      `\\begin{aligned} ${rows.map((r, i) => `&${labels[i]}\\quad ${rowTex(r, vars)}`).join(" \\\\ ")} \\end{aligned}`
    )
  );
  const n = vars.length;
  let pivotRow = 0;
  const pivots = [];
  let next = rows.length + 1;
  for (let col = 0; col < n && pivotRow < rows.length; col++) {
    // choose a row with a nonzero coefficient, preferring ±1
    let best = -1;
    for (let r = pivotRow; r < rows.length; r++) {
      if (rows[r].a[col].isZero()) continue;
      if (best < 0 || (Math.abs(rows[r].a[col].valueOf()) === 1 && Math.abs(rows[best].a[col].valueOf()) !== 1)) best = r;
    }
    if (best < 0) continue;
    if (best !== pivotRow) {
      [rows[best], rows[pivotRow]] = [rows[pivotRow], rows[best]];
      [labels[best], labels[pivotRow]] = [labels[pivotRow], labels[best]];
    }
    const P = rows[pivotRow];
    for (let r = pivotRow + 1; r < rows.length; r++) {
      const c = rows[r].a[col];
      if (c.isZero()) continue;
      const p = P.a[col];
      const L = lcm(Math.abs(p.n), Math.abs(c.n));
      const mp = new Frac(L / Math.abs(p.n));
      const mr = new Frac(L / Math.abs(c.n));
      const same = Math.sign(p.n) === Math.sign(c.n);
      // new = mr*row_r -/+ mp*P so the column cancels
      const nr = tidyRow(addRows(scaleRow(rows[r], mr), scaleRow(P, same ? mp.neg() : mp)));
      const lbl = `(${next++})`;
      const desc = `${fmtMult(mr)}${labels[r]} ${same ? "-" : "+"} ${fmtMult(mp)}${labels[pivotRow]}`;
      steps.push(S(`Eliminate $${vars[col]}$ from ${labels[r]} using ${labels[pivotRow]}: $${desc}$.`, `${lbl}\\quad ${rowTex(nr, vars)}`));
      rows[r] = nr;
      labels[r] = lbl;
    }
    pivots.push({ row: pivotRow, col });
    pivotRow++;
  }
  // inconsistency / dependence
  for (let r = pivotRow; r < rows.length; r++) {
    if (rows[r].a.every(c => c.isZero())) {
      if (!rows[r].c.isZero()) {
        steps.push(S(`Equation ${labels[r]} says $0 = ${ft(rows[r].c)}$, which is impossible.`, null));
        return { kind: "none", method: { name: "Elimination", steps } };
      }
    }
  }
  if (pivots.length < n) {
    steps.push(S("The equations don't determine every variable, so there are infinitely many solutions.", null));
    return { kind: "many", method: { name: "Elimination", steps } };
  }
  // back substitution
  const sol = Array(n).fill(null);
  for (let k = pivots.length - 1; k >= 0; k--) {
    const { row, col } = pivots[k];
    const R = rows[row];
    let rhs = R.c;
    const knownParts = [];
    R.a.forEach((c, j) => {
      if (j !== col && !c.isZero()) {
        rhs = rhs.sub(c.mul(sol[j]));
        knownParts.push(`${vars[j]} = ${ft(sol[j])}`);
      }
    });
    const val = rhs.div(R.a[col]);
    sol[col] = val;
    steps.push(
      S(
        knownParts.length ? `Substitute ${knownParts.map(p => `$${p}$`).join(" and ")} into ${labels[row]} and solve for $${vars[col]}$.` : `Solve ${labels[row]} for $${vars[col]}$.`,
        `${vars[col]} = ${ft(val)}`
      )
    );
  }
  steps.push(S("Check in an original equation.", checkTex(rows0.map(tidyRow)[0], vars, sol)));
  return { kind: "one", solutions: [sol.map(f => ({ tex: ft(f), value: f.valueOf() }))], method: { name: "Elimination", steps } };
}

const fmtMult = f => (f.isOne() ? "" : f.eq(-1) ? "-" : `${ft(f)}\\cdot`);

// ---------- one linear + one nonlinear ----------

function nonlinear2(eqs, rows, vars) {
  const li = rows.findIndex(Boolean);
  if (li < 0) return null;
  const row = rows[li];
  // solve the linear one for a variable that has a nonzero coefficient, preferring y
  const j = !row.a[1].isZero() ? 1 : 0;
  const o = 1 - j;
  const expr = simplify(div(add(num(row.c), mul(num(row.a[o].neg()), sym(vars[o]))), num(row.a[j])));
  const steps = [S(`Solve the linear equation for $${vars[j]}$.`, eqTex(sym(vars[j]), expr))];
  const other = eqs[1 - li];
  const L = substitute(other.L, vars[j], expr);
  const R = substitute(other.R, vars[j], expr);
  steps.push(S(`Substitute it into the other equation.`, eqTex(L, R)));
  const r = solveEquation(L, R, vars[o]);
  if (r.methods[0]) steps.push(...r.methods[0].steps.filter(s => !s.text.startsWith("Check")).map(s => ({ ...s, sub: true })));
  const xs = (r.graph?.points ?? []).map(p => p.x);
  const texes = r.answers.map(a => {
    const m = /= (.*)$/.exec(a);
    return m && !a.includes("approx") ? m[1] : null;
  });
  const solutions = xs.map((x, i) => {
    const yExact = texes[i] ? (() => {
      try {
        const t = simplify(substitute(expr, vars[o], num(Frac.parse(String(x)))));
        return Number.isInteger(x) || /^-?\d+(\.\d+)?$/.test(String(x)) ? t : null;
      } catch {
        return null;
      }
    })() : null;
    const y = evaluate(expr, { [vars[o]]: x });
    const pair = [
      { tex: texes[i] ?? dec(x), value: x },
      { tex: yExact ? tex(yExact) : dec(y), value: y },
    ];
    return o === 0 ? pair : pair.reverse();
  });
  if (solutions.length)
    steps.push(
      S(
        `Put each value back into $${vars[j]} = ${tex(expr)}$.`,
        solutions.map(s => `\\left(${s.map(p => p.tex).join(", ")}\\right)`).join(", \\quad ")
      )
    );
  else steps.push(S("There are no real solutions, so the graphs don't meet.", null));
  return { kind: solutions.length ? "one" : "none", topic: "Nonlinear system", solutions, method: { name: "Substitution", steps } };
}
