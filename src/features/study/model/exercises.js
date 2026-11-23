// Turns one deck of linked material into the ways StudyFox can practice
// it: flashcards, multiple choice, fill in the blank, matching, sorting,
// practical problems and interactive diagrams. Pure functions with a seed,
// so a round can be rebuilt and tested.

// ── Randomness ──────────────────────────────────────────────────────────
export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, r = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

// ── The modes ───────────────────────────────────────────────────────────
export const MODES = [
  { id: "flash", name: "Flashcards", blurb: "Flip, then say how well you knew it. Feeds your spaced review." },
  { id: "quiz", name: "Multiple choice", blurb: "Pick the best answer and see why." },
  { id: "fill", name: "Fill in the blank", blurb: "Type the missing word or number." },
  { id: "match", name: "Matching", blurb: "Pair each term with what it means." },
  { id: "sort", name: "Sorting", blurb: "Drop each one into its category." },
  { id: "problems", name: "Practical problems", blurb: "Work a real problem with fresh numbers." },
  { id: "diagrams", name: "Interactive diagrams", blurb: "Play with it in the app it came from." },
];

const groupsOf = deck => [...new Set((deck.cards ?? []).map(c => c.group).filter(Boolean))];

/** How many of each kind of practice a deck has: { flash, quiz, fill, match, sort, problems, diagrams }. */
export function modeCounts(deck) {
  if (!deck) return {};
  const cards = deck.cards?.length ?? 0;
  const questions = deck.questions?.length ?? 0;
  const fill = fillItems(deck, 1).length;
  return {
    flash: cards + (cards < 4 ? questions : 0),
    quiz: questions + (cards >= 4 ? cards : 0),
    fill,
    match: cards >= 4 ? cards : 0,
    sort: groupsOf(deck).length >= 2 ? deck.cards.filter(c => c.group).length : 0,
    problems: deck.problems ? Infinity : 0,
    diagrams: deck.diagrams?.length ?? 0,
  };
}

/** The first line of a card's back, trimmed for small spaces. */
export function shortBack(text, max = 150) {
  const line = String(text).split("\n").find(l => l.trim()) ?? "";
  return line.length > max ? `${line.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : line;
}

// ── Flashcards ──────────────────────────────────────────────────────────
/** [{ key, front, back, href }] in deck order. Questions stand in when a deck has few cards. */
export function flashItems(deck) {
  const cards = (deck.cards ?? []).map(c => ({ key: `c:${c.id}`, front: c.front, back: c.back, href: c.href }));
  if (cards.length >= 4) return cards;
  return [...cards, ...(deck.questions ?? []).map(q => ({ key: `q:${q.id}`, front: q.text, back: `${q.choices[q.answer]}${q.why ? `\n\n${q.why}` : ""}` }))];
}

// ── Multiple choice ─────────────────────────────────────────────────────
/** A question with its choices shuffled: { key, text, choices, answer, why }. */
export function shuffleQuestion(q, r, key = `q:${q.id}`) {
  const order = shuffle(q.choices.map((_, i) => i), r);
  return { key, text: q.text, choices: order.map(i => q.choices[i]), answer: order.indexOf(q.answer), why: q.why ?? "", href: q.href };
}

/** A question made from a card: what does this describe? Wrong answers come from the same deck, same group first. */
export function cardQuestion(card, cards, r) {
  const others = shuffle(
    cards.filter(c => c.id !== card.id && c.front !== card.front),
    r
  ).sort((a, b) => (b.group === card.group) - (a.group === card.group));
  const forward = r() < 0.5 || card.back.length > 220;
  const shown = c => (forward ? c.front : shortBack(c.back));
  const used = new Set([shown(card)]);
  const wrong = [];
  for (const c of others) {
    if (wrong.length === 3) break;
    if (used.has(shown(c))) continue;
    used.add(shown(c));
    wrong.push(c);
  }
  if (wrong.length < 2) return null;
  const q = forward
    ? { id: card.id, text: `Which one is this?\n${shortBack(card.back, 260)}`, choices: [card.front, ...wrong.map(c => c.front)], answer: 0, why: `${card.front}: ${shortBack(card.back, 260)}` }
    : { id: card.id, text: `What is ${card.front}?`, choices: [shortBack(card.back), ...wrong.map(c => shortBack(c.back))], answer: 0, why: card.back };
  return shuffleQuestion({ ...q, href: card.href }, r, `c:${card.id}`);
}

/** A round of multiple choice: the deck's own questions first, then ones made from its cards. */
export function quizRound(deck, n = 10, seed = newSeed()) {
  const r = rng(seed);
  const own = shuffle(deck.questions ?? [], r).map(q => shuffleQuestion(q, r));
  const cards = deck.cards ?? [];
  const made = cards.length >= 4 ? shuffle(cards, r).map(c => cardQuestion(c, cards, r)).filter(Boolean) : [];
  const ownShare = made.length ? Math.min(own.length, Math.ceil(n * 0.6)) : own.length;
  return shuffle([...own.slice(0, ownShare), ...made.slice(0, n - Math.min(n, ownShare)), ...own.slice(ownShare)].slice(0, n), r);
}

// ── Fill in the blank ───────────────────────────────────────────────────
const UNIT = String.raw`(?:%|percent|mmHg|L/min|mL|mg|mcg|kg|lb|lbs|g|seconds?|secs?|minutes?|hours?|days?|weeks?|months?|years?|ft|feet|knots?|kt|nm|sm|statute miles?|miles?|inches?|in\b|cm|mm|m\b|°\s?[CF]|degrees?|mph|psi|kPa|bpm|breaths?|compressions?|times?|calendar months|hours?|zones?|AGL|MSL)`;
const NUMBER_PHRASE = new RegExp(String.raw`\b\d[\d,.]*(?:\s*(?:to|–|-|or|and)\s*\d[\d,.]*)?(?:\s*${UNIT})?`, "g");
const STOP = new Set("about above after again against because before being below between could during every first other their there these those through under until where which while would should never always often".split(" "));

/** Where to put the blank in a sentence: the given words, a number, an abbreviation or a key word. */
export function pickBlank(text, preferred) {
  if (preferred && text.includes(preferred)) return preferred;
  const numbers = [...text.matchAll(NUMBER_PHRASE)].map(m => m[0].trim()).filter(s => /\d/.test(s) && !/^\d{1,2}$/.test(s) || new RegExp(UNIT).test(s));
  const withUnit = numbers.filter(s => new RegExp(UNIT).test(s));
  if (withUnit.length) return withUnit[0];
  if (numbers.length) return numbers[0];
  const abbr = text.match(/\b[A-Z][A-Z0-9]{1,6}\b/g)?.filter(w => !["A", "I", "OR", "AND", "THE", "NOT"].includes(w));
  if (abbr?.length) return abbr[0];
  const words = (text.match(/\b[a-zA-Z][a-zA-Z-]{6,}\b/g) ?? []).filter(w => !STOP.has(w.toLowerCase()));
  if (!words.length) return null;
  return words.reduce((a, b) => (b.length > a.length ? b : a));
}

/** One cloze: { key, before, answer, after, hint }. */
export function makeCloze(fact) {
  const answer = pickBlank(fact.text, fact.blank);
  if (!answer) return null;
  const at = fact.text.indexOf(answer);
  return { key: `f:${fact.id}`, before: fact.text.slice(0, at), answer, after: fact.text.slice(at + answer.length), hint: `${answer.length} characters` };
}

/** Everything a deck offers to fill in: its facts as clozes, and short terms to recall from their meaning. */
export function fillItems(deck, seed = newSeed()) {
  const r = rng(seed);
  const facts = (deck.facts ?? []).map(makeCloze).filter(Boolean);
  const terms = (deck.cards ?? [])
    .filter(c => c.front.length <= 32 && c.front.split(/\s+/).length <= 4 && !/[:?]/.test(c.front))
    .map(c => ({ key: `c:${c.id}`, before: `${shortBack(c.back, 220)}\n\nThis is `, answer: c.front, after: ".", hint: `${c.front.length} characters`, term: true, href: c.href }));
  return shuffle([...facts, ...terms], r);
}

const normalize = s =>
  String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\bthrough\b|\bto\b/g, "-")
    .replace(/,(?=\d{3})/g, "")
    .replace(/[^a-z0-9.%°-]+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Is a typed answer right? Small typos pass; numbers must match exactly. Units may be left off. */
export function checkTyped(typed, answer) {
  const t = normalize(typed);
  const a = normalize(answer);
  if (!t) return false;
  if (t === a) return true;
  const digits = s => (s.match(/\d+(?:\.\d+)?/g) ?? []).join(" ");
  if (digits(a)) {
    if (digits(t) !== digits(a)) return false;
    // "15" for "15 seconds" is right; "15 minutes" for "15 seconds" is not.
    const words = s => s.replace(/[\d.]+/g, " ").replace(/\s+/g, " ").trim();
    const wt = words(t);
    const wa = words(a);
    return !wt || (wt.length >= 3 && wa.startsWith(wt.replace(/s$/, ""))) || editDistance(wt, wa) <= Math.max(1, Math.floor(wa.length * 0.2));
  }
  return editDistance(t, a) <= Math.max(1, Math.floor(a.length * 0.15));
}

// ── Matching ────────────────────────────────────────────────────────────
/** n cards to pair up: { pairs: [{ key, term, meaning }], meanings: shuffled order }. */
export function matchRound(deck, n = 5, seed = newSeed()) {
  const r = rng(seed);
  const seen = new Set();
  const pairs = shuffle(deck.cards ?? [], r)
    .filter(c => {
      const m = shortBack(c.back, 120);
      if (seen.has(m) || seen.has(c.front)) return false;
      seen.add(m);
      seen.add(c.front);
      return true;
    })
    .slice(0, n)
    .map(c => ({ key: `c:${c.id}`, term: c.front, meaning: shortBack(c.back, 120) }));
  return { pairs, meanings: shuffle(pairs.map(p => p.key), r) };
}

// ── Sorting ─────────────────────────────────────────────────────────────
/** Cards to sort into 2 to 4 groups: { groups: [name], items: [{ key, label, group }] }. */
export function sortRound(deck, n = 10, seed = newSeed()) {
  const r = rng(seed);
  const all = groupsOf(deck);
  if (all.length < 2) return { groups: [], items: [] };
  const groups = shuffle(all, r).slice(0, Math.min(4, all.length));
  const per = Math.max(2, Math.floor(n / groups.length));
  const items = groups.flatMap(g =>
    shuffle(
      deck.cards.filter(c => c.group === g && c.front.toLowerCase() !== g.toLowerCase()),
      r
    )
      .slice(0, per)
      .map(c => ({ key: `c:${c.id}`, label: c.front, group: g, href: c.href }))
  );
  return { groups: [...groups].sort(), items: shuffle(items, r) };
}

// ── Practical problems ──────────────────────────────────────────────────
/** n problems with fresh numbers. Each is multiple choice (choices) or a typed number (unit, tolerance). */
export function problemRound(deck, n = 5, seed = newSeed()) {
  if (!deck.problems) return [];
  const out = [];
  const r = rng(seed);
  for (let i = 0; out.length < n && i < n * 4; i++) {
    const p = deck.problems(seed + i);
    if (!p) continue;
    out.push(p.choices ? { ...shuffleQuestion(p, r, `p:${p.id}`), kind: "choice" } : { ...p, key: `p:${p.id}`, kind: "number" });
  }
  return out;
}

/** Is a typed number within the problem's tolerance? Accepts commas and a trailing unit. */
export function checkNumber(typed, answer, tolerance = 0.02) {
  const m = /-?\d[\d,]*\.?\d*(?:e-?\d+)?|-?\.\d+/i.exec(String(typed).replace(/−/g, "-"));
  if (!m) return false;
  const v = Number(m[0].replace(/,/g, ""));
  if (!Number.isFinite(v)) return false;
  if (answer === 0) return Math.abs(v) < 1e-9;
  return Math.abs(v - answer) / Math.abs(answer) <= tolerance + 1e-9;
}

// ── Spaced review ───────────────────────────────────────────────────────
/** Everything in a deck that has a review schedule: cards, questions and facts. */
export function reviewables(deck) {
  const cardItems = (deck.cards ?? []).map(c => ({ kind: "c", id: c.id }));
  const qItems = (deck.questions ?? []).map(q => ({ kind: "q", id: q.id }));
  const fItems = (deck.facts ?? []).filter(f => makeCloze(f)).map(f => ({ kind: "f", id: f.id }));
  return [...cardItems, ...qItems, ...fItems];
}

/**
 * Today's review queue across the shelf.
 * loaded: [{ ref: { app, id }, deck }] for each deck that loaded.
 * Returns [{ key, app, deckId, kind, id }]: things due first (oldest first),
 * then new things up to the day's new limit.
 */
export function reviewQueue(data, loaded, today, seed = newSeed()) {
  const r = rng(seed);
  const due = [];
  const fresh = [];
  for (const { ref, deck } of loaded) {
    if (!deck) continue;
    for (const it of reviewables(deck)) {
      const key = `${ref.app}:${ref.id}:${it.kind}:${it.id}`;
      const s = data.items[key];
      const entry = { key, app: ref.app, deckId: ref.id, kind: it.kind, id: it.id };
      if (!s || !s.due) fresh.push(entry);
      else if (s.due <= today) due.push({ ...entry, due: s.due });
    }
  }
  const newToday = Object.values(data.items).filter(s => s.first === today).length;
  const room = Math.max(0, data.settings.newPerDay - newToday);
  // New things: take turns between decks so one big deck doesn't crowd the rest out.
  const byDeck = new Map();
  for (const f of fresh) {
    const k = `${f.app}:${f.deckId}`;
    if (!byDeck.has(k)) byDeck.set(k, []);
    byDeck.get(k).push(f);
  }
  const lanes = [...byDeck.values()];
  const picked = [];
  for (let i = 0; picked.length < room && lanes.some(l => l.length > i); i++) for (const l of lanes) if (l[i] && picked.length < room) picked.push(l[i]);
  due.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
  return [...shuffle(due, r).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0)), ...picked];
}

/** Find the material behind a queue entry. */
export function materialFor(deck, kind, id) {
  if (kind === "c") return deck.cards?.find(c => c.id === id) ?? null;
  if (kind === "q") return deck.questions?.find(q => q.id === id) ?? null;
  if (kind === "f") return deck.facts?.find(f => f.id === id) ?? null;
  return null;
}
