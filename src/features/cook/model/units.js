// Turning canonical quantities into practical kitchen measurements.
// Volume mode favors cups and spoons (and ounces/pounds for things you'd weigh
// at the store, like meat). Weight mode favors grams and milliliters. Counts
// (eggs, garlic cloves) stay counts in both.

export const ML_PER_CUP = 236.588;
export const ML_PER_TBSP = 14.787;
export const ML_PER_TSP = 4.929;
export const G_PER_OZ = 28.3495;
export const G_PER_LB = 453.592;

const FRACTION_GLYPHS = { 0.125: "⅛", 0.25: "¼", 0.333: "⅓", 0.5: "½", 0.667: "⅔", 0.75: "¾" };

// Rounds value to the nearest allowed fraction (e.g. [0, .25, .5, .75]).
// Returns the rounded number and its kitchen-friendly text.
export function kitchenFraction(value, fractions) {
  let best = { v: 0, err: Infinity };
  const whole = Math.floor(value);
  for (const w of [whole, whole + 1]) {
    for (const f of fractions) {
      const v = w + f;
      const err = Math.abs(v - value);
      if (err < best.err - 1e-9) best = { v, err, w, f };
    }
  }
  return { value: best.v, text: fractionText(best.w, best.f) };
}

function fractionText(whole, frac) {
  const key = Object.keys(FRACTION_GLYPHS).find(k => Math.abs(Number(k) - frac) < 0.01);
  if (!key) return String(whole);
  if (whole === 0) return FRACTION_GLYPHS[key];
  return `${whole} ${FRACTION_GLYPHS[key]}`;
}

const roundTo = (value, step) => Math.round(value / step) * step;
const trim = n => String(Number(n.toFixed(2)));

export function formatVolume(ml) {
  const tsp = ml / ML_PER_TSP;
  if (tsp < 0.1) return { qty: "", unit: "a pinch", value: 0 };
  if (tsp < 0.375) {
    const r = kitchenFraction(tsp, [0, 0.125, 0.25]);
    return { qty: r.text, unit: "tsp", value: r.value * ML_PER_TSP };
  }
  if (ml < ML_PER_TBSP * 0.95) {
    const r = kitchenFraction(tsp, [0, 0.25, 0.5, 0.75]);
    if (r.value >= 3) return { qty: "1", unit: "tbsp", value: ML_PER_TBSP };
    return { qty: r.text, unit: "tsp", value: r.value * ML_PER_TSP };
  }
  if (ml < ML_PER_CUP / 4 - 0.5) {
    const r = kitchenFraction(ml / ML_PER_TBSP, [0, 0.5]);
    if (r.value >= 4) return { qty: "¼", unit: "cup", value: ML_PER_CUP / 4 };
    return { qty: r.text, unit: "tbsp", value: r.value * ML_PER_TBSP };
  }
  const r = kitchenFraction(ml / ML_PER_CUP, [0, 0.25, 0.333, 0.5, 0.667, 0.75]);
  return { qty: r.text, unit: r.value > 1 ? "cups" : "cup", value: r.value * ML_PER_CUP };
}

export function formatUsWeight(g) {
  const oz = g / G_PER_OZ;
  if (oz < 0.25) return formatGrams(g);
  if (oz < 15.75) {
    const r = oz < 4 ? kitchenFraction(oz, [0, 0.25, 0.5, 0.75]) : { value: Math.round(oz), text: String(Math.round(oz)) };
    return { qty: r.text, unit: "oz", value: r.value * G_PER_OZ };
  }
  const r = kitchenFraction(g / G_PER_LB, [0, 0.25, 0.333, 0.5, 0.667, 0.75]);
  return { qty: r.text, unit: "lb", value: r.value * G_PER_LB };
}

export function formatGrams(g) {
  if (g < 0.25) return { qty: "", unit: "a pinch", value: 0 };
  if (g >= 1000) {
    const v = roundTo(g / 1000, 0.05);
    return { qty: trim(v), unit: "kg", value: v * 1000 };
  }
  const step = g < 10 ? 0.5 : g < 100 ? 1 : g < 500 ? 5 : 10;
  const v = roundTo(g, step);
  return { qty: trim(v), unit: "g", value: v };
}

export function formatMl(ml) {
  if (ml < 0.25) return { qty: "", unit: "a dash", value: 0 };
  if (ml >= 1000) {
    const v = roundTo(ml / 1000, 0.05);
    return { qty: trim(v), unit: "L", value: v * 1000 };
  }
  const step = ml < 20 ? 0.5 : ml < 100 ? 5 : 10;
  const v = roundTo(ml, step);
  return { qty: trim(v), unit: "ml", value: v };
}

// Counts: whole-only items (eggs) round to whole numbers and say so;
// everything else rounds to quarters under one and halves above.
export function formatCount(n, whole = false) {
  if (whole) {
    const v = Math.max(1, Math.round(n));
    return { qty: String(v), unit: "", value: v, rounded: Math.abs(v - n) > 0.05 };
  }
  const r = kitchenFraction(n, n < 1 ? [0, 0.25, 0.5, 0.75] : [0, 0.5]);
  if (r.value < 0.25) return { qty: "¼", unit: "", value: 0.25, rounded: false };
  return { qty: r.text, unit: "", value: r.value, rounded: false };
}

// The amount of one ingredient in the cook's chosen mode.
export function formatAmount(ing, amount, mode) {
  if (ing.unit === "each") return formatCount(amount, ing.whole);
  if (mode === "weight") return ing.unit === "ml" ? formatMl(amount) : formatGrams(amount);
  if (ing.unit === "ml") return formatVolume(amount);
  if (ing.us === "weight") return formatUsWeight(amount);
  return formatVolume((amount / ing.gPerCup) * ML_PER_CUP);
}

// Full display text: "1 ½ cups all-purpose flour", "3 cloves garlic", "2 large eggs".
export function amountText(ing, amount, mode) {
  const f = formatAmount(ing, amount, mode);
  if (ing.unit === "each") {
    const many = f.value > 1;
    if (ing.countUnit) return { ...f, text: `${f.qty} ${many ? ing.countUnit[1] : ing.countUnit[0]}`, name: ing.name };
    return { ...f, text: f.qty, name: many && ing.plural ? ing.plural : ing.name };
  }
  return { ...f, text: f.qty ? `${f.qty} ${f.unit}` : f.unit, name: ing.name };
}

// Grams of an amount, for nutrition.
export function toGrams(ing, amount) {
  if (ing.unit === "g") return amount;
  if (ing.unit === "ml") return amount * (ing.density ?? 1);
  return amount * (ing.gEach ?? 0);
}

// Temperatures. Oven settings round to the nearest 25°F (how dials are marked);
// food temperatures round to the nearest degree, matching USDA charts.
export function ovenTemp(c, unit) {
  return unit === "C" ? `${c}°C` : `${Math.round(((c * 9) / 5 + 32) / 25) * 25}°F`;
}

export function foodTemp(c, unit) {
  return unit === "C" ? `${c}°C` : `${Math.round((c * 9) / 5 + 32)}°F`;
}

// Replaces {oven:220} and {temp:74} tokens in step text.
export function renderTemps(text, unit) {
  return text.replace(/\{(oven|temp):(\d+(?:\.\d+)?)\}/g, (_, kind, c) =>
    kind === "oven" ? ovenTemp(Number(c), unit) : foodTemp(Number(c), unit)
  );
}
