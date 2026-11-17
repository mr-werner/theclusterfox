// Carry a beam's loads to the section-properties page and bring the chosen
// section's stiffness back, so forces and section shapes can be studied together.
// Kept in sessionStorage: it only needs to last for this visit.

import { MATERIALS } from "../data/materials.js";

const TRIP = "toolfox-beam-trip"; // { search, M, V } saved when leaving the beam page
const LAST = "toolfox-section-last"; // the section page's params, to reopen the same shape
const LABEL = "toolfox-beam-section"; // { I, S, label } of the section sent to the beam

const read = (key) => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: the links still work, they just start fresh.
  }
};

export const readBeamTrip = () => read(TRIP);
export const clearBeamTrip = () => write(TRIP, null);
export const saveLastSection = (params) => write(LAST, params);
export const readSectionLabel = () => read(LABEL);

const qs = (obj) => new URLSearchParams(Object.entries(obj).filter(([, x]) => x !== undefined && x !== null && x !== "")).toString();
const n = (x) => String(Number(x.toPrecision(10)));

/** Leave the beam for the section page, taking the beam's worst moment and shear along. */
export function sectionUrlFromBeam(beamParams, { M, V }) {
  write(TRIP, { search: qs(beamParams), M, V });
  const last = read(LAST) || {};
  const next = { ...last };
  if (Number.isFinite(M)) next.M = n(M);
  if (Number.isFinite(V)) next.V = n(V);
  return `/tools/calc/section-properties?${qs(next)}`;
}

/** Back to the beam (or a fresh one) with this section's I, S and material stiffness. */
export function beamUrlFromSection({ Ix, Sx, mat, label }) {
  const trip = read(TRIP);
  const params = Object.fromEntries(new URLSearchParams(trip?.search || ""));
  params.I = n(Ix);
  params.S = n(Sx);
  const m = MATERIALS.find((x) => x.name === mat);
  if (m?.E) {
    params.mat = m.name;
    params.E = n(m.E);
  }
  write(LABEL, { I: Ix, S: Sx, label });
  return `/tools/calc/beam?${qs(params)}`;
}

/**
 * The worst moment (signed: + sags, − hogs) and shear from a beam calculation's results.
 * Standard cantilevers and fixed-end beams peak in hogging, over a support.
 */
export function beamWorst(results, values = {}) {
  const get = (id) => results.find((r) => r.id === id)?.value;
  let M = get("M");
  if (M !== undefined && (values.support === "cant" || values.support === "fixed")) M = -M;
  if (M === undefined) {
    const pos = get("Mpos") || 0, neg = get("Mneg") || 0;
    M = pos >= neg ? pos : -neg;
  }
  return { M, V: get("V") };
}
