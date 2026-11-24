// Jump math. Heights are kept in centimeters and shown in your units.

const G = 9.81;

/** Jump height (cm) from time in the air (seconds): h = g·t²/8. */
export function heightFromFlight(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 2) return null;
  return Math.round(((G * seconds * seconds) / 8) * 1000) / 10;
}

/** Time in the air from a slow-motion video: frames between takeoff and landing. */
export function flightFromFrames(takeoffFrame, landingFrame, fps) {
  if (![takeoffFrame, landingFrame, fps].every(Number.isFinite) || fps <= 0 || landingFrame <= takeoffFrame) return null;
  return (landingFrame - takeoffFrame) / fps;
}

/** Vertical (cm) from standing reach and jump touch, both in cm. */
export function heightFromReach(reach, touch) {
  if (!Number.isFinite(reach) || !Number.isFinite(touch) || touch <= reach) return null;
  return Math.round((touch - reach) * 10) / 10;
}

export const CM_PER_IN = 2.54;

export const toCm = (value, unit) => (unit === "in" ? value * CM_PER_IN : value);
export const fromCm = (cm, unit) => (unit === "in" ? cm / CM_PER_IN : cm);

/** "28.5 in" or "72 cm". Broad jumps over 100 in read better in feet and inches. */
export function fmtLength(cm, unit, { long = false } = {}) {
  if (!Number.isFinite(cm)) return "–";
  if (unit === "in") {
    const inches = cm / CM_PER_IN;
    if (long && inches >= 60) {
      const ft = Math.floor(inches / 12);
      const rest = Math.round(inches - ft * 12);
      return rest === 12 ? `${ft + 1}′ 0″` : `${ft}′ ${rest}″`;
    }
    return `${Math.round(inches * 10) / 10} in`;
  }
  if (long && cm >= 100) return `${(cm / 100).toFixed(2)} m`;
  return `${Math.round(cm * 10) / 10} cm`;
}

/** Best result for each test (and side), with the first one for comparison. */
export function bestByTest(results) {
  const out = new Map();
  const sorted = [...results].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  for (const r of sorted) {
    const key = r.side ? `${r.test}:${r.side}` : r.test;
    const cur = out.get(key);
    if (!cur) out.set(key, { key, test: r.test, side: r.side ?? null, first: r, best: r, last: r, count: 1 });
    else {
      cur.count += 1;
      cur.last = r;
      if (r.cm > cur.best.cm) cur.best = r;
    }
  }
  return out;
}
