// Descriptive statistics with worked steps.

import { Frac, fmtNum } from "../engine/frac.js";
import { S, result } from "./common.js";

const ft = f => (f.d === 1 ? String(f.n) : `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`);
const show = f => {
  // exact fraction plus decimal when it isn't whole
  if (f.d === 1) return String(f.n);
  const dec = fmtNum(f.valueOf(), 8);
  return f.d <= 100 ? `${ft(f)} \\approx ${dec}` : `\\approx ${dec}`;
};
const list = (xs, max = 14) => (xs.length > max ? `${xs.slice(0, max - 2).join(", ")}, \\ldots, ${xs.slice(-2).join(", ")}` : xs.join(", "));
const MEASURES = ["mean", "median", "mode", "range", "variance", "sd", "summary"];

export function parseNumberList(s) {
  const parts = s
    .replace(/[{}[\]()]/g, " ")
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (!parts.length) return null;
  const nums = [];
  for (const p of parts) {
    if (!/^-?(\d+\.?\d*|\.\d+)$/.test(p)) return null;
    nums.push(p);
  }
  return nums;
}

function medianOf(sorted) {
  const n = sorted.length;
  if (n % 2) return { value: sorted[(n - 1) / 2], pos: [(n - 1) / 2] };
  return { value: sorted[n / 2 - 1].add(sorted[n / 2]).div(2), pos: [n / 2 - 1, n / 2] };
}

export function statsResult(raw, measure = "summary", { sample = null } = {}) {
  const fr = raw.map(s => Frac.parse(s));
  const n = fr.length;
  const sorted = [...fr].sort((a, b) => a.cmp(b));
  const sTex = sorted.map(ft);
  const problem = `\\{${list(raw)}\\}`;
  const steps = [];
  const facts = [];
  const want = m => measure === "summary" || measure === m;
  const sum = fr.reduce((s, x) => s.add(x), new Frac(0));
  const mean = sum.div(n);

  if (want("median") || want("range") || measure === "summary") steps.push(S(`Put the ${n} values in order from smallest to largest.`, list(sTex)));

  if (want("mean") || want("variance") || want("sd")) {
    steps.push(S(`Mean: add up all ${n} values and divide by how many there are.`, `\\bar{x} = \\frac{${n > 8 ? `${fr.slice(0, 3).map(ft).join(" + ")} + \\cdots + ${ft(fr[n - 1])}` : fr.map(ft).join(" + ").replace(/\+ -/g, "- ")}}{${n}} = \\frac{${ft(sum)}}{${n}} = ${show(mean)}`));
    facts.push({ label: "Mean", tex: show(mean) });
  }
  if (want("median")) {
    const m = medianOf(sorted);
    steps.push(
      S(
        n % 2 ? `Median: with ${n} values, the middle one is value number ${(n + 1) / 2}.` : `Median: with ${n} values there are two middle ones (numbers ${n / 2} and ${n / 2 + 1}); take their average.`,
        n % 2 ? `\\text{median} = ${ft(m.value)}` : `\\text{median} = \\frac{${ft(sorted[n / 2 - 1])} + ${ft(sorted[n / 2])}}{2} = ${show(m.value)}`
      )
    );
    facts.push({ label: "Median", tex: show(m.value) });
  }
  if (want("mode")) {
    const counts = new Map();
    for (const x of sorted) {
      const hit = counts.get(x.toString());
      if (hit) hit.c++;
      else counts.set(x.toString(), { x, c: 1 });
    }
    const max = Math.max(...[...counts.values()].map(o => o.c));
    const modes = [...counts.values()].filter(o => o.c === max).map(o => ft(o.x));
    const none = max === 1;
    steps.push(
      S(
        none ? "Mode: every value appears once, so there is no mode." : `Mode: the value${modes.length > 1 ? "s" : ""} that appear${modes.length > 1 ? "" : "s"} most often (${max} times).`,
        none ? "\\text{no mode}" : `\\text{mode} = ${modes.join(", ")}`
      )
    );
    facts.push({ label: modes.length > 1 && !none ? "Modes" : "Mode", tex: none ? "\\text{none}" : modes.join(", ") });
  }
  if (want("range")) {
    const r = sorted[n - 1].sub(sorted[0]);
    steps.push(S("Range: largest minus smallest.", `${ft(sorted[n - 1])} - ${sorted[0].sign < 0 ? `(${ft(sorted[0])})` : ft(sorted[0])} = ${show(r)}`));
    facts.push({ label: "Range", tex: show(r) });
  }
  let q1;
  let q3;
  if (measure === "summary" && n >= 4) {
    const half = Math.floor(n / 2);
    q1 = medianOf(sorted.slice(0, half)).value;
    q3 = medianOf(sorted.slice(n - half)).value;
    steps.push(S("Quartiles: Q1 is the median of the lower half and Q3 the median of the upper half (not counting the middle value when there's an odd number).", `Q_1 = ${show(q1)}, \\quad Q_3 = ${show(q3)}, \\quad \\text{IQR} = Q_3 - Q_1 = ${show(q3.sub(q1))}`));
    facts.push({ label: "Five-number summary", tex: `${ft(sorted[0])},\\; ${show(q1).split(" ")[0]},\\; ${show(medianOf(sorted).value).split(" ")[0]},\\; ${show(q3).split(" ")[0]},\\; ${ft(sorted[n - 1])}` });
  }
  if ((want("variance") || want("sd")) && n >= 2) {
    const dev = fr.map(x => x.sub(mean).mul(x.sub(mean)));
    const ss = dev.reduce((s, x) => s.add(x), new Frac(0));
    const shownDev = fr.slice(0, 6).map(x => `(${ft(x)} - ${ft(mean)})^2`).join(" + ") + (n > 6 ? " + \\cdots" : "");
    steps.push(S("Square each value's distance from the mean and add them up (the sum of squares).", `\\sum (x - \\bar{x})^2 = ${shownDev} = ${show(ss)}`));
    const popVar = ss.div(n);
    const sampVar = ss.div(n - 1);
    const both = sample === null;
    if (both || sample === false) {
      steps.push(S(`Population variance: divide by $n = ${n}$. The standard deviation is its square root.`, `\\sigma^2 = \\frac{${ft(ss)}}{${n}} = ${show(popVar)}, \\quad \\sigma = \\sqrt{${show(popVar).split(" ")[0]}} \\approx ${fmtNum(Math.sqrt(popVar.valueOf()), 8)}`));
    }
    if (both || sample === true) {
      steps.push(S(`Sample variance: divide by $n - 1 = ${n - 1}$ instead (use this when your data is a sample of a bigger group).`, `s^2 = \\frac{${ft(ss)}}{${n - 1}} = ${show(sampVar)}, \\quad s = \\sqrt{${show(sampVar).split(" ")[0]}} \\approx ${fmtNum(Math.sqrt(sampVar.valueOf()), 8)}`));
    }
    if (want("variance")) {
      if (both || sample === false) facts.push({ label: "Population variance σ²", tex: show(popVar) });
      if (both || sample === true) facts.push({ label: "Sample variance s²", tex: show(sampVar) });
    }
    if (want("sd") || measure === "summary") {
      if (both || sample === false) facts.push({ label: "Population std. dev. σ", tex: `\\approx ${fmtNum(Math.sqrt(popVar.valueOf()), 8)}` });
      if (both || sample === true) facts.push({ label: "Sample std. dev. s", tex: `\\approx ${fmtNum(Math.sqrt(sampVar.valueOf()), 8)}` });
    }
  }
  facts.push({ label: "Count", tex: String(n) }, { label: "Sum", tex: show(sum) });
  if (measure === "summary") facts.push({ label: "Min / Max", tex: `${ft(sorted[0])}, \\; ${ft(sorted[n - 1])}` });
  const headline = measure === "summary" ? null : facts.filter(f => !["Count", "Sum"].includes(f.label));
  return result({
    topic: measure === "summary" ? "Statistics" : { mean: "Mean", median: "Median", mode: "Mode", range: "Range", variance: "Variance", sd: "Standard deviation" }[measure],
    problem,
    answers: headline ? headline.map(f => `\\text{${f.label}} = ${f.tex}`) : [],
    methods: [{ name: "Work it out", steps }],
    table: facts,
    stats: {
      values: sorted.map(x => x.valueOf()),
      min: sorted[0].valueOf(),
      max: sorted[n - 1].valueOf(),
      median: medianOf(sorted).value.valueOf(),
      mean: mean.valueOf(),
      q1: q1?.valueOf() ?? null,
      q3: q3?.valueOf() ?? null,
    },
  });
}

export { MEASURES };
