// Maths for the longer GD&T lessons: datum shift, hole patterns and datum
// order. Pure functions in millimetres, no React, so tests can run them in Node.

const hyp = Math.hypot;

// Datum feature of size (a bore used as datum B) -------------------------------

/** The datum bore used in the datum-shift lesson: ⌀20 +0.1/0, so its MMB is ⌀20.0. */
export const DATUM_BORE = { nominal: 20, lo: 20.0, hi: 20.1, mmb: 20.0, label: "⌀20 +0.1/0" };
/** The pattern holes in that lesson: ⌀8 +0.1/0 on a square 40 × 40 basic. */
export const PATTERN_HOLE = { nominal: 8, lo: 8.0, hi: 8.1, mmc: 8.0, lmc: 8.1, label: "4× ⌀8 +0.1/0" };
export const SQUARE_PATTERN = [
  [-20, 20],
  [20, 20],
  [20, -20],
  [-20, -20],
];

/**
 * Datum shift available from a datum feature of size, as a diameter.
 * RMB: the gauge grows to fill the bore, so no shift. MMB: the gauge is fixed at
 * the MMB, so the part can rattle by the difference. LMB is the mirror case
 * and is not used for a gauge pin, so it reads as no shift here.
 */
export function datumShift(datumMod, boreSize, bore = DATUM_BORE) {
  if (datumMod !== "MMB") return 0;
  return Math.max(0, boreSize - bore.mmb);
}

/**
 * Smallest worst-hole offset after sliding the whole part by up to `shiftR` in
 * any direction (the part rattling on a fixed gauge pin). `offsets` are each
 * hole's [dx, dy] from true position, in mm. Returns the best slide and each
 * hole's leftover offset.
 */
export function bestSlide(offsets, shiftR) {
  const worst = (sx, sy) => Math.max(...offsets.map(([x, y]) => hyp(x - sx, y - sy)));
  let best = { sx: 0, sy: 0, w: worst(0, 0) };
  if (shiftR > 1e-9) {
    const n = 48;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const sx = -shiftR + (2 * shiftR * i) / n;
        const sy = -shiftR + (2 * shiftR * j) / n;
        if (hyp(sx, sy) > shiftR + 1e-12) continue;
        const w = worst(sx, sy);
        if (w < best.w - 1e-12) best = { sx, sy, w };
      }
    }
    // Refine around the best grid point.
    let step = shiftR / n;
    for (let k = 0; k < 40; k++) {
      let moved = false;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const sx = best.sx + ax * step, sy = best.sy + ay * step;
        if (hyp(sx, sy) > shiftR + 1e-12) continue;
        const w = worst(sx, sy);
        if (w < best.w - 1e-12) {
          best = { sx, sy, w };
          moved = true;
        }
      }
      if (!moved) step /= 2;
    }
  }
  return { ...best, left: offsets.map(([x, y]) => hyp(x - best.sx, y - best.sy)) };
}

/**
 * The datum-shift lesson's check. s: { tol, mod (RFS|MMC), dmod (RMB|MMB),
 * bore, hole, dx, dy, solo } where dx, dy move the whole pattern off the bore's
 * centre and `solo` moves hole 1 on its own (to the right).
 */
export function evaluateShift(s) {
  const offsets = SQUARE_PATTERN.map((_, i) => [s.dx + (i === 0 ? s.solo : 0), s.dy]);
  const shift = datumShift(s.dmod, s.bore);
  const fit = bestSlide(offsets, shift / 2);
  const bonus = s.mod === "MMC" ? Math.max(0, s.hole - PATTERN_HOLE.mmc) : 0;
  const allowed = s.tol + bonus;
  const errors = fit.left.map((d) => 2 * d);
  const raw = offsets.map(([x, y]) => 2 * hyp(x, y));
  const boreOk = s.bore >= DATUM_BORE.lo - 1e-9 && s.bore <= DATUM_BORE.hi + 1e-9;
  const holeOk = s.hole >= PATTERN_HOLE.lo - 1e-9 && s.hole <= PATTERN_HOLE.hi + 1e-9;
  const zoneOk = errors.every((e) => e <= allowed + 1e-9);
  return { offsets, shift, fit, bonus, allowed, errors, raw, boreOk, holeOk, ok: zoneOk && boreOk && holeOk, zoneOk };
}

// Hole patterns -----------------------------------------------------------------

/** The cover-plate pattern: four clearance holes for M8 studs, located from B (left) and C (bottom). */
export const COVER_HOLE = { nominal: 8.4, lo: 8.4, hi: 8.6, mmc: 8.4, lmc: 8.6, label: "4× ⌀8.4 +0.2/0" };
export const STUD = 8.0;
export const COVER_PATTERN = [
  [20, 15],
  [80, 15],
  [80, 55],
  [20, 55],
];
const centroid = (list) => [list.reduce((a, p) => a + p[0], 0) / list.length, list.reduce((a, p) => a + p[1], 0) / list.length];
const rot = ([x, y], t) => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];

/** Where the holes actually are, given a pattern shift, a pattern rotation (degrees) about its centre and one stray hole. */
export function actualPattern({ px, py, rotDeg, stray }, basic = COVER_PATTERN) {
  const c = centroid(basic);
  const t = (rotDeg * Math.PI) / 180;
  return basic.map((b, i) => {
    const [rx, ry] = rot([b[0] - c[0], b[1] - c[1]], t);
    return [c[0] + rx + px + (i === 2 ? stray * 0.8 : 0), c[1] + ry + py + (i === 2 ? stray * 0.6 : 0)];
  });
}

/**
 * Best fit of a perfect pattern to the actual holes when the pattern may move
 * and turn freely (only datum A referenced). Minimises the worst hole's offset.
 * Returns the fitted basic positions and each hole's offset from them.
 */
export function floatingFit(actual, basic = COVER_PATTERN) {
  const c = centroid(basic);
  const place = (tx, ty, t) => basic.map((b) => {
    const [rx, ry] = rot([b[0] - c[0], b[1] - c[1]], t);
    return [c[0] + rx + tx, c[1] + ry + ty];
  });
  const worst = (tx, ty, t) => Math.max(...place(tx, ty, t).map((p, i) => hyp(actual[i][0] - p[0], actual[i][1] - p[1])));
  // Least-squares start: centroid shift, then the average rotation.
  const ca = centroid(actual);
  let num = 0, den = 0;
  basic.forEach((b, i) => {
    const bx = b[0] - c[0], by = b[1] - c[1];
    const ax = actual[i][0] - ca[0], ay = actual[i][1] - ca[1];
    num += bx * ay - by * ax;
    den += bx * ax + by * ay;
  });
  let best = { tx: ca[0] - c[0], ty: ca[1] - c[1], t: Math.atan2(num, den) };
  best.w = worst(best.tx, best.ty, best.t);
  let step = 0.05, tstep = 0.0005;
  for (let k = 0; k < 400 && step > 1e-6; k++) {
    let moved = false;
    for (const [a, b, d] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [1, 1, 0], [-1, -1, 0], [1, -1, 0], [-1, 1, 0]]) {
      const tx = best.tx + a * step, ty = best.ty + b * step, t = best.t + d * tstep;
      const w = worst(tx, ty, t);
      if (w < best.w - 1e-12) {
        best = { tx, ty, t, w };
        moved = true;
      }
    }
    if (!moved) {
      step /= 2;
      tstep /= 2;
    }
  }
  const fitted = place(best.tx, best.ty, best.t);
  return { ...best, fitted, left: fitted.map((p, i) => hyp(actual[i][0] - p[0], actual[i][1] - p[1])) };
}

/**
 * The hole-pattern lesson's check. s: { px, py, rotDeg, stray, hole, single, upper, lower }.
 * Returns the single-segment result, both composite segments, and whether the
 * mating cover (perfect ⌀8 studs, free to float) actually goes on.
 */
export function evaluatePattern(s) {
  const actual = actualPattern(s);
  const bonus = Math.max(0, s.hole - COVER_HOLE.mmc);
  const fromDatums = actual.map((p, i) => 2 * hyp(p[0] - COVER_PATTERN[i][0], p[1] - COVER_PATTERN[i][1]));
  const fit = floatingFit(actual);
  const toEachOther = fit.left.map((d) => 2 * d);
  const sizeOk = s.hole >= COVER_HOLE.lo - 1e-9 && s.hole <= COVER_HOLE.hi + 1e-9;
  const single = { allowed: s.single + bonus, errors: fromDatums };
  single.ok = sizeOk && fromDatums.every((e) => e <= single.allowed + 1e-9);
  const upper = { allowed: s.upper + bonus, errors: fromDatums };
  upper.ok = fromDatums.every((e) => e <= upper.allowed + 1e-9);
  const lower = { allowed: s.lower + bonus, errors: toEachOther };
  lower.ok = toEachOther.every((e) => e <= lower.allowed + 1e-9);
  const composite = { ok: sizeOk && upper.ok && lower.ok };
  const clearance = (s.hole - STUD) / 2;
  const assembles = Math.max(...fit.left) <= clearance + 1e-9;
  return { actual, bonus, fit, single, upper, lower, composite, sizeOk, clearance, assembles };
}

// Datum order -------------------------------------------------------------------

/** The datum-order block, side view: 60 long, 40 tall, hole basic 30 from B and 20 from A. */
export const ORDER_PART = { L: 60, H: 40, hx: 30, hz: 20 };

function seating(order, lean, part) {
  const t = (lean * Math.PI) / 180;
  const { L, H } = part;
  // Part corners in its own frame: bottom along x, left face tilted by the lean.
  const local = [
    [0, 0],
    [L, 0],
    [L, H],
    [-H * Math.tan(t), H],
  ];
  const a = order === "BA" ? -t : 0; // B primary: turn the part so the left face stands flat on B
  const turned = local.map((p) => rot(p, a));
  // Datum simulators: A is the plane z = 0, B the plane x = 0, square to each other.
  // The primary gets full contact; the secondary touches the part's high point.
  const minX = order === "AB" ? Math.min(turned[0][0], turned[3][0]) : turned[0][0];
  const minZ = order === "AB" ? turned[0][1] : Math.min(turned[0][1], turned[1][1]);
  const toGauge = (p) => {
    const [x, z] = rot(p, a);
    return [x - minX, z - minZ];
  };
  const toLocal = ([x, z]) => rot([x + minX, z + minZ], -a);
  return { corners: turned.map(([x, z]) => [x - minX, z - minZ]), toGauge, toLocal };
}

/**
 * Where the hole is on the part (in the part's own frame) if the shop held the
 * part in `order` and drilled it at basic, plus an error ex, ez in that setup.
 */
export function holeMadeIn(order, lean, ex = 0, ez = 0, part = ORDER_PART) {
  return seating(order, lean, part).toLocal([part.hx + ex, part.hz + ez]);
}

/**
 * Sit the part in the gauge in a given order and measure the hole from it.
 * The bottom face (A) is flat; the left face (B) leans out by `lean` degrees
 * (top further left). order "AB": rest on A, then push against B.
 * order "BA": flat against B, then down onto A.
 */
export function seatPart(order, lean, holeLocal, part = ORDER_PART) {
  const st = seating(order, lean, part);
  const { corners } = st;
  const h = st.toGauge(holeLocal);
  const contact =
    order === "AB"
      ? { primary: [corners[0], corners[1]], secondary: corners[0][0] <= corners[3][0] + 1e-12 ? corners[0] : corners[3] }
      : { primary: [corners[0], corners[3]], secondary: corners[0][1] <= corners[1][1] + 1e-12 ? corners[0] : corners[1] };
  const dx = h[0] - part.hx, dz = h[1] - part.hz;
  return { corners, hole: h, dx, dz, error: 2 * hyp(dx, dz), contact };
}
