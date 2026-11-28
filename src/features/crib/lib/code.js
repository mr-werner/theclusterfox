// Pairing codes: eight letters and digits, without the ones that look alike
// (0/O, 1/I/L), shown as ABCD-2345. About 40 bits, so nobody stumbles on
// someone else's monitor by guessing.

export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** A fresh random code, like "K7QM3XRA". */
export function newCode(random = (n) => crypto.getRandomValues(new Uint32Array(n))) {
  const values = random(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[values[i] % ALPHABET.length];
  return code;
}

/** What someone typed, cleaned up: upper case, no spaces or dashes. */
export function cleanCode(input) {
  return String(input ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

/** True when the cleaned code is a whole code. */
export const isCode = (code) => code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));

/** "K7QM3XRA" shown as "K7QM-3XRA". */
export const showCode = (code) => (code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

/** A loudness from 0 (quiet room) to 100 (shouting), from a sound's RMS (0..1). */
export function loudness(rms) {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.max(0, Math.min(100, Math.round(((db + 60) / 50) * 100)));
}

/**
 * Watches loudness readings for crying: true once the sound has stayed over
 * `threshold` for `holdMs`, then quiet for `coolMs` before it can fire again.
 */
export function noiseAlarm({ holdMs = 1500, coolMs = 20000 } = {}) {
  let loudSince = null;
  let lastAlert = -Infinity;
  return (level, threshold, now) => {
    if (level < threshold) {
      loudSince = null;
      return false;
    }
    loudSince ??= now;
    if (now - loudSince >= holdMs && now - lastAlert >= coolMs) {
      lastAlert = now;
      return true;
    }
    return false;
  };
}
