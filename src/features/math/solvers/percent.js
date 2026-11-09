// Percentage word forms: X% of Y, X is what percent of Y, X is Y% of what,
// increase/decrease by X%, percent change, and converting to a percent.

import { Frac, fmtNum } from "../engine/frac.js";
import { S, result } from "./common.js";

const N = "(-?\\d+(?:\\.\\d+)?|-?\\.\\d+)";
const ft = f => (f.d === 1 ? String(f.n) : f.d <= 1000 && String(f.n).length < 8 ? `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}` : fmtNum(f.valueOf(), 10));
const dec = f => fmtNum(f.valueOf(), 10);
const nice = f => (f.d === 1 ? String(f.n) : /^-?\d+\.\d{1,6}$/.test(dec(f)) ? dec(f) : `${ft(f)} \\approx ${fmtNum(f.valueOf(), 8)}`);

const P = s => Frac.parse(s);

export function percentResult(text) {
  const t = text.toLowerCase().replace(/,(?=\d{3})/g, "").replace(/\s+/g, " ").trim();
  let m;
  const steps = [];
  const done = (topic, problem, ans, notes = []) => result({ topic, problem, answers: [ans], methods: [{ name: "Work it out", steps }], notes });

  if ((m = new RegExp(`^(?:what is |find |calculate )?${N} ?%(?: tip| tax| discount)? (?:of|on) \\$?${N}\\??$`).exec(t))) {
    const p = P(m[1]);
    const n = P(m[2]);
    const r = p.div(100).mul(n);
    steps.push(S(`Write the percent as a decimal by dividing by 100.`, `${m[1]}\\% = \\frac{${m[1]}}{100} = ${dec(p.div(100))}`));
    steps.push(S(`“Of” means multiply.`, `${dec(p.div(100))} \\times ${m[2]} = ${nice(r)}`));
    return done("Percent of a number", `${m[1]}\\% \\text{ of } ${m[2]}`, nice(r));
  }
  if ((m = new RegExp(`^(?:what percent(?:age)? of ${N} is ${N}|${N} is what percent(?:age)? of ${N})\\??$`).exec(t))) {
    const whole = P(m[1] ?? m[4]);
    const part = P(m[2] ?? m[3]);
    if (whole.isZero()) throw new Error("The whole can't be zero");
    const r = part.div(whole).mul(100);
    steps.push(S("Divide the part by the whole.", `\\frac{${dec(part)}}{${dec(whole)}} = ${fmtNum(part.div(whole).valueOf(), 10)}`));
    steps.push(S("Multiply by 100 to turn it into a percent.", `${fmtNum(part.div(whole).valueOf(), 10)} \\times 100 = ${nice(r)}\\%`));
    return done("What percent", `${dec(part)} \\text{ is what percent of } ${dec(whole)}?`, `${nice(r)}\\%`);
  }
  if ((m = new RegExp(`^${N} is ${N} ?% of what(?: number)?\\??$`).exec(t))) {
    const part = P(m[1]);
    const p = P(m[2]);
    if (p.isZero()) throw new Error("The percent can't be zero");
    const r = part.div(p.div(100));
    steps.push(S("Set it up: part = percent × whole, so whole = part ÷ percent.", `\\text{whole} = \\frac{${m[1]}}{${dec(p.div(100))}}`));
    steps.push(S("Divide.", `\\text{whole} = ${nice(r)}`));
    return done("Find the whole", `${m[1]} \\text{ is } ${m[2]}\\% \\text{ of what?}`, nice(r));
  }
  if ((m = new RegExp(`^(increase|raise|add|decrease|reduce|discount|lower|subtract) \\$?${N} by ${N} ?%$`).exec(t))) {
    const up = ["increase", "raise", "add"].includes(m[1]);
    const n = P(m[2]);
    const p = P(m[3]);
    const change = n.mul(p.div(100));
    const r = up ? n.add(change) : n.sub(change);
    steps.push(S(`Find ${m[3]}% of ${m[2]}.`, `${dec(p.div(100))} \\times ${m[2]} = ${nice(change)}`));
    steps.push(S(up ? "Add it on." : "Take it off.", `${m[2]} ${up ? "+" : "-"} ${dec(change)} = ${nice(r)}`));
    steps.push(S(`Shortcut: multiply by $${up ? "1 +" : "1 -"} ${dec(p.div(100))} = ${dec(up ? p.div(100).add(1) : new Frac(1).sub(p.div(100)))}$ in one step.`, `${m[2]} \\times ${dec(up ? p.div(100).add(1) : new Frac(1).sub(p.div(100)))} = ${nice(r)}`));
    return done(up ? "Percent increase" : "Percent decrease", `\\text{${up ? "Increase" : "Decrease"} } ${m[2]} \\text{ by } ${m[3]}\\%`, nice(r));
  }
  if ((m = new RegExp(`^(?:percent(?:age)? )?(?:change|increase|decrease|difference) (?:from )?${N} (?:to) ${N}$`).exec(t))) {
    const a = P(m[1]);
    const b = P(m[2]);
    if (a.isZero()) throw new Error("Percent change from zero is undefined");
    const diff = b.sub(a);
    const r = diff.div(a.abs()).mul(100);
    steps.push(S("Find the change: new minus old.", `${m[2]} - ${m[1]} = ${dec(diff)}`));
    steps.push(S("Divide by the original value.", `\\frac{${dec(diff)}}{${dec(a.abs())}} = ${fmtNum(diff.div(a.abs()).valueOf(), 10)}`));
    steps.push(S("Multiply by 100.", `${nice(r)}\\%`));
    return done("Percent change", `\\text{Percent change from } ${m[1]} \\text{ to } ${m[2]}`, `${r.sign >= 0 ? "+" : ""}${nice(r)}\\% \\;\\text{(${r.sign >= 0 ? "increase" : "decrease"})}`);
  }
  if ((m = new RegExp(`^${N}(?: ?/ ?${N})? (?:as a |to |in )(?:percent|percentage|%)$`).exec(t))) {
    const v = m[3] ? P(m[1]).div(P(m[3])) : P(m[1]);
    const r = v.mul(100);
    if (m[3]) steps.push(S("Divide the top by the bottom.", `\\frac{${m[1]}}{${m[3]}} = ${fmtNum(v.valueOf(), 10)}`));
    steps.push(S("Multiply by 100 and add the % sign.", `${fmtNum(v.valueOf(), 10)} \\times 100 = ${nice(r)}\\%`));
    return done("Convert to percent", `${m[3] ? `\\frac{${m[1]}}{${m[3]}}` : m[1]} \\text{ as a percent}`, `${nice(r)}\\%`);
  }
  return null;
}

export const looksLikePercent = text => /%|percent/i.test(text);
