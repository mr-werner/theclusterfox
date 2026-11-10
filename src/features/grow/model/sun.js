// Where the sun falls around a house, for any latitude. Plain functions,
// testable in Node.
//
// Sun position uses the standard declination and hour-angle formulas
// (NOAA solar calculator, simplified to solar time). A bed beside a wall
// gets direct sun only while the sun is in front of that wall and above
// about 10° (lower sun is usually blocked by fences, trees and neighbors).
//
// Hours of direct sun map to the light labels on plant tags:
// full sun 6+ hours, part sun/shade 3–6, shade under 3.

const RAD = Math.PI / 180;

export const FACINGS = [
  { id: "N", name: "North", deg: 0 },
  { id: "NE", name: "Northeast", deg: 45 },
  { id: "E", name: "East", deg: 90 },
  { id: "SE", name: "Southeast", deg: 135 },
  { id: "S", name: "South", deg: 180 },
  { id: "SW", name: "Southwest", deg: 225 },
  { id: "W", name: "West", deg: 270 },
  { id: "NW", name: "Northwest", deg: 315 },
];
export const facingById = id => FACINGS.find(f => f.id === id) ?? null;

export const declination = doy => 23.44 * Math.sin((2 * Math.PI * (284 + doy)) / 365);

/** Sun altitude and azimuth (degrees, azimuth clockwise from north) at a solar hour. */
export function sunPosition(latitude, doy, hour) {
  const phi = latitude * RAD;
  const dec = declination(doy) * RAD;
  const h = (hour - 12) * 15 * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) / RAD + 180;
  return { alt: alt / RAD, az: ((az % 360) + 360) % 360 };
}

/**
 * Hours of direct sun on a day: in the open (facing null) or on the ground
 * in front of a wall facing that compass direction.
 * Returns { total, morning, afternoon }.
 */
export function sunHours(latitude, doy, facing = null, minAlt = 10) {
  const step = 1 / 6;
  let morning = 0;
  let afternoon = 0;
  for (let t = 0; t < 24; t += step) {
    const { alt, az } = sunPosition(latitude, doy, t + step / 2);
    if (alt < minAlt) continue;
    if (facing != null) {
      const diff = Math.cos((az - facing) * RAD);
      if (diff < 0.17) continue;
    }
    if (t < 12) morning += step;
    else afternoon += step;
  }
  const r = n => Math.round(n * 10) / 10;
  return { total: r(morning + afternoon), morning: r(morning), afternoon: r(afternoon) };
}

export const lightFor = hours => (hours >= 6 ? "full" : hours >= 3 ? "part" : "shade");
export const LIGHT = {
  full: { name: "Full sun", hint: "6+ hours of direct sun" },
  part: { name: "Part sun", hint: "3–6 hours, or bright dappled light" },
  shade: { name: "Shade", hint: "Under 3 hours of direct sun" },
};

// Key days: summer solstice, equinox, winter solstice (hemisphere aware).
export function keyDays(latitude) {
  const north = latitude >= 0;
  return {
    summer: { doy: north ? 172 : 355, name: north ? "June 21" : "December 21" },
    equinox: { doy: north ? 79 : 265, name: north ? "March 20" : "September 22" },
    winter: { doy: north ? 355 : 172, name: north ? "December 21" : "June 21" },
  };
}

/** Sun on each side of a house through the year. */
export function sideReport(latitude) {
  const days = keyDays(latitude);
  const sides = [...FACINGS, { id: "open", name: "Open ground", deg: null }].map(f => {
    const summer = sunHours(latitude, days.summer.doy, f.deg);
    const equinox = sunHours(latitude, days.equinox.doy, f.deg);
    const winter = sunHours(latitude, days.winter.doy, f.deg);
    // The growing season sits between the equinox and the summer solstice.
    const season = Math.round(((summer.total + equinox.total) / 2) * 10) / 10;
    const hotAfternoon = (summer.afternoon + equinox.afternoon) / 2 >= 3 && (summer.morning + equinox.morning) / 2 < 2;
    return { ...f, summer, equinox, winter, season, light: lightFor(season), hotAfternoon };
  });
  return { days, sides };
}

/** Noon sun height and the shadow a wall or fence of `height` casts. */
export function noonShadow(latitude, doy, height) {
  const { alt } = sunPosition(latitude, doy, 12);
  if (alt <= 1) return { alt, length: Infinity };
  return { alt: Math.round(alt), length: Math.round((height / Math.tan(alt * RAD)) * 10) / 10 };
}

/** The sunniest and shadiest walls, in plain words, for this hemisphere. */
export function sunAdvice(latitude) {
  const lat = Math.abs(latitude);
  const north = latitude >= 0;
  if (lat < 23.5) {
    return {
      sunny: "Open ground",
      line: "Near the equator the sun passes almost overhead, and switches between the north and south sides of the house through the year. East and west walls get the steadiest sun; afternoon shade helps most plants in the heat.",
    };
  }
  return north
    ? { sunny: "South", line: "In the northern hemisphere the sun arcs across the southern sky. South-facing beds get the most sun, north-facing beds the most shade, east gets gentle morning sun and west gets the hot afternoon." }
    : { sunny: "North", line: "In the southern hemisphere the sun arcs across the northern sky. North-facing beds get the most sun, south-facing beds the most shade, east gets gentle morning sun and west gets the hot afternoon." };
}
