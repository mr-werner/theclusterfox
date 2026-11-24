// Following a real instrument note by note through the microphone.
//
//   const listen = createNoteListener();
//   // every mic frame (from startMic):
//   const struck = listen.update(frame, expectedMidis, { ignore, masked, quiet });
//
// A microphone hears a note for as long as it rings, so "is C sounding?" is
// the wrong question for play-along: a C you played a second ago is still
// sounding when the song asks for the next C. This listener only reports a
// note at the moment it is struck: its own energy jumps (a new key press, or
// the same key played again), or the whole sound gets a sharp attack and the
// pitch tracker agrees on the note. A note still ringing from before never
// counts twice.
//
// expected: the midis worth listening for right now. Only these are judged,
//   which keeps noise and overtones from turning into wrong notes.
// ignore: midis the app itself is playing through the speakers right now.
//   They're skipped, and have to die away before they can count for you.
// masked: overtones of a note the app has just started. Skipped while its
//   sound builds up; after that you only need to play over it.
// (selfSounds() below works both out from what the app is playing.)
// quiet: true while the app makes a sound of its own (a metronome click), so
//   that sound's attack isn't taken for a key press.
//
// Pure JS, no browser APIs: the tests feed it made-up audio.

const HISTORY = 10; // frames kept (~250 ms at 40 frames a second)
const BASE_FROM = 9; // energy "before" is the quietest of frames n-9 .. n-3
const BASE_TO = 3;
const RISE = 2.5; // a note's own energy must jump this much to be a new strike
const MIN_REL = 0.25; // and stand at least this high in the frame's spectrum
const ATTACK = 1.5; // a whole-sound attack: the last 25 ms this much louder
const ATTACK_FRAMES = 4; // an attack still counts for this many frames
const BUMP = 1.25; // a smaller attack: enough when a ringing key is struck again
const BUMP_FRAMES = 8; // ...and its own energy climbs back up within this many frames
const RESTRIKE = 1.15; // by this much over where it was just before
const CONFIRM = 2; // frames in a row a strike must hold before it counts

export function createNoteListener() {
  const hist = []; // per frame: Float32Array(128) of note energies
  const fired = new Map(); // midi -> { frame, peak, faded } for the last time it counted
  const pending = new Map(); // midi -> frames in a row it has looked struck
  let n = 0;
  let floor = null;
  let lastAttack = -Infinity;
  let lastBump = -Infinity;
  let sounding = new Set();

  const contrast = (E, m) => {
    const c = (j) => (E[j] ?? 0) - ((E[j - 1] ?? 0) + (E[j + 1] ?? 0)) / 2;
    return m < 48 ? Math.max(c(m), c(m + 12) * 0.9) : c(m);
  };
  const energyOf = (E, m) => (m < 48 ? Math.max(E[m] ?? 0, (E[m + 12] ?? 0) * 0.9) : E[m] ?? 0);

  function update(frame, expected = [], { ignore, masked, quiet = false } = {}) {
    n++;
    const struck = [];
    const s = frame?.spectrum;
    if (!s) {
      pending.clear();
      sounding = new Set();
      return struck;
    }
    const peak = frame.peak ?? 1;
    const E = new Float32Array(128);
    for (let i = 0; i < 128; i++) E[i] = s[i] * peak;

    // Noise floor: drops to quiet moments quickly and climbs only very
    // slowly (over a minute or so), so a noisy room raises the bar but a long
    // run of notes ringing into each other doesn't.
    const level = frame.level ?? 0;
    floor = floor == null ? Math.min(level, 0.01) : level < floor ? floor * 0.7 + level * 0.3 : floor + (level - floor) * 0.0004;
    const loud = level > Math.max(0.005, floor * 2);
    if (!quiet && loud && (frame.attack ?? 1) >= ATTACK) lastAttack = n;
    if (!quiet && loud && (frame.attack ?? 1) >= BUMP && n - lastBump > 2) lastBump = n;

    const want = [...new Set(expected)];
    const next = new Set();
    for (const m of want) {
      if (ignore?.has(m)) {
        // Treat it like a strike someone else made: it has to die away (or
        // be struck again) before it can count for you.
        pending.delete(m);
        if (present(frame, m, 2)) {
          const e = energyOf(E, m);
          const f = fired.get(m);
          if (!f || f.faded || f.frame < n - 1) fired.set(m, { frame: n, peak: Math.max(e, f && !f.faded ? f.peak : 0), faded: false });
          else f.frame = n;
        }
        continue;
      }
      if (masked?.has(m)) {
        pending.delete(m);
        continue;
      }
      if (!loud || !present(frame, m, want.length, ignore)) {
        pending.delete(m);
        continue;
      }
      next.add(m);
      const f = fired.get(m);
      const last = f ? f.frame : -Infinity;
      // Energy before the strike, never looking back past the last time this
      // note counted, so one strike can't count again as it rings on.
      let base = Infinity;
      const from = Math.max(n - BASE_FROM, last + 1);
      for (let k = from; k <= n - BASE_TO; k++) {
        const h = hist[hist.length - (n - k)];
        if (h) base = Math.min(base, energyOf(h, m));
      }
      const now = energyOf(E, m);
      // A rise only counts once the last strike of this key has died away;
      // until then its energy is still building up in the long window.
      // A quick repeat shows up as a fresh attack instead.
      let rose = (!f || f.faded) && base !== Infinity && now > base * RISE + 1e-9;
      // Struck again while still ringing: a bump in loudness, then this
      // note's energy climbing back up from where it was just before.
      if (!rose && n - lastBump <= BUMP_FRAMES && lastBump > last + 2) {
        // Measured against the keys either side, so the broadband knock of
        // some other key landing on this note's bins doesn't count.
        const before = hist[hist.length - (n - (lastBump - 1))];
        if (before && contrast(E, m) > contrast(before, m) * RESTRIKE + 1e-12) rose = true;
      }
      const attacked = n - lastAttack <= ATTACK_FRAMES && lastAttack > last + 1 && pitchAgrees(frame, m);
      if (rose || attacked) {
        const c = (pending.get(m) ?? 0) + 1;
        if (c >= CONFIRM) {
          struck.push(m);
          fired.set(m, { frame: n, peak: now, faded: false });
          pending.delete(m);
        } else pending.set(m, c);
      } else if (pending.has(m)) {
        // It was rising last frame: let the energy keep building one more frame.
        const c = pending.get(m) + 1;
        if (c >= CONFIRM && now > 0) {
          struck.push(m);
          fired.set(m, { frame: n, peak: now, faded: false });
          pending.delete(m);
        } else pending.set(m, c);
      }
    }
    for (const m of pending.keys()) if (!want.includes(m)) pending.delete(m);
    for (const [m, f] of fired) {
      const e = energyOf(E, m);
      if (e > f.peak) f.peak = e;
      else if (e < f.peak * 0.25) f.faded = true;
    }

    hist.push(E);
    if (hist.length > HISTORY) hist.shift();
    sounding = next;
    return struck;
  }

  return {
    update,
    /** Expected notes heard in the last frame (struck or still ringing). */
    get sounding() {
      return sounding;
    },
    reset() {
      hist.length = 0;
      fired.clear();
      pending.clear();
      lastAttack = -Infinity;
      lastBump = -Infinity;
      sounding = new Set();
    },
  };
}

/** Is note m in this frame at all (struck now or ringing)? */
export function present(frame, m, groupSize = 1, ignore) {
  const s = frame.spectrum;
  const f = s[m] ?? 0;
  const h = s[m + 12] ?? 0;
  // Low piano notes have a weak fundamental; their octave overtone carries them.
  const rel = m < 48 ? Math.max(f, h * 0.9) : Math.max(f, h * 0.5);
  if (rel < MIN_REL) return false;
  // A note is a few sharp peaks; a knock, a click or a voice's hiss lifts
  // the whole spectrum. Ask for the note to stand well above the typical key.
  if (rel < 4 * spread(s)) return false;
  // The energy has to peak on this key, not leak from the one next door.
  if (m >= 48 && f < Math.max(s[m - 1] ?? 0, s[m + 1] ?? 0)) return false;
  // One note asked for, and the pitch tracker is sure it hears another: no.
  // (Unless the note itself dominates the spectrum: the tracker can lock onto
  // a ringing low note, or the app's own note, which may well be louder.)
  if (groupSize === 1 && f < 0.6 && frame.midi != null && !ignore?.has(frame.midi) && frame.clarity >= 0.8 && ((frame.midi - m) % 12 + 12) % 12 !== 0) return false;
  return true;
}

const spreads = new WeakMap();
/** The median energy across the keyboard's middle (C2 to E7) in this spectrum. */
function spread(s) {
  let v = spreads.get(s);
  if (v == null) {
    const a = Array.from(s.subarray(36, 101)).sort((x, y) => x - y);
    v = a[a.length >> 1];
    spreads.set(s, v);
  }
  return v;
}

/**
 * The pitch tracker names this note (or its octave). Only a single clear
 * pitch counts: when it can't name one (a chord, or notes ringing over each
 * other) the note has to show its own rise instead, because "the loudest
 * thing ringing" is not the same as "the key just struck".
 */
function pitchAgrees(frame, m) {
  return frame.midi != null && (frame.midi === m || frame.midi === m + 12 || frame.midi === m - 12);
}

/**
 * What to leave out while the app plays sounds of its own, for update():
 * each note it is playing (ignore), and, just after one starts, the
 * overtones the microphone picks up from it (masked).
 * sounds: [{ midi, at, until }] in ms; now in ms.
 */
export function selfSounds(sounds, now, { fresh = 400 } = {}) {
  const ignore = new Set();
  const masked = new Set();
  for (const x of sounds) {
    if (now > x.until) continue;
    ignore.add(x.midi);
    if (now - x.at < fresh) for (const k of [-12, 12, 19, 24, 28, 31]) masked.add(x.midi + k);
  }
  for (const m of ignore) masked.delete(m);
  return { ignore, masked };
}
