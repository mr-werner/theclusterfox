import assert from "node:assert/strict";
import { Frac } from "../engine/frac.js";
import { parseExpr } from "../engine/parse.js";
import { fn1 } from "../engine/expr.js";
import { derivative } from "../solvers/derivative.js";
import { integrate } from "../solvers/integral.js";
import { previewTex, solve } from "../solve.js";
import { topics } from "../data/examples.js";
import { MAX_HISTORY, pushHistory } from "../state/history.js";

// Exact fractions.
assert.equal(new Frac(6, -8).toString(), "-3/4");
assert(Frac.parse("0.125").eq(new Frac(1, 8)));
assert(new Frac(1, 3).add(new Frac(1, 6)).eq(new Frac(1, 2)));

// Each problem gives exactly these answers (in any order) and at least one worked method.
const cases = [
  ["2x + 3 = 11", ["x = 4"]],
  ["x^2 - 5x + 6 = 0", ["x = 2", "x = 3"]],
  ["x^2 + 2x - 4 = 0", ["x = -1 - \\sqrt{5}", "x = -1 + \\sqrt{5}"]],
  ["x^3 - 6x^2 + 11x - 6 = 0", ["x = 1", "x = 2", "x = 3"]],
  ["|x - 3| = 5", ["x = 8", "x = -2"]],
  ["2^x = 8", ["x = 3"]],
  ["sqrt(x + 3) = x - 3", ["x = 6"]],
  ["ln(x) = 2", ["x = e^{2}"]],
  ["x/(x-2) = 3", ["x = 3"]],
  ["3x - 7 < 5", ["x < 4", "(-\\infty, 4)"]],
  ["-1 < 2x + 3 <= 7", ["-2 < x \\le 2", "(-2, 2]"]],
  ["2x + y = 7, x - y = 2", ["\\left(x, y\\right) = \\left(3, 1\\right)"]],
  ["x + y + z = 6, x - y + z = 2, 2x + y - z = 1", ["x = 1, \\; y = 2, \\; z = 3"]],
  ["expand (x + 3)^2", ["x^{2} + 6x + 9"]],
  ["factor x^2 - 9", ["\\left(x - 3\\right)\\left(x + 3\\right)"]],
  ["simplify (x^2 - 1)/(x - 1)", ["x + 1"]],
  ["integral of x^2 from 0 to 3", ["\\int_{0}^{3} x^{2}\\,dx = 9"]],
  ["limit of sin(x)/x as x -> 0", ["\\lim_{x \\to 0} \\frac{\\sin\\left(x\\right)}{x} = 1"]],
  ["limit of (1 + 1/x)^x as x -> inf", ["\\lim_{x \\to \\infty} \\left(1 + \\frac{1}{x}\\right)^{x} = e"]],
  ["median 1, 3, 5, 7", ["\\text{Median} = 4"]],
  ["3/4 + 5/6", ["\\frac{19}{12}"]],
  ["2 + 3 * 4", ["14"]],
  ["5!", ["120"]],
  ["15% of 80", ["12"]],
];
for (const [q, want] of cases) {
  const r = solve(q);
  assert.deepEqual([...r.answers].sort(), [...want].sort(), `${q}: got ${JSON.stringify(r.answers)}`);
  assert(r.methods.length > 0 && r.methods.every(m => m.steps.length > 0), `${q}: needs worked steps`);
}

// Quadratics offer all three methods when they factor.
assert.deepEqual(
  solve("x^2 - 5x + 6 = 0").methods.map(m => m.name).sort(),
  ["Completing the square", "Factoring", "Quadratic formula"].sort()
);

// Inequalities come with a number line; equations and functions with a graph.
assert(solve("3x - 7 < 5").numberLine);
assert(solve("2x + 3 = 11").graph);
const fn = solve("y = x^2 - 4x + 3");
assert(fn.graph && fn.table.length > 0, "functions get a graph and facts");
assert(fn.graph.points.some(p => p.x === 1 && p.y === 0) && fn.graph.points.some(p => p.x === 3 && p.y === 0), "roots are marked");

// Bad input explains itself rather than crashing.
assert.throws(() => solve("2x + )"));

// Derivatives match a numeric derivative.
const close = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const xs = [0.3, 0.7, 1.3, 2.1];
for (const f of ["x^3 - 2x", "x^2 sin(x)", "e^(2x)", "ln(x^2 + 1)", "sin(x)/x", "sqrt(3x + 1)", "x^x", "tan(x)", "atan(x)", "cos(x)^2"]) {
  const e = parseExpr(f);
  const F = fn1(e, "x");
  const D = fn1(derivative(e, "x"), "x");
  for (const x of xs) {
    const h = 1e-5;
    const num = (F(x + h) - F(x - h)) / (2 * h);
    assert(close(D(x), num), `d/dx ${f} at ${x}: ${D(x)} vs ${num}`);
  }
}

// Antiderivatives differentiate back to the integrand.
for (const f of ["3x^2 + 2", "sin(2x)", "x e^x", "1/(x^2 + 1)", "x ln(x)", "1/(x^2 - 1)", "2x cos(x^2)", "(x + 1)/(x^2 + 2x + 5)", "e^(3x)", "sec(x)^2"]) {
  const e = parseExpr(f);
  const F = integrate(e, "x", []);
  assert(F, `could not integrate ${f}`);
  const Ff = fn1(F, "x");
  const fx = fn1(e, "x");
  for (const x of [1.3, 1.7, 2.4]) {
    const h = 1e-5;
    const num = (Ff(x + h) - Ff(x - h)) / (2 * h);
    assert(close(num, fx(x), 1e-3), `∫ ${f} at ${x}: ${num} vs ${fx(x)}`);
  }
}

// Every example on the page solves.
for (const t of topics) {
  assert(t.examples.length >= 3, `${t.id}: needs examples`);
  for (const ex of t.examples) {
    const r = solve(ex);
    assert(r.answers.length > 0 || r.graph || r.table?.length, `${ex}: no answer, graph or table`);
  }
}

// The live preview is forgiving.
assert(!previewTex(""));
assert(typeof previewTex("x^2 + ") === "string" || previewTex("x^2 + ") === null);

// History de-duplicates and caps.
let h = [];
for (let i = 0; i < 20; i++) h = pushHistory(h, `q${i}`);
h = pushHistory(h, "q15");
assert.equal(h.length, MAX_HISTORY);
assert.equal(h[0], "q15");
assert.equal(h.filter(x => x === "q15").length, 1);

console.log("math: all checks passed");
