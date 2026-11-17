// What FlyFox shares with StudyFox: each knowledge-test subject, with its
// study notes, its questions, and calculation problems that come with
// fresh numbers every time. StudyFox loads this on demand (see
// src/app/studyLinks.js) and always reads the live bank.
import { notesToStudy, tableCards } from "../../../app/studyKit.js";
import { examsById } from "../data/exams.js";
import { QUESTIONS } from "../data/questions.js";
import { TOPICS, topicsById } from "../data/topics.js";
import { GENERATORS, makeQuestion } from "./generators.js";

const shortHeading = h => h.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+—.*$/, "").trim();

export function decks() {
  return TOPICS.map(t => ({
    id: t.id,
    title: t.title,
    blurb: `On the ${t.exams.map(e => examsById.get(e)?.code ?? e.toUpperCase()).join(", ")} test${t.exams.length > 1 ? "s" : ""}.`,
    group: t.exams.length === 1 && t.exams[0] === "uag" ? "Drones (Part 107)" : "Pilot knowledge",
  }));
}

export function deck(id) {
  const t = topicsById.get(id);
  if (!t) return null;
  const cards = [];
  const facts = [];
  for (const s of t.sections) {
    if (s.table) cards.push(...tableCards(s.table, shortHeading(s.h)));
    if (s.list) {
      const made = notesToStudy(s.list, `${t.id}:${s.h}`);
      cards.push(...made.cards);
      facts.push(...made.facts);
    }
    if (s.p && s.p.length <= 320) facts.push(...notesToStudy([s.p], `${t.id}:${s.h}:p`).facts);
  }
  const gens = GENERATORS.filter(g => g.topic === id);
  return {
    id,
    title: t.title,
    href: `/fly?tab=study&exam=${t.exams[0]}`,
    cards,
    facts,
    questions: QUESTIONS.filter(q => q.topic === id).map(q => ({ id: q.id, text: q.text, choices: q.choices, answer: q.answer, why: q.ref ? `${q.why} (${q.ref})` : q.why })),
    problems: gens.length
      ? seed => {
          const q = makeQuestion(gens[seed % gens.length], seed);
          return { id: q.id, text: q.text, choices: q.choices, answer: q.answer, why: q.ref ? `${q.why} (${q.ref})` : q.why };
        }
      : undefined,
    diagrams: [
      { title: "Practice test", href: `/fly?tab=study&exam=${t.exams[0]}&mode=test`, blurb: "A timed test scored like the FAA's." },
      { title: "Winds aloft", href: "/fly?tab=winds", blurb: "Live winds and temperatures at altitude." },
    ],
  };
}
