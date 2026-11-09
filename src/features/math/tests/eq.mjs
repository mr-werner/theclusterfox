// Scratch printer used while developing: node eq.mjs "2x+3=7"
import { solve } from "../solve.js";
for (const s of process.argv.slice(2)) {
  try {
    const r = solve(s);
    console.log("==", s, "|", r.topic, "|", r.problem);
    for (const m of r.methods) {
      console.log("  [" + m.name + "]");
      for (const x of m.steps) console.log("   -", x.text, "||", x.tex, x.work ? "  (work: " + x.work + ")" : "");
    }
    console.log("  ANS:", r.answers.join(" ; "), "|", r.approx.join(" ; "), "|", r.notes.join(" "));
    if (r.graph) console.log("  GRAPH:", r.graph.fns?.map(f => f.label).join(" & "), JSON.stringify(r.graph.points?.map(p => [p.x, p.y])));
  } catch (e) {
    console.log(s, "ERR", e.stack);
  }
}
