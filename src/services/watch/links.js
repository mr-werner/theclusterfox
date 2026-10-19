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
export function providerLink(provider, title, fallback) {
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
