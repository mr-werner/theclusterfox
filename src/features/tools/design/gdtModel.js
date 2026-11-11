// GD&T callouts for Engineer ToolFox: what each one means, the settings in its
// feature control frame, the "part as made" sliders, and the pure check that
// says whether that part passes. Every length is in millimetres. The drawings
// live in GdtDiagrams.jsx; this file has no React so it can be tested in Node.

export const GROUPS = [
  { id: "form", name: "Form", blurb: "The shape of one feature on its own. Never uses datums." },
  { id: "orientation", name: "Orientation", blurb: "Tilt relative to a datum. Location is free." },
  { id: "location", name: "Location", blurb: "Where a feature sits relative to datums." },
  { id: "profile", name: "Profile", blurb: "Any shape, held to a true outline. Can do form, orientation and location at once." },
  { id: "runout", name: "Runout", blurb: "What a dial indicator sees while the part spins on its datum axis." },
];

/** The two features of size the examples use. A pin is an external feature, a hole internal. */
export const PIN = { nominal: 10, lo: 9.9, hi: 10.1, mmc: 10.1, lmc: 9.9, label: "⌀10 ±0.1" };
export const HOLE = { nominal: 10, lo: 10.0, hi: 10.1, mmc: 10.0, lmc: 10.1, label: "⌀10 +0.1/0" };

/** Extra tolerance a material condition modifier gives at an actual size. */
export function bonusFor(mod, feature, size) {
  if (mod === "MMC") return Math.max(0, Math.abs(size - feature.mmc));
  if (mod === "LMC") return Math.max(0, Math.abs(feature.lmc - size));
  return 0;
}
/** Virtual condition: the worst-case boundary a mating part (or gauge) sees. */
export function virtualCondition(mod, feature, tol) {
  const external = feature.mmc > feature.lmc;
  if (mod === "MMC") return external ? feature.mmc + tol : feature.mmc - tol;
  if (mod === "LMC") return external ? feature.lmc - tol : feature.lmc + tol;
  return null;
}
export const inSize = (feature, size) => size >= Math.min(feature.lo, feature.hi) - 1e-9 && size <= Math.max(feature.lo, feature.hi) + 1e-9;

const EPS = 1e-9;
const sizeCheck = (feature, size) => ({
  id: "size",
  label: `Size ${feature.label}`,
  ok: inSize(feature, size),
  measured: size,
  allowed: null,
  text: inSize(feature, size)
    ? `Actual size ⌀${size.toFixed(3)} is inside the size limits.`
    : `Actual size ⌀${size.toFixed(3)} is outside ${feature.lo.toFixed(2)}–${feature.hi.toFixed(2)}. The part fails on size before GD&T is even checked.`,
});
const zoneCheck = (label, measured, allowed, extra = "") => ({
  id: "zone",
  label,
  ok: measured <= allowed + EPS,
  measured,
  allowed,
  text: extra,
});
const range = (fn, n = 241) => {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = fn(i / (n - 1));
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
};

/** Surface waviness used by several drawings: P-V is exactly `pv`. u runs 0..1. */
export const wave = (u, pv, cycles = 2) => (pv / 2) * Math.sin(2 * Math.PI * cycles * u);
/** A smooth bump 0..1 centred at u = 0.5. */
export const bump = (u) => Math.exp(-(((u - 0.5) / 0.16) ** 2));
/** Sag of a bent part, 0 at the ends and 1 in the middle. */
export const sag = (u) => 4 * u * (1 - u);

// The callouts ---------------------------------------------------------------

const flatness = {
  id: "flatness",
  name: "Flatness",
  group: "form",
  summary: "How flat a surface is. Every point must fit between two parallel planes, and those planes can tilt to match the part.",
  frame: { dia: "never", mods: false, datums: "none", tol: [0.005, 0.3, 0.005] },
  defaults: { tol: 0.05, wave: 0.03, tilt: 0.06 },
  params: () => [
    { key: "wave", label: "Surface waviness (peak to valley)", min: 0, max: 0.25, step: 0.005, help: "Bumps and dips in the face." },
    { key: "tilt", label: "Tilt, end to end", min: -0.25, max: 0.25, step: 0.005, help: "One end higher than the other." },
  ],
  sizeTol: 0.1,
  evaluate(s) {
    const [lo, hi] = range((u) => s.tilt * (u - 0.5) + wave(u, s.wave, 2.25));
    const size = { id: "size", label: "Size 20 ±0.1 (Rule #1)", measured: Math.max(hi, -lo), allowed: 0.1, ok: hi <= 0.1 + EPS && lo >= -0.1 - EPS };
    size.text = size.ok ? "Every point of the top face is between the size limits." : "Some of the face is outside the 20 ±0.1 size limits, so the part fails on size even if it is flat.";
    const warnings = s.tol >= 0.2 ? ["The flatness tolerance is as big as the whole size tolerance (0.2 total), so it adds nothing. Rule #1 already keeps the face that flat."] : [];
    return {
      checks: [zoneCheck("Flatness zone", s.wave, s.tol, "Only waviness counts. The zone tilts with the part, so tilt is free."), size],
      main: { measured: s.wave, allowed: s.tol },
      warnings,
    };
  },
  read: (s, L) => `The surface must lie between two parallel planes ${L(s.tol)} apart. The planes may tilt and move to fit the part, so only its waviness is limited.`,
  text: {
    means: "The surface may not have bumps, dips, twist or bow bigger than the tolerance. It says nothing about which way the surface faces or how high it is.",
    zone: "Two parallel planes the tolerance apart. They float: they can tilt and move to wherever they best fit the actual surface.",
    part: "Lower values make the face closer to a perfect plane, which matters for sealing faces, mounting pads and anything that has to sit flat without rocking.",
    accept: "The part passes if the highest and lowest points, measured from the best-fit plane, are no further apart than the tolerance. A tilted face still passes, because tilt is controlled by size (or by parallelism if you need it).",
    datums: "Never. Flatness is a form control: it compares the surface only to itself.",
    modifiers: "None on a surface. (Applied to a feature of size with ⌀ it becomes 'flatness of the derived median plane', which is rare.)",
    inspect: "Surface plate with a height gauge or dial indicator after levelling the part on jacks, or a CMM taking many points. Optical flats for very flat lapped parts.",
    mistakes: ["Calling flatness larger than the size tolerance. Rule #1 already holds the face that flat.", "Expecting flatness to stop the face tilting. Use parallelism to a datum for that."],
  },
  make: { char: "flatness", feature: "flat" },
};

const straightness = {
  id: "straightness",
  name: "Straightness",
  group: "form",
  summary: "How straight a line is. On a surface it checks each line element; with ⌀ it checks the axis of a pin or shaft.",
  frame: { dia: "mode", mods: "mode", datums: "none", tol: [0.005, 0.3, 0.005] },
  modes: [
    { value: "line", label: "Surface line" },
    { value: "axis", label: "Axis (⌀)" },
  ],
  defaults: { tol: 0.05, mode: "line", mod: "RFS", bow: 0.03, wave: 0.01, size: 10.05 },
  params: (s) => [
    { key: "bow", label: "Bend in the middle", min: 0, max: 0.25, step: 0.005, help: "How far the middle of the pin sits off a straight line." },
    ...(s.mode === "line" ? [{ key: "wave", label: "Surface waviness", min: 0, max: 0.15, step: 0.005 }] : []),
    { key: "size", label: `Actual diameter (${PIN.label})`, min: 9.85, max: 10.15, step: 0.005, abs: true },
  ],
  feature: PIN,
  evaluate(s) {
    if (s.mode === "axis") {
      const bonus = bonusFor(s.mod, PIN, s.size);
      return {
        checks: [zoneCheck("Axis straightness zone", s.bow, s.tol + bonus, bonus > 0 ? `Includes ${bonus.toFixed(3)} bonus because the pin is away from ${s.mod}.` : ""), sizeCheck(PIN, s.size)],
        main: { measured: s.bow, allowed: s.tol + bonus, base: s.tol, bonus },
        warnings: [],
        vc: virtualCondition(s.mod, PIN, s.tol),
      };
    }
    const measured = s.bow + s.wave;
    const env = s.size + s.bow + s.wave;
    const envelope = { id: "envelope", label: "Rule #1 envelope (perfect form at MMC ⌀10.1)", measured: env, allowed: PIN.mmc, ok: env <= PIN.mmc + EPS };
    envelope.text = envelope.ok ? "The bent pin still fits through a perfect ⌀10.1 sleeve." : "Size plus bend is bigger than ⌀10.1, so the pin no longer fits a perfect ⌀10.1 sleeve. Rule #1 rejects it.";
    return { checks: [zoneCheck("Line element zone", measured, s.tol), sizeCheck(PIN, s.size), envelope], main: { measured, allowed: s.tol }, warnings: [] };
  },
  read: (s, L) =>
    s.mode === "axis"
      ? `The pin's axis must lie inside a cylinder ⌀${L(s.tol)}${s.mod === "MMC" ? " when the pin is at its largest size (MMC), growing as it gets smaller" : s.mod === "LMC" ? " when the pin is at its smallest size (LMC), growing as it gets bigger" : ", whatever size the pin is"}.`
      : `Each straight line along the surface must lie between two parallel lines ${L(s.tol)} apart.`,
  text: {
    means: "On a surface (no ⌀): every line drawn along the surface must be straight within the tolerance. On a feature of size with ⌀: the derived axis must fit in a cylinder, which allows a bent pin that is still undersize.",
    zone: "Surface line: two parallel lines in the plane of each line element. Axis: a cylinder of the stated diameter.",
    part: "A tighter value keeps shafts, rails and slides from bowing. Calling it on the axis lets a bent pin pass as long as it still fits its mating part.",
    accept: "Surface line: the bend plus waviness must be within the tolerance, and Rule #1 still applies (perfect form at MMC). Axis: the bend must be within ⌀tol, plus bonus if MMC or LMC is used. Rule #1 no longer applies to that feature.",
    datums: "Never. Straightness is form only.",
    modifiers: "Only when it's on the axis (with ⌀). MMC gives bonus tolerance as the pin shrinks, and sets a virtual condition of MMC + tol that a gauge sleeve can check.",
    inspect: "Surface line: a straight edge or indicator run along the part. Axis: CMM, or a functional sleeve gauge at the virtual condition when MMC is used.",
    mistakes: ["Forgetting that surface straightness still lives inside Rule #1.", "Putting the ⌀ symbol on a surface line callout. ⌀ means axis."],
  },
  make: { char: "flatness", feature: "od" },
};

const circularity = {
  id: "circularity",
  name: "Circularity",
  group: "form",
  summary: "How round each cross-section is. Every point on a slice must sit between two concentric circles.",
  frame: { dia: "never", mods: false, datums: "none", tol: [0.002, 0.2, 0.002] },
  defaults: { tol: 0.03, lobes: 3, amp: 0.01 },
  params: () => [
    { key: "amp", label: "Out-of-round (each lobe)", min: 0, max: 0.1, step: 0.001, help: "How far the lobes poke in and out." },
    { key: "lobes", label: "Number of lobes", choices: [2, 3, 5], help: "2 = oval, 3 = typical of centerless grinding or a 3-jaw chuck." },
  ],
  evaluate(s) {
    const measured = 2 * s.amp;
    return { checks: [zoneCheck("Circularity zone (radial)", measured, s.tol, "The two circles share a centre that floats to fit the section.")], main: { measured, allowed: s.tol }, warnings: [] };
  },
  read: (s, L) => `Each cross-section must lie between two concentric circles ${L(s.tol)} apart (radially). The centre floats to fit each section.`,
  text: {
    means: "Each slice of a round feature must be round. It doesn't check the slices line up, taper, or bend; that's cylindricity.",
    zone: "Two concentric circles, the tolerance apart in radius, on each cross-section on its own.",
    part: "Lower values for bearing seats, seals and anything that spins or slides in a bore.",
    accept: "Measure the radial spread of each slice. Highest minus lowest radius must be within the tolerance.",
    datums: "Never.",
    modifiers: "None. Circularity is a surface control.",
    inspect: "Roundness machine (spindle-based), or a CMM. A V-block and indicator can mislead on odd lobing, such as 3 lobes.",
    mistakes: ["Checking with a micrometer: a 3-lobe part measures the same diameter in every direction and looks round.", "Expecting circularity to catch taper."],
  },
  make: { char: "roundness", feature: "od" },
};

const cylindricity = {
  id: "cylindricity",
  name: "Cylindricity",
  group: "form",
  summary: "Roundness, straightness and taper all at once, over the whole length of a cylinder.",
  frame: { dia: "never", mods: false, datums: "none", tol: [0.002, 0.2, 0.002] },
  defaults: { tol: 0.04, amp: 0.005, taper: 0.02, bow: 0.01 },
  params: () => [
    { key: "amp", label: "Out-of-round (each lobe)", min: 0, max: 0.05, step: 0.001 },
    { key: "taper", label: "Taper (diameter difference, end to end)", min: 0, max: 0.1, step: 0.002 },
    { key: "bow", label: "Bend in the middle", min: 0, max: 0.08, step: 0.002 },
  ],
  evaluate(s) {
    const measured = 2 * s.amp + s.taper / 2 + s.bow;
    return {
      checks: [zoneCheck("Cylindricity zone (radial)", measured, s.tol, "Approximate: lobing (2× each lobe) + half the taper + the bend, all measured radially from one best-fit axis.")],
      main: { measured, allowed: s.tol },
      warnings: [],
    };
  },
  read: (s, L) => `The whole surface must lie between two coaxial cylinders ${L(s.tol)} apart (radially). The cylinders float to fit the part.`,
  text: {
    means: "The entire cylindrical surface must be close to a perfect cylinder: round in every slice, straight along its length, and not tapered.",
    zone: "Two coaxial cylinders, the tolerance apart in radius, floating to best fit the surface.",
    part: "Used on precision bores and shafts such as hydraulic cylinders, spool valves and press fits, where the whole length must mate.",
    accept: "The radial spread across the whole surface, from one best-fit axis, must be within the tolerance. Taper and bend count, unlike circularity.",
    datums: "Never.",
    modifiers: "None.",
    inspect: "Roundness machine with a vertical column taking several levels, or a CMM scan.",
    mistakes: ["Calling it where circularity would do. Cylindricity is expensive to make and to check.", "Expecting it to locate the cylinder. Use position or runout for that."],
  },
  make: { char: "roundness", feature: "bores" },
};

const PROFILE_PARAMS = () => [
  { key: "shift", label: "Whole surface too high or low", min: -0.2, max: 0.2, step: 0.005 },
  { key: "tilt", label: "Tilt, end to end", min: -0.2, max: 0.2, step: 0.005 },
  { key: "bump", label: "Local bump (+) or dip (−)", min: -0.2, max: 0.2, step: 0.005 },
];
function evaluateProfile(s) {
  const lockShift = s.datums.includes("A");
  const lockTilt = lockShift || s.datums.includes("B");
  const dev = (u) => (lockShift ? s.shift : 0) + (lockTilt ? s.tilt * (u - 0.5) : 0) + s.bump * bump(u);
  const [lo, hi] = range(dev);
  const measured = lockShift ? 2 * Math.max(Math.abs(lo), Math.abs(hi)) : hi - lo;
  const what = lockShift ? "The zone is locked to the datums, so height, tilt and shape all count." : lockTilt ? "The zone is locked in tilt by datum B but can slide up and down, so only tilt and shape count." : "No datums: the zone floats to fit the part, so only the shape counts.";
  return { checks: [zoneCheck("Profile zone (±half each side)", measured, s.tol, what)], main: { measured, allowed: s.tol }, warnings: [], lockShift, lockTilt };
}
const profileRead = (surface) => (s, L) => {
  const tie = s.datums.length ? ` located and oriented from datum${s.datums.length > 1 ? "s" : ""} ${s.datums.join(", ")}` : ", free to float to fit the part (form only)";
  return `${surface ? "The whole surface" : "Each cross-section line"} must lie inside a band ${L(s.tol)} wide, ${L(s.tol / 2)} each side of the true profile,${tie}.`;
};

const profileLine = {
  id: "profile-line",
  name: "Profile of a line",
  group: "profile",
  summary: "Holds each cross-section of a curved surface inside a band around its true shape. With no datums it's pure form.",
  frame: { dia: "never", mods: false, datums: "optional", tol: [0.01, 0.4, 0.005] },
  defaults: { tol: 0.1, datums: [], shift: 0.06, tilt: 0.02, bump: 0.03 },
  params: PROFILE_PARAMS,
  evaluate: evaluateProfile,
  read: profileRead(false),
  text: {
    means: "Each 2D slice through the surface must follow the true profile, defined by basic dimensions, within the tolerance.",
    zone: "A band around the true profile, half the tolerance each side (bilateral) unless a U modifier or a drawn unequal zone says otherwise.",
    part: "Used on airfoils, cam lobes and extrusions where the shape of each section matters, often with another control holding the length direction.",
    accept: "Without datums the zone may move and rotate to fit, so only shape counts. Add datums and the zone is fixed to them: now height and tilt count too.",
    datums: "Optional. Try adding and removing them on this page; it's the main thing that changes what profile controls.",
    modifiers: "None on the tolerance. U (unequal) can shift the zone to one side.",
    inspect: "Optical comparator overlay, contour tracer, or CMM sections compared to CAD.",
    mistakes: ["Forgetting the true profile needs basic dimensions.", "Using profile of a line where profile of a surface was meant (line checks slices one at a time)."],
  },
  make: { char: "profile", feature: "profile" },
};

const profileSurface = {
  ...profileLine,
  id: "profile-surface",
  name: "Profile of a surface",
  summary: "The most versatile callout. Holds a whole surface inside a 3D band around its true CAD shape, located by datums if given.",
  defaults: { tol: 0.1, datums: ["A", "B"], shift: 0.02, tilt: 0.01, bump: 0.015 },
  read: profileRead(true),
  text: {
    ...profileLine.text,
    means: "The whole surface must lie within a band around its true shape, as defined by basic dimensions or the CAD model. With datums it controls size, location, orientation and form together.",
    zone: "A 3D shell around the true surface, half the tolerance each side by default.",
    part: "Common on castings, moldings, sheet metal and any freeform surface. Many companies use it on almost every non-hole surface.",
  },
  make: { char: "profile", feature: "freeform" },
};

const perpendicularity = {
  id: "perpendicularity",
  name: "Perpendicularity",
  group: "orientation",
  summary: "Holds a surface or axis at exactly 90° to a datum. The zone can slide, but it can't tilt.",
  frame: { dia: "mode", mods: "mode", datums: "required", tol: [0.005, 0.3, 0.005] },
  modes: [
    { value: "surface", label: "Surface" },
    { value: "axis", label: "Hole axis (⌀)" },
  ],
  defaults: { tol: 0.05, mode: "surface", mod: "RFS", datums: ["A"], lean: 0.03, wave: 0.01, size: 10.03 },
  params: (s) => [
    { key: "lean", label: s.mode === "axis" ? "Hole lean over its depth" : "Lean over the height of the face", min: -0.25, max: 0.25, step: 0.005 },
    ...(s.mode === "surface" ? [{ key: "wave", label: "Surface waviness", min: 0, max: 0.15, step: 0.005 }] : [{ key: "size", label: `Actual hole size (${HOLE.label})`, min: 9.95, max: 10.15, step: 0.005, abs: true }]),
  ],
  feature: HOLE,
  evaluate(s) {
    if (!s.datums.length) return noDatum();
    if (s.mode === "axis") {
      const bonus = bonusFor(s.mod, HOLE, s.size);
      const m = Math.abs(s.lean);
      return { checks: [zoneCheck("Perpendicularity zone (⌀ cylinder)", m, s.tol + bonus), sizeCheck(HOLE, s.size)], main: { measured: m, allowed: s.tol + bonus, base: s.tol, bonus }, warnings: [], vc: virtualCondition(s.mod, HOLE, s.tol) };
    }
    const m = Math.abs(s.lean) + s.wave;
    return { checks: [zoneCheck("Perpendicularity zone", m, s.tol, "Lean plus waviness, measured square to datum A.")], main: { measured: m, allowed: s.tol }, warnings: [] };
  },
  read: (s, L) =>
    s.mode === "axis"
      ? `The hole's axis must lie inside a cylinder ⌀${L(s.tol)}${modWords(s.mod, "hole")} that stands exactly 90° to datum ${s.datums[0] || "?"}.`
      : `The face must lie between two parallel planes ${L(s.tol)} apart that are exactly 90° to datum ${s.datums[0] || "?"}.`,
  text: {
    means: "The feature has to be square to the datum. Its location can be anywhere the size or position allow.",
    zone: "Surface: two parallel planes at exactly 90° to the datum. Axis with ⌀: a cylinder standing at 90° to the datum.",
    part: "Tighter values for faces that locate other parts, bores for shafts, and pins pressed into plates.",
    accept: "Measure how far the feature leans across its length (plus waviness for a surface). A long face leans more for the same angle, so the same tolerance is a tighter angle on a taller face.",
    datums: "At least one, which sets the 90°. Usually the primary face the part sits on.",
    modifiers: "On a hole or pin axis, MMC/LMC give bonus as the size departs. On a surface, none.",
    inspect: "Square and indicator on a surface plate, or a CMM. For holes, a gauge pin with an indicator, or a functional gauge at virtual condition.",
    mistakes: ["Thinking it's an angle tolerance. It's a width in mm, so the allowed angle depends on the length of the feature.", "Leaving out the datum."],
  },
  make: { char: "orientation", feature: "flat" },
};

const parallelism = {
  id: "parallelism",
  name: "Parallelism",
  group: "orientation",
  summary: "Keeps a surface parallel to a datum. The zone can move up and down, but it can't tilt.",
  frame: { dia: "never", mods: false, datums: "required", tol: [0.005, 0.3, 0.005] },
  defaults: { tol: 0.05, datums: ["A"], tilt: 0.03, wave: 0.01 },
  params: () => [
    { key: "tilt", label: "Tilt, end to end", min: -0.25, max: 0.25, step: 0.005 },
    { key: "wave", label: "Surface waviness", min: 0, max: 0.15, step: 0.005 },
  ],
  evaluate(s) {
    if (!s.datums.length) return noDatum();
    const m = Math.abs(s.tilt) + s.wave;
    return { checks: [zoneCheck("Parallelism zone", m, s.tol, "Tilt plus waviness, measured from datum A. Compare with flatness, where tilt is free.")], main: { measured: m, allowed: s.tol }, warnings: [] };
  },
  read: (s, L) => `The face must lie between two planes ${L(s.tol)} apart that are exactly parallel to datum ${s.datums[0] || "?"}. They may move up or down but not tilt.`,
  text: {
    means: "The surface must be parallel to the datum. It also limits flatness, because the whole surface has to fit in the zone.",
    zone: "Two parallel planes, the tolerance apart, parallel to the datum. Their height floats within the size tolerance.",
    part: "Top and bottom faces of spacers, rails, guide surfaces and anything stacked.",
    accept: "Sit the part on datum A and sweep an indicator over the face. The full indicator movement must be within the tolerance.",
    datums: "At least one. The part is set on it.",
    modifiers: "None on a surface. For an axis parallel to a datum, ⌀ and MMC can apply.",
    inspect: "Surface plate and dial indicator, or CMM.",
    mistakes: ["Making it bigger than the size tolerance. Size already limits parallelism through Rule #1.", "Confusing it with flatness, which ignores tilt."],
  },
  make: { char: "orientation", feature: "flat" },
};

const angularity = {
  id: "angularity",
  name: "Angularity",
  group: "orientation",
  summary: "Holds a face at an exact basic angle to a datum. The tolerance is a width in mm, not degrees.",
  frame: { dia: "never", mods: false, datums: "required", tol: [0.01, 0.4, 0.005] },
  defaults: { tol: 0.1, datums: ["A"], angle: 30, err: 0.1, wave: 0.01 },
  params: () => [
    { key: "angle", label: "Basic angle (on the drawing)", min: 15, max: 75, step: 1, unit: "deg", abs: true },
    { key: "err", label: "Actual angle error", min: -0.5, max: 0.5, step: 0.01, unit: "deg" },
    { key: "wave", label: "Surface waviness", min: 0, max: 0.15, step: 0.005 },
  ],
  faceLength: 30,
  evaluate(s) {
    if (!s.datums.length) return noDatum();
    const tilt = this.faceLength * Math.abs(Math.sin((s.err * Math.PI) / 180));
    const m = tilt + s.wave;
    const eq = (Math.atan(s.tol / this.faceLength) * 180) / Math.PI;
    return {
      checks: [zoneCheck("Angularity zone", m, s.tol, `On this ${this.faceLength} mm face, ${s.tol.toFixed(3)} mm is about ±${(eq / 2).toFixed(2)}° (${eq.toFixed(2)}° total) if the face were perfectly flat.`)],
      main: { measured: m, allowed: s.tol },
      warnings: [],
    };
  },
  read: (s, L) => `The face must lie between two parallel planes ${L(s.tol)} apart, set at exactly ${s.angle}° to datum ${s.datums[0] || "?"}.`,
  text: {
    means: "The face is held at the exact angle shown in a basic (boxed) dimension. Perpendicularity and parallelism are the 90° and 0° cases.",
    zone: "Two parallel planes the tolerance apart, at the basic angle to the datum.",
    part: "Chamfers that locate, dovetails, inclined mounting faces and angled holes.",
    accept: "Measure how far the real face departs from the exact angle across its length. The same mm tolerance is a tighter angle on a longer face.",
    datums: "At least one.",
    modifiers: "None on a surface. On an axis, ⌀ and MMC can apply.",
    inspect: "Sine bar or sine plate to set the exact angle, then indicate across the face. Or a CMM.",
    mistakes: ["Writing the tolerance in degrees. GD&T uses a width; a ± angle tolerance is a different (wedge-shaped) zone.", "Forgetting to box the angle as basic."],
  },
  make: { char: "orientation", feature: "flat" },
};

const position = {
  id: "position",
  name: "Position",
  group: "location",
  summary: "The most used callout. Locates a hole or pin from datums, inside a round zone around its true position.",
  frame: { dia: "optional", mods: true, datums: "required", tol: [0.01, 0.6, 0.01] },
  defaults: { tol: 0.2, dia: true, mod: "MMC", datums: ["A", "B", "C"], dx: 0.05, dy: 0.06, size: 10.04 },
  params: () => [
    { key: "dx", label: "Hole off to the right (from B)", min: -0.3, max: 0.3, step: 0.005 },
    { key: "dy", label: "Hole off upward (from C)", min: -0.3, max: 0.3, step: 0.005 },
    { key: "size", label: `Actual hole size (${HOLE.label})`, min: 9.95, max: 10.15, step: 0.005, abs: true },
  ],
  feature: HOLE,
  basic: { x: 30, y: 20 },
  evaluate(s) {
    if (!s.datums.length) return noDatum();
    const usesX = s.datums.includes("B");
    const usesY = s.datums.includes("C");
    const dx = usesX ? s.dx : 0;
    const dy = usesY ? s.dy : 0;
    const measured = s.dia ? 2 * Math.hypot(dx, dy) : 2 * Math.max(Math.abs(dx), Math.abs(dy));
    const bonus = bonusFor(s.mod, HOLE, s.size);
    const warnings = [];
    if (!usesX) warnings.push("Without datum B, nothing holds the hole's left-right location, so that error isn't checked.");
    if (!usesY) warnings.push("Without datum C, nothing holds the hole's up-down location, so that error isn't checked.");
    if (!s.datums.includes("A")) warnings.push("Without datum A, the hole isn't held square to the face.");
    if (!s.dia) warnings.push("No ⌀: the zone is a square, ±half the tolerance in X and in Y. A round zone (⌀) accepts 57% more area for the same fit.");
    return {
      checks: [
        zoneCheck(`Position zone${s.dia ? " (⌀)" : " (square)"}`, measured, s.tol + bonus, s.dia ? "Position error = 2 × the distance from true position." : "Square zone: 2 × the larger of the X or Y error."),
        sizeCheck(HOLE, s.size),
      ],
      main: { measured, allowed: s.tol + bonus, base: s.tol, bonus },
      warnings,
      vc: virtualCondition(s.mod, HOLE, s.tol),
    };
  },
  read: (s, L) =>
    `The hole's axis must lie inside a ${s.dia ? `cylinder ⌀${L(s.tol)}` : `square ${L(s.tol)} wide`}${modWords(s.mod, "hole")}, centred on its true position${s.datums.length ? `, measured from datum${s.datums.length > 1 ? "s" : ""} ${s.datums.join(", ")}` : ""}.`,
  text: {
    means: "The axis of the hole must fall inside a zone centred on its exact (basic) location. The basic dimensions say where; the frame says how close.",
    zone: "With ⌀: a cylinder around the true position, square to the primary datum. Without ⌀: a box, ±half the tolerance each way.",
    part: "Bolt patterns, dowel holes and anything that has to line up with a mating part. MMC lets the shop use the hole's extra size as extra location tolerance.",
    accept: "Measure how far the actual centre is from true position: position error is twice that distance. Compare with the tolerance plus any bonus. The hole's size must also be in limits.",
    datums: "Required (apart from pattern-only cases). The order matters: the part sits on the primary, pushes against the secondary, then the tertiary.",
    modifiers: "MMC is the classic choice for clearance holes: if the hole is bigger, a bolt still fits even if it's further off, so you get bonus tolerance. LMC protects minimum wall. RFS (no symbol) gives no bonus.",
    inspect: "CMM, or a functional gauge: a plate with pins at the virtual condition size (MMC − tol for a hole) in the exact pattern. If it drops on, the part passes.",
    mistakes: ["Dimensioning the hole location with ± instead of basic dimensions.", "Forgetting ⌀, which gives a square zone.", "Using RFS where MMC would give the shop free tolerance at no risk to fit."],
  },
  make: { char: "position", feature: "holes" },
};

const concentricity = {
  id: "concentricity",
  name: "Concentricity",
  group: "location",
  legacy: true,
  summary: "Older callout for keeping one diameter centred on another's axis. Removed from ASME Y14.5-2018; still seen on older drawings and in ISO.",
  frame: { dia: "always", mods: false, datums: "required", tol: [0.005, 0.3, 0.005] },
  defaults: { tol: 0.05, dia: true, datums: ["A"], e: 0.015 },
  params: () => [{ key: "e", label: "Small diameter off-centre", min: 0, max: 0.2, step: 0.002 }],
  evaluate(s) {
    if (!s.datums.length) return noDatum();
    const m = 2 * s.e;
    return {
      checks: [zoneCheck("Concentricity zone (⌀)", m, s.tol, "Error = 2 × the offset of the median points from datum axis A.")],
      main: { measured: m, allowed: s.tol },
      warnings: ["ASME Y14.5-2018 removed this symbol. Runout or position usually does the job and is far easier to check."],
    };
  },
  read: (s, L) => `The median points of every section of this diameter must lie inside a cylinder ⌀${L(s.tol)} around datum axis ${s.datums[0] || "?"}.`,
  text: {
    means: "The centre (median) points of the feature must fall inside a cylinder around the datum axis. Out-of-roundness that is symmetrical doesn't count; only offset does.",
    zone: "A cylinder of the stated diameter, coaxial with the datum axis.",
    part: "Meant for rotating balance. In practice, circular runout or position is used instead.",
    accept: "Find the median points of many opposite pairs of surface points, then check they all lie in the zone. That takes a CMM and a lot of points.",
    datums: "Required: the datum axis.",
    modifiers: "None.",
    inspect: "CMM with many points. Hard to check, which is why it was dropped.",
    mistakes: ["Using it when runout was meant. Runout is easy to measure with an indicator."],
  },
  make: { char: "runout", feature: "od" },
};

const symmetry = {
  id: "symmetry",
  name: "Symmetry",
  group: "location",
  legacy: true,
  summary: "Older callout for keeping a slot or tab centred on a datum centre plane. Removed from ASME Y14.5-2018; still in ISO.",
  frame: { dia: "never", mods: false, datums: "required", tol: [0.01, 0.4, 0.005] },
  defaults: { tol: 0.1, datums: ["A"], e: 0.03 },
  params: () => [{ key: "e", label: "Slot off-centre", min: -0.2, max: 0.2, step: 0.002 }],
  evaluate(s) {
    if (!s.datums.length) return noDatum();
    const m = 2 * Math.abs(s.e);
    return {
      checks: [zoneCheck("Symmetry zone", m, s.tol, "Error = 2 × the offset of the slot's centre plane from datum A.")],
      main: { measured: m, allowed: s.tol },
      warnings: ["ASME Y14.5-2018 removed this symbol. Position on the slot width (with MMC if fit matters) is the modern replacement."],
    };
  },
  read: (s, L) => `The median points of the slot must lie between two planes ${L(s.tol)} apart, centred on datum centre plane ${s.datums[0] || "?"}.`,
  text: {
    means: "The slot's median plane (midway between its walls) must be centred on the datum centre plane.",
    zone: "Two parallel planes the tolerance apart, centred on the datum plane.",
    part: "Keyways and slots that must be centred for balance or appearance.",
    accept: "Measure both walls from the datum at several places; the midpoints must all fall in the zone.",
    datums: "Required: a centre plane from a width.",
    modifiers: "None.",
    inspect: "CMM, or an indicator from each side of the part.",
    mistakes: ["Using it where position with MMC would allow a cheap gauge."],
  },
  make: { char: "position", feature: "pockets" },
};

const RUNOUT_PARAMS = () => [
  { key: "e", label: "Off-centre from the datum axis", min: 0, max: 0.1, step: 0.002 },
  { key: "amp", label: "Out-of-round (each of 3 lobes)", min: 0, max: 0.05, step: 0.001 },
  { key: "bow", label: "Bend in the middle", min: 0, max: 0.08, step: 0.002 },
  { key: "taper", label: "Taper (diameter difference)", min: 0, max: 0.1, step: 0.002 },
];
/** Radial reading, from nominal, at station u (0..1) and angle t (radians) for runout. */
export const runoutRadius = (s, u, t) => (s.e + s.bow * sag(u)) * Math.cos(t) + s.amp * Math.cos(3 * t) + (s.taper / 2) * (u - 0.5);
export function runoutFim(s, total) {
  let worst = 0, glo = Infinity, ghi = -Infinity;
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const [lo, hi] = range((k) => runoutRadius(s, u, k * 2 * Math.PI), 181);
    worst = Math.max(worst, hi - lo);
    glo = Math.min(glo, lo);
    ghi = Math.max(ghi, hi);
  }
  return total ? ghi - glo : worst;
}
const runoutEval = (total) =>
  function (s) {
    if (!s.datums.length) return noDatum();
    const m = runoutFim(s, total);
    return {
      checks: [zoneCheck(total ? "Total runout (whole surface)" : "Circular runout (worst single section)", m, s.tol, total ? "One reading for the whole surface: taper and bend count." : "Each section is read on its own, so taper doesn't count.")],
      main: { measured: m, allowed: s.tol },
      warnings: [],
    };
  };

const circularRunout = {
  id: "circular-runout",
  name: "Circular runout",
  group: "runout",
  summary: "Spin the part on its datum axis and watch a dial at one spot. The needle swing at every section must stay within the tolerance.",
  frame: { dia: "never", mods: false, datums: "required", tol: [0.005, 0.3, 0.005] },
  defaults: { tol: 0.05, datums: ["A"], e: 0.01, amp: 0.004, bow: 0.006, taper: 0.03 },
  params: RUNOUT_PARAMS,
  evaluate: runoutEval(false),
  read: (s, L) => `Spun about datum axis ${s.datums[0] || "?"}, the dial indicator must not swing more than ${L(s.tol)} at any one cross-section.`,
  text: {
    means: "A combined check of roundness and off-centre for each slice, relative to the datum axis. It's what you'd see with an indicator while the part turns.",
    zone: "At each section, two concentric circles the tolerance apart, centred on the datum axis.",
    part: "Pulleys, gear blanks, bearing seats and anything that spins and must not wobble.",
    accept: "Full indicator movement (FIM) at each section must be within the tolerance. Taper doesn't show, because each section is read separately.",
    datums: "Required: the axis it spins on, usually from one or two diameters or centres.",
    modifiers: "None. Runout is always RFS.",
    inspect: "Part between centres or in V-blocks on the datum, indicator on the surface, rotate one turn, repeat at several sections.",
    mistakes: ["Using it on a face when total runout was needed to catch dish or wobble across the whole face."],
  },
  make: { char: "runout", feature: "od" },
};

const totalRunout = {
  ...circularRunout,
  id: "total-runout",
  name: "Total runout",
  summary: "Spin the part and sweep the dial along the whole surface. One reading covers roundness, off-centre, bend and taper.",
  evaluate: runoutEval(true),
  read: (s, L) => `Spun about datum axis ${s.datums[0] || "?"} with the indicator moved along the whole surface, the dial must not swing more than ${L(s.tol)} in total.`,
  text: {
    ...circularRunout.text,
    means: "Like circular runout, but the dial moves along the full length while the part turns, and the total swing counts. It catches taper and bend too.",
    zone: "Two coaxial cylinders the tolerance apart, centred on the datum axis.",
    part: "Long bearing journals, rollers, shafts for seals, and faces that must be square to the axis.",
    accept: "One FIM for the whole surface. Taper and bend add to the reading, unlike circular runout.",
  },
  make: { char: "runout", feature: "od" },
};

function noDatum() {
  return {
    checks: [{ id: "datum", label: "Datum reference", ok: false, measured: null, allowed: null, text: "This callout needs a datum. Without one there's nothing to measure the tilt or location from." }],
    main: { measured: NaN, allowed: NaN },
    warnings: ["Add a datum to the frame."],
  };
}
function modWords(mod, kind) {
  if (mod === "MMC") return kind === "hole" ? " when the hole is at its smallest (MMC), growing as the hole gets bigger" : " at MMC";
  if (mod === "LMC") return kind === "hole" ? " when the hole is at its largest (LMC), growing as the hole gets smaller" : " at LMC";
  return ", whatever size the hole is";
}

export const CALLOUTS = [flatness, straightness, circularity, cylindricity, perpendicularity, parallelism, angularity, position, concentricity, symmetry, profileLine, profileSurface, circularRunout, totalRunout];
export const calloutById = Object.fromEntries(CALLOUTS.map((c) => [c.id, c]));

/** The starting state for a callout's page. */
export function initialState(c) {
  return { dia: c.frame.dia === "always", mod: "RFS", datums: c.frame.datums === "none" ? [] : ["A"], mode: c.modes?.[0]?.value, ...c.defaults };
}
/** Is the ⌀ symbol on in this state? */
export const showsDia = (c, s) => c.frame.dia === "always" || (c.frame.dia === "optional" && s.dia) || (c.frame.dia === "mode" && s.mode === "axis");
/** Can this state carry MMC or LMC? */
export const allowsMods = (c, s) => c.frame.mods === true || (c.frame.mods === "mode" && s.mode === "axis");

/** Run the check, with the derived flags the drawing needs. */
export function evaluate(c, s) {
  const mod = allowsMods(c, s) ? s.mod : "RFS";
  const r = c.evaluate.call(c, { ...s, dia: showsDia(c, s), mod });
  const ok = r.checks.every((k) => k.ok);
  return { ...r, ok, mod, vc: mod === "RFS" ? null : r.vc ?? null };
}

/** Basics pages that sit in front of the symbol pages. */
export const BASICS = [
  { id: "frame", name: "Reading a feature control frame", summary: "Build a callout box by box and hear it read in plain words." },
  { id: "datums", name: "Datums and the 3-2-1 rule", summary: "How a part is held for measuring, and what each datum locks." },
  { id: "modifiers", name: "MMC, LMC and bonus tolerance", summary: "Why a bigger hole can be further out of position and still fit." },
];
