// PilotFox's flight model: a light trainer (numbers close to a Cessna 172)
// flown as a point mass. It is simple on purpose, but it gets the
// lessons right: the elevator sets angle of attack, power and pitch trade
// speed for climb, bank turns the airplane, and too much angle of attack
// stalls the wing. Units inside are SI (meters, m/s, radians).

export const G = 9.81;
export const KT = 0.514444; // m/s per knot
export const FT = 0.3048; // m per foot
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export const PLANE = {
  mass: 1000, // kg, about 2,200 lb
  wing: 16.2, // m²
  cl0: 0.25,
  clAlpha: 4.8, // per radian
  stallAlpha: 16 * D2R,
  cd0: 0.027,
  k: 0.058, // induced drag factor
  power: 70000, // W of thrust power at full throttle at sea level
  staticThrust: 2700, // N
  flapCl: 0.55 / 30, // extra lift coefficient per degree of flap
  flapCd: 0.045 / 30,
  vr: 55, // rotate, knots
  vne: 163,
};

// The practice airport: Foxfield (made up), field elevation 0, one
// runway 10/28, 1,500 m by 46 m, centered on the origin.
export const RUNWAY = {
  heading: 280,
  length: 1500,
  width: 46, // 150 ft
};
const RWY_U = [Math.sin(RUNWAY.heading * D2R), Math.cos(RUNWAY.heading * D2R)];
/** Where a point (east, north) sits relative to runway 28: along from the
 *  threshold (positive down the runway) and across (positive right). */
export function runwayFrame(x, y) {
  const tx = -RWY_U[0] * (RUNWAY.length / 2);
  const ty = -RWY_U[1] * (RUNWAY.length / 2);
  const dx = x - tx;
  const dy = y - ty;
  return { along: dx * RWY_U[0] + dy * RWY_U[1], across: dx * RWY_U[1] - dy * RWY_U[0] };
}
/** World position of a point given along/across runway 28. */
export function fromRunway(along, across) {
  const tx = -RWY_U[0] * (RUNWAY.length / 2);
  const ty = -RWY_U[1] * (RUNWAY.length / 2);
  return [tx + along * RWY_U[0] + across * RWY_U[1], ty + along * RWY_U[1] - across * RWY_U[0]];
}
export const onRunway = (x, y) => {
  const r = runwayFrame(x, y);
  return r.along >= -5 && r.along <= RUNWAY.length + 5 && Math.abs(r.across) <= RUNWAY.width / 2 + 2;
};

export const density = h => 1.225 * Math.pow(Math.max(0.2, 1 - 2.2558e-5 * h), 4.256);

function clMax(flaps) {
  return PLANE.cl0 + flaps * PLANE.flapCl + PLANE.clAlpha * PLANE.stallAlpha;
}

/** Lift coefficient, with the drop-off past the stall. */
export function liftCoefficient(alpha, flaps = 0) {
  const base = PLANE.cl0 + flaps * PLANE.flapCl;
  if (alpha <= PLANE.stallAlpha) return base + PLANE.clAlpha * Math.max(alpha, -12 * D2R);
  return clMax(flaps) - (alpha - PLANE.stallAlpha) * 3.2;
}

export function thrust(throttle, v, h) {
  const sigma = density(h) / 1.225;
  return Math.min(PLANE.staticThrust, PLANE.power / Math.max(v, 1)) * throttle * sigma;
}

/** Stall speed in knots, level flight at load factor n. */
export function stallSpeedKt(flaps = 0, n = 1, h = 0) {
  return Math.sqrt((2 * PLANE.mass * G * n) / (density(h) * PLANE.wing * clMax(flaps))) / KT;
}

/** Angle of attack (degrees) that holds level flight at this speed. */
export function trimAlphaDeg(kt, flaps = 0, h = 0) {
  const v = kt * KT;
  const cl = (PLANE.mass * G) / (0.5 * density(h) * v * v * PLANE.wing);
  return ((cl - PLANE.cl0 - flaps * PLANE.flapCl) / PLANE.clAlpha) * R2D;
}

/** Throttle (0..1) that holds level flight at this speed, or more than 1 if it can't. */
export function levelThrottle(kt, flaps = 0, h = 0) {
  const v = kt * KT;
  const q = 0.5 * density(h) * v * v;
  const cl = (PLANE.mass * G) / (q * PLANE.wing);
  const d = q * PLANE.wing * (PLANE.cd0 + flaps * PLANE.flapCd + PLANE.k * cl * cl);
  return d / thrust(1, v, h);
}

export const FLAP_STEPS = [0, 10, 20, 30];

/** The airplane at rest or in flight. Angles in radians. */
function base(over) {
  return {
    x: 0, y: 0, h: 0, v: 0, gamma: 0, psi: RUNWAY.heading * D2R, phi: 0,
    alpha: 0, flaps: 0, throttle: 0, trim: 2, onGround: true, t: 0,
    turnRate: 0, slip: 0, stalled: false, warn: null, outcome: null, touchdown: null,
    ...over,
  };
}

export const SCENARIOS = [
  {
    id: "takeoff",
    name: "Take off",
    blurb: "Lined up on runway 28 at Foxfield. Full power, keep it on the centerline, and pull back gently at 55 knots.",
    make() {
      const [x, y] = fromRunway(15, 0);
      // Trimmed for a climb at about 70 knots, as you'd set it before takeoff.
      return base({ x, y, trim: 5 });
    },
  },
  {
    id: "cruise",
    name: "Cruise at 3,000 ft",
    blurb: "Level at 3,000 feet and 100 knots, trimmed and hands off. Try turns, climbs, descents and slow flight.",
    make() {
      const h = 3000 * FT;
      const [x, y] = fromRunway(-9000, 1500);
      return base({ x, y, h, v: 100 * KT, onGround: false, alpha: trimAlphaDeg(100, 0, h) * D2R, trim: trimAlphaDeg(100, 0, h), throttle: levelThrottle(100, 0, h) });
    },
  },
  {
    id: "final",
    name: "Land from final",
    blurb: "A mile and a half out on a 3° glide path to runway 28 with 20° of flaps. Hold 65 knots, keep the lights two white and two red, and flare just above the runway.",
    make() {
      const dist = 2800;
      const h = dist * Math.tan(3 * D2R);
      const [x, y] = fromRunway(-dist + 300, 0);
      const kt = 65;
      const gamma = -3 * D2R;
      const a = trimAlphaDeg(kt, 20) * D2R;
      // Power that holds 65 knots on a 3° descent.
      const v = kt * KT;
      const q = 0.5 * density(h) * v * v;
      const cl = (PLANE.mass * G * Math.cos(gamma)) / (q * PLANE.wing);
      const d = q * PLANE.wing * (PLANE.cd0 + 20 * PLANE.flapCd + PLANE.k * cl * cl);
      const thr = Math.max(0, (d + PLANE.mass * G * Math.sin(gamma)) / thrust(1, v, h));
      return base({ x, y, h, v, gamma, onGround: false, alpha: a, trim: a * R2D, flaps: 20, throttle: thr });
    },
  },
  {
    id: "stalls",
    name: "Practice stalls",
    blurb: "At 4,500 feet with room to spare. Pull power to idle, hold the nose up until the wing stalls, then recover: nose down, full power, wings level.",
    make() {
      const h = 4500 * FT;
      const [x, y] = fromRunway(-15000, -3000);
      return base({ x, y, h, v: 90 * KT, onGround: false, alpha: trimAlphaDeg(90, 0, h) * D2R, trim: trimAlphaDeg(90, 0, h), throttle: levelThrottle(90, 0, h), psi: 0 });
    },
  },
];

export const scenarioById = id => SCENARIOS.find(s => s.id === id) ?? SCENARIOS[0];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, target, rate, dt) => v + clamp(target - v, -rate * dt, rate * dt);

/**
 * Advance the airplane by dt seconds.
 * c: { elevator -1..1 (+ = pull back), aileron -1..1 (+ = right),
 *      rudder -1..1 (+ = right), throttle 0..1, flaps 0..30, brakes bool }
 * Returns a new state.
 */
export function step(s, c, dt) {
  if (s.outcome === "crash") return s;
  const n = { ...s, t: s.t + dt, throttle: clamp(c.throttle, 0, 1), flaps: approach(s.flaps, c.flaps ?? s.flaps, 5, dt) };
  const m = PLANE.mass;
  const rho = density(n.h);
  const v = Math.max(n.v, 0.1);
  const q = 0.5 * rho * v * v;

  // The elevator sets angle of attack around the trimmed angle.
  const trimA = clamp(n.trim, -6, 14) * D2R;
  const alphaCmd = clamp(trimA + c.elevator * 13 * D2R, -10 * D2R, 24 * D2R);
  // Less airflow, less elevator authority.
  const authority = clamp((v - 8) / 22, 0, 1);
  const target = n.onGround ? Math.min(alphaCmd, 12 * D2R) * (v > 22 ? 1 : 0) : alphaCmd * authority + n.alpha * (1 - authority);
  n.alpha = approach(n.alpha, target, n.onGround ? 6 * D2R : 25 * D2R, dt);

  const cl = liftCoefficient(n.alpha, n.flaps);
  const cd = PLANE.cd0 + n.flaps * PLANE.flapCd + PLANE.k * cl * cl + (n.alpha > PLANE.stallAlpha ? 0.25 : 0);
  const L = q * PLANE.wing * cl;
  const D = q * PLANE.wing * cd;
  const T = thrust(n.throttle, v, n.h);
  n.stalled = !n.onGround && n.alpha > PLANE.stallAlpha;

  // Roll from the ailerons (weak at low speed), a little from the rudder,
  // and a wing drop when stalled.
  const rollRate = (c.aileron * 50 * authority + c.rudder * 8 * authority) * D2R + (n.stalled ? 14 * D2R * (n.phi >= 0 ? 1 : -1) : 0);
  if (n.onGround) {
    n.phi = approach(n.phi, 0, 30 * D2R, dt);
  } else {
    n.phi = clamp(n.phi + rollRate * dt, -80 * D2R, 80 * D2R);
  }

  // Slip: adverse yaw from the ailerons pushes the ball toward the turn,
  // rudder pushes it back ("step on the ball").
  n.slip = clamp(0.35 * c.aileron * authority - 0.6 * c.rudder * authority, -1, 1);

  const prevPsi = n.psi;
  if (n.onGround) {
    const friction = (c.brakes ? 0.4 : 0.025) * Math.max(0, m * G - L);
    const accel = (T - D - friction) / m;
    n.v = Math.max(0, n.v + accel * dt);
    if (n.v === 0 && T < friction) n.v = 0;
    n.psi += c.rudder * 18 * D2R * clamp(n.v / 6, 0, 1) * dt * (n.v > 0.2 ? 1 : 0);
    n.gamma = 0;
    const lift = L + T * Math.sin(n.alpha);
    if (lift > m * G && n.alpha > 2 * D2R) {
      n.onGround = false;
      n.gamma = 0.5 * D2R;
      n.outcome = n.outcome === "landed" ? null : n.outcome;
    }
  } else {
    const lift = L + T * Math.sin(n.alpha);
    n.v = Math.max(1, n.v + ((T * Math.cos(n.alpha) - D) / m - G * Math.sin(n.gamma)) * dt);
    n.gamma = clamp(n.gamma + ((lift * Math.cos(n.phi)) / (m * v) - (G * Math.cos(n.gamma)) / v) * dt, -80 * D2R, 80 * D2R);
    n.psi += ((lift * Math.sin(n.phi)) / (m * v * Math.max(0.2, Math.cos(n.gamma))) + c.rudder * 5 * D2R) * dt;
  }
  n.psi = ((n.psi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let dpsi = n.psi - prevPsi;
  if (dpsi > Math.PI) dpsi -= 2 * Math.PI;
  if (dpsi < -Math.PI) dpsi += 2 * Math.PI;
  n.turnRate = (dpsi / dt) * R2D;

  n.x += n.v * Math.cos(n.gamma) * Math.sin(n.psi) * dt;
  n.y += n.v * Math.cos(n.gamma) * Math.cos(n.psi) * dt;
  n.h += n.v * Math.sin(n.gamma) * dt;

  // Touchdown.
  if (!n.onGround && n.h <= 0) {
    const fpm = (n.v * Math.sin(n.gamma)) / FT * 60;
    const bank = Math.abs(n.phi * R2D);
    const pitch = (n.gamma + n.alpha) * R2D;
    const where = onRunway(n.x, n.y) ? "runway" : "field";
    n.h = 0;
    n.touchdown = { fpm: Math.round(fpm), bank: Math.round(bank), pitch: Math.round(pitch), kt: Math.round(n.v / KT), where };
    if (fpm < -900 || bank > 15 || pitch < -6) {
      n.outcome = "crash";
      n.v = 0;
    } else {
      n.onGround = true;
      n.gamma = 0;
      n.phi = 0;
      n.outcome = "landed";
    }
  }

  const kt = n.v / KT;
  n.warn = n.stalled ? "stall" : !n.onGround && n.alpha > PLANE.stallAlpha - 4 * D2R && kt < 75 ? "stall-horn" : kt > PLANE.vne ? "overspeed" : null;
  return n;
}

/** What the instruments show. */
export function readout(s) {
  return {
    kt: s.v / KT,
    alt: s.h / FT,
    fpm: ((s.v * Math.sin(s.gamma)) / FT) * 60,
    pitch: (s.gamma + s.alpha) * R2D,
    bank: s.phi * R2D,
    heading: s.psi * R2D,
    turnRate: s.turnRate,
    slip: s.slip,
    aoa: s.alpha * R2D,
  };
}

/** A coach's one-line hint for what's happening right now. */
export function coachHint(s, scenarioId) {
  const r = readout(s);
  if (s.outcome === "crash") {
    const t = s.touchdown;
    if (!t) return "That didn't end well. Try again.";
    if (t.fpm < -900) return `Hit the ground at ${-t.fpm} feet a minute. Flare: raise the nose gently just above the runway to slow the descent.`;
    if (t.bank > 15) return `Touched down banked ${t.bank}°, which catches a wingtip. Keep the wings level as you land.`;
    return "Landed nose first. Hold the nose up a little in the flare so the main wheels touch first.";
  }
  if (s.outcome === "landed" && s.onGround) {
    const t = s.touchdown;
    const feel = t.fpm > -250 ? "Smooth landing!" : t.fpm > -500 ? "Firm but fine." : "That was a hard landing.";
    const spot = t.where === "runway" ? "" : " You landed off the runway, though.";
    return `${feel} ${-t.fpm} feet a minute at ${t.kt} knots.${spot} Throttle to idle and hold B to brake.`;
  }
  if (s.warn === "stall") return "STALL: push forward to lower the nose, add full power, level the wings with the ailerons.";
  if (s.warn === "stall-horn") return "Stall warning: the wing is near its critical angle of attack. Lower the nose a little or add power.";
  if (s.warn === "overspeed") return "Too fast: past the red line. Reduce power and raise the nose.";
  if (s.onGround) {
    if (r.kt < 1 && s.throttle < 0.5) return "Add full power (+ key or the throttle), keep straight with the rudder (Q / E).";
    if (r.kt < PLANE.vr) return `Accelerating: ${Math.round(r.kt)} knots. Pull back gently at ${PLANE.vr}.`;
    return "Rotate now: pull back gently until the nose comes up about 8°.";
  }
  if (scenarioId === "takeoff" && r.alt < 1000) return "Climb at about 75 knots: raise or lower the nose to hold that speed. Use trim ( ] ) to take the pressure off.";
  if (scenarioId === "final") {
    const rf = runwayFrame(s.x, s.y);
    const gs = Math.atan2(s.h, Math.max(1, 300 - rf.along)) * R2D;
    if (r.alt < 30) return "Over the runway: power to idle and slowly raise the nose to flare.";
    if (gs > 3.5) return "Too high: reduce power a little. Watch the lights: four white means high.";
    if (gs < 2.5) return "Too low: add power. Four red lights means low.";
    if (Math.abs(rf.across) > 30) return `Off the centerline: turn ${rf.across > 0 ? "left" : "right"} a little.`;
    return "On the glide path: two white, two red. Hold 65 knots with pitch and the glide path with power.";
  }
  if (Math.abs(r.bank) > 45) return "Steep bank: the wing has to make more lift, so pull back to hold altitude, and watch the speed.";
  if (Math.abs(r.fpm) > 300 && Math.abs(r.bank) < 10) return r.fpm > 0 ? "Climbing. Lower the nose or reduce power to level off." : "Descending. Raise the nose or add power to level off.";
  return "Flying. Try a 30° bank turn to a new heading, then roll out on it.";
}
