// StudyFox checks: node src/features/study/tests/validate.mjs
// Loads every app's study material the way StudyFox does, and checks the
// review schedule, the practice rounds, and what shows up in PlanFox.
import assert from "node:assert/strict";
import fs from "node:fs";

import { STUDY_LINKS } from "../../../app/studyLinks.js";
import { addDays } from "../model/dates.js";
import { checkNumber, checkTyped, fillItems, flashItems, makeCloze, matchRound, modeCounts, pickBlank, problemRound, quizRound, reviewQueue, reviewables, sortRound } from "../model/exercises.js";
import { grade, newState } from "../model/srs.js";
import { addDeck, emptyData, normalizeData, recordPractice, recordReview, removeDeck } from "../state/studyStore.js";
import { launchTargets, planItems } from "../model/planLink.js";

let passed = 0;
const test = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};

const parts = JSON.parse(fs.readFileSync(new URL("../../../../public/anatomy/index.json", import.meta.url))).parts;
const loadParts = async () => parts;
const TODAY = "2026-11-17";

// ── Every linked deck loads and is usable ───────────────────────────────
const all = [];
for (const link of STUDY_LINKS) {
  const mod = await link.load();
  const decks = await mod.decks();
  await test(`${link.app}: every deck loads with stable, unique ids`, async () => {
    assert(decks.length > 0);
    assert.equal(new Set(decks.map(d => d.id)).size, decks.length);
    for (const d of decks) {
      assert(d.title && /^[\w.#@ ()'&,/+-]{1,80}$/.test(d.id), `${link.app}:${d.id} id`);
      const deck = await mod.deck(d.id, { loadParts });
      assert(deck, `${link.app}:${d.id} loads`);
      assert(deck.href?.startsWith("/"), `${d.id} href`);
      const items = reviewables(deck);
      assert(items.length > 0 || deck.problems, `${link.app}:${d.id} has something to study`);
      const keys = items.map(i => `${i.kind}:${i.id}`);
      assert.equal(new Set(keys).size, keys.length, `${link.app}:${d.id} item ids unique: ${keys.filter((k, i) => keys.indexOf(k) !== i).slice(0, 3)}`);
      for (const c of deck.cards ?? []) assert(c.front && c.back, `${d.id} card ${c.id}`);
      for (const q of deck.questions ?? []) assert(q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length, `${d.id} question ${q.id}`);
      for (const f of deck.facts ?? []) if (f.blank) assert(f.text.includes(f.blank), `${d.id} fact ${f.id}`);
      const again = await mod.deck(d.id, { loadParts });
      assert.deepEqual(reviewables(again), items, `${d.id} is the same each time it loads`);
      all.push({ ref: { app: link.app, id: d.id }, deck });
    }
  });
}

await test("one deck offers every kind of practice somewhere", () => {
  const offered = new Set();
  for (const { deck } of all) for (const [mode, n] of Object.entries(modeCounts(deck))) if (n) offered.add(mode);
  assert.deepEqual([...offered].sort(), ["diagrams", "fill", "flash", "match", "problems", "quiz", "sort"]);
});

await test("practice rounds build for every deck", () => {
  for (const { ref, deck } of all) {
    const counts = modeCounts(deck);
    if (counts.flash) assert(flashItems(deck).length > 0);
    if (counts.quiz) {
      const qs = quizRound(deck, 10, 42);
      assert(qs.length > 0, `${ref.app}:${ref.id} quiz`);
      for (const q of qs) {
        assert(q.answer >= 0 && q.answer < q.choices.length);
        assert.equal(new Set(q.choices).size, q.choices.length, `${ref.id} duplicate choices in "${q.text.slice(0, 50)}"`);
      }
    }
    if (counts.fill) for (const f of fillItems(deck, 3)) assert(f.answer && `${f.before}${f.answer}${f.after}`.length > f.answer.length);
    if (counts.match) {
      const m = matchRound(deck, 5, 9);
      assert(m.pairs.length >= 3, `${ref.id} match`);
      assert.equal(new Set(m.pairs.map(p => p.meaning)).size, m.pairs.length);
    }
    if (counts.sort) {
      const s = sortRound(deck, 10, 5);
      assert(s.groups.length >= 2 && s.items.every(i => s.groups.includes(i.group)));
    }
  }
});

await test("practical problems come with fresh numbers and check out", () => {
  const withProblems = all.filter(a => a.deck.problems);
  assert(withProblems.length >= 8);
  for (const { ref, deck } of withProblems) {
    const a = problemRound(deck, 4, 100);
    const b = problemRound(deck, 4, 200);
    assert(a.length >= 1, `${ref.id} problems`);
    assert.notDeepEqual(a.map(p => p.text), b.map(p => p.text), `${ref.id} fresh numbers`);
    for (const p of a) {
      if (p.kind === "number") {
        assert(Number.isFinite(p.answer));
        assert(checkNumber(String(p.answer * 1.01), p.answer, p.tolerance));
        assert(!checkNumber(String(p.answer * 1.2), p.answer, p.tolerance));
      } else assert(p.choices[p.answer] !== undefined);
    }
  }
});

// ── Typed answers ───────────────────────────────────────────────────────
await test("typed answers forgive small slips, not wrong numbers", () => {
  assert(checkTyped("15 seconds", "15 seconds"));
  assert(checkTyped("15", "15 seconds"));
  assert(checkTyped("15 secs", "15 seconds"));
  assert(!checkTyped("10 seconds", "15 seconds"));
  assert(!checkTyped("15 minutes", "15 seconds"));
  assert(checkTyped("10-15 L/min", "10 to 15 L/min"));
  assert(checkTyped("perpendicularty", "Perpendicularity"));
  assert(!checkTyped("parallelism", "Perpendicularity"));
  assert(checkTyped("1,000 ft", "1000 ft"));
  assert(!checkTyped("", "CPAP"));
  assert(checkNumber("4.90 kW", 4.9024, 0.02));
  assert(checkNumber("1,234", 1234, 0.001));
  assert(!checkNumber("abc", 3));
});

await test("fill in the blank picks a number, then a term", () => {
  assert.equal(pickBlank("Suction no longer than 15 seconds for adults."), "15 seconds");
  assert.equal(pickBlank("Use CPAP for an alert patient."), "CPAP");
  assert.equal(pickBlank("It is so.", "nope"), null);
  const c = makeCloze({ id: "x", text: "Normal EtCO2 is 35 to 45 mmHg.", blank: "35 to 45 mmHg" });
  assert.equal(c.before + c.answer + c.after, "Normal EtCO2 is 35 to 45 mmHg.");
});

// ── Spaced repetition ───────────────────────────────────────────────────
await test("the gap grows when you know it and resets when you don't", () => {
  let s = grade(newState(), "good", TODAY);
  assert.equal(s.ivl, 1);
  assert.equal(s.due, addDays(TODAY, 1));
  s = grade(s, "good", s.due);
  assert.equal(s.ivl, 3);
  const before = s.ivl;
  s = grade(s, "good", s.due);
  assert(s.ivl > before * 2);
  s = grade(s, "easy", s.due);
  assert(s.ivl > 15);
  const miss = grade(s, "again", s.due);
  assert.equal(miss.ivl, 0);
  assert.equal(miss.due, s.due);
  assert.equal(miss.lapses, 1);
  assert(miss.ease < s.ease);
  assert.equal(miss.first, TODAY);
  let long = newState();
  for (let i = 0; i < 40; i++) long = grade(long, "easy", TODAY);
  assert(long.ivl <= 365);
});

await test("the shelf adds, removes and survives bad data", () => {
  let d = addDeck(emptyData(), { app: "medicfox", id: "cpr", title: "CPR" }, "2026-11-17T00:00:00Z");
  assert.equal(addDeck(d, { app: "medicfox", id: "cpr", title: "CPR" }), d);
  d = addDeck(d, { app: "toolfox", id: "gdt", title: "GD&T" });
  assert.deepEqual(d.decks.map(x => x.id), ["gdt", "cpr"]);
  d = recordReview(d, "medicfox:cpr:q:cp1", "good", TODAY);
  d = recordReview(d, "medicfox:cpr:q:cp2", "again", TODAY);
  assert.deepEqual(d.log, [{ day: TODAY, n: 2, right: 1 }]);
  // A right quiz answer doesn't push something that isn't due yet further out.
  assert.equal(recordPractice(d, "medicfox:cpr:q:cp1", true, TODAY), d);
  assert.equal(recordPractice(d, "medicfox:cpr:q:cp1", false, TODAY).items["medicfox:cpr:q:cp1"].ivl, 0);
  const back = normalizeData(JSON.parse(JSON.stringify(d)));
  assert.deepEqual(back, d);
  d = removeDeck(d, "medicfox", "cpr");
  assert.deepEqual(d.decks.map(x => x.id), ["gdt"]);
  assert(d.items["medicfox:cpr:q:cp1"], "schedule kept for later");
  const junk = normalizeData({ decks: [{ app: "<x>", id: "a" }, { app: "toolfox", id: "gdt" }, { app: "toolfox", id: "gdt" }], items: { a: 5, b: { ivl: 9e9, due: "nope" } }, settings: { time: "25:00", newPerDay: -3 } });
  assert.equal(junk.decks.length, 1);
  assert.deepEqual(junk.items.b, { ivl: 0, ease: 2.5, reps: 0, lapses: 0, due: null, last: null, first: null });
  assert.deepEqual(junk.settings, emptyData().settings);
});

await test("today's review: due first, then new, capped per day", () => {
  const medic = all.filter(a => a.ref.app === "medicfox").slice(0, 3);
  let data = emptyData();
  for (const m of medic) data = addDeck(data, { app: m.ref.app, id: m.ref.id, title: m.deck.title });
  data = { ...data, settings: { ...data.settings, newPerDay: 10 } };
  let q = reviewQueue(data, medic, TODAY, 1);
  assert.equal(q.length, 10);
  assert(new Set(q.map(e => e.deckId)).size > 1, "new cards take turns between decks");
  // Learn three today: tomorrow they're due, ahead of new ones.
  for (const e of q.slice(0, 3)) data = recordReview(data, e.key, "good", TODAY);
  q = reviewQueue(data, medic, TODAY, 1);
  assert.equal(q.length, 7, "new limit counts what you already met today");
  const tomorrow = addDays(TODAY, 1);
  q = reviewQueue(data, medic, tomorrow, 1);
  assert.equal(q.filter(e => e.due).length, 3);
  assert(q.slice(0, 3).every(e => e.due));
  assert.equal(q.length, 13);
});

// ── PlanFox ─────────────────────────────────────────────────────────────
await test("PlanFox shows reviews at your study time and days you studied", () => {
  assert.deepEqual(planItems(null, TODAY, TODAY), []);
  let data = addDeck(emptyData(), { app: "medicfox", id: "cpr", title: "CPR" });
  let items = planItems(data, TODAY, addDays(TODAY, 3), TODAY);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Learn something new");
  assert.equal(items[0].time, "18:00");
  assert.equal(items[0].href, "/study?review=1");
  data = recordReview(data, "medicfox:cpr:q:cp1", "good", TODAY);
  data = recordReview(data, "medicfox:cpr:q:cp2", "good", TODAY);
  data = recordReview(data, "toolfox:gdt:c:flatness", "good", TODAY); // not on the shelf: not counted
  items = planItems(data, addDays(TODAY, -1), addDays(TODAY, 3), TODAY);
  assert.deepEqual(items.map(i => [i.day, i.title, Boolean(i.done)]), [
    [TODAY, "Studied 3 cards", true],
    [addDays(TODAY, 1), "Review 2 cards", false],
  ]);
  // Overdue reviews count on today.
  items = planItems(data, addDays(TODAY, 3), addDays(TODAY, 3), addDays(TODAY, 3));
  assert.equal(items[0].title, "Review 2 cards");
  data = { ...data, settings: { ...data.settings, remind: false, time: "07:30" } };
  assert.equal(planItems(data, addDays(TODAY, 1), addDays(TODAY, 1), TODAY).length, 0);
  assert.deepEqual(launchTargets(data).map(t => t.href), ["/study?review=1", "/study?deck=medicfox%3Acpr"]);
});

console.log(`\nStudyFox: ${passed} checks passed`);
