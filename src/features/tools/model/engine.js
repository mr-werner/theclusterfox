// Running a calculator: defaults, URL state, and a safe compute.

export function defaultsOf(calc) {
  return Object.fromEntries(calc.inputs.map((i) => [i.id, i.value]));
}

export const isVisible = (input, values) => !input.hidden && (!input.when || input.when(values));

/** Run compute and catch anything odd so one bad input never blanks the page. */
export function run(calc, values) {
  for (const input of calc.inputs) {
    if (input.type !== "num" || !isVisible(input, values)) continue;
    const v = values[input.id];
    if (!Number.isFinite(v)) return { results: [], warnings: [`Enter a number for “${input.label}”.`] };
    if (input.min !== undefined && v < input.min) return { results: [], warnings: [`“${input.label}” can't be less than ${input.min === 0 ? "zero" : input.min}.`] };
    if (input.max !== undefined && v > input.max) return { results: [], warnings: [`“${input.label}” is out of range.`] };
  }
  try {
    const r = calc.compute(values) || {};
    return { results: r.results || [], warnings: r.warnings || [], visual: r.visual };
  } catch (err) {
    console.error(err);
    return { results: [], warnings: ["Those inputs don't make a valid case. Check the values."] };
  }
}

/** Values → URL search params (only what differs from the defaults). */
export function toParams(calc, values) {
  const params = {};
  for (const input of calc.inputs) {
    const v = values[input.id];
    if (v === input.value || v === undefined) continue;
    params[input.id] = typeof v === "number" ? String(Number(v.toPrecision(10))) : String(v);
  }
  return params;
}

export function fromParams(calc, searchParams) {
  const values = defaultsOf(calc);
  for (const input of calc.inputs) {
    const raw = searchParams.get(input.id);
    if (raw === null) continue;
    if (input.type === "num") {
      const n = Number(raw);
      if (Number.isFinite(n)) values[input.id] = n;
    } else if (input.type === "choice") {
      if (input.options.some((o) => o.value === raw)) values[input.id] = raw;
    } else values[input.id] = raw;
  }
  return values;
}

/** Apply a preset option: set its fields. */
export function applyPreset(calc, values, presetId, label) {
  const input = calc.inputs.find((i) => i.id === presetId);
  const option = input?.options.find((o) => o.label === label);
  const set = Object.fromEntries(Object.entries(option?.set || {}).filter(([k]) => k in values));
  return { ...values, [presetId]: label, ...set };
}

/** The preset label that matches current values, or "" (custom). */
export function matchingPreset(input, values) {
  const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const current = input.options.find((o) => o.label === values[input.id]);
  const matches = (o) => {
    const entries = Object.entries(o?.set || {}).filter(([k]) => k in values);
    return entries.length > 0 && entries.every(([k, v]) => close(values[k], v));
  };
  if (matches(current)) return current.label;
  const any = input.options.find(matches);
  return any ? any.label : "";
}
