// Checks ScoreFox's saved settings: node src/features/sports/tests/validate.mjs
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: key => store.delete(key),
};

const { DEFAULT_LEAGUES, emptyData, loadData, normalizeData, pickedNames, saveData, STORAGE_KEY, toggleIn, toggleService, WATCH_STORAGE_KEY } =
  await import("../state/sportsStore.js");
const { apps } = await import("../../../app/apps.js").catch(() => ({ apps: null }));

let passed = 0;
const test = (name, fn) => {
  store.clear();
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

test("a fresh visitor follows the default leagues", () => {
  assert.deepEqual(loadData(), emptyData());
  assert.deepEqual(emptyData().leagues, DEFAULT_LEAGUES);
});

test("saved settings are cleaned up on load", () => {
  const data = normalizeData({
    region: "XX",
    services: [{ id: 8, name: "Netflix" }, { id: "bad" }],
    live: ["YouTube TV", "Nope", "YouTube TV"],
    leagues: ["nfl", "curling"],
    favorites: [{ id: 1, type: "movie", title: "Not a sports thing" }],
  });
  assert.equal(data.region, "US");
  assert.deepEqual(data.services.map(s => s.id), [8]);
  assert.deepEqual(data.live, ["YouTube TV"]);
  assert.deepEqual(data.leagues, ["nfl"]);
  assert.equal(data.favorites, undefined, "movie lists stay in WatchFox");
});

test("first visit carries over the sports picks made in WatchFox", () => {
  store.set(
    WATCH_STORAGE_KEY,
    JSON.stringify({ region: "CA", services: [{ id: 8, name: "Netflix" }], live: ["Sling TV"], leagues: ["nhl", "epl"], favorites: [] })
  );
  const data = loadData();
  assert.equal(data.region, "CA");
  assert.deepEqual(data.leagues, ["nhl", "epl"]);
  assert.deepEqual(data.live, ["Sling TV"]);
  assert.deepEqual(data.services.map(s => s.name), ["Netflix"]);
});

test("once ScoreFox has its own settings, WatchFox no longer changes them", () => {
  store.set(WATCH_STORAGE_KEY, JSON.stringify({ leagues: ["nhl"] }));
  saveData({ ...emptyData(), leagues: ["mlb"] });
  assert.ok(store.has(STORAGE_KEY));
  assert.deepEqual(loadData().leagues, ["mlb"]);
});

test("following no leagues is remembered, not reset to the defaults", () => {
  saveData({ ...emptyData(), leagues: [] });
  assert.deepEqual(loadData().leagues, []);
});

test("picked service names cover streaming and live TV", () => {
  const data = normalizeData({ services: [{ id: 8, name: "Netflix" }], live: ["YouTube TV"] });
  assert.deepEqual(pickedNames(toggleService(data, { id: 15, name: "Hulu" })), ["Netflix", "Hulu", "YouTube TV"]);
  assert.deepEqual(toggleIn(data.leagues, "nfl"), DEFAULT_LEAGUES.filter(id => id !== "nfl"));
});

// apps.js pulls in lucide-react, which only loads where JSX tooling exists.
if (apps) {
  test("ScoreFox and WatchFox are separate apps", () => {
    const score = apps.find(a => a.id === "scorefox");
    const watch = apps.find(a => a.id === "watchfox");
    assert.equal(score.path, "/sports");
    assert.equal(watch.path, "/watch");
    assert.doesNotMatch(watch.description, /sport/i);
  });
}

console.log(`ScoreFox: ${passed} checks passed.`);
