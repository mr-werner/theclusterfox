// Turns typed math into trees. It is forgiving about how people write:
// 2x, 3(x+1), sin x, sin^2 x, x², √x, |x|, π, ≤, ≥, ×, ÷, and so on.
//
// parseRaw keeps the shape as typed (for step-by-step arithmetic);
// toExpr turns that into the canonical tree the algebra works on.

import { Frac } from "./frac.js";
import { add, div, fn, mul, neg, num, pow, sym, E } from "./expr.js";

export class ParseError extends Error {}

const FUNC_ALIASES = {
  arcsin: "asin",
  arccos: "acos",
  arctan: "atan",
  asin: "asin",
  acos: "acos",
  atan: "atan",
  sinh: "sinh",
  cosh: "cosh",
  tanh: "tanh",
  sin: "sin",
  cos: "cos",
  tan: "tan",
  sec: "sec",
  csc: "csc",
  cot: "cot",
  ln: "ln",
  log: "log",
  sqrt: "sqrt",
  cbrt: "cbrt",
  abs: "abs",
  exp: "exp",
};
const CONST_NAMES = { pi: "pi", infinity: "inf", inf: "inf", theta: "theta", alpha: "alpha", beta: "beta", phi: "phi" };
const NAMES = [...Object.keys(FUNC_ALIASES), ...Object.keys(CONST_NAMES)].sort((a, b) => b.length - a.length);

export function normalizeText(s) {
  return s
    .replace(/[−–—]/g, "-")
    .replace(/[×·∙⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/√/g, "sqrt")
    .replace(/∛/g, "cbrt")
    .replace(/π/g, "pi")
    .replace(/θ/g, "theta")
    .replace(/∞/g, "inf")
    .replace(/≤|=<|⩽/g, "<=")
    .replace(/≥|=>|⩾/g, ">=")
    .replace(/≠|=\/=/g, "!=")
    .replace(/\*\*/g, "^")
    .replace(/[“”]/g, '"');
}

function splitIdent(word) {
  const out = [];
  let i = 0;
  const w = word.toLowerCase();
  while (i < w.length) {
    const name = NAMES.find(n => w.startsWith(n, i));
    if (name) {
      out.push(name);
      i += name.length;
    } else {
      out.push(word[i]);
      i += 1;
    }
  }
  return out;
}

export function tokenize(text) {
  const s = normalizeText(text);
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      if (!m) throw new ParseError(`I couldn't read the number near "${s.slice(i, i + 6)}"`);
      // "2e" followed by nothing numeric is 2·e, not scientific notation.
      let txt = m[0];
      if (/e/i.test(txt) && !/e[+-]?\d/i.test(txt)) txt = m[1];
      toks.push({ k: "num", s: txt, pos: i });
      i += txt.length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      const m = /^[a-zA-Z]+/.exec(s.slice(i));
      for (const part of splitIdent(m[0])) toks.push({ k: "id", s: part, pos: i });
      i += m[0].length;
      continue;
    }
    const two = s.slice(i, i + 2);
    if (["<=", ">=", "!="].includes(two)) {
      toks.push({ k: "rel", s: two, pos: i });
      i += 2;
      continue;
    }
    if ("=<>".includes(c)) {
      toks.push({ k: "rel", s: c, pos: i });
      i++;
      continue;
    }
    if ("+-*/^()[]{},;!%|_'".includes(c)) {
      const map = { "[": "(", "{": "(", "]": ")", "}": ")", ";": "," };
      toks.push({ k: "op", s: map[c] ?? c, pos: i });
      i++;
      continue;
    }
    throw new ParseError(`I don't recognize the symbol "${c}"`);
  }
  return toks;
}

class Parser {
  constructor(toks) {
    this.t = toks;
    this.i = 0;
    this.absDepth = 0;
  }
  peek(o = 0) {
    return this.t[this.i + o];
  }
  isOp(s, o = 0) {
    const t = this.peek(o);
    return t && t.k === "op" && t.s === s;
  }
  next() {
    return this.t[this.i++];
  }
  expectOp(s) {
    if (!this.isOp(s)) {
      const t = this.peek();
      throw new ParseError(t ? `Expected "${s}" before "${t.s}"` : `Missing a closing "${s}"`);
    }
    this.i++;
  }

  expr() {
    let l = this.term();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().s;
      l = { k: "bin", op, l, r: this.term() };
    }
    return l;
  }

  startsPrimary() {
    const t = this.peek();
    if (!t) return false;
    if (t.k === "num" || t.k === "id") return true;
    if (t.k === "op" && t.s === "(") return true;
    if (t.k === "op" && t.s === "|" && this.absDepth === 0) return true;
    return false;
  }

  term() {
    let l = this.unary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/")) {
        const op = this.next().s;
        l = { k: "bin", op, l, r: this.unary() };
      } else if (this.startsPrimary()) {
        l = { k: "bin", op: "impl", l, r: this.power() };
      } else break;
    }
    return l;
  }

  unary() {
    if (this.isOp("-")) {
      this.next();
      return { k: "neg", a: this.unary() };
    }
    if (this.isOp("+")) {
      this.next();
      return this.unary();
    }
    return this.power();
  }

  power() {
    const base = this.postfix();
    if (this.isOp("^")) {
      this.next();
      return { k: "bin", op: "^", l: base, r: this.unary() };
    }
    return base;
  }

  postfix() {
    let a = this.primary();
    for (;;) {
      if (this.isOp("!")) {
        this.next();
        a = { k: "fact", a };
      } else if (this.isOp("%")) {
        this.next();
        a = { k: "pct", a };
      } else break;
    }
    return a;
  }

  primary() {
    const t = this.next();
    if (!t) throw new ParseError("The problem seems to end too early");
    if (t.k === "num") return { k: "num", v: Frac.parse(t.s), s: t.s };
    if (t.k === "op" && t.s === "(") {
      const inner = this.expr();
      this.expectOp(")");
      return { k: "paren", a: inner };
    }
    if (t.k === "op" && t.s === "|") {
      this.absDepth++;
      const inner = this.expr();
      this.absDepth--;
      this.expectOp("|");
      return { k: "abs", a: inner };
    }
    if (t.k === "id") {
      const name = t.s.toLowerCase();
      if (FUNC_ALIASES[name]) return this.call(FUNC_ALIASES[name]);
      if (CONST_NAMES[name]) return { k: "sym", n: CONST_NAMES[name] };
      return { k: "sym", n: t.s };
    }
    if (t.k === "rel") throw new ParseError(`Unexpected "${t.s}"`);
    throw new ParseError(`Unexpected "${t.s}"`);
  }

  call(f) {
    // log_2(8) or log_2 8
    let base = null;
    if (f === "log" && this.isOp("_")) {
      this.next();
      base = this.postfix();
    }
    // sin^2 x, sin^-1 x
    let power = null;
    if (this.isOp("^")) {
      this.next();
      power = this.unary();
      if (power.k === "neg" && power.a.k === "num" && power.a.v.isOne() && ["sin", "cos", "tan"].includes(f)) {
        f = "a" + f;
        power = null;
      }
    }
    let arg;
    if (this.isOp("(")) {
      this.next();
      arg = this.expr();
      this.expectOp(")");
      arg = { k: "paren", a: arg };
      // sqrt(x)^2 is the square of the root
      if (!power && this.isOp("^")) {
        this.next();
        return { k: "bin", op: "^", l: { k: "call", f, a: arg, base }, r: this.unary() };
      }
    } else {
      // Bare argument: a run of numbers, variables and powers, like sin 2x or ln x^2.
      if (!this.peek() || !(this.peek().k === "num" || this.peek().k === "id" || this.isOp("|") || this.isOp("-")))
        throw new ParseError(`"${f}" needs something to act on`);
      if (this.isOp("-")) {
        this.next();
        arg = { k: "neg", a: this.power() };
      } else arg = this.power();
      while (this.peek() && (this.peek().k === "num" || (this.peek().k === "id" && !FUNC_ALIASES[this.peek().s.toLowerCase()]))) {
        arg = { k: "bin", op: "impl", l: arg, r: this.power() };
      }
    }
    const node = { k: "call", f, a: arg, base };
    return power ? { k: "bin", op: "^", l: node, r: power } : node;
  }
}

// One expression, no relations.
export function parseRaw(text) {
  const toks = tokenize(text);
  if (!toks.length) throw new ParseError("Type a problem to get started");
  return parseTokens(toks);
}

function parseTokens(toks) {
  if (!toks.length) throw new ParseError("Something is missing on one side");
  const p = new Parser(toks);
  const r = p.expr();
  if (p.i < toks.length) {
    const t = toks[p.i];
    throw new ParseError(t.s === ")" ? 'There is an extra ")"' : `I got stuck at "${t.s}"`);
  }
  return r;
}

// Full input: comma separated statements, each a chain like a < b <= c or a = b.
export function parseStatements(text) {
  const toks = tokenize(text);
  if (!toks.length) throw new ParseError("Type a problem to get started");
  const statements = [];
  let cur = [];
  let depth = 0;
  for (const t of toks) {
    if (t.k === "op" && t.s === "(") depth++;
    if (t.k === "op" && t.s === ")") depth--;
    if (t.k === "op" && t.s === "," && depth === 0) {
      statements.push(cur);
      cur = [];
    } else cur.push(t);
  }
  statements.push(cur);
  return statements
    .filter(s => s.length)
    .map(stoks => {
      const parts = [];
      const rels = [];
      let buf = [];
      let d = 0;
      for (const t of stoks) {
        if (t.k === "op" && t.s === "(") d++;
        if (t.k === "op" && t.s === ")") d--;
        if (t.k === "rel" && d === 0) {
          parts.push(buf);
          rels.push(t.s);
          buf = [];
        } else buf.push(t);
      }
      parts.push(buf);
      const raws = parts.map(parseTokens);
      return { raws, exprs: raws.map(toExpr), rels };
    });
}

// ---------- raw -> canonical ----------

function flatInto(list, type, e) {
  if (e.t === type) list.push(...e.a);
  else list.push(e);
}

export function toExpr(r) {
  switch (r.k) {
    case "num":
      return num(r.v);
    case "sym":
      return sym(r.n);
    case "paren":
      return toExpr(r.a);
    case "neg":
      return neg(toExpr(r.a));
    case "abs":
      return fn("abs", toExpr(r.a));
    case "fact":
      return fn("fact", toExpr(r.a));
    case "pct":
      return div(toExpr(r.a), num(100));
    case "call": {
      const a = toExpr(r.a);
      if (r.f === "sqrt") return pow(a, num(new Frac(1, 2)));
      if (r.f === "cbrt") return pow(a, num(new Frac(1, 3)));
      if (r.f === "exp") return pow(E, a);
      if (r.f === "log" && r.base) return div(fn("ln", a), fn("ln", toExpr(r.base)));
      return fn(r.f, a);
    }
    case "bin": {
      const l = toExpr(r.l);
      const rr = toExpr(r.r);
      switch (r.op) {
        case "+": {
          const out = [];
          flatInto(out, "add", l);
          flatInto(out, "add", rr);
          return add(out);
        }
        case "-": {
          const out = [];
          flatInto(out, "add", l);
          out.push(neg(rr));
          return add(out);
        }
        case "*":
        case "impl": {
          const out = [];
          flatInto(out, "mul", l);
          flatInto(out, "mul", rr);
          return mul(out);
        }
        case "/":
          return div(l, rr);
        case "^":
          return pow(l, rr);
      }
    }
  }
  throw new ParseError("I couldn't understand part of that");
}

export function parseExpr(text) {
  const st = parseStatements(text);
  if (st.length !== 1 || st[0].rels.length) throw new ParseError("Expected a single expression here");
  return st[0].exprs[0];
}
