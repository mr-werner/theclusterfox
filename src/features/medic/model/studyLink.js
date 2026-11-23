// What MedicFox shares with StudyFox: each knowledge topic, with its
// practice questions, its tables as flashcards and its key points for fill
// in the blank. StudyFox loads this on demand (see src/app/studyLinks.js).
import { notesToStudy, tableCards } from "../../../app/studyKit.js";
import { EXAM_AREAS, levelById } from "../data/levels.js";
import { TOPICS, topicById } from "../data/knowledge.js";
import { QUESTIONS } from "../data/questions.js";

const textOf = pt => (typeof pt === "string" ? pt : pt.t);
const minOf = pt => (typeof pt === "string" ? "emr" : pt.min);

export function decks() {
  return TOPICS.map(t => ({
    id: t.id,
    title: t.title,
    blurb: `${t.summary} From ${levelById.get(t.min)?.short ?? "EMR"} up.`,
    group: EXAM_AREAS.find(a => a.id === t.area)?.name ?? "EMS",
  }));
}

export function deck(id) {
  const t = topicById.get(id);
  if (!t) return null;
  const notes = t.points.map(pt => {
    const level = minOf(pt);
    return level === "emr" ? textOf(pt) : `${textOf(pt)} (${levelById.get(level)?.short})`;
  });
  const { cards, facts } = notesToStudy(notes, t.id);
  return {
    id,
    title: t.title,
    blurb: t.summary,
    href: "/medic",
    cards: [...tableCards(t.table, t.table?.caption?.replace(/s$/, "")), ...cards],
    facts,
    questions: QUESTIONS.filter(q => q.topic === id).map(q => ({ id: q.id, text: q.text, choices: q.choices, answer: q.answer, why: q.why })),
    diagrams: [{ title: "Skill stations", href: "/medic?tab=skills", blurb: "Run the practical skill sheets, step by step, at crawl, walk or run pace." }],
  };
}
