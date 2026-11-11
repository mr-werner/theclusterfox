// Checks ScoreFox's feed parsing: node src/features/sports/tests/feeds.mjs
import assert from "node:assert/strict";

import { SPORTS, SPORTS_LEAGUES, sportsLeaguesById } from "../../../services/sports/leagues.js";
import { parseEspnScoreboard, parseOdds, parsePickcenter, parseSummary, parseTsdbEvents, signed } from "../../../services/sports/parse.js";
import { LEAGUES } from "../../../services/watch/parse.js";
import { onDay } from "../model/schedule.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

test("every league has a known sport, a unique id and a source", () => {
  const sports = new Set(SPORTS.map(s => s.id));
  assert.equal(sportsLeaguesById.size, SPORTS_LEAGUES.length);
  SPORTS_LEAGUES.forEach(l => {
    assert.ok(sports.has(l.sport), l.id);
    assert.ok(l.source === "espn" ? l.path : l.tsdb, l.id);
  });
  // Leagues picked before (and PlanFox's) keep working.
  LEAGUES.forEach(l => assert.ok(sportsLeaguesById.has(l.id), l.id));
});

test("odds read as signed American numbers", () => {
  assert.equal(signed(150), "+150");
  assert.equal(signed(-180), "-180");
  assert.equal(signed(null), "");
  const odds = parseOdds([{ provider: { displayName: "DraftKings" }, details: "NYG -2.5", overUnder: 41.5, homeTeamOdds: { moneyLine: -130 }, awayTeamOdds: { moneyLine: 110 } }]);
  assert.deepEqual(odds, { provider: "DraftKings", details: "NYG -2.5", overUnder: 41.5, homeMoneyline: "-130", awayMoneyline: "+110" });
  assert.equal(parseOdds([]), null);
  assert.equal(parseOdds([{ provider: { name: "x" } }]), null, "a provider with no numbers is no line");
});

test("team games carry their line", () => {
  const league = sportsLeaguesById.get("nfl");
  const [game] = parseEspnScoreboard(
    {
      events: [
        {
          id: 7,
          name: "WSH at NYG",
          date: "2026-11-13T01:15Z",
          status: { type: { state: "pre", shortDetail: "8:15 PM" } },
          competitions: [
            {
              competitors: [
                { homeAway: "home", team: { displayName: "New York Giants", abbreviation: "NYG" } },
                { homeAway: "away", team: { displayName: "Washington Commanders", abbreviation: "WSH" } },
              ],
              broadcasts: [{ market: "national", names: ["Prime Video"] }],
              odds: [{ details: "NYG -2.5", overUnder: 41.5 }],
            },
          ],
        },
      ],
    },
    league,
    "20261112"
  );
  assert.equal(game.kind, "match");
  assert.equal(game.home.abbreviation, "NYG");
  assert.equal(game.odds.details, "NYG -2.5");
  assert.equal(game.networks[0].name, "Prime Video");
});

test("fight cards put the main event first", () => {
  const fighter = (name, record) => ({ athlete: { displayName: name }, records: [{ summary: record }] });
  const [card] = parseEspnScoreboard(
    {
      events: [
        {
          id: 1,
          name: "UFC 334",
          date: "2026-11-14T22:00Z",
          status: { type: { state: "pre" } },
          competitions: [
            { id: "a", type: { abbreviation: "Lightweight" }, competitors: [fighter("Prelim One", "1-0"), fighter("Prelim Two", "2-0")], broadcasts: [{ names: ["ESPN+"] }] },
            { id: "b", type: { abbreviation: "Heavyweight" }, format: { regulation: { periods: 5 } }, competitors: [fighter("Josh Hokit", "10-0-0"), fighter("Ciryl Gane", "14-2-0")], broadcasts: [{ names: ["Paramount+"] }] },
          ],
        },
      ],
    },
    sportsLeaguesById.get("ufc")
  );
  assert.equal(card.kind, "card");
  assert.equal(card.bouts[0].a.name, "Josh Hokit");
  assert.equal(card.bouts[0].rounds, 5);
  assert.deepEqual(card.networks.map(n => n.name).sort(), ["ESPN+", "Paramount+"]);
});

test("racing shows the race result, golf its leaderboard", () => {
  const driver = (name, order) => ({ order, athlete: { displayName: name } });
  const [race] = parseEspnScoreboard(
    {
      events: [
        {
          id: 2,
          name: "São Paulo GP",
          status: { type: { state: "post" } },
          competitions: [
            { type: { abbreviation: "Qual" }, status: { type: { state: "post" } }, competitors: [driver("Pole Sitter", 1)] },
            { type: { abbreviation: "Race" }, status: { type: { state: "post" } }, competitors: [driver("Second", 2), driver("Winner", 1)] },
          ],
        },
      ],
    },
    sportsLeaguesById.get("f1")
  );
  assert.equal(race.leaderboard.session, "Race");
  assert.deepEqual(race.leaderboard.leaders.map(l => l.name), ["Winner", "Second"]);
  assert.equal(race.sessions.length, 2);

  const [golf] = parseEspnScoreboard(
    { events: [{ id: 3, name: "Open", status: { type: { state: "in" } }, competitions: [{ competitors: [driver("B", 2), driver("A", 1)].map((c, i) => ({ ...c, score: i ? "-12" : "-10" })) }] }] },
    sportsLeaguesById.get("pga")
  );
  assert.equal(golf.leaderboard.leaders[0].name, "A");
  assert.equal(golf.leaderboard.leaders[0].score, "-12");
  assert.equal(golf.leaderboard.fieldSize, 2);
  assert.deepEqual(golf.sessions, []);
});

test("tennis keeps singles near the day, main draw first", () => {
  const player = (name, sets, winner) => ({ athlete: { displayName: name }, linescores: sets.map(value => ({ value })), winner });
  const match = (id, date, round, a = "A", b = "B") => ({ id, date, round: { displayName: round }, status: { type: { state: "post" } }, competitors: [player(a, [6, 6], true), player(b, [3, 4], false)] });
  const [event] = parseEspnScoreboard(
    {
      events: [
        {
          id: 4,
          name: "Paris Masters",
          groupings: [
            { grouping: { displayName: "Men's Singles" }, competitions: [match(1, "2026-11-08T14:00Z", "Final"), match(2, "2026-11-01T10:00Z", "Round 1"), match(3, "2026-11-08T09:00Z", "Qualifying 1st Round"), match(5, "2026-11-08T12:00Z", "Final", "TBD", "TBD")] },
            { grouping: { displayName: "Men's Doubles" }, competitions: [match(4, "2026-11-08T11:00Z", "Final")] },
          ],
        },
      ],
    },
    sportsLeaguesById.get("atp"),
    "20261108"
  );
  assert.deepEqual(event.matches.map(m => m.id), ["1"]);
  assert.deepEqual(event.matches[0].a.sets.map(s => s.games), [6, 6]);
  // The browser trims to its own day.
  assert.equal(onDay(event, "20990101"), null);
});

test("TheSportsDB listings get a UTC time and a result", () => {
  const league = sportsLeaguesById.get("boxing");
  const [fight, finished] = parseTsdbEvents(
    {
      events: [
        { idEvent: "1", strEvent: "Kabayel vs Hysa", strTimestamp: "2026-11-28T00:00:00", strVenue: "Merkur Arena", strCity: "Dusseldorf", strStatus: "Not Started" },
        { idEvent: "2", strEvent: "Slalom at Levi", dateEvent: "2026-11-14", strTime: "09:00:00", strResult: "1. Shiffrin", strStatus: "Match Finished" },
        { strEvent: "no id" },
      ],
    },
    league
  );
  assert.equal(fight.start, "2026-11-28T00:00:00Z");
  assert.equal(fight.timeKnown, false, "midnight means the time isn't out yet");
  assert.equal(fight.state, "pre");
  assert.equal(fight.detail, "");
  assert.equal(finished.start, "2026-11-14T09:00:00Z");
  assert.equal(finished.state, "post");
  assert.equal(finished.result, "1. Shiffrin");
  assert.deepEqual(parseTsdbEvents({ events: null }, league), []);
});

test("game summaries give stats, leaders, line and standings", () => {
  const summary = parseSummary({
    boxscore: {
      teams: [
        { homeAway: "home", team: { displayName: "Atlanta Falcons", abbreviation: "ATL" }, statistics: [{ label: "Total Yards", displayValue: "319" }] },
        { homeAway: "away", team: { displayName: "Cincinnati Bengals", abbreviation: "CIN" }, statistics: [{ label: "Total Yards", displayValue: "388" }] },
      ],
    },
    leaders: [{ team: { displayName: "Atlanta Falcons" }, leaders: [{ displayName: "Passing Yards", leaders: [{ displayValue: "162 YDS", athlete: { displayName: "Michael Penix Jr." } }] }] }],
    pickcenter: [
      {
        provider: { name: "DraftKings" },
        details: "CIN -3",
        overUnder: 52.5,
        awayTeamOdds: { moneyLine: -180 },
        homeTeamOdds: { moneyLine: 150 },
        moneyline: { home: { open: { odds: "+185" }, close: { odds: "+150" } }, away: { open: { odds: "-225" }, close: { odds: "-180" } } },
      },
    ],
    standings: { groups: [{ header: "AFC North", standings: { entries: [{ team: "Pittsburgh", id: "23", stats: [{ abbreviation: "W", displayValue: "6" }, { abbreviation: "L", displayValue: "2" }, { abbreviation: "PF", displayValue: "180" }] }] } }] },
    news: { articles: [{ headline: "Trade deadline", links: { web: { href: "https://espn.com/x" } } }] },
    gameInfo: { venue: { fullName: "Mercedes-Benz Stadium", address: { city: "Atlanta" } }, attendance: 70000 },
  });
  assert.deepEqual(summary.teamStats, [{ label: "Total Yards", away: "388", home: "319" }], "away on the left");
  assert.equal(summary.teams[0].abbreviation, "CIN");
  assert.equal(summary.leaders[0].items[0].name, "Michael Penix Jr.");
  assert.equal(summary.odds.awayMoneyline, "-180");
  assert.equal(summary.odds.moneyline.home.open.odds, "+185");
  assert.equal(summary.odds.spread, null);
  assert.deepEqual(summary.standings[0].rows[0].cols, ["W", "L"]);
  assert.equal(summary.news[0].link, "https://espn.com/x");
  assert.equal(summary.venue, "Mercedes-Benz Stadium, Atlanta");
  assert.equal(parsePickcenter(null), null);
  assert.deepEqual(parseSummary({}).leaders, []);
});

console.log(`ScoreFox feeds: ${passed} checks passed.`);
