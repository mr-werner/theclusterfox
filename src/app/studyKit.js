// Small helpers apps use in their studyLink modules to turn the notes they
// already have into StudyFox cards and facts. Plain functions, no React.

/** A short, stable id from text, for material that has no id of its own. */
export function textId(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * "Term: what it means" or "Term (abbr): ..." → { front, back }, when the
 * part before the colon reads like a term. Otherwise null.
 */
export function splitTerm(text) {
  const m = /^([^:.!?]{2,70}):\s+(.{8,})$/s.exec(text.trim());
  if (!m) return null;
  const front = m[1].trim();
  if (front.split(/\s+/).length > 9) return null;
  return { front, back: m[2].trim().replace(/^./, c => c.toUpperCase()) };
}

/**
 * Cards from a table: the first column is the term, the rest are labelled
 * with their column heads. { head: [...], rows: [[...]] }
 */
export function tableCards(table, prefix = "") {
  if (!table?.rows?.length) return [];
  return table.rows.map(row => ({
    id: `t-${textId(prefix + row[0])}`,
    front: prefix ? `${prefix}: ${row[0]}` : row[0],
    back: row
      .slice(1)
      .map((cell, i) => `${table.head[i + 1]}: ${cell}`)
      .join("\n"),
  }));
}

/** Notes → cards where a note names a term, facts for the rest. */
export function notesToStudy(notes, prefix = "") {
  const cards = [];
  const facts = [];
  for (const text of notes) {
    const id = textId(prefix + text);
    const term = splitTerm(text);
    if (term) cards.push({ id: `n-${id}`, ...term });
    else facts.push({ id: `f-${id}`, text });
  }
  return { cards, facts };
}
