// Where a provider or network chip links to. Search pages where the service
// has a public one, otherwise its home page.

import { networkKey, normalizeName } from "./parse.js";

const q = encodeURIComponent;

// Matched against the start of the normalized provider name.
const PROVIDERS = [
  ["netflix", t => `https://www.netflix.com/search?q=${q(t)}`],
  ["amazon", t => `https://www.amazon.com/s?k=${q(t)}&i=instant-video`],
  ["primevideo", t => `https://www.amazon.com/s?k=${q(t)}&i=instant-video`],
  ["hulu", t => `https://www.hulu.com/search?q=${q(t)}`],
  ["appletv", t => `https://tv.apple.com/search?term=${q(t)}`],
  ["youtube", t => `https://www.youtube.com/results?search_query=${q(t)}`],
  ["googleplay", t => `https://play.google.com/store/search?q=${q(t)}&c=movies`],
  ["crunchyroll", t => `https://www.crunchyroll.com/search?q=${q(t)}`],
  ["tubi", t => `https://tubitv.com/search/${q(t)}`],
  ["disney+", () => "https://www.disneyplus.com/"],
  ["hbomax", () => "https://www.hbomax.com/"],
  ["max", () => "https://www.hbomax.com/"],
  ["peacock", () => "https://www.peacocktv.com/"],
  ["paramount+", () => "https://www.paramountplus.com/"],
  ["plutotv", () => "https://pluto.tv/"],
  ["therokuchannel", () => "https://therokuchannel.roku.com/"],
  ["fandango", () => "https://athome.fandango.com/"],
  ["vudu", () => "https://athome.fandango.com/"],
  ["starz", () => "https://www.starz.com/"],
  ["amc+", () => "https://www.amcplus.com/"],
  ["philo", () => "https://www.philo.com/"],
  ["sling", () => "https://www.sling.com/"],
  ["fubo", () => "https://www.fubo.tv/"],
  ["youtubetv", () => "https://tv.youtube.com/"],
];

// Unknown providers fall back to the title's TMDB watch page, which links
// straight to each service.
export function providerLink(provider, title, fallback, direct = []) {
  const exact = directLinkFor(provider, direct);
  if (exact) return exact;
  const name = normalizeName(provider.name);
  const match = PROVIDERS.filter(([prefix]) => name.startsWith(prefix)).sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1](title) : fallback ?? null;
}

const NETWORKS = new Map(
  Object.entries({
    "https://www.espn.com/watch/": ["ESPN", "ESPN2", "ESPNU", "ESPNews", "ESPN Deportes", "ESPN+", "ABC", "SEC Network", "ACC Network"],
    "https://www.peacocktv.com/": ["Peacock", "NBC"],
    "https://www.paramountplus.com/": ["Paramount+", "CBS"],
    "https://www.hbomax.com/": ["HBO Max", "Max", "TNT", "TBS", "truTV"],
    "https://www.foxsports.com/live": ["FOX", "FS1", "FS2"],
    "https://www.amazon.com/primevideo": ["Prime Video", "Amazon"],
    "https://tv.apple.com/": ["Apple TV", "MLS Season Pass"],
    "https://www.netflix.com/": ["Netflix"],
    "https://www.youtube.com/": ["YouTube"],
    "https://www.nba.com/watch/league-pass-stream": ["NBA TV", "NBA League Pass"],
    "https://www.mlb.com/live-stream-games": ["MLB Network", "MLB.TV"],
    "https://www.nhl.com/tv": ["NHL Network"],
    "https://www.nfl.com/plus/": ["NFL Network", "NFL+"],
  }).flatMap(([url, names]) => names.map(n => [networkKey(n), url]))
);

export const networkLink = name => NETWORKS.get(networkKey(name)) ?? null;

// ----- Direct links (Watchmode) -----

// Services go by different names in TMDB and Watchmode ("Amazon Prime
// Video" vs "Prime Video", "HBO Max" vs "Max"), so both are reduced to a
// shared key before matching.
const SERVICE_KEYS = [
  [/^(amazon|primevideo)/, "amazon"],
  [/^(hbo)?max/, "max"],
  [/^(appletv|itunes|apple)/, "apple"],
  [/^disney/, "disney"],
  [/^paramount/, "paramount"],
  [/^peacock/, "peacock"],
  [/^youtubetv/, "youtubetv"],
  [/^youtube/, "youtube"],
  [/^(googleplay|google)/, "google"],
  [/^(vudu|fandango)/, "fandango"],
  [/^netflix/, "netflix"],
  [/^hulu/, "hulu"],
  [/^(plutotv|pluto)/, "pluto"],
  [/^(tubi)/, "tubi"],
  [/^(therokuchannel|roku)/, "roku"],
  [/^(starz)/, "starz"],
  [/^(amc\+|amcplus)/, "amc+"],
  [/^(crunchyroll)/, "crunchyroll"],
];

export function serviceKey(name) {
  const plain = normalizeName(name);
  return SERVICE_KEYS.find(([pattern]) => pattern.test(plain))?.[1] ?? plain;
}

// direct: [{ name, url }] from /api/watch/links.
export function directLinkFor(provider, direct = []) {
  if (!direct.length) return null;
  const key = serviceKey(provider.name);
  return direct.find(link => serviceKey(link.name) === key)?.url ?? null;
}

// Watchmode /title/{id}/sources → one link per service, subscription and
// free listings before rentals.
export function parseWatchmodeSources(sources, region) {
  const order = { sub: 0, free: 1, tve: 2, rent: 3, buy: 4 };
  const seen = new Set();
  return (Array.isArray(sources) ? sources : [])
    .filter(s => s && typeof s.web_url === "string" && /^https:\/\//.test(s.web_url) && (!s.region || s.region === region))
    .sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))
    .filter(s => {
      const key = serviceKey(s.name);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(s => ({ name: String(s.name), url: s.web_url }));
}
