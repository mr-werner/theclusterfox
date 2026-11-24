// Growing inside: how much light a spot by a window gets, how well a
// houseplant will do in your home, and the calendar indoor care runs on.
// Plain functions, testable in Node.
//
// Light levels follow extension houseplant guides: a window facing the
// equator (south in the north, north in the south) gives the most light,
// west windows get strong afternoon sun, east windows gentle morning sun,
// and light falls off fast with distance: a few feet back from the glass
// can get a quarter of the light on the sill.

import { RATINGS } from "./care.js";
import { fromDoy } from "./dates.js";

export const INDOOR_LIGHT = {
  bright: { name: "Bright", hint: "Some direct sun, or under a grow light" },
  medium: { name: "Medium", hint: "Bright but indirect: near a window, out of direct sun" },
  low: { name: "Low", hint: "Far from a window, or a window facing away from the sun" },
};
export const LIGHT_ORDER = ["low", "medium", "bright"];

export const WINDOWS = [
  { id: "S", name: "South window" },
  { id: "W", name: "West window" },
  { id: "E", name: "East window" },
  { id: "N", name: "North window" },
  { id: "grow", name: "Under a grow light" },
  { id: "none", name: "No window nearby" },
];
export const DISTANCES = [
  { id: "sill", name: "On the sill" },
  { id: "near", name: "Within 3 ft (1 m)" },
  { id: "far", name: "Across the room" },
];

// [sill, near, far] for each kind of window.
const WINDOW_LIGHT = {
  sunny: ["bright", "bright", "medium"],
  west: ["bright", "medium", "low"],
  east: ["medium", "medium", "low"],
  shady: ["medium", "low", "low"],
};

/** The light at a room spot: { id: "bright"|"medium"|"low", why }. */
export function roomLight(room, hemisphere = "N") {
  if (room.light && INDOOR_LIGHT[room.light]) return { id: room.light, why: "Set by hand" };
  if (room.window === "grow") return { id: "bright", why: "A grow light gives bright light all year" };
  if (room.window === "none") return { id: "low", why: "No window nearby" };
  const sunnySide = hemisphere === "S" ? "N" : "S";
  const kind = room.window === sunnySide ? "sunny" : room.window === "W" ? "west" : room.window === "E" ? "east" : "shady";
  const i = Math.max(0, DISTANCES.findIndex(d => d.id === room.distance));
  const why = {
    sunny: "Faces the sun most of the day",
    west: "Strong afternoon sun",
    east: "Gentle morning sun",
    shady: "Faces away from the sun: no direct light",
  }[kind];
  return { id: WINDOW_LIGHT[kind][i], why: i === 2 ? `${why}, but light fades fast across a room` : why };
}

export const AIR = [
  { id: "dry", name: "Dry", hint: "Heated or air-conditioned most of the year, or a desert climate" },
  { id: "average", name: "Average", hint: "Most homes" },
  { id: "humid", name: "Humid", hint: "A muggy climate, or a bathroom or kitchen" },
];

/**
 * rateIndoor(plant, light?, home?) → { score 1..6, rating, reasons }
 * light: the room's light ("bright" | "medium" | "low"), when rating for a room.
 * home: { air: "dry"|"average"|"humid", pets: boolean }.
 */
export function rateIndoor(plant, light = null, home = null) {
  let score = plant.base;
  const reasons = [];
  let unsuited = false;
  const add = (n, why) => {
    score += n;
    reasons.push(why);
  };
  const levels = plant.light ?? [];
  if (light && levels.length && !levels.includes(light)) {
    const here = LIGHT_ORDER.indexOf(light);
    const dimmest = Math.min(...levels.map(l => LIGHT_ORDER.indexOf(l)));
    if (here < dimmest) {
      if (dimmest - here >= 2) {
        unsuited = true;
        reasons.push("Far too dark here: it needs a sunny window or a grow light");
      } else add(2, "A bit dark for it: expect slow, leggy growth. A small grow light fixes it");
    } else add(1, "More direct sun than it likes: set it back from the glass or behind a sheer curtain");
  }
  if (home) {
    if (plant.humidity === 3 && home.air === "dry") add(2, "Dry air here: expect crispy leaf edges without a humidifier, a pebble tray or a bathroom spot");
    else if (plant.humidity === 3 && home.air !== "humid") add(1, "Likes more humidity than most homes have: group it with other plants or run a humidifier");
    else if (plant.humidity === 1 && home.air === "humid") add(1, "Humid home: let the soil dry fully between waterings so it doesn't rot");
    if (home.pets && plant.petSafe === false) reasons.push("Toxic to cats and dogs: keep it out of reach, or pick a pet-safe plant");
  }
  const final = unsuited ? 6 : Math.max(1, Math.min(5, score));
  return { score: final, rating: RATINGS[final], reasons };
}

/** "Medium or low light · bright but indirect light is best". */
export function lightNeed(plant) {
  const levels = plant.light ?? [];
  if (!levels.length) return "";
  const names = levels.map((l, i) => (i ? INDOOR_LIGHT[l].name.toLowerCase() : INDOOR_LIGHT[l].name));
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}` : names[0];
  return `${list} light · best with ${INDOOR_LIGHT[levels[0]].hint.toLowerCase()}`;
}

/** Is this garden entry growing inside? */
export function isInside(entry, plant) {
  if (!plant) return false;
  if (plant.setting === "indoor") return true;
  if (plant.setting === "outdoor") return false;
  return Boolean(entry?.inside);
}

/**
 * Indoors there's no frost, so care follows the light: "growing" runs from
 * early March to mid October in the north (September to April in the
 * south) and "winter" is the dark months between. Shaped like a climate so
 * the outdoor calendar helpers work on it.
 */
export function indoorClimate(hemisphere = "N") {
  const lastFrost = hemisphere === "S" ? 258 : 74; // Sep 15 / Mar 15
  return {
    source: "indoor",
    indoor: true,
    hemisphere,
    latitude: null,
    zone: 11,
    lastFrost,
    firstFrost: ((lastFrost + 214 - 1) % 365) + 1,
    frostFree: 214,
    frostless: false,
    monthly: null,
    summerHigh: null,
    summerRain: null,
    annualRain: null,
  };
}

/** The first day of the indoor growing season in a year, as a day number. */
export const indoorSpring = (hemisphere, year) => fromDoy(year, indoorClimate(hemisphere).lastFrost);
