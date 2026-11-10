// Turns ESPN and TheSportsDB answers into the small shapes ScoreFox draws.
// Shared by the /api/watch/sports function and the tests, so it stays plain
// JavaScript with no browser or Node-only APIs.

import { eventNetworks, networkKey, parseScoreboard } from "../watch/parse.js";

const num = value => (value === null || value === undefined || value === "" || Number.isNaN(Number(value)) ? null : Number(value));
const text = (value, max = 160) => (typeof value === "string" ? value.trim().slice(0, max) : "");

// American odds read best with a sign: +150, -180.
export const signed = value => {
  const n = num(value);
  if (n === null) return "";
  return n > 0 ? `+${n}` : String(n);
};

function statusOf(source) {
  const type = source?.status?.type ?? {};
  return { state: type.state ?? "pre", detail: type.shortDetail ?? type.detail ?? "" };
}

function dedupeNetworks(list) {
  const seen = new Map();
  list.forEach(n => {
    const key = `${networkKey(n.name)}|${n.market}`;
    if (!seen.has(key)) seen.set(key, n);
  });
  return [...seen.values()];
}

const mergeNetworks = competitions => dedupeNetworks(competitions.flatMap(c => eventNetworks(c)));

function person(competitor) {
  const athlete = competitor?.athlete ?? {};
  const roster = competitor?.roster ?? {};
  return {
    name: athlete.displayName || roster.displayName || competitor?.team?.displayName || "TBD",
    short: athlete.shortName || roster.shortDisplayName || athlete.displayName || "TBD",
    flag: athlete.flag?.href ?? null,
    country: athlete.flag?.alt ?? "",
    record: competitor?.records?.[0]?.summary ?? null,
    seed: competitor?.curatedRank?.current && competitor.curatedRank.current < 99 ? competitor.curatedRank.current : null,
    winner: competitor?.winner === true,
  };
}

// ----- Betting lines -----

/** The line ESPN shows on the scoreboard: spread, total and moneylines. */
export function parseOdds(odds) {
  const line = Array.isArray(odds) ? odds[0] : odds;
  if (!line || typeof line !== "object") return null;
  const out = {
    provider: text(line.provider?.displayName || line.provider?.name, 40),
    details: text(line.details, 40),
    overUnder: num(line.overUnder),
    homeMoneyline: signed(line.homeTeamOdds?.moneyLine ?? line.moneyline?.home?.close?.odds),
    awayMoneyline: signed(line.awayTeamOdds?.moneyLine ?? line.moneyline?.away?.close?.odds),
  };
  if (!out.details && out.overUnder === null && !out.homeMoneyline && !out.awayMoneyline) return null;
  return out;
}

const side = s => (s ? { line: text(s.line, 12), odds: text(s.odds, 8) } : null);

/** The full line from a game summary: opening and current numbers. */
export function parsePickcenter(pickcenter) {
  const line = Array.isArray(pickcenter) ? pickcenter[0] : null;
  if (!line) return null;
  const base = parseOdds(line);
  if (!base) return null;
  const pick = (market, a, b) => ({
    [a]: { open: side(line[market]?.[a]?.open), close: side(line[market]?.[a]?.close) },
    [b]: { open: side(line[market]?.[b]?.open), close: side(line[market]?.[b]?.close) },
  });
  return {
    ...base,
    spread: line.pointSpread ? pick("pointSpread", "away", "home") : null,
    moneyline: line.moneyline ? pick("moneyline", "away", "home") : null,
    total: line.total ? pick("total", "over", "under") : null,
  };
}

// ----- Scoreboards -----

function matchEvents(data, league) {
  const byId = new Map((data?.events ?? []).map(e => [String(e.id), e]));
  return parseScoreboard(data, league.id).map(game => {
    const competition = byId.get(game.id)?.competitions?.[0] ?? {};
    return { kind: "match", ...game, odds: parseOdds(competition.odds) };
  });
}

function cardEvents(data, league) {
  return (data?.events ?? []).map(event => {
    const competitions = event.competitions ?? [];
    // ESPN lists the prelims first and the main event last.
    const bouts = [...competitions].reverse().map(c => {
      const [a, b] = c.competitors ?? [];
      return {
        id: String(c.id ?? ""),
        weight: text(c.type?.abbreviation, 40),
        start: c.date ?? event.date ?? null,
        ...statusOf(c),
        a: person(a),
        b: person(b),
        rounds: num(c.format?.regulation?.periods),
      };
    });
    return {
      kind: "card",
      id: String(event.id),
      league: league.id,
      name: text(event.name, 120),
      start: event.date ?? null,
      ...statusOf(event),
      venue: competitions[0]?.venue?.fullName ?? "",
      networks: mergeNetworks(competitions),
      bouts,
    };
  });
}

function fieldEvents(data, league) {
  return (data?.events ?? []).map(event => {
    const competitions = event.competitions ?? [];
    // Racing weekends are several sessions; the race is the one that counts.
    const sessions = competitions.map(c => ({
      name: text(c.type?.abbreviation || c.type?.text, 20),
      start: c.date ?? null,
      ...statusOf(c),
    }));
    const started = competitions.filter(c => statusOf(c).state !== "pre");
    const shown = competitions.find(c => /race/i.test(c.type?.abbreviation ?? "") && statusOf(c).state !== "pre") ?? started.at(-1) ?? competitions[0] ?? {};
    const leaders = [...(shown.competitors ?? [])]
      .sort((x, y) => (num(x.order) ?? 999) - (num(y.order) ?? 999))
      .slice(0, 10)
      .map(c => ({ ...person(c), position: num(c.order), score: text(c.score, 12) }));
    return {
      kind: "field",
      id: String(event.id),
      league: league.id,
      name: text(event.name, 120),
      start: event.date ?? null,
      end: event.endDate ?? null,
      ...statusOf(event),
      venue: competitions[0]?.venue?.fullName ?? event.circuit?.fullName ?? "",
      networks: mergeNetworks(competitions),
      sessions: sessions.length > 1 ? sessions : [],
      leaderboard: { session: sessions.length > 1 ? text(shown.type?.abbreviation, 20) : "", leaders, fieldSize: (shown.competitors ?? []).length },
      link: event.links?.[0]?.href ?? null,
    };
  });
}

// Tennis tournaments run for a week or two; keep the singles matches near
// the asked-for day (the browser trims them to its own local day).
function tennisEvents(data, league, dateKey) {
  const day = dateKey ? Date.UTC(+dateKey.slice(0, 4), +dateKey.slice(4, 6) - 1, +dateKey.slice(6, 8)) : null;
  const near = start => {
    if (day === null) return true;
    const t = Date.parse(start);
    return Number.isFinite(t) && t >= day - 86400000 && t < day + 2 * 86400000;
  };
  return (data?.events ?? [])
    .map(event => {
      const singles = (event.groupings ?? []).filter(g => /singles/i.test(g.grouping?.displayName ?? ""));
      const matches = singles
        .flatMap(g =>
          (g.competitions ?? []).map(c => {
            const [a, b] = c.competitors ?? [];
            const sets = x => (x?.linescores ?? []).map(l => ({ games: num(l.value), tiebreak: num(l.tiebreak) }));
            return {
              id: String(c.id ?? ""),
              draw: text(g.grouping?.displayName, 40),
              round: text(c.round?.displayName, 40),
              start: c.date ?? null,
              ...statusOf(c),
              a: { ...person(a), sets: sets(a) },
              b: { ...person(b), sets: sets(b) },
              networks: eventNetworks(c),
            };
          })
        )
        .filter(m => near(m.start))
        // Matches still waiting on both players aren't worth a row.
        .filter(m => m.a.name !== "TBD" || m.b.name !== "TBD");
      // Qualifying only shows when there's nothing from the main draw.
      const main = matches.filter(m => !/qualif/i.test(m.round));
      return {
        kind: "tennis",
        id: String(event.id),
        league: league.id,
        name: text(event.name, 120),
        start: event.date ?? null,
        end: event.endDate ?? null,
        ...statusOf(event),
        venue: event.venue?.fullName ?? event.venue?.displayName ?? "",
        networks: dedupeNetworks(matches.flatMap(m => m.networks)),
        matches: (main.length ? main : matches).sort((x, y) => Date.parse(x.start) - Date.parse(y.start)).slice(0, 60),
      };
    })
    .filter(e => e.matches.length);
}

/** One ESPN scoreboard answer → ScoreFox events for that league. */
export function parseEspnScoreboard(data, league, dateKey) {
  if (league.kind === "card") return cardEvents(data, league);
  if (league.kind === "field") return fieldEvents(data, league);
  if (league.kind === "tennis") return tennisEvents(data, league, dateKey);
  return matchEvents(data, league);
}

// TheSportsDB times are UTC without a zone, e.g. "2026-11-14T22:00:00".
function tsdbStart(event) {
  const stamp = text(event.strTimestamp, 30);
  if (stamp) return /[zZ]|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : `${stamp}Z`;
  const date = text(event.dateEvent, 10);
  if (!date) return null;
  return `${date}T${text(event.strTime, 8) || "00:00:00"}Z`;
}

const FINISHED = /finish|^ft$|^aet$|final|ended|complete/i;

/** TheSportsDB eventsday answer → ScoreFox listings. */
export function parseTsdbEvents(data, league) {
  return (data?.events ?? [])
    .filter(e => e && e.idEvent)
    .map(e => {
      const status = text(e.strStatus, 40);
      const result = text(e.strResult, 400);
      const finished = FINISHED.test(status) || Boolean(result) || (e.intHomeScore !== null && e.intHomeScore !== undefined && e.intHomeScore !== "");
      const start = tsdbStart(e);
      // A midnight start usually means "time not announced".
      const timeKnown = Boolean(start) && !/T00:00:00/.test(start);
      return {
        kind: "listing",
        id: `tsdb-${e.idEvent}`,
        league: league.id,
        name: text(e.strEvent, 140),
        start,
        timeKnown,
        state: finished ? "post" : "pre",
        detail: finished ? "Final" : status && !/not started|^ns$/i.test(status) ? status : "",
        result,
        venue: [text(e.strVenue, 80), text(e.strCity, 60), text(e.strCountry, 40)].filter(Boolean).join(", "),
        image: text(e.strThumb || e.strPoster, 300) || null,
        networks: text(e.strTVStation, 80) ? [{ name: text(e.strTVStation, 80), kind: "tv", market: "national" }] : [],
      };
    });
}

// ----- Game details -----

const PREFERRED_STANDINGS = ["W", "L", "T", "D", "OTL", "PCT", "GB", "PTS", "GD"];

function standingRows(entries) {
  return (entries ?? []).map(entry => {
    const stats = new Map((entry.stats ?? []).filter(s => s.abbreviation).map(s => [s.abbreviation, s.displayValue]));
    const cols = PREFERRED_STANDINGS.filter(k => stats.has(k));
    return { team: text(entry.team?.displayName || entry.team, 60), id: String(entry.id ?? ""), cols, values: cols.map(k => stats.get(k)) };
  });
}

/** An ESPN game summary → box score, leaders, line, standings and news. */
export function parseSummary(data) {
  const teams = data?.boxscore?.teams ?? [];
  const away = teams.find(t => t.homeAway === "away") ?? teams[0];
  const home = teams.find(t => t.homeAway === "home") ?? teams[1];
  const statsOf = t => new Map((t?.statistics ?? []).map(s => [s.label || s.displayName || s.name, s.displayValue]));
  const awayStats = statsOf(away);
  const homeStats = statsOf(home);
  const labels = [...new Set([...awayStats.keys(), ...homeStats.keys()])].filter(Boolean);
  const teamStats = labels.slice(0, 16).map(label => ({ label: text(label, 40), away: awayStats.get(label) ?? "", home: homeStats.get(label) ?? "" }));

  const leaders = (data?.leaders ?? [])
    .map(group => ({
      team: text(group.team?.displayName, 60),
      abbreviation: text(group.team?.abbreviation, 8),
      logo: group.team?.logo ?? null,
      items: (group.leaders ?? [])
        .map(cat => {
          const top = cat.leaders?.[0];
          if (!top) return null;
          return {
            category: text(cat.displayName, 40),
            name: text(top.athlete?.displayName, 60),
            value: text(top.displayValue, 60),
            headshot: top.athlete?.headshot?.href ?? null,
          };
        })
        .filter(Boolean)
        .slice(0, 5),
    }))
    .filter(g => g.items.length);

  const standings = (data?.standings?.groups ?? [])
    .map(g => ({ header: text(g.header, 80), rows: standingRows(g.standings?.entries) }))
    .filter(g => g.rows.length);

  const news = (data?.news?.articles ?? [])
    .map(a => ({ headline: text(a.headline, 160), link: a.links?.web?.href ?? null }))
    .filter(a => a.headline)
    .slice(0, 3);

  const info = data?.gameInfo ?? {};
  return {
    teams: [away, home].filter(Boolean).map(t => ({ name: text(t.team?.displayName, 60), abbreviation: text(t.team?.abbreviation, 8), logo: t.team?.logo ?? null })),
    teamStats,
    leaders,
    odds: parsePickcenter(data?.pickcenter),
    standings,
    standingsLink: data?.standings?.fullViewLink?.href ?? null,
    news,
    venue: [info.venue?.fullName, info.venue?.address?.city].filter(Boolean).join(", "),
    attendance: num(info.attendance),
  };
}
