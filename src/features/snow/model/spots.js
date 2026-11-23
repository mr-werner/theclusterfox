// Finding a mountain or backcountry spot by id, with the two elevations
// SnowFox forecasts for.
import { RESORTS } from "../data/resorts.js";
import { BACKCOUNTRY } from "../data/backcountry.js";
import { CANADA } from "../data/roads.js";

export function findSpot(id, data) {
  const r = RESORTS.find(x => x.id === id);
  if (r) return { ...r, kind: "resort", country: CANADA.has(r.state) ? "CA" : "US", lowName: "Base", highName: "Top" };
  const b = BACKCOUNTRY.find(x => x.id === id);
  if (b) return { ...b, kind: "backcountry", base: b.elev, summit: b.elev + 1500, country: CANADA.has(b.state) ? "CA" : "US", lowName: "Trailhead", highName: "Ridge (+1,500 ft)" };
  const c = data?.custom?.find(x => x.id === id);
  if (c) return { ...c, kind: "custom", country: CANADA.has(c.state) ? "CA" : "US", lowName: "Low", highName: "High" };
  return null;
}

export function allSpots(data) {
  return [...RESORTS, ...BACKCOUNTRY, ...(data?.custom ?? [])];
}
