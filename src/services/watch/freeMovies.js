// Free movies anyone can watch legally: public domain feature films from
// the Internet Archive (archive.org). Played with the Archive's own embed
// player, straight from the browser (the Archive allows cross-site requests),
// so this needs no key and no server function.

const SEARCH_URL = "https://archive.org/advancedsearch.php";
export const PAGE_SIZE = 36;

// Only films in the Archive's Feature Films collection that are marked
// public domain, released before 1978 (the year US copyright rules changed),
// so later films labelled public domain by mistake stay out.
const BASE_QUERY =
  "collection:feature_films AND mediatype:movies AND licenseurl:*publicdomain* AND year:[1890 TO 1977] AND NOT subject:(exploitation)";

export const FREE_GENRES = [
  { id: "comedy", name: "Comedy", subject: "comedy" },
  { id: "noir", name: "Film noir", subject: "noir" },
  { id: "horror", name: "Horror", subject: "horror" },
  { id: "scifi", name: "Sci-Fi", subject: '"science fiction" OR sci-fi' },
  { id: "western", name: "Western", subject: "western*" },
  { id: "mystery", name: "Mystery", subject: "mystery OR thriller" },
  { id: "drama", name: "Drama", subject: "drama" },
  { id: "romance", name: "Romance", subject: "romance" },
  { id: "war", name: "War", subject: "war" },
  { id: "silent", name: "Silent", subject: "silent" },
];

// Hand-picked, well known public domain films, with clean titles.
export const FREE_PICKS = [
  { id: "Night.Of.The.Living.Dead_1080p", title: "Night of the Living Dead", year: 1968 },
  { id: "his_girl_friday", title: "His Girl Friday", year: 1940 },
  { id: "The_General_Buster_Keaton", title: "The General", year: 1926 },
  { id: "CarnivalofSouls", title: "Carnival of Souls", year: 1962 },
  { id: "Detour", title: "Detour", year: 1945 },
  { id: "The_House_On_Haunted_Hill", title: "House on Haunted Hill", year: 1959 },
  { id: "TheStranger_0", title: "The Stranger", year: 1946 },
  { id: "Nosferatu_DVD_quality", title: "Nosferatu", year: 1922 },
  { id: "meet_john_doe", title: "Meet John Doe", year: 1941 },
  { id: "ScarletStreet", title: "Scarlet Street", year: 1945 },
  { id: "mclintok_widescreen", title: "McLintock!", year: 1963 },
  { id: "royal_wedding", title: "Royal Wedding", year: 1951 },
  { id: "TheLastManOnEarth1964_201808", title: "The Last Man on Earth", year: 1964 },
  { id: "sherlockjr1924_201909", title: "Sherlock Jr.", year: 1924 },
  { id: "angel_and_the_badman", title: "Angel and the Badman", year: 1947 },
  { id: "penny_serenade", title: "Penny Serenade", year: 1941 },
  { id: "kansascityconfidencial", title: "Kansas City Confidential", year: 1952 },
  { id: "charlie_chaplin_film_fest", title: "Charlie Chaplin Festival", year: 1938 },
].map(pick => ({ ...pick, poster: thumbnail(pick.id), pick: true }));

export function thumbnail(id) {
  return `https://archive.org/services/img/${encodeURIComponent(id)}`;
}

export function embedUrl(id) {
  return `https://archive.org/embed/${encodeURIComponent(id)}`;
}

export function pageUrl(id) {
  return `https://archive.org/details/${encodeURIComponent(id)}`;
}

/** The Archive search query for a search and a category. */
export function freeQuery({ text = "", genre = "" } = {}) {
  const parts = [BASE_QUERY];
  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  if (words.length) parts.push(`title:(${words.join(" AND ")})`);
  const found = FREE_GENRES.find(g => g.id === genre);
  if (found) parts.push(`subject:(${found.subject})`);
  return parts.join(" AND ");
}

// Descriptions are HTML written by uploaders: keep the text only.
export function plainText(value) {
  const text = Array.isArray(value) ? value.join(" ") : String(value ?? "");
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// "1:31:44" or "91 min" or "01:31:44" -> minutes.
export function runtimeMinutes(value) {
  const text = String(Array.isArray(value) ? value[0] : value ?? "").trim();
  if (!text) return null;
  const clock = text.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    const [h, m] = clock[3] !== undefined ? [Number(clock[1]), Number(clock[2])] : [0, Number(clock[1])];
    return h * 60 + m || null;
  }
  const minutes = text.match(/(\d+)\s*min/i);
  return minutes ? Number(minutes[1]) : null;
}

// Titles uploaders pad with years and cast: "Charade (1963) Cary Grant..." -> "Charade".
export function cleanTitle(title, year) {
  let text = plainText(title)
    .replace(/[_.]+/g, " ")
    .replace(/\b(ipod|mpeg4?|dvd quality|720p|1080p)\b(\s+version)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (year) text = text.replace(new RegExp(`\\s*[([]?\\s*${year}\\s*[)\\]]?.*$`), "").trim() || text;
  return text;
}

// The same film is often uploaded several times: keep the first (most watched).
export function movieKey(movie) {
  return `${movie.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")}|${movie.year ?? ""}`;
}

export function dedupeMovies(movies, seen = new Set()) {
  return movies.filter(movie => {
    const key = movieKey(movie);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseArchiveDocs(docs = []) {
  return docs
    .filter(doc => doc?.identifier && doc.title)
    .map(doc => {
      const year = Number.parseInt(doc.year, 10) || null;
      return {
        id: doc.identifier,
        title: cleanTitle(doc.title, year),
        year,
        runtime: runtimeMinutes(doc.runtime),
        overview: plainText(doc.description),
        subjects: (Array.isArray(doc.subject) ? doc.subject : doc.subject ? [doc.subject] : []).slice(0, 4),
        poster: thumbnail(doc.identifier),
      };
    });
}

export async function searchFreeMovies({ text = "", genre = "", page = 1, signal } = {}) {
  const params = new URLSearchParams({ q: freeQuery({ text, genre }), rows: String(PAGE_SIZE), page: String(page), output: "json" });
  ["identifier", "title", "year", "runtime", "description", "subject"].forEach(f => params.append("fl[]", f));
  params.append("sort[]", "downloads desc");
  const response = await fetch(`${SEARCH_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("The Internet Archive didn't answer. Try again in a moment.");
  const data = await response.json();
  return { items: dedupeMovies(parseArchiveDocs(data.response?.docs)), total: data.response?.numFound ?? 0 };
}

/** Full details for one film, for picks that only carry a title. */
export async function fetchFreeMovie(id, { signal } = {}) {
  const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}/metadata`, { signal });
  if (!response.ok) throw new Error("Couldn't load this film.");
  const data = await response.json();
  const [movie] = parseArchiveDocs([{ identifier: id, ...data.result }]);
  return movie ?? null;
}
