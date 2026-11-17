// Working with a book's reading blocks: chapters, the contents list, how
// far along a place is, and how styling and highlights split a paragraph
// into runs. Plain functions, no React, so the tests run them in Node.

const ROMAN = /^(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})\.?$/i;
const MAX_SECTION = 360;

/** A heading's text for the contents list: its last line, tidied. */
export function headingLabel(text) {
  const lines = String(text ?? "")
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
  let label = (lines[lines.length - 1] ?? "").replace(/\s+/g, " ");
  // A chapter numbered only "XII" reads better as "Chapter XII".
  if (ROMAN.test(label) || /^\d{1,3}\.?$/.test(label)) label = `Chapter ${label.replace(/\.$/, "")}`;
  if (lines.length > 1 && label.length < 4) label = lines.join(" ");
  return label.length > 90 ? `${label.slice(0, 87)}…` : label;
}

/**
 * Chapters: [{ from, to, title, level }]. A chapter starts at each heading of
 * level 1-3; very long stretches split at section breaks so a page never
 * has to draw thousands of paragraphs at once.
 */
export function sections(blocks, { start = 0, end = blocks.length } = {}) {
  const cuts = [0];
  // The source's own front and back matter (Gutenberg's header and
  // license) get chapters of their own, so a new book opens on its text.
  const fixed = new Set([start, end].filter(i => i > 0 && i < blocks.length));
  blocks.forEach((b, i) => {
    if (fixed.has(i) && i > cuts[cuts.length - 1]) {
      cuts.push(i);
      return;
    }
    if (i > 0 && b.t === "h" && b.l <= 3 && blocks[i - 1]?.t !== "h") {
      // Keep a picture placed just above its heading with that heading.
      let at = i;
      while (at > 0 && blocks[at - 1].t === "img" && at > cuts[cuts.length - 1] + 1) at -= 1;
      if (at > cuts[cuts.length - 1]) cuts.push(at);
    }
  });
  cuts.push(blocks.length);
  const out = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    let from = cuts[k];
    const to = cuts[k + 1];
    while (to - from > MAX_SECTION) {
      // Prefer a section break, else a paragraph boundary.
      let cut = from + MAX_SECTION;
      for (let i = from + MAX_SECTION; i > from + MAX_SECTION / 2; i--) {
        if (blocks[i]?.t === "hr") {
          cut = i + 1;
          break;
        }
      }
      out.push({ from, to: cut });
      from = cut;
    }
    out.push({ from, to });
  }
  return out.map((s, i) => {
    if (start > 0 && s.from === 0) return { ...s, title: "About this edition", level: 9, extra: true };
    if (end < blocks.length && s.from >= end) return { ...s, title: s.from === end ? "Project Gutenberg license" : null, level: 9, extra: true };
    const h = blocks.slice(s.from, Math.min(s.to, s.from + 4)).find(b => b.t === "h");
    const prev = out[i - 1];
    return { ...s, title: h ? headingLabel(h.x) : prev ? null : "Beginning", level: h?.l ?? 9 };
  });
}

/** Fill in the names of untitled chapters ("Chapter III, continued"). */
export function namedSections(blocks, bounds) {
  const list = sections(blocks, bounds);
  let last = "Beginning";
  return list.map((s, i) => {
    if (s.extra && s.title) return s;
    if (s.title) {
      last = s.title;
      return s;
    }
    if (list[i - 1]?.extra && !s.extra) return { ...s, title: "Opening pages" };
    return { ...s, title: `${last} (continued)`, continued: true };
  });
}

/** The chapter that holds block b. */
export function sectionAt(list, b) {
  let lo = 0;
  let hi = list.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (list[mid].from <= b) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** How far through the book block b is, 0..1, counting only the book's own text. */
export function progressAt(book, b) {
  const start = book.start ?? 0;
  const end = book.end ?? book.blocks.length;
  if (end <= start + 1) return 0;
  return Math.min(1, Math.max(0, (b - start) / (end - 1 - start)));
}

/** The block a share of the way through the book. */
export function blockAtProgress(book, p) {
  const start = book.start ?? 0;
  const end = book.end ?? book.blocks.length;
  return Math.round(start + Math.min(1, Math.max(0, p)) * Math.max(0, end - 1 - start));
}

/** Words from a block on, for "minutes left". */
export function wordsBetween(blocks, from, to) {
  let n = 0;
  for (let i = from; i < to && i < blocks.length; i++) {
    const x = blocks[i].x;
    if (x) n += x.split(/\s+/).length;
  }
  return n;
}

export const WORDS_PER_MINUTE = 240;

export function minutesLabel(words) {
  const mins = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * Split a block's text into runs by styling and highlights.
 * styles: [[start, end, kind]]; marks: [{ id, from, to, color, note }].
 * Returns [{ text, from, to, styles: Set, mark }] in order. Where highlights
 * overlap, the later one shows.
 */
export function runs(text, styles = [], marks = []) {
  const len = text.length;
  const cuts = new Set([0, len]);
  for (const [a, b] of styles) {
    cuts.add(Math.max(0, Math.min(len, a)));
    cuts.add(Math.max(0, Math.min(len, b)));
  }
  for (const m of marks) {
    cuts.add(Math.max(0, Math.min(len, m.from)));
    cuts.add(Math.max(0, Math.min(len, m.to)));
  }
  const points = [...cuts].sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (to <= from) continue;
    const kinds = new Set(styles.filter(([a, b]) => a <= from && b >= to).map(s => s[2]));
    let mark = null;
    for (const m of marks) if (m.from <= from && m.to >= to) mark = m;
    out.push({ text: text.slice(from, to), from, to, styles: kinds, mark });
  }
  return out;
}

/**
 * The part of each highlight that falls in block b, as { id, from, to,
 * color, note, last } where last marks the run a note icon follows.
 */
export function marksInBlock(marks, b, length) {
  const out = [];
  for (const m of marks) {
    if (m.kind !== "hl" || m.a[0] > b || m.z[0] < b) continue;
    const from = m.a[0] === b ? m.a[1] : 0;
    const to = m.z[0] === b ? m.z[1] : length;
    if (to > from) out.push({ id: m.id, from, to, color: m.color, note: m.note, last: m.z[0] === b });
  }
  return out;
}

/** The quoted text of a range, for a highlight's label. */
export function textOfRange(blocks, a, z) {
  const parts = [];
  for (let b = a[0]; b <= z[0] && b < blocks.length; b++) {
    const x = blocks[b]?.x ?? "";
    parts.push(x.slice(b === a[0] ? a[1] : 0, b === z[0] ? z[1] : x.length));
  }
  return parts.join("\n").replace(/[ \t]+/g, " ").trim();
}

/** A word to blank out of a highlight for fill-in-the-blank practice. */
export function keyWord(text) {
  const words = String(text).match(/[A-Za-z][A-Za-z'’-]{5,}/g) ?? [];
  const common = new Set(["through", "though", "without", "himself", "herself", "themselves", "another", "something", "nothing", "everything", "should", "would", "could", "before", "always"]);
  const pick = words.filter(w => !common.has(w.toLowerCase())).sort((p, q) => q.length - p.length)[0];
  return pick ?? null;
}

/** A book's highlights and notes as Markdown, for saving or sharing. */
export function marksMarkdown(book, marks) {
  const author = book.authors?.length ? book.authors.join(", ") : "Anonymous";
  const lines = [`# ${book.title}`, `*${author}*`, ""];
  for (const m of marks) {
    if (m.kind === "bm") {
      lines.push(`- Bookmark: ${m.label || m.text.slice(0, 80)}`, "");
      continue;
    }
    lines.push(...m.text.split("\n").map(l => `> ${l}`));
    if (m.note) lines.push("", m.note);
    lines.push("");
  }
  return lines.join("\n");
}
