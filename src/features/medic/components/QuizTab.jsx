import { useMemo, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";

import { covers, EXAM_AREAS } from "../data/levels";
import { topicById } from "../data/knowledge";
import { QUESTIONS } from "../data/questions";
import { rng, shuffle } from "../model/sim";

// One question at a time, choices shuffled, the reasoning shown after you pick.
// Questions you have missed before come up first.
export default function QuizTab({ level, data, onAnswer }) {
  const [area, setArea] = useState("all");
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [session, setSession] = useState({ right: 0, total: 0 });

  const pool = useMemo(() => {
    const rand = rng(seed);
    const list = QUESTIONS.filter(q => covers(level, q.min) && (area === "all" || topicById.get(q.topic)?.area === area));
    const missedFirst = q => {
      const r = data.quiz[q.id];
      return r && r.wrong > r.right ? 0 : r ? 2 : 1;
    };
    return shuffle(rand, list)
      .sort((a, b) => missedFirst(a) - missedFirst(b))
      .map(q => ({ ...q, order: shuffle(rand, q.choices.map((_, i) => i)) }));
    // Only reshuffle on a new round, level or area, not on every answer.
  }, [level, area, seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = pool[index];
  const answered = Object.values(data.quiz).reduce((s, r) => s + r.right + r.wrong, 0);
  const right = Object.values(data.quiz).reduce((s, r) => s + r.right, 0);

  function choose(i) {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === q.answer;
    setSession(s => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    onAnswer(q.id, ok);
  }
  function next() {
    setPicked(null);
    if (index + 1 < pool.length) setIndex(index + 1);
    else restart();
  }
  function restart() {
    setSeed(s => s + 1);
    setIndex(0);
    setPicked(null);
    setSession({ right: 0, total: 0 });
  }
  function pickArea(id) {
    setArea(id);
    setIndex(0);
    setPicked(null);
  }

  return (
    <section className="mx-quiz">
      <div className="mx-filter" role="group" aria-label="Exam area">
        <button type="button" className={area === "all" ? "is-on" : ""} onClick={() => pickArea("all")}>All areas</button>
        {EXAM_AREAS.map(a => (
          <button key={a.id} type="button" className={area === a.id ? "is-on" : ""} onClick={() => pickArea(a.id)}>{a.name.split(",")[0]}</button>
        ))}
      </div>

      <p className="mx-small">
        This round: {session.right} of {session.total} right · All time: {answered ? Math.round((right / answered) * 100) : 0}% of {answered}
      </p>

      {q ? (
        <article className="mx-card mx-question">
          <p className="mx-small">
            Question {index + 1} of {pool.length} · {topicById.get(q.topic)?.title}
          </p>
          <h2>{q.text}</h2>
          <div className="mx-choices">
            {q.order.map(i => {
              const state = picked === null ? "" : i === q.answer ? " is-right" : i === picked ? " is-wrong" : " is-dim";
              return (
                <button key={i} type="button" className={`mx-choice${state}`} onClick={() => choose(i)} disabled={picked !== null}>
                  {picked !== null && i === q.answer && <Check size={16} aria-hidden="true" />}
                  {picked !== null && i === picked && i !== q.answer && <X size={16} aria-hidden="true" />}
                  <span>{q.choices[i]}</span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className={`mx-why ${picked === q.answer ? "is-right" : "is-wrong"}`} role="status">
              <strong>{picked === q.answer ? "Right." : "Not quite."}</strong> {q.why}
            </div>
          )}
          <div className="mx-row">
            {picked !== null && (
              <button type="button" className="mx-btn mx-btn--primary" onClick={next}>
                {index + 1 < pool.length ? "Next question" : "New round"}
              </button>
            )}
            <button type="button" className="mx-btn" onClick={restart}>
              <RotateCcw size={15} aria-hidden="true" /> Shuffle
            </button>
          </div>
        </article>
      ) : (
        <p className="mx-muted">No questions for this area at your level yet.</p>
      )}
    </section>
  );
}
