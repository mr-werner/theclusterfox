// Arithmetic, one operation at a time in order-of-operations order, with exact
// fractions (and the common-denominator work shown when adding them).

import { Frac, exactRoot, fmtNum, lcm } from "../engine/frac.js";
import { rawTex } from "../engine/tex.js";
import { recognize } from "../engine/numeric.js";
import { S, result } from "./common.js";

const isAtom = n => n.k === "num" || n.k === "dec";
const val = n => (n.k === "num" ? n.v.valueOf() : n.x);
const mkNum = f => ({ k: "num", v: f });
const mkDec = (x, tx) => ({ k: "dec", x, tx });
const ft = f => (f.d === 1 ? String(f.n) : `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`);
const at = n => (n.k === "num" ? ft(n.v) : n.tx ?? fmtNum(n.x, 10));
const pa = n => (val(n) < 0 ? `\\left(${at(n)}\\right)` : at(n));

const RULES = [
  "Work out the function or absolute value first.",
  "Exponents come next.",
  "",
  "Multiply and divide from left to right.",
  "Add and subtract from left to right.",
];

// Constants become atoms.
function prep(n) {
  switch (n.k) {
    case "sym":
      if (n.n === "pi") return mkDec(Math.PI, "\\pi");
      if (n.n === "e") return mkDec(Math.E, "e");
      throw new Error(`variable ${n.n}`);
    case "num":
      return n;
    case "paren":
    case "abs":
    case "fact":
    case "pct":
    case "neg":
      return { ...n, a: prep(n.a) };
    case "call":
      return { ...n, a: prep(n.a), base: n.base ? prep(n.base) : null };
    case "bin":
      if (n.op === "/" && n.l.k === "num" && n.r.k === "num" && n.l.v.isInt() && n.r.v.isInt() && !n.r.v.isZero() && n.l.v.n % n.r.v.n !== 0)
        return mkNum(n.l.v.div(n.r.v));
      return { ...n, l: prep(n.l), r: prep(n.r) };
  }
  throw new Error("unsupported");
}

export function hasVariables(raw) {
  let found = false;
  const walk = n => {
    if (!n) return;
    if (n.k === "sym" && n.n !== "pi" && n.n !== "e") found = true;
    ["a", "l", "r", "base"].forEach(k => n[k] && walk(n[k]));
  };
  walk(raw);
  return found;
}

// Apply one operation to atoms. Returns { node, text, work }.
function apply(n) {
  const fracOK = (...xs) => xs.every(x => x.k === "num");
  switch (n.k) {
    case "neg": {
      const a = n.a;
      return { node: a.k === "num" ? mkNum(a.v.neg()) : mkDec(-a.x), text: "Apply the negative sign.", silent: true };
    }
    case "paren":
      return { node: n.a, silent: true };
    case "abs":
      return { node: n.a.k === "num" ? mkNum(n.a.v.abs()) : mkDec(Math.abs(n.a.x)), text: `The absolute value of $${at(n.a)}$ is its distance from zero.`, work: `\\left|${at(n.a)}\\right| = ${at(n.a.k === "num" ? mkNum(n.a.v.abs()) : mkDec(Math.abs(n.a.x)))}` };
    case "pct": {
      const r = n.a.k === "num" ? mkNum(n.a.v.div(100)) : mkDec(n.a.x / 100);
      return { node: r, text: "Percent means “out of 100”.", work: `${at(n.a)}\\% = \\frac{${at(n.a)}}{100} = ${at(r)}` };
    }
    case "fact": {
      const x = val(n.a);
      if (!Number.isInteger(x) || x < 0 || x > 170) throw new Error("Factorials need a whole number from 0 to 170");
      let f = 1;
      const parts = [];
      for (let i = x; i >= 1; i--) {
        f *= i;
        if (parts.length < 8) parts.push(i);
      }
      const r = Number.isSafeInteger(f) ? mkNum(new Frac(f)) : mkDec(f);
      return { node: r, text: `A factorial multiplies every whole number from ${x} down to 1.`, work: `${x}! = ${x <= 1 ? "1" : parts.join(" \\times ") + (x > 8 ? " \\times \\cdots" : "")} = ${at(r)}` };
    }
    case "call": {
      const a = n.a.k === "paren" ? n.a.a : n.a;
      const x = isAtom(a) ? val(a) : evalRaw(a);
      let r;
      let text;
      let work;
      if (n.f === "sqrt" || n.f === "cbrt") {
        const k = n.f === "sqrt" ? 2 : 3;
        if (k === 2 && x < 0) throw new Error("The square root of a negative number isn't a real number");
        if (a.k === "num") {
          const t = exactRoot(a.v.n, k);
          const b = exactRoot(a.v.d, k);
          if (t !== null && b !== null) r = mkNum(new Frac(t, b));
        }
        r ??= mkDec(k === 2 ? Math.sqrt(x) : Math.cbrt(x));
        text = k === 2 ? `Take the square root: which number times itself is $${at(a)}$?` : "Take the cube root.";
        work = `${k === 2 ? "\\sqrt" : "\\sqrt[3]"}{${at(a)}} ${r.k === "num" ? "=" : "\\approx"} ${at(r)}`;
      } else {
        const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, ln: Math.log, log: Math.log10, exp: Math.exp, abs: Math.abs, sec: t => 1 / Math.cos(t), csc: t => 1 / Math.sin(t), cot: t => 1 / Math.tan(t), sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh }[n.f];
        if (!F) throw new Error(`Unknown function ${n.f}`);
        let y = F(x);
        if (n.f === "log" && n.base) y = Math.log(x) / Math.log(val(n.base));
        if (!Number.isFinite(y)) throw new Error(`${n.f}(${fmtNum(x)}) is undefined`);
        const named = recognize(y);
        r = named && /^-?\d+$|frac\{\d+\}\{\d+\}$/.test(named.tex) && Math.abs(y - named.value) < 1e-12 ? mkNum(Frac.parse(String(named.value)).d <= 64 ? fracFrom(named.value) : new Frac(0)) : mkDec(y);
        const nm = { asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan", log: n.base ? `\\log_{${at(n.base)}}` : "\\log" }[n.f] ?? `\\${n.f}`;
        text = n.f.match(/sin|cos|tan|sec|csc|cot/) ? "Evaluate the trig function (angles are in radians)." : "Evaluate the function.";
        work = `${nm}\\left(${isAtom(a) ? at(a) : rawTex(a)}\\right) ${r.k === "num" ? "=" : "\\approx"} ${at(r)}`;
      }
      return { node: r, text, work };
    }
    case "bin": {
      const { l, r } = n;
      const op = n.op === "impl" ? "*" : n.op;
      if (op === "^") {
        let res;
        if (fracOK(l, r) && r.v.isInt() && Math.abs(r.v.n) <= 64) {
          try {
            res = mkNum(l.v.pow(r.v.n));
          } catch {
            res = mkDec(val(l) ** val(r));
          }
        } else if (fracOK(l, r) && l.v.sign >= 0) {
          const t = exactRoot(l.v.n, r.v.d);
          const b = exactRoot(l.v.d, r.v.d);
          res = t !== null && b !== null ? mkNum(new Frac(t, b).pow(r.v.n)) : mkDec(val(l) ** val(r));
        } else res = mkDec(val(l) ** val(r));
        if (!Number.isFinite(val(res))) throw new Error("That power isn't a real number");
        const expl = fracOK(l, r) && r.v.isInt() && r.v.n > 1 && r.v.n <= 5 ? Array(r.v.n).fill(pa(l)).join(" \\times ") : "";
        return { node: res, text: expl ? `Evaluate the power: $${pa(l)}^{${at(r)}} = ${expl}$.` : "Evaluate the power.", work: `${pa(l)}^{${at(r)}} ${res.k === "num" ? "=" : "\\approx"} ${at(res)}` };
      }
      if (op === "/" && val(r) === 0) throw new Error("Division by zero is undefined");
      if (fracOK(l, r)) {
        const a = l.v;
        const b = r.v;
        let res;
        let work;
        let text;
        if (op === "+" || op === "-") {
          res = op === "+" ? a.add(b) : a.sub(b);
          text = op === "+" ? "Add." : "Subtract.";
          if ((a.d !== 1 || b.d !== 1) && a.d !== b.d) {
            const L = lcm(a.d, b.d);
            const A = `\\frac{${a.n * (L / a.d)}}{${L}}`;
            const B = `\\frac{${Math.abs(b.n) * (L / b.d)}}{${L}}`;
            const top = op === "+" ? a.n * (L / a.d) + b.n * (L / b.d) : a.n * (L / a.d) - b.n * (L / b.d);
            text = `${op === "+" ? "Add" : "Subtract"} the fractions: rewrite both over the common denominator $${L}$.`;
            work = `${ft(a)} ${op} ${pa(l)} = ${A} ${op === "+" ? (b.n < 0 ? "-" : "+") : b.n < 0 ? "+" : "-"} ${B} = \\frac{${top}}{${L}}${new Frac(top, L).d !== L ? ` = ${ft(res)}` : ""}`.replace(`${ft(a)} ${op} ${pa(l)}`, `${ft(a)} ${op} ${pa(r)}`);
          } else if (a.d !== 1 && a.d === b.d) {
            const top = op === "+" ? a.n + b.n : a.n - b.n;
            text = `${op === "+" ? "Add" : "Subtract"} the numerators; the denominators already match.`;
            work = `${ft(a)} ${op} ${pa(r)} = \\frac{${top}}{${a.d}}${new Frac(top, a.d).d !== a.d ? ` = ${ft(res)}` : ""}`;
          } else work = `${at(l)} ${op} ${pa(r)} = ${ft(res)}`;
        } else if (op === "*") {
          res = a.mul(b);
          text = "Multiply.";
          if (a.d !== 1 || b.d !== 1) {
            text = "Multiply the fractions: tops times tops, bottoms times bottoms.";
            work = `${pa(l)} \\times ${pa(r)} = \\frac{${a.n} \\times ${b.n < 0 ? `(${b.n})` : b.n}}{${a.d} \\times ${b.d}}${a.n * b.n !== res.n || a.d * b.d !== res.d ? ` = \\frac{${a.n * b.n}}{${a.d * b.d}}` : ""} = ${ft(res)}`;
          } else work = `${at(l)} \\times ${pa(r)} = ${ft(res)}`;
        } else {
          res = a.div(b);
          if (a.d === 1 && b.d === 1) {
            text = res.d === 1 ? "Divide." : "Divide. It doesn't come out even, so write it as a fraction in lowest terms.";
            work = `${at(l)} \\div ${pa(r)} = ${ft(res)}`;
          } else {
            text = "Divide by a fraction by multiplying by its reciprocal (flip it).";
            work = `${pa(l)} \\div ${pa(r)} = ${pa(l)} \\times ${ft(b.inv())} = ${ft(res)}`;
          }
        }
        return { node: mkNum(res), text, work };
      }
      const x = val(l);
      const y = val(r);
      const z = op === "+" ? x + y : op === "-" ? x - y : op === "*" ? x * y : x / y;
      const res = mkDec(z);
      const sym = { "+": "+", "-": "-", "*": "\\times", "/": "\\div" }[op];
      return { node: res, text: { "+": "Add.", "-": "Subtract.", "*": "Multiply.", "/": "Divide." }[op], work: `${pa(l)} ${sym} ${pa(r)} \\approx ${at(res)}` };
    }
  }
  throw new Error("Can't evaluate that");
}

function fracFrom(x) {
  for (let d = 1; d <= 64; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-12) return new Frac(n, d);
  }
  return new Frac(0);
}

const RANK = n => {
  if (n.k === "call" || n.k === "abs" || n.k === "fact" || n.k === "pct") return 0;
  if (n.k === "bin" && n.op === "^") return 1;
  if (n.k === "neg") return 2;
  if (n.k === "bin" && ["*", "/", "impl"].includes(n.op)) return 3;
  if (n.k === "bin") return 4;
  if (n.k === "paren") return 2;
  return 9;
};

const children = n => (n.k === "bin" ? [n.l, n.r] : n.k === "call" ? [n.a.k === "paren" ? n.a.a : n.a] : n.a ? [n.a] : []);
const callArg = n => (n.a.k === "paren" ? n.a.a : n.a);
const hasConst = n => (n.k === "dec" && n.tx) || ["a", "l", "r"].some(k => n[k] && hasConst(n[k]));
const ready = n =>
  (n.k === "call" && hasConst(callArg(n)) && !/sqrt|cbrt/.test(n.f)) ||
  (children(n).every(isAtom) && (n.k !== "call" || !n.base || isAtom(n.base)));

function evalRaw(n) {
  switch (n.k) {
    case "num":
      return n.v.valueOf();
    case "dec":
      return n.x;
    case "paren":
      return evalRaw(n.a);
    case "neg":
      return -evalRaw(n.a);
    case "bin": {
      const a = evalRaw(n.l);
      const b = evalRaw(n.r);
      return { "+": a + b, "-": a - b, "*": a * b, impl: a * b, "/": a / b, "^": a ** b }[n.op];
    }
    case "abs":
      return Math.abs(evalRaw(n.a));
    case "pct":
      return evalRaw(n.a) / 100;
    default:
      return NaN;
  }
}

// Find the next node to reduce: innermost grouping first, then by rank, leftmost.
function pick(root) {
  // innermost grouping with unfinished work
  const groupWithWork = n => {
    if (n.k === "call" && ready(n)) return null;
    for (const c of children(n)) {
      const g = groupWithWork(c);
      if (g) return g;
    }
    if (n.k === "call" && ready(n)) return null;
    if ((n.k === "paren" || n.k === "abs" || n.k === "call") && !isAtom(n.k === "call" ? (n.a.k === "paren" ? n.a.a : n.a) : n.a)) return n;
    return null;
  };
  const region = groupWithWork(root);
  const scope = region ? (region.k === "call" ? (region.a.k === "paren" ? region.a.a : region.a) : region.a) : root;
  let best = null;
  const visit = n => {
    if (isAtom(n)) return;
    if (n !== scope && (n.k === "paren" || n.k === "abs" || n.k === "call") && !ready(n)) return;
    if (!(n.k === "call" && ready(n))) children(n).forEach(visit);
    if (ready(n)) {
      const r = RANK(n);
      if (!best || r < best.r) best = { n, r };
    }
  };
  visit(scope);
  return best ? { n: best.n, grouped: !!region && region.k === "paren" } : null;
}

function replace(root, target, by) {
  if (root === target) return by;
  if (isAtom(root) || root.k === "sym") return root;
  const out = { ...root };
  if (root.k === "bin") {
    out.l = replace(root.l, target, by);
    out.r = replace(root.r, target, by);
  } else if (root.a) out.a = replace(root.a, target, by);
  return out;
}

// Tidy: drop parentheses around single numbers (keep them for negatives inside products).
function tidy(n) {
  if (isAtom(n) || n.k === "sym") return n;
  if (n.k === "paren" && isAtom(n.a)) return n.a;
  if (n.k === "call" && n.a.k === "paren" && isAtom(n.a.a)) return { ...n, a: n.a };
  const out = { ...n };
  if (n.k === "bin") {
    out.l = tidy(n.l);
    out.r = tidy(n.r);
  } else if (n.a) out.a = tidy(n.a);
  return out;
}

export function arithmeticResult(raw0) {
  let raw = prep(raw0);
  const problem = rawTex(raw0);
  const steps = [];
  let guard = 0;
  let lastRule = null;
  while (!isAtom(raw) && guard++ < 80) {
    const picked = pick(raw);
    if (!picked) break;
    const target = picked.n;
    const out = apply(target);
    raw = tidy(replace(raw, target, out.node));
    if (out.silent) continue;
    const r = RANK(target);
    const rule = picked.grouped ? "Parentheses first." : RULES[r];
    const inGroup = lastRule === rule || !rule ? "" : `${rule} `;
    lastRule = rule;
    steps.push(S(`${inGroup}${out.text}`, rawTex(raw), out.work));
  }
  const ans = raw;
  const answers = [];
  const approx = [];
  if (ans.k === "num") {
    answers.push(ft(ans.v));
    if (ans.v.d !== 1) {
      const whole = Math.trunc(ans.v.n / ans.v.d);
      if (whole !== 0) approx.push(`= ${whole < 0 ? "-" : ""}${Math.abs(whole)}\\tfrac{${Math.abs(ans.v.n) % ans.v.d}}{${ans.v.d}}`);
      approx.push(`= ${fmtNum(ans.v.valueOf(), 12)}${String(fmtNum(ans.v.valueOf(), 12)).length > 10 ? "\\ldots" : ""}`);
    }
  } else {
    const named = recognize(ans.x);
    answers.push(named && named.tex.length < 18 && !/^-?\d+$/.test(named.tex) ? named.tex : `${fmtNum(ans.x, 12)}`);
    if (named && answers[0] === named.tex) approx.push(`\\approx ${fmtNum(ans.x, 10)}`);
  }
  if (steps.length) {
    const last = steps[steps.length - 1];
    if (last.tex !== answers[0]) steps.push(S("Final answer:", answers[0]));
  }
  return result({
    topic: "Arithmetic",
    problem,
    answers,
    approx,
    methods: steps.length ? [{ name: "Order of operations", steps }] : [],
    notes: steps.length > 1 ? ["Order of operations: parentheses, exponents, multiplication and division (left to right), then addition and subtraction (left to right)."] : [],
  });
}
