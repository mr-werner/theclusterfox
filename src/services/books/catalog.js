// BookFox's view of a book, shared by the browser and the /api/apps book
// routes. Project Gutenberg books keep their Gutenberg number as the id;
// Standard Ebooks keep their path ("se:jane-austen/pride-and-prejudice").
// Plain functions, no React, so the API and the build script use them too.

export const SUMMARY_SHARDS = 32;

const GUTENBERG = "https://www.gutenberg.org";
const MIRROR = "https://aleph.pglaf.org";

/** The genre shelves, in the order the store shows them. */
export const GENRES = [
  { id: "classics", name: "Great classics", blurb: "The books on every best-ever list." },
  { id: "mystery", name: "Mystery & detective", blurb: "Holmes, Poirot's elders, and a great many locked rooms." },
  { id: "adventure", name: "Adventure", blurb: "Sea voyages, lost worlds, westerns and treasure." },
  { id: "scifi", name: "Science fiction", blurb: "Wells, Verne and the pulps that started it all." },
  { id: "fantasy", name: "Fantasy & fairy tales", blurb: "Oz, Wonderland, Grimm and Andersen." },
  { id: "horror", name: "Horror & gothic", blurb: "Dracula, Frankenstein, Poe and ghost stories." },
  { id: "romance", name: "Love stories", blurb: "Austen, the Brontës and courtships of every kind." },
  { id: "children", name: "For young readers", blurb: "Stories written for children, loved by everyone." },
  { id: "humor", name: "Humor & satire", blurb: "Twain, Wodehouse, Swift and Jerome K. Jerome." },
  { id: "short", name: "Short stories", blurb: "Something you can finish tonight." },
  { id: "poetry", name: "Poetry", blurb: "Epics, sonnets and verse." },
  { id: "drama", name: "Plays", blurb: "Shakespeare, Wilde, Ibsen and the Greeks." },
  { id: "philosophy", name: "Philosophy & ideas", blurb: "Plato to Nietzsche, Stoics to Thoreau." },
  { id: "history", name: "History & biography", blurb: "Lives, wars and empires, told by those who were nearer to them." },
  { id: "science", name: "Science & nature", blurb: "Darwin, Faraday and the naturalists." },
  { id: "myth", name: "Myths & legends", blurb: "Gods, heroes and the stories under all the others." },
];
export const genreById = new Map(GENRES.map(g => [g.id, g]));

const RULES = [
  ["classics", /best books ever|harvard classics|classics of literature/i],
  ["mystery", /detective|mystery|crime|murder|sherlock/i],
  ["adventure", /adventure|sea stories|pirates|western stories|voyages|survival|treasure/i],
  ["scifi", /science fiction|time travel|interplanetary|mars \(planet\)/i],
  ["fantasy", /fantasy|fairy tales|fairies|magic|oz \(imaginary/i],
  ["horror", /horror|ghost|gothic|vampire|supernatural|monsters/i],
  ["romance", /love stories|romance|courtship/i],
  ["children", /juvenile|children/i],
  ["humor", /humor|humour|satire|wit and/i],
  ["short", /short stories/i],
  ["poetry", /poetry|poems|sonnets|epic/i],
  ["drama", /drama|plays|tragedies|comedies|theater/i],
  ["philosophy", /philosophy|ethics|stoic|political science|psychology|metaphysics/i],
  ["history", /history|biography|autobiograph|memoir|war,|world war|civil war/i],
  ["science", /science|mathematics|natural history|astronomy|biology|evolution|physics|chemistry/i],
  ["myth", /mythology|legends|folklore|arthurian|epic poetry/i],
];

/** Genre ids for a Gutendex book, from its subjects and bookshelves. */
export function genresOf(b) {
  const subjects = (b.subjects ?? []).join(" | ");
  const shelves = (b.bookshelves ?? []).join(" | ");
  const all = `${subjects} | ${shelves}`;
  const fiction = /fiction|stories|tales|novel|romance/i.test(all);
  const out = [];
  for (const [id, re] of RULES) {
    if (!re.test(all)) continue;
    // Non-fiction shelves skip novels that only mention the topic.
    if ((id === "science" || id === "history" || id === "philosophy") && fiction && !re.test(shelves)) continue;
    out.push(id);
  }
  return out;
}

/** "Austen, Jane" -> "Jane Austen", "Doyle, Arthur Conan" -> "Arthur Conan Doyle". */
export function personName(name) {
  const clean = String(name ?? "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const m = /^([^,]+),\s*(.+)$/.exec(clean);
  return (m ? `${m[2]} ${m[1]}` : clean).replace(/\s+/g, " ").trim();
}

const years = p => (p.birth_year || p.death_year ? `${p.birth_year ?? "?"}–${p.death_year ?? ""}` : "");

/** A Gutendex book as BookFox keeps it (without the summary). */
export function compactBook(b) {
  const authors = (b.authors ?? []).map(p => personName(p.name)).filter(Boolean);
  const subjects = [...new Set((b.subjects ?? []).map(s => s.replace(/\s*--\s*Fiction$/i, "").replace(/\s*--\s*/g, ": ").trim()))].slice(0, 5);
  const out = {
    id: b.id,
    title: String(b.title ?? "Untitled").replace(/\s*\r?\n\s*/g, ": ").replace(/\$/g, "").trim(),
    authors: authors.length ? authors : ["Anonymous"],
    lang: (b.languages ?? ["en"])[0],
    downloads: b.download_count ?? 0,
    subjects,
  };
  const life = (b.authors ?? [])[0] ? years(b.authors[0]) : "";
  if (life) out.life = life;
  const tr = (b.translators ?? []).map(p => personName(p.name)).filter(Boolean);
  if (tr.length) out.translators = tr.slice(0, 3);
  if (!b.formats?.["text/html"] && !Object.keys(b.formats ?? {}).some(k => k.startsWith("text/html"))) out.textOnly = true;
  return out;
}

export const isGutenberg = id => Number.isInteger(id) && id > 0 && id < 1e7;
export const isStandard = id => typeof id === "string" && /^se:[a-z0-9-]+(\/[a-z0-9-]+){1,4}$/.test(id);

/** Parse an id from a URL parameter: "1342" -> 1342, "se:..." stays. */
export function parseBookId(raw) {
  const s = String(raw ?? "").trim();
  if (/^\d{1,7}$/.test(s)) return Number(s);
  return isStandard(s) ? s : null;
}

/** Cover images to try, best first. */
export function coverUrls(id, size = "medium") {
  if (isStandard(id)) return [`https://standardebooks.org/ebooks/${id.slice(3)}/downloads/cover-thumbnail.jpg`];
  if (!isGutenberg(id)) return [];
  return [`${GUTENBERG}/cache/epub/${id}/pg${id}.cover.${size}.jpg`, `${MIRROR}/cache/epub/${id}/pg${id}.cover.${size}.jpg`];
}

/** Files to download to a phone or computer. */
export function downloadLinks(id) {
  if (isStandard(id)) {
    const path = id.slice(3);
    const file = path.replace("/", "_").replace(/\//g, "_");
    const base = `https://standardebooks.org/ebooks/${path}/downloads/${file}`;
    return [
      { kind: "epub", label: "EPUB", note: "Apple Books, Google Play Books, most readers", href: `${base}.epub` },
      { kind: "kindle", label: "Kindle", note: "AZW3 for Kindle", href: `${base}.azw3` },
      { kind: "kobo", label: "Kobo", note: "Kepub for Kobo readers", href: `${base}.kepub.epub` },
    ];
  }
  return [
    { kind: "epub", label: "EPUB", note: "Apple Books, Google Play Books, most readers", href: `${GUTENBERG}/ebooks/${id}.epub3.images` },
    { kind: "kindle", label: "Kindle", note: "For Kindle devices and apps", href: `${GUTENBERG}/ebooks/${id}.kf8.images` },
    { kind: "txt", label: "Plain text", note: "Opens anywhere", href: `${GUTENBERG}/ebooks/${id}.txt.utf-8` },
  ];
}

/** The book's page at its source. */
export function sourceUrl(id) {
  if (isStandard(id)) return `https://standardebooks.org/ebooks/${id.slice(3)}`;
  return `${GUTENBERG}/ebooks/${id}`;
}

export const sourceName = id => (isStandard(id) ? "Standard Ebooks" : "Project Gutenberg");

/** Where the readable HTML lives, in the order to try. */
export function textUrls(id) {
  if (isStandard(id)) return [`https://standardebooks.org/ebooks/${id.slice(3)}/text/single-page`];
  return [
    `${GUTENBERG}/cache/epub/${id}/pg${id}-images.html`,
    `${MIRROR}/cache/epub/${id}/pg${id}-images.html`,
    `${GUTENBERG}/cache/epub/${id}/pg${id}.txt`,
    `${MIRROR}/cache/epub/${id}/pg${id}.txt`,
  ];
}

export const authorLine = b => (b?.authors?.length ? b.authors.join(", ") : "Anonymous");
