// What BookFox shares with StudyFox: one deck per book you've highlighted.
// Each highlight with a note becomes a flashcard (the passage, and your
// note on the back), and every highlight becomes a fill-in-the-blank line.
// StudyFox loads this on demand (see src/app/studyLinks.js) and reads your
// highlights fresh each time, so new ones show up there by themselves.
import { loadData, marksFor } from "../state/bookStore.js";
import { keyWord } from "./text.js";
import { readHref } from "./planLink.js";

const authorOf = b => (b.authors.length ? b.authors.join(", ") : "Anonymous");

export function decks(data = loadData()) {
  const counts = {};
  for (const m of Object.values(data.marks)) if (m.kind === "hl") counts[m.book] = (counts[m.book] ?? 0) + 1;
  return Object.entries(counts).map(([key, n]) => ({
    id: key,
    title: data.books[key]?.title ?? "A book",
    blurb: `${n} highlight${n === 1 ? "" : "s"} from ${authorOf(data.books[key] ?? { authors: [] })}.`,
    group: "Your highlights",
  }));
}

export function deck(id, data = loadData()) {
  const book = data.books[id];
  if (!book) return null;
  const marks = marksFor(data, id, "hl");
  return {
    id,
    title: book.title,
    blurb: `Your highlights and notes from ${book.title}.`,
    href: readHref(id),
    cards: marks
      .filter(m => m.note.trim())
      .map(m => ({ id: m.id, front: m.text.length > 400 ? `${m.text.slice(0, 397)}…` : m.text, back: m.note, href: `${readHref(id)}&at=${m.a[0]}` })),
    facts: marks
      .map(m => ({ m, blank: keyWord(m.text) }))
      .filter(({ m, blank }) => blank && m.text.length <= 500)
      .map(({ m, blank }) => ({ id: `f-${m.id}`, text: m.text, blank })),
    diagrams: [],
  };
}
