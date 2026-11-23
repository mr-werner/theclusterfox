// Builds BookFox's starter catalog: the most-read Project Gutenberg books,
// with their summaries, sorted onto genre shelves. BookFox shows these
// instantly (and offline); search still reaches all 75,000+ books live.
//
//   node scripts/books/build-catalog.mjs [pages=100]
//
// Writes public/books/catalog.json (the shelves) and public/books/sum/NN.json
// (summaries, split into 32 files by id so a book page loads one small file).
// Data from Gutendex (gutendex.com), a free JSON index of Project Gutenberg.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compactBook, genresOf, SUMMARY_SHARDS } from "../../src/services/books/catalog.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "public/books");
const PAGES = Number(process.argv[2] ?? 100);

async function page(n, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://gutendex.com/books/?page=${n}`, { signal: AbortSignal.timeout(120000) });
      if (res.ok) return (await res.json()).results;
      console.warn(`page ${n}: ${res.status}`);
    } catch (e) {
      console.warn(`page ${n}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error(`page ${n} failed`);
}

const raw = [];
// One page at a time: Gutendex is a free, volunteer-run service.
for (let n = 1; n <= PAGES; n++) {
  raw.push(...(await page(n)));
  process.stdout.write(`\r${raw.length} books`);
}
console.log();

const seen = new Set();
const books = [];
const summaries = Array.from({ length: SUMMARY_SHARDS }, () => ({}));
for (const b of raw) {
  if (seen.has(b.id) || b.media_type !== "Text" || b.copyright) continue;
  seen.add(b.id);
  const c = compactBook(b);
  books.push({ ...c, g: genresOf(b) });
  const s = (b.summaries ?? [])[0];
  if (s) summaries[b.id % SUMMARY_SHARDS][b.id] = s.replace(/\s*\(This is an automatically generated summary\.\)\s*$/, "");
}

mkdirSync(join(OUT, "sum"), { recursive: true });
writeFileSync(join(OUT, "catalog.json"), JSON.stringify({ built: new Date().toISOString().slice(0, 10), books }));
summaries.forEach((s, i) => writeFileSync(join(OUT, "sum", `${String(i).padStart(2, "0")}.json`), JSON.stringify(s)));
const counts = {};
for (const b of books) for (const g of b.g) counts[g] = (counts[g] ?? 0) + 1;
console.log(`${books.length} books`, counts);
