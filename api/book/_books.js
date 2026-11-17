// BookFox's book routes (see api/apps/[route].js). Gutendex (gutendex.com)
// indexes all of Project Gutenberg; when it is slow, a book's details come
// from Gutenberg's own catalog record instead. Standard Ebooks' newest
// releases come from its public Atom feed. Book text is fetched from
// Gutenberg (or its PGLAF mirror) or Standard Ebooks and turned into
// reading blocks here, so the browser never runs a stranger's HTML.

import { compactBook, isGutenberg, isStandard, parseBookId, personName, textUrls } from "../../src/services/books/catalog.js";
import { decodeEntities, parseHtml, parseText, splitParts } from "../../src/services/books/parseBook.js";

const GUTENDEX = "https://gutendex.com/books/";
const MIRROR = "https://aleph.pglaf.org";
const UA = { "user-agent": "TheClusterFox-BookFox/1.0" };
const DAY = 86400;

async function get(url, { timeout = 12000, accept = "*/*" } = {}) {
  const res = await fetch(url, { headers: { ...UA, accept }, signal: AbortSignal.timeout(timeout), redirect: "follow" });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return res;
}

function send(res, maxAge, body) {
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 7}`);
  return res.status(200).json(body);
}

const summaryOf = b => ((b.summaries ?? [])[0] ?? "").replace(/\s*\(This is an automatically generated summary\.\)\s*$/, "").trim();
const withSummary = b => ({ ...compactBook(b), summary: summaryOf(b) || undefined });

/** Search all of Project Gutenberg: ?q=words&page=1, or ?ids=1,2,3. */
export async function books(req, res) {
  const q = String(req.query.q ?? "").trim().slice(0, 120);
  const ids = String(req.query.ids ?? "")
    .split(",")
    .map(Number)
    .filter(isGutenberg)
    .slice(0, 32);
  const page = Math.min(500, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
  if (!q && !ids.length) return res.status(400).json({ error: "Search words or book ids are required." });
  const params = new URLSearchParams(ids.length ? { ids: ids.join(",") } : { search: q, page: String(page) });
  const data = await (await get(`${GUTENDEX}?${params}`, { timeout: 20000, accept: "application/json" })).json();
  const list = (data.results ?? []).filter(b => b.media_type === "Text" && !b.copyright);
  return send(res, DAY, { count: data.count ?? list.length, next: Boolean(data.next), page, books: list.map(withSummary) });
}

const tag = (xml, name) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim() : "";
};
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "g"))].map(m => decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim());

/** A Gutenberg book from its RDF catalog record, shaped like Gutendex's. */
async function fromRdf(id) {
  let xml = null;
  for (const url of [`https://www.gutenberg.org/cache/epub/${id}/pg${id}.rdf`, `${MIRROR}/cache/epub/${id}/pg${id}.rdf`]) {
    try {
      xml = await (await get(url, { timeout: 8000 })).text();
      if (xml.includes("dcterms:title")) break;
    } catch {
      xml = null; // try the next copy
    }
  }
  if (!xml || !xml.includes("dcterms:title")) return null;
  const creators = [...xml.matchAll(/<pgterms:agent[\s\S]*?<\/pgterms:agent>/g)].map(m => ({
    name: tag(m[0], "pgterms:name"),
    birth_year: Number(tag(m[0], "pgterms:birthdate")) || null,
    death_year: Number(tag(m[0], "pgterms:deathdate")) || null,
  }));
  const subjects = [...xml.matchAll(/<dcterms:subject>[\s\S]*?<\/dcterms:subject>/g)].map(m => tag(m[0], "rdf:value"));
  const shelves = [...xml.matchAll(/<pgterms:bookshelf>[\s\S]*?<\/pgterms:bookshelf>/g)].map(m => tag(m[0], "rdf:value"));
  const lang = tag(/<dcterms:language>[\s\S]*?<\/dcterms:language>/.exec(xml)?.[0] ?? "", "rdf:value") || "en";
  return {
    id,
    title: tag(xml, "dcterms:title"),
    authors: creators.slice(0, 3),
    subjects,
    bookshelves: shelves,
    languages: [lang],
    copyright: false,
    media_type: "Text",
    formats: xml.includes(".html") ? { "text/html": "" } : {},
    download_count: Number(tag(xml, "pgterms:downloads")) || 0,
    summaries: tags(xml, "pgterms:marc520"),
  };
}

const meta = (html, key) => {
  const m = new RegExp(`<meta[^>]+(?:property|name)="${key}"[^>]*content="([^"]*)"|<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${key}"`).exec(html);
  return m ? decodeEntities(m[1] ?? m[2]).trim() : "";
};

/** A Standard Ebooks book from its page. */
async function fromStandard(id) {
  const html = await (await get(`https://standardebooks.org/ebooks/${id.slice(3)}`, { timeout: 10000 })).text();
  const og = meta(html, "og:title").replace(/\s*-\s*Free ebook download$/i, "");
  const m = /^(.*), by (.*)$/.exec(og);
  const desc = /<section[^>]+id="description"[^>]*>([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";
  const paras = [...desc.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(p => decodeEntities(p[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()).filter(Boolean);
  const subjects = [...html.matchAll(/href="\/subjects\/[^"]+"[^>]*>([^<]+)</g)].map(x => decodeEntities(x[1]).trim());
  return {
    id,
    title: m?.[1] ?? og,
    authors: [m?.[2] ?? "Anonymous"],
    lang: "en",
    downloads: 0,
    subjects: [...new Set(subjects)].slice(0, 5),
    summary: paras.join("\n\n") || meta(html, "schema:abstract") || meta(html, "description"),
    blurb: meta(html, "schema:abstract"),
  };
}

/** One book with its summary: ?id=1342 or ?id=se:author/title. */
export async function book(req, res) {
  const id = parseBookId(req.query.id);
  if (id === null) return res.status(400).json({ error: "A book id is required." });
  if (isStandard(id)) return send(res, DAY, { book: await fromStandard(id) });
  let raw = null;
  try {
    const data = await (await get(`${GUTENDEX}?ids=${id}`, { timeout: 8000, accept: "application/json" })).json();
    raw = data.results?.[0] ?? null;
  } catch {
    // Gutendex is slow now and then; Gutenberg's own record has the same facts.
  }
  raw ??= await fromRdf(id);
  if (!raw) return res.status(404).json({ error: "No such book." });
  return send(res, DAY, { book: withSummary(raw) });
}

/** The newest books from Standard Ebooks. */
export async function standard(req, res) {
  const xml = await (await get("https://standardebooks.org/feeds/atom/new-releases", { accept: "application/atom+xml" })).text();
  const list = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const page = tag(e, "id");
    const path = page.replace(/^https:\/\/standardebooks\.org\/ebooks\//, "");
    const content = decodeEntities(/<content[^>]*>([\s\S]*?)<\/content>/.exec(e)?.[1] ?? "");
    const summary = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(p => decodeEntities(p[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()).join("\n\n");
    const subjects = [...e.matchAll(/<category scheme="https:\/\/standardebooks\.org\/vocab\/subjects" term="([^"]+)"/g)].map(m => decodeEntities(m[1]));
    return {
      id: `se:${path}`,
      title: tag(e, "title"),
      authors: tags(e, "name").map(personName).slice(0, 3),
      lang: "en",
      downloads: 0,
      subjects,
      blurb: tag(e, "summary"),
      summary: summary || tag(e, "summary"),
      added: tag(e, "published").slice(0, 10),
    };
  });
  return send(res, 6 * 3600, { books: list.filter(b => isStandard(b.id)) });
}

/** A book's text as reading blocks, in parts: ?id=1342&part=0. */
export async function bookText(req, res) {
  const id = parseBookId(req.query.id);
  if (id === null) return res.status(400).json({ error: "A book id is required." });
  const part = Math.max(0, Number.parseInt(req.query.part, 10) || 0);
  let parsed = null;
  let from = null;
  let lastError = null;
  for (const url of textUrls(id)) {
    try {
      const r = await get(url, { timeout: 15000 });
      const type = r.headers.get("content-type") ?? "";
      const body = await r.text();
      if (url.endsWith(".txt") || type.startsWith("text/plain")) {
        if (!/START OF (THE|THIS) PROJECT GUTENBERG/i.test(body)) throw new Error("not a book file");
        parsed = parseText(body);
      } else {
        if (!/<body/i.test(body) || /Temporarily Down for Maintenance/i.test(body.slice(0, 2000))) throw new Error("not a book page");
        parsed = parseHtml(body, url);
      }
      from = url;
      if (parsed.blocks.length > 3) break;
    } catch (error) {
      lastError = error;
      parsed = null;
    }
  }
  if (!parsed) return res.status(502).json({ error: `Couldn't load this book's text (${lastError?.message ?? "no copy found"}).` });
  const parts = splitParts(parsed.blocks);
  if (part >= parts.length) return res.status(404).json({ error: "No such part." });
  const offset = parts.slice(0, part).reduce((n, p) => n + p.length, 0);
  return send(res, 30 * DAY, {
    id,
    part,
    parts: parts.length,
    offset,
    total: parsed.blocks.length,
    start: parsed.start,
    end: parsed.end,
    source: from,
    blocks: parts[part],
  });
}
