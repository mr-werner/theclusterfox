// A calculation written out as a plain record: inputs with units, results,
// warnings, equations and sources, for copying, saving or printing.
import { isVisible, matchingPreset } from "./engine.js";
import { fmt, fromSI, unitLabel } from "./units.js";

/** One line per visible input, in the units on screen. */
export function inputRows(calc, values, unitFor) {
  return calc.inputs
    .filter((input) => isVisible(input, values))
    .map((input) => {
      const v = values[input.id];
      if (input.type === "num") {
        const u = unitFor(input.dim);
        return { label: input.label, value: fmt(fromSI(v, input.dim, u), 6), unit: unitLabel(input.dim, u) };
      }
      if (input.type === "choice") return { label: input.label, value: input.options.find((o) => o.value === v)?.label ?? String(v), unit: "" };
      if (input.type === "preset") return { label: input.label, value: matchingPreset(input, values) || "Custom", unit: "" };
      return { label: input.label, value: String(v ?? ""), unit: "" };
    });
}

/** One line per result, in the units chosen for each. */
export function resultRows(results, outUnitFor) {
  return results.map((r) => {
    if (r.text !== undefined) return { label: r.label, value: r.text, unit: "" };
    const u = outUnitFor(r);
    return { label: r.label, value: fmt(fromSI(r.value, r.dim, u)), unit: unitLabel(r.dim, u) };
  });
}

const line = (row) => `  ${row.label}: ${row.value}${row.unit ? ` ${row.unit}` : ""}`;

export function reportText({ calc, inputs, results, warnings = [], url = "", date = new Date() }) {
  const parts = [
    `${calc.name}`,
    `Engineer ToolFox · ${date.toISOString().slice(0, 10)}`,
    "",
    "Inputs",
    ...inputs.map(line),
    "",
    "Results",
    ...(results.length ? results.map(line) : ["  (no result for these inputs)"]),
  ];
  if (warnings.length) parts.push("", "Notes", ...warnings.map((w) => `  ${w}`));
  if (calc.formula?.length) parts.push("", "Equations", ...calc.formula.map((f) => `  ${f}`));
  if (calc.about) parts.push("", "Assumptions", `  ${calc.about}`);
  if (calc.sources) parts.push("", "Sources", `  ${calc.sources}`);
  if (url) parts.push("", `Open these inputs: ${url}`);
  parts.push("", "Check results before relying on them for design.");
  return parts.join("\n");
}

const csvCell = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));

export function reportCsv({ inputs, results }) {
  const rows = [["Section", "Quantity", "Value", "Unit"]];
  inputs.forEach((r) => rows.push(["Input", r.label, r.value, r.unit]));
  results.forEach((r) => rows.push(["Result", r.label, r.value, r.unit]));
  // Excel reads U+2212 minus as text, so write a plain hyphen.
  // The byte-order mark lets Excel read symbols like ³ and ε.
  return "\ufeff" + rows.map((row) => row.map((c) => csvCell(String(c).replace(/−/g, "-").replace(/,(?=\d{3}\b)/g, ""))).join(",")).join("\n");
}
