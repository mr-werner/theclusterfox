// Helpers for writing calculator definitions.
//
// A calculator is { id, cat, name, blurb, keywords, inputs, compute, formula, about, sources }.
// Inputs hold SI values. compute(values) returns { results, warnings, visual }.
// A result is { id, label, dim, value } (numbers, shown in a unit the person picks)
// or { id, label, text } (words).

export const num = (id, label, dim, value, extra = {}) => ({ id, label, dim, value, type: "num", ...extra });

export const choice = (id, label, options, value, extra = {}) => ({
  id,
  label,
  type: "choice",
  options: options.map((o) => (typeof o === "string" ? { value: o, label: o } : o)),
  value: value ?? (typeof options[0] === "string" ? options[0] : options[0].value),
  ...extra,
});

/** A "fill from" list: picking an option sets other inputs. */
export const preset = (id, label, options, extra = {}) => ({ id, label, type: "preset", options, value: options[0]?.label ?? "", ...extra });

export const text = (id, label, value, extra = {}) => ({ id, label, type: "text", value, ...extra });

export const out = (id, label, dim, value, extra = {}) => ({ id, label, dim, value, ...extra });
export const say = (id, label, textValue, extra = {}) => ({ id, label, text: textValue, ...extra });
