// Look up what a calculator's inputs and results mean, and where its
// principle is used. See terms.js, fields.js and uses.js.

import { TERMS } from "./terms.js";
import { FIELD_TERMS } from "./fields.js";
import { USES } from "./uses.js";

export { TERMS, FIELD_TERMS, USES };

/** The term key for a calculator field, or undefined. `side` is "in" or "out". */
export function termKeyFor(calcId, side, fieldId) {
  const map = FIELD_TERMS[calcId]?.[side];
  if (!map) return undefined;
  return map[fieldId] ?? map[fieldId.replace(/\d+$/, "#")];
}

/** The term (with its key) for a calculator field, or null. */
export function termFor(calcId, side, fieldId) {
  const key = termKeyFor(calcId, side, fieldId);
  return key && TERMS[key] ? { key, ...TERMS[key] } : null;
}

/**
 * Every distinct term on a calculator page, in page order: the inputs shown
 * (whether in the form or on the drawing), then the results.
 */
export function termsOnPage(calcId, inputs, results) {
  const seen = new Set();
  const list = [];
  const add = (side, id) => {
    const t = termFor(calcId, side, id);
    if (!t || seen.has(t.key)) return;
    seen.add(t.key);
    list.push(t);
  };
  inputs.forEach((i) => add("in", i.id));
  results.forEach((r) => add("out", r.id));
  return list;
}

export const usesFor = (calcId) => USES[calcId] ?? null;
