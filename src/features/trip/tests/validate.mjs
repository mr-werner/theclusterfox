// TripFox: saved data, budget math, places parsing, links and the TaskFox feed.
import assert from "node:assert/strict";

import { cleanTrip, newTrip, normalizeData, fromTaskFox, taskFoxDestination, tripTitle } from "../state/tripStore.js";
import { budgetFor, maxNightly, staysForNightly, travelCost } from "../model/budget.js";
import { addDays, dateSpan, nightsOf, tripDays } from "../model/days.js";
import { mergeThings, stayLinks, staysFromOsm, thingsFromEvents, thingsFromOsm, thingsFromWiki, travelLinks } from "../model/places.js";
import { launchTargets, planItems } from "../model/planLink.js";
import { parsePlaceName } from "../../../services/geo/reverse.js";

globalThis.crypto ??= (await import("node:crypto")).webcrypto;

const denver = { id: "d", name: "Denver", region: "Colorado", lat: 39.7392, lon: -104.9903 };
const chicago = { id: "c", name: "Chicago", region: "Illinois", lat: 41.8781, lon: -87.6298 };

// Store: junk in, sensible data out.
{
  for (const raw of [null, 42, "x", [], { trips: "no" }]) assert.deepEqual(normalizeData(raw).trips, []);
  const t = cleanTrip({ id: "a", dest: { latitude: 39.7, longitude: -105, name: "Denver" }, start: "2026-12-18", end: "2026-12-10", adults: 99, kids: -3, travel: "teleport", plan: [{ id: "p", title: "Zoo", day: "nope", time: "25:00", url: "javascript:alert(1)" }] });
  assert.equal(t.dest.lat, 39.7, "TaskFox-shaped places are accepted");
  assert.equal(t.end, null, "an end before the start is dropped");
  assert.equal(t.adults, 12);
  assert.equal(t.kids, 0);
  assert.equal(t.travel, "drive");
  assert.deepEqual([t.plan[0].day, t.plan[0].time, t.plan[0].url], [null, null, null]);
  const data = normalizeData({ trips: [t], currentId: "gone" });
  assert.equal(data.currentId, "a", "falls back to the first trip");
  assert.equal(tripTitle(t), "Trip to Denver");
  assert.equal(tripTitle(newTrip()), "New trip");
}

// TaskFox's town and home airport carry over; a watched destination is found by code.
{
  const raw = { place: { name: "Chicago", latitude: 41.88, longitude: -87.63 }, flights: { from: { code: "CHI", name: "Chicago" }, to: [{ code: "DEN", name: "Denver" }] } };
  const got = fromTaskFox(raw);
  assert.equal(got.home.name, "Chicago");
  assert.equal(got.homeAirport.code, "CHI");
  assert.deepEqual(taskFoxDestination(raw, "DEN"), { code: "DEN", name: "Denver" });
  assert.deepEqual(taskFoxDestination(null, "LAX"), { code: "LAX", name: "LAX" });
  assert.deepEqual(fromTaskFox("junk"), {});
}

// Days.
{
  const t = { start: "2026-12-30", end: "2027-01-02" };
  assert.deepEqual(tripDays(t), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.equal(nightsOf(t), 3);
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(dateSpan({ start: "2026-12-18", end: "2026-12-22" }), "Dec 18 – 22");
}

// Budget.
{
  const trip = newTrip({ dest: denver, start: "2026-12-18", end: "2026-12-22", adults: 2, kids: 2, rooms: 1, travel: "drive", vehicle: "suv", stayKind: "hotel", nightly: 150, food: 40, fun: 20 });
  const route = { miles: 1000, minutes: 900 };
  const travel = travelCost(trip, { home: chicago, route, gasPrice: 3 });
  assert.equal(travel.amount, 240, "2000 miles at 25 mpg and $3");
  const b = budgetFor(trip, { home: chicago, route, gasPrice: 3 });
  const line = id => b.lines.find(l => l.id === id).amount;
  assert.equal(line("stay"), Math.round(150 * 4 * 1.13));
  assert.equal(line("food"), Math.round(40 * (2 + 2 * 0.6) * 5));
  assert.equal(line("fun"), 20 * 4 * 5);
  assert.equal(b.total, 240 + line("stay") + line("food") + line("fun"));
  assert.equal(b.left, null);
  // Tickets added on the Do tab count too.
  const withTickets = budgetFor({ ...trip, plan: [{ id: "z", title: "Zoo", cost: 25, perPerson: true }] }, { home: chicago, route, gasPrice: 3 });
  assert.equal(withTickets.total - b.total, 100);
  // A budget gives a nightly ceiling, and it's consistent with the total.
  const budgeted = { ...trip, budget: 2000 };
  const ceiling = maxNightly(budgeted, { home: chicago, route, gasPrice: 3 });
  assert(ceiling > 0 && budgetFor({ ...budgeted, nightly: ceiling }, { home: chicago, route, gasPrice: 3 }).left >= 0);
  assert(budgetFor({ ...budgeted, nightly: ceiling + 5 }, { home: chicago, route, gasPrice: 3 }).left < 0);
  // Your own number wins.
  assert.equal(travelCost({ ...trip, travelCost: 99 }, { home: chicago }).amount, 99);
  // Flying uses real fares per seat when there are some, else a labeled guess.
  assert.equal(travelCost({ ...trip, travel: "fly" }, { home: chicago, fare: 210 }).amount, 840);
  assert.equal(travelCost({ ...trip, travel: "fly" }, { home: chicago }).basis, "estimate");
  assert.equal(travelCost({ ...trip, travel: "train" }, {}).amount, null, "no home, no guess");
  assert.equal(budgetFor({ ...trip, stayKind: "free" }, {}).lines.find(l => l.id === "stay").amount, 0);
  assert.deepEqual(staysForNightly(10).map(k => k.id), ["camp", "free"]);
  assert(staysForNightly(170).some(k => k.id === "hotel") && !staysForNightly(170).some(k => k.id === "free"));
}

// Wikipedia: keeps places worth a visit, skips schools and streets.
{
  const body = {
    query: {
      pages: {
        1: { pageid: 1, title: "Denver Art Museum", description: "art museum in Denver, Colorado", coordinates: [{ lat: 39.737, lon: -104.989 }], thumbnail: { source: "https://upload.wikimedia.org/a.jpg" } },
        2: { pageid: 2, title: "East High School", description: "public high school in Denver", coordinates: [{ lat: 39.74, lon: -104.95 }] },
        3: { pageid: 3, title: "Denver Zoo", description: "zoo in City Park, Denver", coordinates: [{ lat: 39.75, lon: -104.95 }] },
        4: { pageid: 4, title: "Red Rocks Park", description: "mountain park", coordinates: [{ lat: 39.66, lon: -105.2 }] },
        5: { pageid: 5, title: "No coords", description: "museum" },
      },
    },
  };
  const things = thingsFromWiki(body, denver);
  assert.deepEqual(things.map(t => t.title).sort(), ["Denver Art Museum", "Denver Zoo", "Red Rocks Park"]);
  const museum = things.find(t => t.title === "Denver Art Museum");
  assert.equal(museum.kind, "museums");
  assert.equal(museum.indoor, true);
  assert(museum.url.startsWith("https://en.wikipedia.org/wiki/Denver_Art_Museum"));
  assert.equal(things.find(t => t.title === "Denver Zoo").kind, "family");
  assert.equal(things.find(t => t.title === "Red Rocks Park").kind, "outdoors");
  assert.deepEqual(thingsFromWiki(null, denver), []);
}

// OpenStreetMap things and stays.
{
  const body = {
    elements: [
      { type: "node", id: 1, lat: 39.75, lon: -104.95, tags: { tourism: "zoo", name: "Denver Zoo", website: "http://denverzoo.org" } },
      { type: "way", id: 2, center: { lat: 39.74, lon: -104.99 }, tags: { leisure: "park", name: "Tiny Park" } },
      { type: "way", id: 3, center: { lat: 39.74, lon: -104.99 }, tags: { tourism: "museum", name: "History Colorado" } },
      { type: "node", id: 4, lat: 39.7, lon: -105, tags: { tourism: "hotel", name: "The Brown Palace", stars: "4" } },
      { type: "node", id: 5, lat: 39.8, lon: -105.1, tags: { tourism: "camp_site", name: "Cherry Creek", fee: "no" } },
      { type: "node", id: 6, lat: 39.8, lon: -105.1, tags: { tourism: "hotel" } },
    ],
  };
  const things = thingsFromOsm(body, denver);
  assert.deepEqual(things.map(t => t.title), ["Denver Zoo", "History Colorado"], "unremarkable small parks are skipped");
  assert.equal(things[0].url, "https://denverzoo.org", "links upgrade to https");
  const stays = staysFromOsm(body, denver);
  assert.deepEqual(stays.map(s => s.name), ["The Brown Palace", "Cherry Creek"]);
  assert.equal(stays[0].stars, 4);
  assert.equal(stays[1].free, true);
  // Merging: the same place from two sources shows once; kids put family first.
  const wiki = thingsFromWiki({ query: { pages: { 1: { pageid: 9, title: "Denver Zoo", description: "zoo", coordinates: [{ lat: 39.75, lon: -104.95 }], thumbnail: { source: "https://x/y.jpg" } } } } }, denver);
  const events = thingsFromEvents([{ id: "e1", title: "Nutcracker", day: "2026-12-19", time: "19:00", kind: "arts", url: "https://tm.example/e1", price: { min: 45 } }]);
  assert.equal(events[0].price, 45);
  const merged = mergeThings([wiki, things, events], { kids: 1 });
  assert.equal(merged.filter(t => t.title === "Denver Zoo").length, 1);
  assert.equal(merged[0].title, "Denver Zoo");
  assert.equal(merged.find(t => t.title === "Denver Zoo").image, "https://x/y.jpg");
}

// Links open with the trip filled in and only go to https sites.
{
  const trip = newTrip({ dest: denver, start: "2026-12-18", end: "2026-12-22", adults: 2, kids: 1, stayKind: "hotel" });
  const links = stayLinks(trip, 140);
  const booking = links.find(l => l.id === "booking").href;
  assert(booking.includes("checkin=2026-12-18") && booking.includes("group_children=1") && booking.includes("USD-0-140-1"));
  assert(links.some(l => l.id === "airbnb"), "families see whole homes");
  assert(stayLinks({ ...trip, stayKind: "camp" }, 0).some(l => l.id === "recgov"));
  assert(stayLinks({ ...trip, stayKind: "free" }, 0).some(l => l.id === "freecamp"));
  for (const l of [...links, ...travelLinks({ ...trip, travel: "fly" }, { home: chicago, homeAirport: { code: "ORD" } }), ...travelLinks({ ...trip, travel: "bus" }, { home: chicago })]) assert(l.href.startsWith("https://"), l.href);
  assert(travelLinks({ ...trip, travel: "fly" }, { homeAirport: { code: "ORD" } })[0].href.includes("ORD"));
}

// TaskFox calendar: every trip day, with what's planned, opening that day.
{
  const raw = { trips: [{ id: "t1", dest: denver, start: "2026-11-27", end: "2026-11-29", plan: [{ id: "a", title: "Zoo", day: "2026-11-28", time: "10:00" }, { id: "b", title: "Idea", day: null }] }] };
  const items = planItems(raw, "2026-11-01", "2026-11-30");
  assert.deepEqual(items.map(i => i.day), ["2026-11-27", "2026-11-28", "2026-11-29"]);
  assert.equal(items[0].title, "Trip to Denver: leave");
  assert.equal(items[2].title, "Trip to Denver: head home");
  assert.equal(items[1].detail, "10:00 AM Zoo");
  assert.equal(items[1].href, "/trip?trip=t1&tab=days&day=2026-11-28");
  assert.equal(planItems(raw, "2026-12-01", "2026-12-31").length, 0);
  assert(launchTargets(raw).some(t => t.href === "/trip?trip=t1"));
}

// Naming "my location".
{
  assert.deepEqual(parsePlaceName({ city: "Golden", principalSubdivision: "Colorado", countryCode: "US" }), { name: "Golden", region: "Colorado" });
  assert.deepEqual(parsePlaceName({ city: "", locality: "Banff", principalSubdivision: "Alberta", countryCode: "CA", countryName: "Canada" }), { name: "Banff", region: "Alberta, Canada" });
  assert.equal(parsePlaceName({}), null);
}

console.log("TripFox: all checks passed");
