// Reads what the person typed, works out what kind of problem it is,
// and hands it to the right solver.

import { ParseError, parseRaw, parseStatements, normalizeText } from "./engine/parse.js";
import { add, depends, evaluate, freeVars, isSym, neg, num, sym } from "./engine/expr.js";
import { tex, eqTex } from "./engine/tex.js";
import { solveEquation } from "./solvers/equation.js";
import { solveCompound, solveInequality } from "./solvers/inequality.js";
import { solveSystem, systemGraph } from "./solvers/system.js";
import { expressionResult, functionResult } from "./solvers/algebra.js";
import { derivativeResult } from "./solvers/derivative.js";
import { integralResult } from "./solvers/integral.js";
import { limitResult } from "./solvers/limit.js";
import { parseNumberList, statsResult } from "./solvers/stats.js";
import { arithmeticResult } from "./solvers/arith.js";
import { percentResult } from "./solvers/percent.js";
import { result } from "./solvers/common.js";

const ORDER = ["x", "y", "z", "t", "n"];
function pickVar(vars, preferred) {
  if (preferred && vars.includes(preferred)) return preferred;
  for (const v of ORDER) if (vars.includes(v)) return v;
  return [...vars].sort()[0];
}

const STATS_WORDS = [
  [/^(?:mean|average|avg)$/, "mean"],
  [/^median$/, "median"],
  [/^modes?$/, "mode"],
  [/^range$/, "range"],
  [/^(?:sample )?variance$/, "variance"],
  [/^population variance$/, "variance"],
  [/^(?:sample |population )?(?:standard deviation|std ?dev|stdev|sd|s\.d\.)$/, "sd"],
  [/^(?:stats|statistics|summary|describe|five number summary|quartiles|data)$/, "summary"],
];

function stripLead(text) {
  return text
    .replace(/^\s*(?:please\s+)?(?:can you\s+)?(?:find|compute|calculate|evaluate|work out|what is|what's|whats)\s+(?:the\s+)?/i, "")
    .replace(/(?:\?|(?<=\D)\.)\s*$/, "")
    .trim();
}

export function solve(input) {
  const original = input.trim();
  if (!original) throw new ParseError("Type a problem to get started");
  const text = normalizeText(original);
  const lower = text.toLowerCase();

  // ---- percentages (word forms) ----
  if (/%|percent/.test(lower)) {
    const p = percentResult(stripLead(text).replace(/^what is /i, ""));
    if (p) return p;
  }

  const body = stripLead(text);

  // ---- statistics ----
  {
    const m = /^([a-z. ]+?)\s*(?:of\s+)?[:(]?\s*([-\d.,;\s{}[\]]+)\)?$/i.exec(body);
    if (m) {
      const word = m[1].trim().toLowerCase().replace(/^the\s+/, "");
      const hit = STATS_WORDS.find(([re]) => re.test(word));
      const nums = parseNumberList(m[2]);
      if (hit && nums && nums.length >= 1) {
        const sample = /sample/.test(word) ? true : /population/.test(word) ? false : null;
        return statsResult(nums, hit[1], { sample });
      }
    }
    const nums = parseNumberList(body);
    if (nums && nums.length >= 3 && /[,;\s]/.test(body.trim())) return statsResult(nums, "summary");
  }

  // ---- derivatives ----
  {
    let m;
    let order = 1;
    let v = null;
    let at = null;
    let expr = null;
    const atRe = /\s+(?:at|when|where)\s+(?:([a-z])\s*=\s*)?(.+)$/i;
    if ((m = /^(?:the\s+)?(second|third|2nd|3rd|fourth|4th)?\s*derivative\s+of\s+(.+)$/i.exec(body))) {
      order = { second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4 }[m[1]?.toLowerCase()] ?? 1;
      expr = m[2];
    } else if ((m = /^differentiate\s+(.+)$/i.exec(body))) expr = m[1];
    else if ((m = /^d\^?\s*(\d)?\s*\/\s*d\s*([a-z])\s*\^?\s*(\d)?\s*(.+)$/i.exec(body))) {
      order = Number(m[1] || m[3] || 1);
      v = m[2];
      expr = m[4];
    }
    if (expr) {
      const wrt = /\s+(?:with respect to|wrt|w\.r\.t\.?)\s+([a-z])\b/i.exec(expr);
      if (wrt) {
        v = wrt[1];
        expr = expr.replace(wrt[0], "");
      }
      const am = atRe.exec(expr);
      if (am) {
        at = am;
        expr = expr.slice(0, am.index);
      }
      expr = expr.replace(/^\s*\[(.*)\]\s*$/, "($1)");
      const e = parseSingle(expr);
      const vars = [...freeVars(e)];
      v = v ?? (at?.[1] || pickVar(vars));
      if (!v) v = "x";
      const atE = at ? parseSingle(at[2]) : null;
      return derivativeResult(e, v, order, atE);
    }
  }

  // ---- integrals ----
  {
    let m;
    let s = body.replace(/∫/g, " integral ").replace(/\s+/g, " ").trim();
    let lo = null;
    let hi = null;
    let expr = null;
    let v = null;
    if ((m = /^(?:the )?(?:definite )?integral from (.+?) to (.+?) of (.+)$/i.exec(s))) {
      [lo, hi, expr] = [m[1], m[2], m[3]];
    } else if ((m = /^(?:the )?(?:definite |indefinite )?(?:integral|integrate|antiderivative|anti-derivative)(?: of)? (.+?)(?: from (.+?) to (.+))?$/i.exec(s))) {
      expr = m[1];
      if (m[2]) [lo, hi] = [m[2], m[3]];
    } else if ((m = /^integral_\{?([^\s}^]+)\}?\^\{?([^\s}]+)\}? (.+)$/i.exec(s))) {
      [lo, hi, expr] = [m[1], m[2], m[3]];
    }
    if (expr) {
      const dm = /\s*,?\s*(?:d([a-z])|with respect to ([a-z]))\s*$/i.exec(expr);
      if (dm) {
        v = dm[1] || dm[2];
        expr = expr.slice(0, dm.index);
      }
      const dm2 = /^(.*?)\s*d([a-z])\s+from\s+(.+?)\s+to\s+(.+)$/i.exec(expr);
      if (dm2) [expr, v, lo, hi] = [dm2[1], dm2[2], dm2[3], dm2[4]];
      const e = parseSingle(expr);
      v = v ?? pickVar([...freeVars(e)]) ?? "x";
      return integralResult(e, v, lo ? parseSingle(lo) : null, hi ? parseSingle(hi) : null);
    }
  }

  // ---- limits ----
  {
    let m;
    const s = body.replace(/→/g, "->").replace(/\s+(?:approaches|goes to|tends to|tends towards|approaching)\s+/gi, " -> ");
    let expr = null;
    let v = null;
    let a = null;
    if ((m = /^(?:the )?(?:limit|lim)(?: of)? (.+?) as ([a-z]) ?-> ?(.+)$/i.exec(s))) [expr, v, a] = [m[1], m[2], m[3]];
    else if ((m = /^(?:limit|lim)\s*_?\s*[({]?\s*([a-z])\s*->\s*([^\s)}]+)\s*[)}]?\s+(?:of\s+)?(.+)$/i.exec(s))) [v, a, expr] = [m[1], m[2], m[3]];
    if (expr) {
      a = a.trim();
      let side = null;
      const sm = /^(.*?)\s*(?:\^?\s*([+-])|\s+from the (left|right)|\s*(left|right))$/i.exec(a);
      if (sm && (sm[2] || sm[3] || sm[4]) && sm[1]) {
        a = sm[1];
        const d = sm[2] || (sm[3] || sm[4]).toLowerCase();
        side = d === "+" || d === "right" ? "+" : "-";
      }
      const al = a.toLowerCase().replace(/\s/g, "");
      const aExpr = ["inf", "infinity", "+inf", "+infinity", "oo"].includes(al) ? "inf" : ["-inf", "-infinity", "-oo"].includes(al) ? "-inf" : parseSingle(a);
      return limitResult(parseSingle(expr), v, aExpr, side);
    }
  }

  // ---- command words ----
  let mode = null;
  let forVar = null;
  let work = body;
  let m;
  if ((m = /^(simplify|expand|factor|factorise|factorize|factorise|reduce)\s+(.+)$/i.exec(work))) {
    mode = m[1].toLowerCase().startsWith("factor") ? "factor" : m[1].toLowerCase() === "expand" ? "expand" : "simplify";
    work = m[2];
  } else if ((m = /^(graph|plot|sketch|draw)\s+(.+)$/i.exec(work))) {
    mode = "graph";
    work = m[2];
  } else if ((m = /^(solve|find)\s+(.+)$/i.exec(work))) {
    mode = "solve";
    work = m[2];
  }
  if ((m = /\s+for\s+([a-z])\s*$/i.exec(work))) {
    forVar = m[1];
    work = work.slice(0, m.index);
  }
  work = work.replace(/^y\s*=\s*$/, "");

  // f(x) = ... is a function definition
  let funcDef = null;
  if ((m = /^\s*([a-zA-Z])\s*\(\s*([a-z])\s*\)\s*=\s*(.+)$/.exec(work)) && !/[=<>]/.test(m[3])) {
    funcDef = { name: m[1], v: m[2] };
    work = m[3];
    mode = mode === "solve" ? null : mode;
  }

  const statements = parseStatements(work);

  // ---- systems ----
  if (statements.length > 1) {
    if (statements.every(s => s.rels.length === 1 && s.rels[0] === "=")) return solveSystem(statements);
    throw new ParseError("For a system, separate equations with commas, like: x + y = 5, x - y = 1");
  }
  const st = statements[0];

  if (st.rels.length === 0) {
    const e = st.exprs[0];
    const vars = [...freeVars(e)];
    if (!vars.length) {
      if (mode === "graph") return functionResult(e, "x", `y = ${tex(e)}`, "Graph");
      return arithmeticResult(parseRaw(work));
    }
    const v = funcDef?.v ?? pickVar(vars, forVar);
    if (mode === "graph" || funcDef) {
      if (vars.length === 1) return functionResult(e, v, funcDef ? `${funcDef.name}(${v}) = ${tex(e)}` : `y = ${tex(e)}`, "Graph");
    }
    if (mode === "solve" && vars.length === 1) {
      const r = solveEquation(e, num(0), v);
      return { ...r, notes: [`I treated this as $${tex(e)} = 0$.`, ...r.notes] };
    }
    return expressionResult(e, mode === "graph" ? "simplify" : mode ?? "simplify", v);
  }

  if (st.rels.length === 1) {
    const [L, R] = st.exprs;
    const rel = st.rels[0];
    const vars = [...freeVars(add(L, R))];
    if (!vars.length) {
      const l = arithmeticResult(st.raws[0]);
      const r = arithmeticResult(st.raws[1]);
      const lv = evaluate(L);
      const rv = evaluate(R);
      const truth = { "=": Math.abs(lv - rv) < 1e-12, "<": lv < rv, ">": lv > rv, "<=": lv <= rv + 1e-12, ">=": lv >= rv - 1e-12, "!=": Math.abs(lv - rv) > 1e-12 }[rel];
      return result({
        topic: "Check a statement",
        problem: eqTex(L, R, rel),
        answers: [truth ? "\\text{True}" : "\\text{False}"],
        methods: [{ name: "Evaluate both sides", steps: [{ text: "Left side:", tex: l.answers[0] }, { text: "Right side:", tex: r.answers[0] }] }],
      });
    }
    if (rel === "=") {
      // y = f(x)  ->  graph it and describe it
      const isY = (s, o) => isSym(s, "y") && !depends(o, "y") && vars.length <= 2 && forVar !== "x";
      if (!forVar && mode !== "solve" && (isY(L, R) || isY(R, L))) {
        const f = isSym(L, "y") ? R : L;
        const fv = [...freeVars(f)];
        if (fv.length <= 1) return functionResult(f, fv[0] ?? "x", `y = ${tex(f)}`, mode === "graph" ? "Graph" : "Function");
      }
      // equations in x and y with no target: implicit graph (and solve for y when possible)
      if (!forVar && vars.length === 2 && vars.includes("x") && vars.includes("y") && mode !== "solve") {
        const r = solveEquation(L, R, "y");
        return { ...r, topic: "Equation in x and y", graph: systemGraph([{ L, R }], ["x", "y"], []) };
      }
      const v = pickVar(vars, forVar);
      return solveEquation(L, R, v);
    }
    if (rel === "!=") throw new ParseError("Try an equation (=) or an inequality (<, >, ≤, ≥)");
    const v = pickVar(vars, forVar);
    if (vars.length > 1) throw new ParseError("Inequalities need a single variable");
    return solveInequality(L, R, rel, v);
  }

  if (st.rels.length === 2 && st.rels.every(r => r !== "=" && r !== "!=")) {
    const vars = [...freeVars(add(st.exprs))];
    if (vars.length !== 1) throw new ParseError("Compound inequalities need a single variable");
    return solveCompound(st.exprs, st.rels, vars[0]);
  }
  throw new ParseError("I couldn't tell what to do with that. Try one of the examples.");
}

function parseSingle(s) {
  const st = parseStatements(s);
  if (st.length !== 1 || st[0].rels.length) throw new ParseError(`Expected an expression: ${s}`);
  return st[0].exprs[0];
}


// What the parser understood, for the live preview under the input.
export function previewTex(input) {
  const text = input.trim();
  if (!text) return "";
  try {
    const body = stripLead(normalizeText(text))
      .replace(/^(simplify|expand|factor|factorise|factorize|graph|plot|solve|differentiate)\s+/i, "")
      .replace(/^(?:the\s+)?(?:second\s+|third\s+)?derivative\s+of\s+/i, "")
      .replace(/^(?:integral|integrate|antiderivative)(?:\s+of)?\s+/i, "")
      .replace(/\s+for\s+[a-z]\s*$/i, "")
      .replace(/\s*d[a-z]\s*$/i, "");
    if (/\b(?:from|as|at|percent|of)\b|%|->|→/.test(body)) return "";
    const st = parseStatements(body);
    return st.map(s => s.exprs.map((e, i) => tex(e) + (i < s.rels.length ? ` ${{ "=": "=", "<": "<", ">": ">", "<=": "\\le", ">=": "\\ge", "!=": "\\ne" }[s.rels[i]]} ` : "")).join("")).join(", \\quad ");
  } catch {
    return "";
  }
}

export { neg, sym };
