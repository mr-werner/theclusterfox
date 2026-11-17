// Radio practice helpers: tuning frequencies, and turning what a student
// typed or said ("foxfield ground skyhawk one two three four alpha") into
// a plain form the lessons can check ("foxfield ground skyhawk 1234 a").

/* Frequencies are kept as whole kilohertz: 121.7 MHz is 121700. */
export const COM_MIN = 118000;
export const COM_MAX = 136975;
export const fmtFreq = khz => (khz / 1000).toFixed(3);

/** Parse "121.7", "121.70", "121700" or "1217" into kHz, or null. */
export function parseFreq(text) {
  const t = String(text ?? "").trim().replace(/,/g, ".");
  if (!t) return null;
  let khz;
  if (/^\d{3}(\.\d{1,3})?$/.test(t)) khz = Math.round(Number(t) * 1000);
  else if (/^\d{6}$/.test(t)) khz = Number(t);
  else if (/^\d{4,5}$/.test(t)) khz = Math.round(Number(`${t.slice(0, 3)}.${t.slice(3)}`) * 1000);
  else return null;
  if (khz < COM_MIN || khz > COM_MAX) return null;
  if (khz % 5 !== 0) return null;
  return khz;
}

/** Turn the big knob (whole MHz) or small knob (25 kHz) one click, wrapping like a real radio. */
export function turnKnob(khz, knob, dir) {
  const mhz = Math.floor(khz / 1000);
  const frac = khz % 1000;
  if (knob === "big") {
    let next = mhz + dir;
    if (next > 136) next = 118;
    if (next < 118) next = 136;
    return next * 1000 + frac;
  }
  const steps = Math.round(frac / 25);
  const next = (((steps + dir) % 40) + 40) % 40;
  return mhz * 1000 + next * 25;
}

/* Spoken words to their written form. */
const DIGITS = { zero: "0", one: "1", two: "2", three: "3", tree: "3", four: "4", five: "5", fife: "5", six: "6", seven: "7", eight: "8", nine: "9", niner: "9" };
const PHONETIC = {
  alpha: "a", alfa: "a", bravo: "b", charlie: "c", delta: "d", echo: "e", foxtrot: "f", golf: "g", hotel: "h", india: "i",
  juliet: "j", juliett: "j", kilo: "k", lima: "l", mike: "m", november: "n", oscar: "o", papa: "p", quebec: "q", romeo: "r",
  sierra: "s", tango: "t", uniform: "u", victor: "v", whiskey: "w", whisky: "w", xray: "x", yankee: "y", zulu: "z",
};
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/**
 * Lowercase, spell numbers as digits, phonetic letters as letters, and
 * join digit runs: "runway two eight" → "runway 28", "one two one point
 * seven" → "121.7", "three thousand five hundred" → "3500",
 * "x-ray" → "x".
 */
export function normalizeCall(text) {
  let t = String(text ?? "").toLowerCase();
  t = t.replace(/x-ray/g, "xray").replace(/[’']/g, "").replace(/(\d),(\d{3})/g, "$1$2");
  t = t.replace(/(\d)\.(\d)/g, "$1 point $2");
  t = t.replace(/[^a-z0-9\s]/g, " ");
  // Split letters from digits typed together ("34a" → "34 a", "n1234a" → "n 1234 a").
  t = t.replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2");
  const words = t.split(/\s+/).filter(Boolean);

  // Words to tokens.
  const tokens = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w in DIGITS) tokens.push({ d: DIGITS[w] });
    else if (/^\d+$/.test(w)) tokens.push({ d: w, typed: true });
    else if (w in TEENS) tokens.push({ n: TEENS[w] });
    else if (w in TENS) {
      const next = words[i + 1];
      if (next && next in DIGITS && DIGITS[next] !== "0") {
        tokens.push({ n: TENS[w] + Number(DIGITS[next]) });
        i += 1;
      } else tokens.push({ n: TENS[w] });
    } else if (w === "hundred" || w === "thousand") tokens.push({ mult: w === "hundred" ? 100 : 1000 });
    else if (w === "point" || w === "decimal") tokens.push({ dot: true });
    else if (w in PHONETIC) tokens.push({ w: PHONETIC[w] });
    else tokens.push({ w });
  }

  // Join numbers.
  const out = [];
  for (let i = 0; i < tokens.length; ) {
    const tk = tokens[i];
    if (tk.d !== undefined || tk.n !== undefined) {
      // A run of digits, with an optional "thousand"/"hundred" form.
      let run = "";
      let total = 0;
      let current = null;
      let usedMult = false;
      let j = i;
      while (j < tokens.length) {
        const x = tokens[j];
        if (x.d !== undefined) {
          if (usedMult) {
            current = Number(`${current ?? ""}${x.d}`);
          } else run += x.d;
        } else if (x.n !== undefined) {
          if (usedMult) current = (current ?? 0) + x.n;
          else run += String(x.n);
        } else if (x.mult) {
          const base = usedMult ? (current ?? 1) : Number(run || 1);
          total += base * x.mult;
          run = "";
          current = null;
          usedMult = true;
        } else break;
        j += 1;
      }
      let num = usedMult ? String(total + (current ?? 0)) : run;
      // "121 point 7"
      if (tokens[j]?.dot && (tokens[j + 1]?.d !== undefined)) {
        let frac = "";
        j += 1;
        while (j < tokens.length && tokens[j].d !== undefined) {
          frac += tokens[j].d;
          j += 1;
        }
        num = `${num}.${frac}`;
      }
      out.push(num);
      i = j;
    } else if (tk.dot) {
      // ".7" said as "point seven"
      let frac = "";
      let j = i + 1;
      while (j < tokens.length && tokens[j].d !== undefined) {
        frac += tokens[j].d;
        j += 1;
      }
      out.push(frac ? `.${frac}` : "point");
      i = j;
    } else {
      out.push(tk.w ?? "");
      i += 1;
    }
  }
  return out.filter(Boolean).join(" ");
}

/* The practice airplane's callsign. */
export const CALLSIGN = { full: "Skyhawk 1234 Alpha", short: "Skyhawk 34 Alpha", type: "Skyhawk" };
export const CS_FULL = /\b(skyhawk|cessna|n)\s?1234\s?a\b/;
export const CS_ANY = /\b((skyhawk|cessna|n)\s?(12)?34\s?a|1234\s?a)\b/;

/** Check a call against a step's expected parts. */
export function gradeCall(text, expect) {
  const norm = normalizeCall(text);
  const parts = expect.map(e => ({ label: e.label, ok: e.re.test(norm), optional: !!e.optional }));
  const ok = parts.every(p => p.ok || p.optional);
  return { norm, parts, ok };
}
