// Every league ScoreFox can follow, grouped by sport.
//
// source "espn": ESPN's public site API (no key). `path` is the sport/league
// part of site.api.espn.com/apis/site/v2/sports/<path>/scoreboard.
// source "tsdb": TheSportsDB's free API, for sports ESPN doesn't cover
// (boxing, skiing, biathlon...). `tsdb` is TheSportsDB's league id.
//
// kind says how an event is shaped, so the schedule can draw it:
//   match  - two teams or players, one score each (most team sports)
//   card   - a fight night: many bouts under one event (UFC, PFL)
//   field  - a tournament or race with a leaderboard (golf, racing)
//   tennis - a tournament made of many matches
//   listing - an event with a name, time and result only (TheSportsDB)

export const SPORTS = [
  { id: "football", name: "Football" },
  { id: "basketball", name: "Basketball" },
  { id: "baseball", name: "Baseball" },
  { id: "hockey", name: "Hockey" },
  { id: "soccer", name: "Soccer" },
  { id: "fighting", name: "Fighting" },
  { id: "golf", name: "Golf" },
  { id: "tennis", name: "Tennis" },
  { id: "racing", name: "Racing" },
  { id: "winter", name: "Winter sports" },
  { id: "more", name: "More sports" },
];

const espn = (id, name, sport, path, extra = {}) => ({ id, name, sport, source: "espn", path, kind: "match", ...extra });
const tsdb = (id, name, sport, leagueId, extra = {}) => ({ id, name, sport, source: "tsdb", tsdb: leagueId, kind: "listing", ...extra });

export const SPORTS_LEAGUES = [
  // Football
  espn("nfl", "NFL", "football", "football/nfl"),
  espn("cfb", "College Football", "football", "football/college-football", { groups: "80" }),
  espn("cfl", "CFL", "football", "football/cfl"),
  espn("ufl", "UFL", "football", "football/ufl"),

  // Basketball
  espn("nba", "NBA", "basketball", "basketball/nba"),
  espn("wnba", "WNBA", "basketball", "basketball/wnba"),
  espn("cbb", "College Basketball", "basketball", "basketball/mens-college-basketball", { groups: "50" }),
  espn("wcbb", "Women's College Basketball", "basketball", "basketball/womens-college-basketball", { groups: "50" }),
  espn("gleague", "NBA G League", "basketball", "basketball/nba-development"),

  // Baseball
  espn("mlb", "MLB", "baseball", "baseball/mlb"),
  espn("cbase", "College Baseball", "baseball", "baseball/college-baseball"),

  // Hockey
  espn("nhl", "NHL", "hockey", "hockey/nhl"),
  espn("chockey", "College Hockey", "hockey", "hockey/mens-college-hockey"),

  // Soccer
  espn("mls", "MLS", "soccer", "soccer/usa.1"),
  espn("nwsl", "NWSL", "soccer", "soccer/usa.nwsl"),
  espn("epl", "Premier League", "soccer", "soccer/eng.1"),
  espn("laliga", "LALIGA", "soccer", "soccer/esp.1"),
  espn("seriea", "Serie A", "soccer", "soccer/ita.1"),
  espn("bundesliga", "Bundesliga", "soccer", "soccer/ger.1"),
  espn("ligue1", "Ligue 1", "soccer", "soccer/fra.1"),
  espn("ligamx", "Liga MX", "soccer", "soccer/mex.1"),
  espn("eredivisie", "Eredivisie", "soccer", "soccer/ned.1"),
  espn("primeira", "Primeira Liga", "soccer", "soccer/por.1"),
  espn("efl", "EFL Championship", "soccer", "soccer/eng.2"),
  espn("facup", "FA Cup", "soccer", "soccer/eng.fa"),
  espn("ucl", "Champions League", "soccer", "soccer/uefa.champions"),
  espn("uel", "Europa League", "soccer", "soccer/uefa.europa"),
  espn("worldcup", "World Cup", "soccer", "soccer/fifa.world"),

  // Fighting
  espn("ufc", "UFC", "fighting", "mma/ufc", { kind: "card" }),
  espn("pfl", "PFL", "fighting", "mma/pfl", { kind: "card" }),
  tsdb("boxing", "Boxing", "fighting", "4445"),
  tsdb("bkfc", "Bare Knuckle (BKFC)", "fighting", "4567"),
  tsdb("wwe", "WWE", "fighting", "4444"),

  // Golf
  espn("pga", "PGA Tour", "golf", "golf/pga", { kind: "field" }),
  espn("lpga", "LPGA", "golf", "golf/lpga", { kind: "field" }),
  espn("liv", "LIV Golf", "golf", "golf/liv", { kind: "field" }),
  espn("dpworld", "DP World Tour", "golf", "golf/eur", { kind: "field" }),

  // Tennis
  espn("atp", "ATP (men)", "tennis", "tennis/atp", { kind: "tennis" }),
  espn("wta", "WTA (women)", "tennis", "tennis/wta", { kind: "tennis" }),

  // Racing
  espn("f1", "Formula 1", "racing", "racing/f1", { kind: "field" }),
  espn("nascar", "NASCAR Cup", "racing", "racing/nascar-premier", { kind: "field" }),
  espn("indycar", "IndyCar", "racing", "racing/irl", { kind: "field" }),
  tsdb("formulae", "Formula E", "racing", "4371"),

  // Winter sports
  tsdb("alpine", "Alpine Ski World Cup", "winter", "5625"),
  tsdb("xcski", "Cross-Country Ski World Cup", "winter", "5722"),
  tsdb("biathlon", "Biathlon World Cup", "winter", "5342"),

  // More
  espn("pll", "Premier Lacrosse League", "more", "lacrosse/pll"),
  espn("nll", "National Lacrosse League", "more", "lacrosse/nll"),
  espn("clax", "College Lacrosse", "more", "lacrosse/mens-college-lacrosse"),
  espn("cvolley", "Women's College Volleyball", "more", "volleyball/womens-college-volleyball"),
  espn("afl", "AFL (Aussie rules)", "more", "australian-football/afl"),
];

export const sportsLeaguesById = new Map(SPORTS_LEAGUES.map(league => [league.id, league]));

export const leaguesForSport = sport => SPORTS_LEAGUES.filter(league => league.sport === sport);
