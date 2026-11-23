// International Morse code (ITU-R M.1677) and the timing that turns it into
// light. One "unit" is a dot. A dash is three units, the gap inside a letter
// is one, between letters three, between words seven.

export const MORSE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", "_": "..--.-",
  '"': ".-..-.", $: "...-..-", "@": ".--.-.",
};

// SOS is sent as one run of nine signals with no letter gaps (a prosign),
// which is how it is recognized.
export const SOS_CODE = "...---...";

const FROM_CODE = new Map(Object.entries(MORSE).map(([ch, code]) => [code, ch]));

export const MAX_MESSAGE = 120;

/** Words per minute to milliseconds per unit (the PARIS standard). */
export const unitMs = wpm => Math.round(1200 / Math.min(30, Math.max(1, wpm)));

/** Fold what people type into characters Morse has: case, accents, curly quotes. */
export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE);
}

/**
 * Text to Morse, letter by letter.
 * Returns [{ char, code }] where a space is { char: " ", code: " " } and a
 * character Morse has no code for is { char, code: null } (it is skipped).
 */
export function encode(text) {
  const clean = normalizeText(text);
  const out = [];
  for (const char of clean) {
    if (char === " ") {
      if (out.length && out[out.length - 1].char !== " ") out.push({ char: " ", code: " " });
    } else {
      out.push({ char, code: MORSE[char] ?? null });
    }
  }
  while (out.length && out[out.length - 1].char === " ") out.pop();
  return out;
}

/** The readable form: ".-- .... --- / .- -- ..." */
export function toMorseString(text) {
  return encode(text)
    .filter(l => l.code)
    .map(l => (l.code === " " ? "/" : l.code))
    .join(" ");
}

/** Morse back to text. Letters split by spaces, words by " / " or 3+ spaces. */
export function decode(morse) {
  return String(morse ?? "")
    .trim()
    .split(/\s*\/\s*|\s{3,}/)
    .map(word =>
      word
        .split(/\s+/)
        .filter(Boolean)
        .map(code => (code === SOS_CODE ? "SOS" : FROM_CODE.get(code) ?? "?"))
        .join("")
    )
    .filter(Boolean)
    .join(" ");
}

/**
 * Turn letters into light: [{ on, units, at }], where at is the index of
 * the letter in `letters` (for highlighting what is being sent). Ends with a
 * word gap so it repeats cleanly.
 */
export function lettersToUnits(letters) {
  const steps = [];
  const off = (units, at) => {
    const last = steps[steps.length - 1];
    if (last && !last.on) last.units = Math.max(last.units, units);
    else steps.push({ on: false, units, at });
  };
  letters.forEach((l, at) => {
    if (!l.code) return;
    if (l.code === " ") {
      off(7, at);
      return;
    }
    if (steps.length) off(3, at);
    [...l.code].forEach((sym, i) => {
      if (i > 0) off(1, at);
      steps.push({ on: true, units: sym === "-" ? 3 : 1, at });
    });
  });
  if (steps.length) off(7, letters.length - 1);
  return steps;
}

/** Units to milliseconds. */
export const unitsToMs = (steps, unit) => steps.map(s => ({ on: s.on, ms: s.units * unit, at: s.at }));

/** How long one pass takes, in ms. */
export const totalMs = segments => segments.reduce((sum, s) => sum + s.ms, 0);

/** A message's light pattern in ms at a speed. */
export function messageSegments(text, wpm) {
  return unitsToMs(lettersToUnits(encode(text)), unitMs(wpm));
}

/**
 * Read a press-and-release key: given how long each press lasted and the
 * pause before the next, return the letters. Presses under two units are
 * dots, longer are dashes; a pause over 2.5 units ends a letter, over 5.5 a
 * word. `unit` adapts to how fast the person taps when `adapt` is on.
 */
export function readKeying(presses, unit) {
  let code = "";
  let text = "";
  const flush = () => {
    if (code) text += code === SOS_CODE ? "SOS" : FROM_CODE.get(code) ?? "?";
    code = "";
  };
  presses.forEach(({ down, gapAfter }) => {
    code += down < unit * 2 ? "." : "-";
    if (gapAfter == null) return;
    if (gapAfter > unit * 5.5) {
      flush();
      text += " ";
    } else if (gapAfter > unit * 2.5) {
      flush();
    }
  });
  return { text, pending: code };
}
