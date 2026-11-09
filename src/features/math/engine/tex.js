// Expression tree -> TeX for KaTeX.

import { neg, num, pow } from "./expr.js";
import { Frac, fmtNum } from "./frac.js";

const SYM = { pi: "\\pi", theta: "\\theta", alpha: "\\alpha", beta: "\\beta", phi: "\\phi", inf: "\\infty", e: "e", i: "i" };
const FN = {
  sin: "\\sin",
  cos: "\\cos",
  tan: "\\tan",
  sec: "\\sec",
  csc: "\\csc",
  cot: "\\cot",
  asin: "\\arcsin",
  acos: "\\arccos",
  atan: "\\arctan",
  sinh: "\\sinh",
  cosh: "\\cosh",
  tanh: "\\tanh",
  ln: "\\ln",
  log: "\\log",
};

const paren = s => `\\left(${s}\\right)`;

export function isNegTerm(e) {
  return (e.t === "num" && e.v.sign < 0) || (e.t === "mul" && e.a[0]?.t === "num" && e.a[0].v.sign < 0);
}

function numTex(v) {
  if (v.d === 1) return String(v.n);
  return `${v.n < 0 ? "-" : ""}\\frac{${Math.abs(v.n)}}{${v.d}}`;
}

function needsParenInProduct(e, first) {
  if (e.t === "add" || e.t === "pm") return true;
  if (e.t === "num" && !first && e.v.sign < 0) return true;
  if (e.t === "mul" && isNegTerm(e)) return true;
  return false;
}

function joinFactors(parts) {
  let s = "";
  parts.forEach(({ tex: t, factor }, idx) => {
    if (idx > 0 && (factor.t === "num" || /^[0-9.-]/.test(t) || (factor.t === "pow" && factor.b.t === "num" && !isRootPow(factor))))
      s += " \\cdot ";
    else if (idx > 0 && /\\[a-zA-Z]+$/.test(s) && /^[a-zA-Z]/.test(t)) s += " ";
    s += t;
  });
  return s;
}

const isRootPow = p => p.e.t === "num" && p.e.v.n === 1 && p.e.v.d > 1 && p.e.v.d <= 9;

function mulTex(e) {
  let coef = new Frac(1);
  let hasCoef = false;
  let factors = e.a;
  if (factors[0]?.t === "num") {
    coef = factors[0].v;
    hasCoef = true;
    factors = factors.slice(1);
  }
  if (!factors.length) return numTex(coef);
  const numer = [];
  const denom = [];
  for (const f of factors) {
    if (f.t === "pow" && f.e.t === "num" && f.e.v.sign < 0) {
      const ne = f.e.v.neg();
      denom.push(ne.isOne() ? f.b : pow(f.b, num(ne)));
    } else numer.push(f);
  }
  const sign = coef.sign < 0 ? "-" : "";
  const cn = Math.abs(coef.n);
  const cd = coef.d;
  const numParts = [];
  if (cn !== 1 || (!numer.length && hasCoef)) numParts.push({ tex: String(cn), factor: num(cn) });
  const lone = numer.length === 1 && !numParts.length && (denom.length || cd !== 1);
  numer.forEach((f, i) => {
    const t = tex(f);
    numParts.push({ tex: !lone && needsParenInProduct(f, i === 0 && !numParts.length) ? paren(t) : t, factor: f });
  });
  const denParts = [];
  if (cd !== 1) denParts.push({ tex: String(cd), factor: num(cd) });
  denom.forEach(f => {
    const t = tex(f);
    denParts.push({ tex: needsParenInProduct(f, !denParts.length) && denom.length + (cd !== 1) > 1 ? paren(t) : t, factor: f });
  });
  const top = numParts.length ? joinFactors(numParts) : "1";
  if (!denParts.length) return sign + top;
  return `${sign}\\frac{${top}}{${joinFactors(denParts)}}`;
}

function powTex(e) {
  const { b, e: x } = e;
  if (x.t === "num" && x.v.sign < 0) {
    const ne = x.v.neg();
    return `\\frac{1}{${tex(ne.isOne() ? b : pow(b, num(ne)))}}`;
  }
  if (x.t === "num" && x.v.n === 1 && x.v.d === 2) return `\\sqrt{${tex(b)}}`;
  if (isRootPow(e)) return `\\sqrt[${x.v.d}]{${tex(b)}}`;
  if (b.t === "fn" && FN[b.n] && x.t === "num" && x.v.isInt() && x.v.n > 0)
    return `${FN[b.n]}^{${x.v.n}}${paren(tex(b.a))}`;
  let bt = tex(b);
  const wrap =
    b.t === "add" ||
    b.t === "mul" ||
    b.t === "pow" ||
    b.t === "fn" ||
    b.t === "pm" ||
    (b.t === "num" && (b.v.sign < 0 || !b.v.isInt())) ||
    b.t === "int" ||
    b.t === "d";
  if (wrap && !(b.t === "fn" && b.n === "abs")) bt = paren(bt);
  return `${bt}^{${tex(x)}}`;
}

export function tex(e) {
  if (!e) return "";
  switch (e.t) {
    case "num":
      return numTex(e.v);
    case "sym":
      if (e.tx) return e.tx;
      return SYM[e.n] ?? (e.n.length > 1 ? `\\mathrm{${e.n}}` : e.n);
    case "add": {
      if (!e.a.length) return "0";
      return e.a
        .map((t, i) => {
          if (i === 0) return tex(t);
          if (isNegTerm(t)) return ` - ${tex(neg(t))}`;
          return ` + ${tex(t)}`;
        })
        .join("");
    }
    case "mul":
      if (!e.a.length) return "1";
      return mulTex(e);
    case "pow":
      return powTex(e);
    case "fn": {
      if (e.n === "abs") return `\\left|${tex(e.a)}\\right|`;
      if (e.n === "fact") {
        const t = tex(e.a);
        return (e.a.t === "num" && e.a.v.isInt() && e.a.v.sign >= 0) || e.a.t === "sym" ? `${t}!` : `${paren(t)}!`;
      }
      if (e.a.t === "fn" && e.a.n === "abs" && (e.n === "ln" || e.n === "log")) return `${FN[e.n]}${tex(e.a)}`;
      return `${FN[e.n] ?? `\\operatorname{${e.n}}`}${paren(tex(e.a))}`;
    }
    case "d": {
      const k = e.k ?? 1;
      const op = k === 1 ? `\\frac{d}{d${e.v}}` : `\\frac{d^{${k}}}{d${e.v}^{${k}}}`;
      return `${op}\\left[${tex(e.a)}\\right]`;
    }
    case "int": {
      const lim = e.lo ? `_{${tex(e.lo)}}^{${tex(e.hi)}}` : "";
      const body = e.a.t === "add" ? paren(tex(e.a)) : tex(e.a);
      return `\\int${lim} ${body}\\,d${e.v}`;
    }
    case "eval":
      return `\\Big[${tex(e.a)}\\Big]_{${tex(e.lo)}}^{${tex(e.hi)}}`;
    case "pm":
      return `${tex(e.a)} \\pm ${tex(e.b)}`;
    case "raw":
      return e.tex;
    default:
      return "?";
  }
}

export const eqTex = (l, r, rel = "=") => `${tex(l)} ${relTex(rel)} ${tex(r)}`;

export function relTex(rel) {
  return { "=": "=", "<": "<", ">": ">", "<=": "\\le", ">=": "\\ge", "!=": "\\ne" }[rel] ?? rel;
}

// Raw (as-typed) trees, used for arithmetic steps so 12 ÷ 4 × 3 keeps its shape.
export function rawTex(r, parentPrec = 0, side = "") {
  const P = { "+": 1, "-": 1, "*": 2, "/": 2, impl: 2, "^": 4 };
  switch (r.k) {
    case "num": {
      const s = r.v.d === 1 ? String(r.v.n) : r.s && /\./.test(r.s) ? r.s : numTex(r.v);
      return side === "r" && r.v.sign < 0 ? paren(s) : s;
    }
    case "dec": {
      const s = r.tx ?? fmtNum(r.x, 10);
      return side === "r" && r.x < 0 ? paren(s) : s;
    }
    case "sym":
      return SYM[r.n] ?? r.n;
    case "paren":
      return paren(rawTex(r.a));
    case "abs":
      return `\\left|${rawTex(r.a)}\\right|`;
    case "fact":
      return `${rawTex(r.a, 5)}!`;
    case "pct":
      return `${rawTex(r.a, 5)}\\%`;
    case "neg": {
      const s = `-${rawTex(r.a, 3)}`;
      return parentPrec >= 2 ? paren(s) : s;
    }
    case "call": {
      const a = r.a.k === "paren" ? r.a.a : r.a;
      if (r.f === "sqrt") return `\\sqrt{${rawTex(a)}}`;
      if (r.f === "cbrt") return `\\sqrt[3]{${rawTex(a)}}`;
      if (r.f === "abs") return `\\left|${rawTex(a)}\\right|`;
      if (r.f === "exp") return `e^{${rawTex(a)}}`;
      const name = FN[r.f] ?? `\\operatorname{${r.f}}`;
      return `${name}${r.base ? `_{${rawTex(r.base)}}` : ""}${paren(rawTex(a))}`;
    }
    case "bin": {
      const p = P[r.op];
      const bare = n => (n.k === "paren" ? n.a : n);
      const atomic = n => (n.k === "num" && n.v.isInt()) || n.k === "dec" || n.k === "sym" || (n.k === "neg" && atomic(n.a));
      if (r.op === "/" && atomic(bare(r.l)) && atomic(bare(r.r))) return `\\frac{${rawTex(bare(r.l))}}{${rawTex(bare(r.r))}}`;
      if (r.op === "^") {
        const base = rawTex(r.l, 5);
        return `${base}^{${rawTex(bare(r.r))}}`;
      }
      const opTex = { "+": " + ", "-": " - ", "*": " \\times ", "/": " \\div ", impl: "" }[r.op];
      let l = rawTex(r.l, p, "l");
      let rr = rawTex(r.r, p + (r.op === "-" || r.op === "/" ? 0.5 : 0), "r");
      let op = opTex;
      if (r.op === "impl" && (/^[0-9.]/.test(rr) || (r.l.k === "num" && r.r.k === "num"))) op = " \\times ";
      const s = l + op + rr;
      const need = p < parentPrec || (side === "r" && p === parentPrec && parentPrec % 1 !== 0);
      return need ? paren(s) : s;
    }
  }
  return "?";
}
