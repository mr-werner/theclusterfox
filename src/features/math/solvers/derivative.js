// Derivatives, showing each rule as it is used.

import { add, depends, div, E, fn, fn1, isNum, isSym, mul, neg, num, pow, substitute, evaluate } from "../engine/expr.js";
import { expand, simplify } from "../engine/simplify.js";
import { tex } from "../engine/tex.js";
import { S, dec, result } from "./common.js";
import { recognize } from "../engine/numeric.js";

const D = (a, v) => ({ t: "d", a, v });

// Outer derivatives g'(u) for g(u)
const OUTER = {
  sin: u => fn("cos", u),
  cos: u => neg(fn("sin", u)),
  tan: u => pow(fn("sec", u), num(2)),
  sec: u => mul(fn("sec", u), fn("tan", u)),
  csc: u => neg(mul(fn("csc", u), fn("cot", u))),
  cot: u => neg(pow(fn("csc", u), num(2))),
  asin: u => pow(add(num(1), neg(pow(u, num(2)))), num(-1 / 2)),
  acos: u => neg(pow(add(num(1), neg(pow(u, num(2)))), num(-1 / 2))),
  atan: u => pow(add(num(1), pow(u, num(2))), num(-1)),
  sinh: u => fn("cosh", u),
  cosh: u => fn("sinh", u),
  tanh: u => add(num(1), neg(pow(fn("tanh", u), num(2)))),
  ln: u => pow(u, num(-1)),
  log: u => pow(mul(u, fn("ln", num(10))), num(-1)),
  abs: u => mul(u, pow(fn("abs", u), num(-1))),
};

const RULE_NAME = {
  sin: "The derivative of $\\sin u$ is $\\cos u$.",
  cos: "The derivative of $\\cos u$ is $-\\sin u$.",
  tan: "The derivative of $\\tan u$ is $\\sec^2 u$.",
  sec: "The derivative of $\\sec u$ is $\\sec u \\tan u$.",
  csc: "The derivative of $\\csc u$ is $-\\csc u \\cot u$.",
  cot: "The derivative of $\\cot u$ is $-\\csc^2 u$.",
  asin: "The derivative of $\\arcsin u$ is $\\frac{1}{\\sqrt{1 - u^2}}$.",
  acos: "The derivative of $\\arccos u$ is $-\\frac{1}{\\sqrt{1 - u^2}}$.",
  atan: "The derivative of $\\arctan u$ is $\\frac{1}{1 + u^2}$.",
  sinh: "The derivative of $\\sinh u$ is $\\cosh u$.",
  cosh: "The derivative of $\\cosh u$ is $\\sinh u$.",
  tanh: "The derivative of $\\tanh u$ is $1 - \\tanh^2 u$.",
  ln: "The derivative of $\\ln u$ is $\\frac{1}{u}$.",
  log: "The derivative of $\\log_{10} u$ is $\\frac{1}{u \\ln 10}$.",
  abs: "The derivative of $|u|$ is $\\frac{u}{|u|}$ (for $u \\ne 0$).",
};

function tidy(e) {
  const s = simplify(e);
  try {
    const x = expand(s);
    if (tex(x).length <= tex(s).length) return x;
  } catch {
    // too big to expand
  }
  return s;
}

export function differentiate(e, v, steps = []) {
  const sub = (a, depth) => d(a, depth);
  const d = (n, depth = 0) => {
    if (!depends(n, v)) {
      if (depth === 0) steps.push(S("The derivative of a constant is $0$.", `${tex(D(n, v))} = 0`));
      return num(0);
    }
    if (isSym(n, v)) {
      steps.push(S(`The derivative of $${v}$ is $1$.`, `${tex(D(n, v))} = 1`));
      return num(1);
    }
    switch (n.t) {
      case "add": {
        const consts = n.a.filter(t => !depends(t, v));
        steps.push(
          S(
            `Sum rule: differentiate each term separately.${consts.length ? " Constant terms have derivative $0$." : ""}`,
            `${tex(D(n, v))} = ${tex(add(n.a.filter(t => depends(t, v)).map(t => D(t, v))))}`
          )
        );
        return simplify(add(n.a.map(t => sub(t, depth + 1))));
      }
      case "mul": {
        const C = n.a.filter(f => !depends(f, v));
        const G = n.a.filter(f => depends(f, v));
        if (C.length) {
          const g = G.length === 1 ? G[0] : mul(G);
          const c = simplify(mul(C));
          steps.push(S("Constant multiple rule: pull the constant out front.", `${tex(D(n, v))} = ${tex(c)} \\cdot ${tex(D(g, v))}`));
          return simplify(mul(c, sub(g, depth + 1)));
        }
        const numer = G.filter(f => !(f.t === "pow" && isNum(f.e) && f.e.v.sign < 0));
        const denom = G.filter(f => f.t === "pow" && isNum(f.e) && f.e.v.sign < 0).map(f => (f.e.v.eq(-1) ? f.b : pow(f.b, num(f.e.v.neg()))));
        if (numer.length && denom.length) {
          const f = numer.length === 1 ? numer[0] : mul(numer);
          const g = denom.length === 1 ? denom[0] : mul(denom);
          steps.push(
            S(
              `Quotient rule: $\\left(\\frac{f}{g}\\right)' = \\frac{f'g - fg'}{g^2}$ with $f = ${tex(f)}$ and $g = ${tex(g)}$.`,
              `${tex(D(n, v))} = \\frac{${tex(D(f, v))} \\cdot ${paren(g)} - ${paren(f)} \\cdot ${tex(D(g, v))}}{${paren(g)}^2}`
            )
          );
          const df = sub(f, depth + 1);
          const dg = sub(g, depth + 1);
          let top = simplify(add(mul(df, g), neg(mul(f, dg))));
          try {
            const ex = expand(top);
            if (tex(ex).length <= tex(top).length * 1.5) top = ex;
          } catch {
            // keep factored
          }
          const res = { t: "mul", a: [top, pow(g, num(-2))] };
          steps.push(S("Put the pieces into the quotient rule and simplify the top.", `${tex(D(n, v))} = \\frac{${tex(top)}}{${paren(g)}^2}`));
          return simplify(res);
        }
        const f = G[0];
        const g = G.length === 2 ? G[1] : mul(G.slice(1));
        steps.push(
          S(
            `Product rule: $(fg)' = f'g + fg'$ with $f = ${tex(f)}$ and $g = ${tex(g)}$.`,
            `${tex(D(n, v))} = ${tex(D(f, v))} \\cdot ${paren(g)} + ${paren(f)} \\cdot ${tex(D(g, v))}`
          )
        );
        const df = sub(f, depth + 1);
        const dg = sub(g, depth + 1);
        return simplify(add(mul(df, g), mul(f, dg)));
      }
      case "pow": {
        const bd = depends(n.b, v);
        const ed = depends(n.e, v);
        if (bd && !ed) {
          const k = n.e;
          const k1 = simplify(add(k, num(-1)));
          if (isSym(n.b, v)) {
            const res = simplify(mul(k, pow(n.b, k1)));
            const root = isNum(k) && !k.v.isInt() ? ` (Write the root as a power: $${tex(n)} = ${n.b.n}^{${tex(k)}}$.)` : "";
            steps.push(S(`Power rule: $\\frac{d}{d${v}}\\left[${v}^n\\right] = n${v}^{n-1}$.${root}`, `${tex(D(n, v))} = ${powerWork(k, v)} = ${tex(res)}`));
            return res;
          }
          steps.push(
            S(
              `Chain rule with the power rule: with $u = ${tex(n.b)}$, $\\frac{d}{d${v}}\\left[u^n\\right] = n u^{n-1} \\cdot u'$.`,
              `${tex(D(n, v))} = ${tex(simplify(mul(k, pow(n.b, k1))))} \\cdot ${tex(D(n.b, v))}`
            )
          );
          const du = sub(n.b, depth + 1);
          return simplify(mul(k, pow(n.b, k1), du));
        }
        if (!bd && ed) {
          const isE = isSym(n.b, "e");
          const outer = isE ? n : mul(n, fn("ln", n.b));
          if (isSym(n.e, v)) {
            steps.push(S(isE ? `The derivative of $e^${v}$ is itself.` : `The derivative of $a^${v}$ is $a^${v} \\ln a$.`, `${tex(D(n, v))} = ${tex(outer)}`));
            return simplify(outer);
          }
          steps.push(
            S(
              isE ? `Chain rule: the derivative of $e^u$ is $e^u \\cdot u'$ with $u = ${tex(n.e)}$.` : `Chain rule: the derivative of $a^u$ is $a^u \\ln a \\cdot u'$ with $u = ${tex(n.e)}$.`,
              `${tex(D(n, v))} = ${tex(outer)} \\cdot ${tex(D(n.e, v))}`
            )
          );
          const du = sub(n.e, depth + 1);
          return simplify(mul(outer, du));
        }
        // f^g: rewrite with e
        const inner = mul(n.e, fn("ln", n.b));
        steps.push(S(`Both the base and exponent change, so write $${tex(n)} = e^{${tex(inner)}}$. Then by the chain rule:`, `${tex(D(n, v))} = ${tex(n)} \\cdot ${tex(D(inner, v))}`));
        const di = sub(inner, depth + 1);
        return simplify(mul(n, di));
      }
      case "fn": {
        const g = OUTER[n.n];
        if (!g) throw new Error(`I don't know how to differentiate ${n.n}`);
        const outer = simplify(g(n.a));
        if (isSym(n.a, v)) {
          steps.push(S(RULE_NAME[n.n], `${tex(D(n, v))} = ${tex(outer)}`));
          return outer;
        }
        steps.push(S(`Chain rule with $u = ${tex(n.a)}$. ${RULE_NAME[n.n]} Then multiply by $u'$.`, `${tex(D(n, v))} = ${paren(outer)} \\cdot ${tex(D(n.a, v))}`));
        const du = sub(n.a, depth + 1);
        return simplify(mul(outer, du));
      }
    }
    throw new Error("I can't differentiate that");
  };
  const raw = d(e);
  return tidy(raw);
}

function powerWork(k, v) {
  const kt = tex(k);
  const kp = k.t === "num" && k.v.sign < 0 ? `\\left(${kt}\\right)` : kt;
  return `${kp}${v}^{${kt} - 1}`;
}

const paren = e => (e.t === "add" || (e.t === "mul" && e.a[0]?.t === "num" && e.a[0].v.sign < 0) ? `\\left(${tex(e)}\\right)` : tex(e));

// Quiet derivative (used by limits and integrals).
export const derivative = (e, v) => differentiate(e, v, []);

export function derivativeResult(e, v, order = 1, at = null) {
  const problem = order === 1 ? tex(D(e, v)) : tex({ t: "d", a: e, v, k: order });
  const steps = [];
  let cur = e;
  for (let k = 1; k <= order; k++) {
    if (order > 1) steps.push(S(k === 1 ? "First derivative" : `${ordinal(k)} derivative: differentiate the result again.`, null));
    const s = [];
    const r = differentiate(cur, v, s);
    steps.push(...s.map(x => ({ ...x, sub: order > 1 })));
    const lastTex = s[s.length - 1]?.tex ?? "";
    if (!lastTex.endsWith(`= ${tex(r)}`)) steps.push(S("Simplify.", `${order > 1 ? (k === 1 ? "f'" : k === 2 ? "f''" : `f^{(${k})}`) : `\\frac{d}{d${v}}`}${order > 1 ? `(${v})` : `\\left[${tex(cur)}\\right]`} = ${tex(r)}`));
    cur = r;
  }
  const answers = [`${order === 1 ? `\\frac{d}{d${v}}\\left[${tex(e)}\\right]` : order === 2 ? `f''(${v})` : `f^{(${order})}(${v})`} = ${tex(cur)}`];
  const approx = [];
  if (at !== null) {
    const val = simplify(substitute(cur, v, at));
    const nv = evaluate(val);
    steps.push(S(`Evaluate at $${v} = ${tex(at)}$.`, `${tex(cur).length > 60 ? "" : `${tex(substitute(cur, v, at))} = `}${tex(val)}`));
    const named = val.t === "num" ? null : recognize(nv);
    answers.push(`\\left.${order === 1 ? "f'" : order === 2 ? "f''" : `f^{(${order})}`}\\right|_{${v} = ${tex(at)}} = ${named ? named.tex : tex(val)}`);
    if (val.t !== "num" && Number.isFinite(nv)) approx.push(`\\approx ${dec(nv)}`);
  }
  const fns = [
    { e, label: `y = ${tex(e)}` },
    { e: cur, label: `y = ${tex(cur)}`, dashed: true },
  ];
  const points = [];
  if (at !== null) {
    const x0 = evaluate(at);
    const y0 = fn1(e, v)(x0);
    const m = fn1(cur, v)(x0);
    if (order === 1 && [x0, y0, m].every(Number.isFinite)) {
      fns.push({ f: x => y0 + m * (x - x0), label: `\\text{tangent: } y = ${dec(m)}(${v} - ${dec(x0)}) + ${dec(y0)}`.replace("+ -", "- ").replace("- -", "+ ") });
      points.push({ x: x0, y: y0, label: "point" });
    }
  }
  return result({
    topic: order === 1 ? "Derivative" : `${ordinal(order)} derivative`,
    problem,
    answers,
    approx,
    methods: [{ name: "Differentiate", steps }],
    graph: { v, fns, points },
    notes: order === 1 ? ["The dashed curve is the derivative: it's positive where the original rises and negative where it falls."] : [],
  });
}

const ordinal = k => ["", "First", "Second", "Third", "Fourth", "Fifth"][k] ?? `${k}th`;

export { E, div };
