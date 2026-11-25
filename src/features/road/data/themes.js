// The kinds of road trip RoadFox builds routes for. Each theme says which
// OpenStreetMap places count, how good each kind is as a stop, and how long
// a stop there usually takes. "fastest" has no stops.

export const THEMES = [
  { id: "fastest", name: "Fastest", blurb: "Straight there. Gas, food and sleep stops only.", icon: "Gauge" },
  { id: "scenic", name: "Scenic & nature", blurb: "Parks, waterfalls, overlooks and hot springs.", icon: "Mountain", radiusKm: 24 },
  { id: "food", name: "Food & local flavor", blurb: "Diners, BBQ, ice cream, breweries and farm stands.", icon: "UtensilsCrossed", radiusKm: 8 },
  { id: "history", name: "History & oddities", blurb: "Museums, landmarks, forts and roadside wonders.", icon: "Landmark", radiusKm: 16 },
  { id: "outdoors", name: "Outdoors & play", blurb: "Trailheads, swimming holes, zoos and parks for stretching your legs.", icon: "Footprints", radiusKm: 16 },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map(t => [t.id, t]));

// [theme, label, score, minutes, test(tags)]: the first match wins for the label.
const KINDS = [
  ["scenic", "National park", 12, 120, t => t.boundary === "national_park" || (t.boundary === "protected_area" && t.protect_class === "2")],
  ["scenic", "Natural arch", 8, 45, t => t.natural === "arch"],
  ["scenic", "Geyser", 8, 45, t => t.natural === "geyser"],
  ["scenic", "Waterfall", 7, 45, t => t.natural === "waterfall"],
  ["scenic", "Hot spring", 7, 75, t => t.natural === "hot_spring"],
  ["scenic", "Canyon", 7, 45, t => t.natural === "gorge" || t.natural === "canyon"],
  ["scenic", "Cave", 6, 60, t => t.natural === "cave_entrance"],
  ["scenic", "Scenic overlook", 4, 20, t => t.tourism === "viewpoint"],
  ["scenic", "State park", 6, 75, t => t.boundary === "protected_area" || /state park/i.test(t.name ?? "")],
  ["scenic", "Nature reserve", 4, 60, t => t.leisure === "nature_reserve"],
  ["outdoors", "Beach", 5, 90, t => t.natural === "beach"],
  ["outdoors", "Trailhead", 4, 75, t => t.highway === "trailhead"],
  ["outdoors", "Swimming spot", 5, 60, t => t.leisure === "swimming_area"],
  ["outdoors", "Zoo", 6, 120, t => t.tourism === "zoo"],
  ["outdoors", "Aquarium", 6, 90, t => t.tourism === "aquarium"],
  ["outdoors", "Theme park", 6, 180, t => t.tourism === "theme_park"],
  ["outdoors", "Water park", 5, 150, t => t.leisure === "water_park"],
  ["outdoors", "Park", 3, 40, t => t.leisure === "park"],
  ["food", "Brewery", 4, 60, t => t.craft === "brewery" || t.microbrewery === "yes"],
  ["food", "Winery", 4, 60, t => t.craft === "winery" || t.tourism === "wine_cellar"],
  ["food", "Distillery", 4, 45, t => t.craft === "distillery"],
  ["food", "BBQ", 5, 60, t => /barbecue|bbq/.test(t.cuisine ?? "")],
  ["food", "Diner", 5, 50, t => /diner/.test(t.cuisine ?? "")],
  ["food", "Ice cream", 4, 20, t => t.amenity === "ice_cream" || /ice_cream/.test(t.cuisine ?? "")],
  ["food", "Farm stand", 3, 20, t => t.shop === "farm"],
  ["food", "Local favorite", 3, 50, t => t.amenity === "restaurant" || t.amenity === "cafe"],
  ["history", "Museum", 5, 75, t => t.tourism === "museum"],
  ["history", "Lighthouse", 5, 30, t => t.man_made === "lighthouse"],
  ["history", "Fort", 6, 60, t => t.historic === "fort" || t.historic === "castle"],
  ["history", "Battlefield", 6, 60, t => t.historic === "battlefield"],
  ["history", "Ruins", 5, 45, t => t.historic === "ruins" || t.historic === "archaeological_site"],
  ["history", "Monument", 4, 25, t => t.historic === "monument" || t.historic === "memorial"],
  ["history", "Historic site", 4, 40, t => Boolean(t.historic)],
  ["history", "Roadside attraction", 4, 30, t => t.tourism === "attraction"],
];

/**
 * What a place is to RoadFox from its OSM tags: { theme, label, score,
 * minutes } or null when it isn't a stop worth suggesting.
 */
export function classify(tags) {
  if (!tags?.name) return null;
  if (tags.brand || tags["brand:wikidata"]) return null; // chains aren't the journey
  if (tags.access === "private" || tags.access === "no") return null;
  for (const [theme, label, score, minutes, test] of KINDS) {
    if (test(tags)) {
      const fame = (tags.wikidata ? 3 : 0) + (tags.wikipedia ? 2 : 0) + (tags.website ? 0.5 : 0);
      return { theme, label, score: score + fame, minutes };
    }
  }
  return null;
}

/** The Overpass statements that find each theme's places near a line. */
export function overpassAlong(samples) {
  const line = samples.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(",");
  const at = km => `(around:${km * 1000},${line})`;
  const r = id => THEME_BY_ID[id].radiusKm;
  const sets = {
    scenic: [
      `nwr${at(r("scenic"))}["tourism"="viewpoint"]["name"]`,
      `nwr${at(r("scenic"))}["natural"~"^(waterfall|hot_spring|arch|geyser|gorge|canyon|cave_entrance)$"]["name"]`,
      `nwr${at(r("scenic"))}["boundary"~"^(national_park|protected_area)$"]["wikidata"]["name"]`,
      `nwr${at(r("scenic"))}["leisure"="nature_reserve"]["wikidata"]["name"]`,
    ],
    food: [
      `nwr${at(r("food"))}["amenity"~"^(restaurant|cafe)$"]["cuisine"~"diner|barbecue|bbq|regional"]["name"][!"brand"]`,
      `nwr${at(r("food"))}["amenity"="ice_cream"]["name"][!"brand"]`,
      `nwr${at(r("food"))}["craft"~"^(brewery|winery|distillery)$"]["name"]`,
      `nwr${at(r("food"))}["tourism"="wine_cellar"]["name"]`,
      `nwr${at(r("food"))}["amenity"~"^(restaurant|cafe)$"]["wikidata"]["name"][!"brand"]`,
    ],
    history: [
      `nwr${at(r("history"))}["tourism"="museum"]["name"]`,
      `nwr${at(r("history"))}["historic"]["wikidata"]["name"]`,
      `nwr${at(r("history"))}["tourism"="attraction"]["name"]`,
      `nwr${at(r("history"))}["man_made"="lighthouse"]["name"]`,
    ],
    outdoors: [
      `nwr${at(r("outdoors"))}["highway"="trailhead"]["name"]`,
      `nwr${at(r("outdoors"))}["leisure"~"^(swimming_area|water_park)$"]["name"]`,
      `nwr${at(r("outdoors"))}["tourism"~"^(zoo|aquarium|theme_park)$"]["name"]`,
      `nwr${at(r("outdoors"))}["natural"="beach"]["name"]`,
      `nwr${at(r("outdoors"))}["leisure"="park"]["wikidata"]["name"]`,
    ],
  };
  // One output per theme, each capped, so a city full of cafés can't crowd
  // out the waterfalls. Overpass returns them in id order, which is spread
  // all over the map, so the cap thins evenly rather than by place.
  const body = Object.values(sets)
    .map(list => `(${list.map(s => `${s};`).join("")});out center tags 250;`)
    .join("");
  return `[out:json][timeout:60];${body}`;
}

/**
 * A lighter query for one stretch of road: nodes and ways only (big park
 * boundaries take Overpass minutes to measure against a long line), a
 * short server timeout and a cap per theme. Wikipedia fills in the parks.
 */
export function activityQuery(samples, { timeout = 25, cap = 90 } = {}) {
  const line = samples.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join(",");
  const at = km => `(around:${km * 1000},${line})`;
  const r = id => THEME_BY_ID[id].radiusKm;
  const sets = {
    scenic: [`nw${at(r("scenic"))}["tourism"="viewpoint"]["name"]`, `nw${at(r("scenic"))}["natural"~"^(waterfall|hot_spring|arch|geyser|gorge|canyon|cave_entrance)$"]["name"]`, `nw${at(r("scenic"))}["leisure"="nature_reserve"]["wikidata"]["name"]`],
    food: [`nw${at(r("food"))}["amenity"~"^(restaurant|cafe)$"]["cuisine"~"diner|barbecue|bbq|regional"]["name"][!"brand"]`, `nw${at(r("food"))}["amenity"="ice_cream"]["name"][!"brand"]`, `nw${at(r("food"))}["craft"~"^(brewery|winery|distillery)$"]["name"]`, `nw${at(r("food"))}["amenity"~"^(restaurant|cafe)$"]["wikidata"]["name"][!"brand"]`],
    history: [`nw${at(r("history"))}["tourism"="museum"]["name"]`, `nw${at(r("history"))}["historic"]["wikidata"]["name"]`, `nw${at(r("history"))}["tourism"="attraction"]["name"]`, `nw${at(r("history"))}["man_made"="lighthouse"]["name"]`],
    outdoors: [`nw${at(r("outdoors"))}["highway"="trailhead"]["name"]`, `nw${at(r("outdoors"))}["leisure"~"^(swimming_area|water_park)$"]["name"]`, `nw${at(r("outdoors"))}["tourism"~"^(zoo|aquarium|theme_park)$"]["name"]`, `nw${at(r("outdoors"))}["natural"="beach"]["name"]`],
  };
  const body = Object.values(sets)
    .map(list => `(${list.map(s => `${s};`).join("")});out center tags ${cap};`)
    .join("");
  return `[out:json][timeout:${timeout}];${body}`;
}

// Wikipedia articles near the road that are worth a stop, by title:
// [theme, label, score, minutes, test].
const WIKI_KINDS = [
  ["scenic", "National park", 12, 120, /National Park\b/],
  ["scenic", "National monument", 9, 75, /National Monument\b/],
  ["scenic", "Waterfall", 7, 45, /\bFalls\b|Waterfall/],
  ["scenic", "Hot spring", 7, 75, /Hot Springs?\b/],
  ["scenic", "Canyon", 7, 45, /Canyon\b|Gorge\b/],
  ["scenic", "Cave", 6, 75, /Caverns?\b|\bCaves?\b/],
  ["scenic", "Natural arch", 7, 45, /\bArch\b|Natural Bridge/],
  ["scenic", "State park", 6, 75, /State Park\b|Provincial Park\b|State Recreation Area/],
  ["scenic", "Wild lands", 5, 60, /National (Forest|Grassland|Recreation Area|Wildlife Refuge|Seashore|Lakeshore|Preserve)|Wilderness\b/],
  ["scenic", "Scenic overlook", 4, 25, /Overlook\b|Scenic (Byway|Drive|Area)/],
  ["history", "Museum", 5, 75, /Museum\b/],
  ["history", "Battlefield", 6, 60, /Battlefield|Battle of /],
  ["history", "Fort", 6, 60, /^Fort [A-Z]|\bFort\b.*(Historic|State)/],
  ["history", "Historic site", 5, 45, /National Historic|Historic (Site|District|Park)|Historical (Park|Site)/],
  ["history", "Lighthouse", 5, 30, /Lighthouse\b/],
  ["history", "Monument", 4, 25, /Monument\b|Memorial\b/],
  ["outdoors", "Zoo", 6, 120, /\bZoo\b|Wildlife Park|Safari/],
  ["outdoors", "Aquarium", 6, 90, /Aquarium\b/],
  ["outdoors", "Theme park", 6, 180, /Amusement Park|Theme Park|Water ?park/i],
  ["outdoors", "Trail", 4, 75, /\bTrail\b/],
  ["outdoors", "Beach", 5, 90, /\bBeach\b/],
  ["outdoors", "Lake", 4, 60, /^Lake [A-Z]|\bLake$|Reservoir\b/],
  ["food", "Winery", 4, 60, /Winery|Vineyards?\b|Wine Cellars?/],
  ["food", "Brewery", 4, 60, /Brewery|Brewing Company|Distillery/],
];

/** A Wikipedia geosearch hit as a RoadTripFox place, or null. */
export function classifyWiki(hit) {
  const title = String(hit?.title ?? "");
  if (!title || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lon)) return null;
  if (/^(List of|Template:|Category:)|\b(High School|Elementary|School District|County|Township|Interstate|U\.S\. Route|Highway|Station|Airport|Church|Cemetery|Hospital|Mall)\b/.test(title)) return null;
  for (const [theme, label, score, minutes, re] of WIKI_KINDS) {
    if (re.test(title)) {
      return {
        id: `wiki/${hit.pageid}`,
        name: title.slice(0, 90),
        lat: hit.lat,
        lon: hit.lon,
        theme,
        label,
        score: score + 3,
        minutes,
        wiki: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        website: null,
        town: null,
      };
    }
  }
  return null;
}
