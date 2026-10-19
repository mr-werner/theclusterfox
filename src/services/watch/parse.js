// Pure helpers shared by the /api/watch functions and the WatchFox page.
// TMDB supplies show listings and where they stream (data from JustWatch);
// ESPN's public scoreboard supplies game times and broadcast networks.

export const TMDB_IMAGE = "https://image.tmdb.org/t/p";

export const REGIONS = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "IE", name: "Ireland" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "IN", name: "India" },
];

export const isRegion = code => REGIONS.some(region => region.code === code);

export const normalizeName = name =>
  String(name ?? "")
    .toLowerCase()
    .replace(/\bplus\b/g, "+")
    .replace(/[^a-z0-9+]/g, "");

function cleanProvider(provider) {
  return {
    id: provider.provider_id,
    name: provider.provider_name,
    logo: provider.logo_path ? `${TMDB_IMAGE}/w92${provider.logo_path}` : null,
    priority: provider.display_priority ?? 999,
  };
}

// TMDB lists movie and TV providers separately; merge them by id.
export function mergeProviderLists(...lists) {
  const byId = new Map();
  lists.flat().forEach(provider => {
    if (!provider?.provider_id) return;
    const clean = cleanProvider(provider);
    const seen = byId.get(clean.id);
    if (!seen || clean.priority < seen.priority) byId.set(clean.id, clean);
  });
  return [...byId.values()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

// One region's entry from /{type}/{id}/watch/providers.
export function parseWatchProviders(results, region) {
  const entry = results?.[region];
  if (!entry) return { link: null, stream: [], free: [], rent: [], buy: [] };
  const list = key => mergeProviderLists(entry[key] ?? []);
  return {
    link: entry.link ?? null,
    stream: list("flatrate"),
    free: mergeProviderLists(entry.free ?? [], entry.ads ?? []),
    rent: list("rent"),
    buy: list("buy"),
  };
}

export function parseSearchResult(item) {
  if (item?.media_type !== "movie" && item?.media_type !== "tv") return null;
  const title = item.media_type === "tv" ? item.name : item.title;
  const date = item.media_type === "tv" ? item.first_air_date : item.release_date;
  return {
    id: item.id,
    type: item.media_type,
    title: title || "Untitled",
    year: date ? date.slice(0, 4) : "",
    overview: item.overview ?? "",
    poster: item.poster_path ? `${TMDB_IMAGE}/w185${item.poster_path}` : null,
    popularity: item.popularity ?? 0,
  };
}

// "Netflix Standard with Ads" counts as Netflix, so a picked service
// also matches the other plans and add-on channels named after it.
export function onMyServices(provider, myProviders) {
  const name = normalizeName(provider.name);
  return myProviders.some(mine => mine.id === provider.id || (mine.name && name.startsWith(normalizeName(mine.name))));
}

export function splitByServices(providers, myProviders) {
  const mine = providers.filter(p => onMyServices(p, myProviders));
  return { mine, other: providers.filter(p => !onMyServices(p, myProviders)) };
}

// ----- Sports -----

export const LEAGUES = [
  { id: "nfl", name: "NFL", path: "football/nfl" },
  { id: "cfb", name: "College Football", path: "football/college-football", groups: "80" },
  { id: "nba", name: "NBA", path: "basketball/nba" },
  { id: "wnba", name: "WNBA", path: "basketball/wnba" },
  { id: "cbb", name: "College Basketball", path: "basketball/mens-college-basketball", groups: "50" },
  { id: "mlb", name: "MLB", path: "baseball/mlb" },
  { id: "nhl", name: "NHL", path: "hockey/nhl" },
  { id: "mls", name: "MLS", path: "soccer/usa.1" },
  { id: "epl", name: "Premier League", path: "soccer/eng.1" },
  { id: "ucl", name: "Champions League", path: "soccer/uefa.champions" },
];

export const leaguesById = new Map(LEAGUES.map(league => [league.id, league]));

const BROADCAST = ["ABC", "CBS", "NBC", "FOX", "The CW", "CW", "PBS", "Univision", "Telemundo", "UniMás", "ION"];
const ESPN_NETWORKS = ["ESPN", "ESPN2", "ESPNU", "ESPNews", "ESPN Deportes", "SEC Network", "SECN", "ACC Network", "ACCN", "ESPN+"];
const CABLE = [
  ...ESPN_NETWORKS.filter(n => n !== "ESPN+"),
  "FS1", "FS2", "TNT", "TBS", "truTV", "USA Net", "USA Network", "NFL Network", "NFL Net", "NBA TV",
  "MLB Network", "MLB Net", "NHL Network", "Big Ten Network", "BTN", "CBSSN", "CBS Sports Network",
  "Golf", "Golf Channel", "beIN SPORTS", "FOX Deportes", "TUDN", "Fox Sports 1",
];

// Which networks each service carries. Live TV bundles vary by plan and
// market, so their lists are a close guide rather than a promise.
export const SERVICE_NETWORKS = [
  { key: "netflix", label: "Netflix", match: /^netflix/, networks: ["Netflix"] },
  { key: "prime", label: "Prime Video", match: /^amazon(prime)?video|^primevideo/, networks: ["Prime Video", "Amazon Prime Video", "Amazon"] },
  { key: "peacock", label: "Peacock", match: /^peacock/, networks: ["Peacock", "NBC"] },
  { key: "paramount", label: "Paramount+", match: /^paramount\+/, networks: ["Paramount+", "CBS"] },
  { key: "max", label: "HBO Max", match: /^(hbo)?max$|^hbomax/, networks: ["HBO Max", "Max", "TNT", "TBS", "truTV"] },
  { key: "espn", label: "ESPN", match: /^espn/, networks: ESPN_NETWORKS },
  { key: "apple", label: "Apple TV", match: /^appletv/, networks: ["Apple TV", "Apple TV+", "MLS Season Pass"] },
  { key: "youtube-tv", label: "YouTube TV", match: /^youtubetv/, networks: [...BROADCAST, ...CABLE] },
  { key: "hulu-live", label: "Hulu + Live TV", match: /^hulu\+?livetv/, networks: [...BROADCAST, ...CABLE, "ESPN+"] },
  { key: "fubo", label: "Fubo", match: /^fubo/, networks: [...BROADCAST, ...CABLE.filter(n => !["TNT", "TBS", "truTV"].includes(n))] },
  { key: "sling", label: "Sling TV", match: /^sling/, networks: ["ESPN", "ESPN2", "ESPNU", "SEC Network", "ACC Network", "TNT", "TBS", "truTV", "FS1", "USA Net", "NFL Network", "NBA TV", "NHL Network", "Big Ten Network", "NBC", "FOX"] },
  { key: "directv", label: "DIRECTV STREAM", match: /^directv/, networks: [...BROADCAST, ...CABLE] },
  { key: "antenna", label: "TV antenna (free)", match: /^tvantenna/, networks: BROADCAST },
];

// Extra services for sports that TMDB doesn't list as show providers.
export const LIVE_SERVICES = SERVICE_NETWORKS.filter(s => ["espn", "youtube-tv", "hulu-live", "fubo", "sling", "directv", "antenna"].includes(s.key));

export const networkKey = name =>
  normalizeName(name)
    .replace(/^usanet(work)?$/, "usa")
    .replace(/^(nflnet|nflnetwork)$/, "nfl")
    .replace(/^(mlbnet|mlbnetwork)$/, "mlb")
    .replace(/^(secn|secnetwork)$/, "sec")
    .replace(/^(accn|accnetwork)$/, "acc")
    .replace(/^(btn|bigtennetwork)$/, "btn")
    .replace(/^(cbssn|cbssportsnetwork)$/, "cbssn")
    .replace(/^(foxsports1)$/, "fs1")
    .replace(/^(golfchannel)$/, "golf")
    .replace(/^(thecw)$/, "cw")
    .replace(/^(amazonprimevideo|amazon)$/, "primevideo")
    .replace(/^(appletv\+|mlsseasonpass)$/, "appletv")
    .replace(/^(hbomax)$/, "max");

// Services the viewer picked → the set of network keys they can watch.
// `picked` holds service names (TMDB provider names or live service labels).
export function networksForServices(picked) {
  const keys = new Set();
  picked.forEach(name => {
    const plain = normalizeName(name);
    SERVICE_NETWORKS.filter(s => s.match.test(plain) || normalizeName(s.label) === plain).forEach(service =>
      service.networks.forEach(n => keys.add(networkKey(n)))
    );
  });
  return keys;
}

export const isBroadcastNetwork = name => BROADCAST.some(n => networkKey(n) === networkKey(name));
export const canWatchNetwork = (name, keys) => keys.has(networkKey(name));

function cleanTeam(competitor) {
  const team = competitor?.team ?? {};
  return {
    name: team.displayName || team.name || "TBD",
    short: team.shortDisplayName || team.abbreviation || team.displayName || "TBD",
    abbreviation: team.abbreviation || "",
    logo: team.logo || null,
    score: competitor?.score ?? null,
    record: competitor?.records?.[0]?.summary ?? null,
  };
}

function eventNetworks(competition) {
  const seen = new Map();
  const add = (name, kind, market) => {
    if (!name) return;
    const key = `${networkKey(name)}|${market}`;
    if (!seen.has(key)) seen.set(key, { name, kind, market });
  };
  (competition?.geoBroadcasts ?? []).forEach(item => {
    const kind = String(item?.type?.shortName ?? "TV").toLowerCase();
    if (kind === "radio") return;
    add(item?.media?.shortName, kind === "streaming" ? "streaming" : "tv", String(item?.market?.type ?? "national").toLowerCase());
  });
  if (!seen.size) {
    (competition?.broadcasts ?? []).forEach(item =>
      (item?.names ?? []).forEach(name => add(name, "tv", String(item?.market ?? "national").toLowerCase()))
    );
  }
  // National first, then home and away regional feeds.
  const order = { national: 0, home: 1, away: 2 };
  return [...seen.values()].sort((a, b) => (order[a.market] ?? 3) - (order[b.market] ?? 3));
}

export function parseScoreboard(data, leagueId) {
  return (data?.events ?? []).map(event => {
    const competition = event.competitions?.[0] ?? {};
    const competitors = competition.competitors ?? [];
    const home = competitors.find(c => c.homeAway === "home") ?? competitors[0];
    const away = competitors.find(c => c.homeAway === "away") ?? competitors[1];
    const status = event.status?.type ?? competition.status?.type ?? {};
    return {
      id: String(event.id),
      league: leagueId,
      name: event.name ?? "",
      start: event.date ?? null,
      state: status.state ?? "pre",
      detail: status.shortDetail ?? status.detail ?? "",
      home: cleanTeam(home),
      away: cleanTeam(away),
      venue: competition.venue?.fullName ?? "",
      networks: eventNetworks(competition),
    };
  });
}
