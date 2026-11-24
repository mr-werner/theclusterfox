// BookFox checks: node src/features/book/tests/validate.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { compactBook, coverUrls, downloadLinks, GENRES, genresOf, parseBookId, personName, SUMMARY_SHARDS } from "../../../services/books/catalog.js";
import { decodeEntities, parseHtml, parseText, splitParts } from "../../../services/books/parseBook.js";
import { deleteMark, emptyData, logReading, marksFor, minutesOn, normalizeData, openBook, putMark, removeBook, savePlace, shelveBook, streak } from "../state/bookStore.js";
import { blockAtProgress, headingLabel, keyWord, marksInBlock, marksMarkdown, namedSections, progressAt, runs, sectionAt, textOfRange } from "../model/text.js";
import { launchTargets, planItems } from "../model/planLink.js";
import { deck, decks } from "../model/studyLink.js";

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

// ── Catalog ───────────────────────────────────────────────────────────
test("names, ids, covers and downloads", () => {
  assert.equal(personName("Austen, Jane"), "Jane Austen");
  assert.equal(personName("Doyle, Arthur Conan"), "Arthur Conan Doyle");
  assert.equal(personName("Homer"), "Homer");
  assert.equal(parseBookId("1342"), 1342);
  assert.equal(parseBookId("se:jane-austen/pride-and-prejudice"), "se:jane-austen/pride-and-prejudice");
  assert.equal(parseBookId("../etc/passwd"), null);
  assert.equal(parseBookId("se:../x"), null);
  assert.equal(coverUrls(1342).length, 2);
  assert(downloadLinks(1342).every(d => d.href.startsWith("https://www.gutenberg.org/ebooks/1342.")));
  assert(downloadLinks("se:jane-austen/pride-and-prejudice")[0].href.endsWith("/downloads/jane-austen_pride-and-prejudice.epub"));
});

test("a Gutendex book becomes a catalog entry on the right shelves", () => {
  const raw = {
    id: 1661,
    title: "The Adventures of Sherlock Holmes",
    authors: [{ name: "Doyle, Arthur Conan", birth_year: 1859, death_year: 1930 }],
    subjects: ["Detective and mystery stories, English", "Holmes, Sherlock (Fictitious character) -- Fiction", "Short stories, English"],
    bookshelves: ["Category: Classics of Literature", "Category: Mystery Fiction"],
    languages: ["en"],
    formats: { "text/html": "x" },
    download_count: 9000,
  };
  const b = compactBook(raw);
  assert.deepEqual(b.authors, ["Arthur Conan Doyle"]);
  assert.equal(b.life, "1859–1930");
  assert(!b.textOnly);
  const g = genresOf(raw);
  for (const id of ["classics", "mystery", "short"]) assert(g.includes(id), id);
  assert(!g.includes("science"));
});

test("the shipped catalog is sound", () => {
  const cat = JSON.parse(readFileSync(new URL("../../../../public/books/catalog.json", import.meta.url)));
  assert(cat.books.length > 1500, "catalog has plenty of books");
  assert.equal(new Set(cat.books.map(b => b.id)).size, cat.books.length, "ids unique");
  const genreIds = new Set(GENRES.map(g => g.id));
  for (const b of cat.books) {
    assert(Number.isInteger(b.id) && b.title && b.authors.length, `book ${b.id}`);
    for (const g of b.g) assert(genreIds.has(g), `${b.id} genre ${g}`);
  }
  for (const g of GENRES) assert(cat.books.filter(b => b.g.includes(g.id) && b.lang === "en").length >= 12, `${g.id} shelf is full`);
  const shards = readdirSync(new URL("../../../../public/books/sum/", import.meta.url));
  assert.equal(shards.length, SUMMARY_SHARDS);
});

// ── Turning a book into blocks ────────────────────────────────────────
const HTML = `<!DOCTYPE html><html><head><title>x</title><style>p{}</style></head><body>
<section id="pg-header"><h2>The Project Gutenberg eBook of Test</h2><p>Boilerplate</p></section>
<h2><a id="c1"></a><img src="images/one.jpg" alt=""><br>Chapter I.</h2>
<p>It is a truth <i>universally</i> acknowledged&mdash;that a <span class="smcap">single</span> man<span class="pagenum">{2}</span> &amp; more.</p>
<p>Line one<br>line two</p>
<div class="poem"><div class="stanza"><span>Once upon a midnight dreary,</span><br><span>while I pondered</span></div></div>
<blockquote><p>A quote.</p></blockquote>
<hr>
<script>alert(1)</script>
<p onclick="x()">Safe <a href="javascript:alert(1)">link text</a>.</p>
<section id="pg-footer"><p>License</p></section>
</body></html>`;

test("HTML: text, styles, pictures, verse, quotes and the Gutenberg wrapper", () => {
  const { blocks, start, end } = parseHtml(HTML, "https://example.org/cache/epub/1/pg1-images.html");
  assert.equal(blocks[start].t, "img");
  assert.equal(blocks[start].src, "https://example.org/cache/epub/1/images/one.jpg");
  assert.deepEqual(blocks[start + 1], { t: "h", l: 2, x: "Chapter I." });
  const p = blocks[start + 2];
  assert.equal(p.x, "It is a truth universally acknowledged—that a single man & more.");
  assert.deepEqual(p.s, [[14, 25, "i"], [46, 52, "sc"]]);
  assert.equal(p.x.slice(14, 25), "universally");
  assert.equal(blocks[start + 3].x, "Line one\nline two");
  assert.equal(blocks[start + 4].v, 1);
  assert.equal(blocks[start + 4].x, "Once upon a midnight dreary,\nwhile I pondered");
  assert.equal(blocks[start + 5].q, 1);
  assert.equal(blocks[start + 6].t, "hr");
  assert.equal(blocks[start + 7].x, "Safe link text.");
  assert.equal(blocks[end].x, "License");
  assert(!JSON.stringify(blocks).includes("alert"), "scripts never reach the reader");
  assert(!JSON.stringify(blocks).includes("Boilerplate") || start > 0);
});

test("HTML: a heading drawn as a picture is named from its caption", () => {
  const { blocks } = parseHtml('<body><h2><img src="a.png" alt="CHAPTER IV."></h2><p>Text</p></body>', "https://x.org/");
  assert.deepEqual(blocks.slice(0, 2), [{ t: "img", src: "https://x.org/a.png", alt: "CHAPTER IV." }, { t: "h", l: 2, x: "CHAPTER IV." }]);
});

test("entities", () => {
  assert.equal(decodeEntities("&ldquo;Caf&eacute;&rdquo; &#8212; &#x2014; &bogus;"), "“Café” — — &bogus;");
});

test("plain text books", () => {
  const txt = ["Title page", "", "*** START OF THE PROJECT GUTENBERG EBOOK TEST ***", "", "CHAPTER I", "", "It was a dark and stormy night; the rain fell in torrents, except at occasional", "intervals.", "", "Roses are red,", "Violets are blue", "", "*** END OF THE PROJECT GUTENBERG EBOOK TEST ***", "", "License"].join("\r\n");
  const { blocks, start, end } = parseText(txt);
  assert.deepEqual(blocks[start], { t: "h", l: 2, x: "CHAPTER I" });
  assert.equal(blocks[start + 1].x, "It was a dark and stormy night; the rain fell in torrents, except at occasional intervals.");
  assert.equal(blocks[start + 2].v, 1);
  assert(/END OF/.test(blocks[end].x));
});

test("long books come in parts", () => {
  const blocks = Array.from({ length: 1000 }, (_, i) => ({ t: "p", x: `${i} `.repeat(100) }));
  const parts = splitParts(blocks, 50000);
  assert(parts.length > 3);
  assert.equal(parts.flat().length, 1000);
  assert(parts.every(p => JSON.stringify(p).length <= 50000 + 1000));
});

// ── Chapters, progress and runs ───────────────────────────────────────
const BOOK = {
  start: 1,
  end: 9,
  blocks: [
    { t: "p", x: "front" },
    { t: "h", l: 2, x: "I hope Mr. Bingley will like it.\n\nCHAPTER I." },
    { t: "p", x: "One two three four." },
    { t: "img", src: "https://x/a.jpg" },
    { t: "h", l: 2, x: "II" },
    { t: "p", x: "Five six." },
    { t: "p", x: "Seven eight." },
    { t: "h", l: 3, x: "Part" },
    { t: "p", x: "Nine." },
    { t: "p", x: "license" },
  ],
};

test("chapters and contents", () => {
  const s = namedSections(BOOK.blocks);
  assert.deepEqual(s.map(x => [x.from, x.to]), [[0, 1], [1, 3], [3, 7], [7, 10]]);
  assert.equal(s[1].title, "CHAPTER I.");
  assert.equal(s[2].title, "Chapter II", "a picture above a heading stays with it");
  assert.equal(sectionAt(s, 5), 2);
  assert.equal(headingLabel("XII"), "Chapter XII");
  const big = Array.from({ length: 1000 }, () => ({ t: "p", x: "a" }));
  assert(namedSections(big).every(x => x.to - x.from <= 360));
  assert(namedSections(big)[1].continued);
  const framed = namedSections(BOOK.blocks, { start: BOOK.start, end: BOOK.end });
  assert.equal(framed[0].title, "About this edition");
  assert.equal(framed[framed.length - 1].title, "Project Gutenberg license");
  assert.equal(framed[framed.length - 1].from, 9);
});

test("progress", () => {
  assert.equal(progressAt(BOOK, 1), 0);
  assert.equal(progressAt(BOOK, 8), 1);
  assert.equal(blockAtProgress(BOOK, 0.5), 5);
  assert.equal(progressAt(BOOK, 0), 0);
});

test("styles and highlights split text into runs", () => {
  const r = runs("abcdefghij", [[2, 5, "i"]], [{ id: "m", from: 4, to: 8, color: "blue" }]);
  assert.deepEqual(r.map(x => x.text), ["ab", "cd", "e", "fgh", "ij"]);
  assert(r[2].styles.has("i") && r[2].mark.id === "m");
  assert.equal(r.map(x => x.text).join(""), "abcdefghij");
  const marks = [{ id: "a", kind: "hl", a: [2, 4], z: [5, 3], color: "pink" }];
  assert.deepEqual(marksInBlock(marks, 2, 19).map(m => [m.from, m.to, m.last]), [[4, 19, false]]);
  assert.deepEqual(marksInBlock(marks, 5, 9).map(m => [m.from, m.to, m.last]), [[0, 3, true]]);
  assert.equal(marksInBlock(marks, 6, 9).length, 0);
  assert.equal(textOfRange(BOOK.blocks, [2, 4], [5, 4]), "two three four.\n\nII\nFive");
  assert.equal(keyWord("It is a truth universally acknowledged"), "acknowledged");
});

// ── Saved data ────────────────────────────────────────────────────────
const PP = { id: 1342, title: "Pride and Prejudice", authors: ["Jane Austen"] };

test("shelves, places, highlights and reading time", () => {
  let d = emptyData();
  d = shelveBook(d, PP, "want", "2026-11-17T10:00:00Z");
  assert.equal(d.books["1342"].shelf, "want");
  d = openBook(d, PP, "2026-11-17T10:05:00Z");
  assert.equal(d.books["1342"].shelf, "reading");
  d = savePlace(d, "1342", 120, 0.25);
  assert.deepEqual(d.books["1342"].pos, { b: 120 });
  assert.equal(savePlace(d, "1342", 120, 0.25), d, "no change, same object");
  d = putMark(d, { id: "h1", book: "1342", kind: "hl", a: [5, 10], z: [4, 2], color: "green", text: "x", note: "" });
  assert.deepEqual([d.marks.h1.a, d.marks.h1.z], [[4, 2], [5, 10]], "ranges are kept in order");
  d = putMark(d, { ...d.marks.h1, note: "Good line" });
  assert.equal(d.marks.h1.note, "Good line");
  assert(d.marks.h1.edited);
  d = putMark(d, { id: "b1", book: "1342", kind: "bm", a: [2, 0], z: [2, 0], text: "y" });
  assert.deepEqual(marksFor(d, "1342").map(m => m.id), ["b1", "h1"]);
  assert.equal(putMark(d, { id: "x", book: "999", kind: "hl", a: [0, 0], z: [0, 1] }), d, "marks need a book on your shelves");
  d = logReading(d, { day: "2026-11-17", book: "1342", secs: 600, from: 0.2, to: 0.22 });
  d = logReading(d, { day: "2026-11-17", book: "1342", secs: 300, from: 0.22, to: 0.25 });
  assert.equal(d.sessions.length, 1);
  assert.equal(d.sessions[0].from, 0.2);
  assert.equal(d.sessions[0].to, 0.25);
  assert.equal(minutesOn(d, "2026-11-17"), 15);
  d = logReading(d, { day: "2026-11-16", book: "1342", secs: 120, from: 0.1, to: 0.2 });
  assert.equal(streak(d, "2026-11-17"), 2);
  assert.equal(streak(d, "2026-11-18"), 2, "today not read yet keeps yesterday's streak");
  d = deleteMark(d, "b1");
  assert.equal(Object.keys(d.marks).length, 1);
  const again = normalizeData(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(again, d, "survives a round trip through the account");
  d = removeBook(d, "1342");
  assert.equal(Object.keys(d.marks).length, 0, "removing a book removes its notes");
});

test("bad saved data is cleaned up", () => {
  const d = normalizeData({ books: { "../x": { title: "bad" }, 5: { title: "ok", shelf: "nope" } }, marks: { q: { book: "77", a: [1, 1] } }, prefs: { size: 400, theme: "neon" }, sessions: [{ day: "x" }] });
  assert.deepEqual(Object.keys(d.books), ["5"]);
  assert.equal(d.books["5"].shelf, "want");
  assert.equal(Object.keys(d.marks).length, 0);
  assert.equal(d.prefs.size, 32);
  assert.equal(d.prefs.theme, "paper");
  assert.equal(d.sessions.length, 0);
  assert.deepEqual(normalizeData(null), emptyData());
});

// ── TaskFox and StudyFox ──────────────────────────────────────────────
test("TaskFox shows reading days and can open books", () => {
  let d = openBook(emptyData(), PP);
  d = logReading(d, { day: "2026-11-17", book: "1342", secs: 1500, from: 0.12, to: 0.18 });
  d = logReading(d, { day: "2026-11-10", book: "1342", secs: 10, from: 0.1, to: 0.1 });
  const items = planItems(JSON.parse(JSON.stringify(d)), "2026-11-01", "2026-11-30");
  assert.equal(items.length, 1, "a few seconds don't count");
  assert.deepEqual(items[0], { id: "r:2026-11-17:1342", day: "2026-11-17", time: null, title: "Read Pride and Prejudice", detail: "25 min, 12% to 18%", href: "/books?read=1342", action: "Keep reading", done: true });
  assert.deepEqual(planItems(null, "2026-11-01", "2026-11-30"), []);
  const targets = launchTargets(d);
  assert.equal(targets[0].href, "/books");
  assert.equal(targets[1].href, "/books?read=1342");
});

test("StudyFox gets a deck of your highlights", () => {
  let d = openBook(emptyData(), PP);
  d = putMark(d, { id: "h1", book: "1342", kind: "hl", a: [3, 0], z: [3, 60], text: "It is a truth universally acknowledged", note: "The famous first line" });
  d = putMark(d, { id: "h2", book: "1342", kind: "hl", a: [9, 0], z: [9, 20], text: "She is tolerable, but not handsome enough", note: "" });
  assert.deepEqual(decks(d).map(x => [x.id, x.title]), [["1342", "Pride and Prejudice"]]);
  const k = deck("1342", d);
  assert.equal(k.cards.length, 1);
  assert.equal(k.cards[0].back, "The famous first line");
  assert.equal(k.facts.length, 2);
  for (const f of k.facts) assert(f.text.includes(f.blank));
  assert.equal(deck("999", d), null);
  assert(marksMarkdown(PP, Object.values(d.marks)).includes("> It is a truth universally acknowledged"));
});

console.log(`\nBookFox: ${passed} checks passed`);
