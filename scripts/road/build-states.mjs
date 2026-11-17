// Builds src/features/road/data/stateShapes.json, the simplified US state
// outlines RoadFox uses to tell which state a point on a route is in (for
// gas prices, the license plate game and state trivia).
//
//   node scripts/road/build-states.mjs path/to/us-states.json
//
// Source: the public-domain US Census outlines as packaged in
// github.com/PublicaMundi/MappingAPI (data/geojson/us-states.json).
import { readFileSync, writeFileSync } from "node:fs";

const NAME_TO_CODE = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
  Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

const src = JSON.parse(readFileSync(process.argv[2], "utf8"));
const out = {};
for (const f of src.features) {
  const code = NAME_TO_CODE[f.properties.name];
  if (!code) continue;
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  // Outer rings only, coordinates to 0.01° (about half a mile): plenty to
  // tell which state a highway is in.
  out[code] = polys
    .map(p => p[0].map(([lon, lat]) => [Math.round(lon * 100) / 100, Math.round(lat * 100) / 100]))
    .map(ring => ring.filter((pt, i) => i === 0 || pt[0] !== ring[i - 1][0] || pt[1] !== ring[i - 1][1]))
    .filter(ring => ring.length >= 4);
}
writeFileSync(new URL("../../src/features/road/data/stateShapes.json", import.meta.url), JSON.stringify(out));
console.log(`${Object.keys(out).length} states`);
