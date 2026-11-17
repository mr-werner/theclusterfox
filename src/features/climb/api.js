// ClimbFox's route data comes from OpenBeta (https://openbeta.io), the open,
// climber-built route database. Its climbing data is public domain (CC0),
// photos excluded, and its GraphQL API allows browser requests, so we call
// it straight from the page. Answers are cached for the visit.

const URL = "https://api.openbeta.io/";
const cache = new Map();

async function gql(query, variables, { signal } = {}) {
  const key = query + JSON.stringify(variables ?? {});
  if (cache.has(key)) return cache.get(key);
  let response;
  try {
    response = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach OpenBeta, where the routes come from. Check your connection.", { cause: error });
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || (body.errors && !body.data)) throw new Error("The route database isn't answering right now. Try again in a moment.");
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  cache.set(key, body.data);
  return body.data;
}

const TYPE = "type{ trad sport bouldering tr alpine ice mixed aid deepwatersolo snow }";
const CLIMB_LIGHT = `uuid name grades{ yds vscale french font ewbank uiaa wi } ${TYPE} safety length boltsCount metadata{ leftRightIndex }`;
const AREA_LIGHT = "uuid area_name totalClimbs metadata{ lat lng leaf isBoulder leftRightIndex }";

/** Areas whose name matches what was typed. */
export async function searchAreas(text, opts) {
  const q = `query($t:String!){ areas(filter:{ area_name:{ match:$t } }, limit: 30){ ${AREA_LIGHT} pathTokens ancestors } }`;
  const data = await gql(q, { t: text.trim() }, opts);
  return (data.areas ?? []).map(cleanArea).filter(Boolean).sort((a, b) => b.totalClimbs - a.totalClimbs);
}

/** Crags (areas that hold routes) inside a map box [west, south, east, north]. */
export async function cragsWithin(bbox, zoom, opts) {
  const q = `query($b:[Float], $z:Float){ cragsWithin(filter:{ bbox:$b, zoom:$z }){ ${AREA_LIGHT} pathTokens ancestors } }`;
  const data = await gql(q, { b: bbox.map(v => Math.round(v * 1000) / 1000), z: zoom }, opts);
  return (data.cragsWithin ?? []).map(cleanArea).filter(Boolean);
}

/** One area: where it is, what's in it, its routes and its sub-areas. */
export async function getArea(uuid, opts) {
  const q = `query($u:ID){ area(uuid:$u){ ${AREA_LIGHT} pathTokens ancestors gradeContext content{ description areaLocation }
    aggregate{ byDiscipline{ sport{ total } trad{ total } boulder{ total } tr{ total } alpine{ total } ice{ total } mixed{ total } aid{ total } } byGradeBand{ beginner intermediate advanced expert unknown } }
    climbs{ ${CLIMB_LIGHT} }
    children{ ${AREA_LIGHT} } } }`;
  const data = await gql(q, { u: uuid }, opts);
  if (!data.area) throw new Error("That area isn't in OpenBeta anymore.");
  const a = data.area;
  return {
    ...cleanArea(a),
    description: (a.content?.description ?? "").trim(),
    approach: (a.content?.areaLocation ?? "").trim(),
    gradeContext: a.gradeContext ?? "US",
    disciplines: Object.fromEntries(Object.entries(a.aggregate?.byDiscipline ?? {}).map(([k, v]) => [k, v?.total ?? 0])),
    bands: a.aggregate?.byGradeBand ?? {},
    climbs: (a.climbs ?? []).map(c => cleanClimb(c, a)),
    children: (a.children ?? []).map(cleanArea).filter(Boolean).sort((x, y) => (x.lrIndex ?? 0) - (y.lrIndex ?? 0) || x.name.localeCompare(y.name)),
  };
}

// Every route under an area, four levels down. Big regions are too much to
// pull at once, so callers only ask when an area holds a few thousand or fewer.
export const DEEP_LIMIT = 3500;

export async function getAllRoutes(uuid, opts) {
  const level = depth => (depth === 0 ? "" : `children{ uuid area_name metadata{ lat lng } climbs{ ${CLIMB_LIGHT} } ${level(depth - 1)} }`);
  const q = `query($u:ID){ area(uuid:$u){ uuid area_name metadata{ lat lng } climbs{ ${CLIMB_LIGHT} } ${level(5)} } }`;
  const data = await gql(q, { u: uuid }, opts);
  const out = [];
  const walk = (a, path) => {
    for (const c of a.climbs ?? []) out.push({ ...cleanClimb(c, a), wall: path.join(" › ") });
    for (const child of a.children ?? []) walk(child, [...path, prettyName(child.area_name)]);
  };
  if (data.area) walk(data.area, []);
  return out;
}

/** One route with everything OpenBeta knows about it. */
export async function getClimb(uuid, opts) {
  const q = `query($u:ID){ climb(uuid:$u){ ${CLIMB_LIGHT} fa gradeContext pathTokens ancestors metadata{ lat lng leftRightIndex }
    content{ description location protection }
    pitches{ pitchNumber grades{ yds vscale french } length boltsCount description }
    parent{ uuid area_name metadata{ lat lng } climbs{ ${CLIMB_LIGHT} } } } }`;
  const data = await gql(q, { u: uuid }, opts);
  const c = data.climb;
  if (!c) throw new Error("That route isn't in OpenBeta anymore.");
  const parent = c.parent ? { uuid: c.parent.uuid, name: prettyName(c.parent.area_name), lat: c.parent.metadata?.lat ?? null, lng: c.parent.metadata?.lng ?? null } : null;
  return {
    ...cleanClimb(c, c.parent),
    fa: (c.fa ?? "").trim(),
    lat: c.metadata?.lat ?? parent?.lat ?? null,
    lng: c.metadata?.lng ?? parent?.lng ?? null,
    path: (c.pathTokens ?? []).map(prettyName),
    ancestors: c.ancestors ?? [],
    description: (c.content?.description ?? "").trim(),
    location: (c.content?.location ?? "").trim(),
    protection: (c.content?.protection ?? "").trim(),
    pitches: (c.pitches ?? []).map(p => ({ n: p.pitchNumber, grade: p.grades?.yds || p.grades?.vscale || p.grades?.french || "", length: p.length > 0 ? p.length : null, bolts: p.boltsCount > 0 ? p.boltsCount : null, description: (p.description ?? "").trim() })).sort((a, b) => a.n - b.n),
    parent,
    neighbors: (c.parent?.climbs ?? []).map(n => cleanClimb(n, c.parent)).sort((a, b) => (a.lrIndex ?? 9999) - (b.lrIndex ?? 9999)),
  };
}

/** "Gorilla, The" reads as "The Gorilla". */
export function prettyName(name) {
  const n = String(name ?? "").trim();
  const m = n.match(/^(.*),\s*(The|A|An)$/i);
  return m ? `${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()} ${m[1]}` : n;
}

export function cleanArea(a) {
  if (!a || !a.uuid) return null;
  return {
    uuid: a.uuid,
    name: prettyName(a.area_name) || "Unnamed area",
    totalClimbs: a.totalClimbs ?? 0,
    lat: Number.isFinite(a.metadata?.lat) ? a.metadata.lat : null,
    lng: Number.isFinite(a.metadata?.lng) ? a.metadata.lng : null,
    leaf: Boolean(a.metadata?.leaf),
    boulder: Boolean(a.metadata?.isBoulder),
    path: (a.pathTokens ?? []).map(prettyName),
    ancestors: a.ancestors ?? [],
    lrIndex: a.metadata?.leftRightIndex >= 0 ? a.metadata.leftRightIndex : null,
  };
}

const TYPE_ORDER = ["sport", "trad", "tr", "bouldering", "alpine", "ice", "mixed", "aid", "deepwatersolo", "snow"];

export function cleanClimb(c, parent) {
  const types = TYPE_ORDER.filter(t => c.type?.[t]);
  return {
    uuid: c.uuid,
    name: (c.name ?? "Unnamed").trim() || "Unnamed",
    grades: c.grades ?? {},
    types,
    safety: c.safety && c.safety !== "UNSPECIFIED" ? c.safety : null,
    length: c.length > 0 ? c.length : null, // metres
    bolts: c.boltsCount > 0 ? c.boltsCount : null,
    lrIndex: Number.isFinite(c.metadata?.leftRightIndex) && c.metadata.leftRightIndex >= 0 ? c.metadata.leftRightIndex : null,
    areaUuid: parent?.uuid ?? null,
    areaName: prettyName(parent?.area_name ?? parent?.name) || null,
    lat: parent?.metadata?.lat ?? null,
    lng: parent?.metadata?.lng ?? null,
  };
}

/** Links to read or add beta on OpenBeta itself. */
export const openBetaArea = uuid => `https://openbeta.io/area/${uuid}`;
export const openBetaClimb = uuid => `https://openbeta.io/climb/${uuid}`;
