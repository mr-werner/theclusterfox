import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, ChevronDown, Clock, Dices, RotateCcw, Target, X } from "lucide-react";

import { EXAMS, examsById, PASS } from "../data/exams";
import { QUESTIONS } from "../data/questions";
import { topicsById, topicsFor } from "../data/topics";
import { generatorsFor, makeQuestion } from "../model/generators";
import { progressFor, recordAnswer, recordExam } from "../state/flyStore";

// Study for an FAA knowledge test: notes for each subject, practice with
// instant explanations, and timed practice tests scored like the real one.
const shuffled = (list, seed = Math.random) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seed() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export function bankFor(examId) {
  return QUESTIONS.filter(q => q.exams.includes(examId));
}

/** A practice test: the bank shuffled, topped up with fresh-number questions. */
export function buildTest(examId, count, seed = newSeed()) {
  const bank = shuffled(bankFor(examId));
  const gens = generatorsFor(examId);
  const out = bank.slice(0, Math.round(count * 0.8));
  let s = seed;
  while (out.length < count && gens.length) {
    out.push(makeQuestion(gens[out.length % gens.length], s++));
  }
  for (const q of bank.slice(Math.round(count * 0.8))) if (out.length < count) out.push(q);
  return shuffled(out);
}

export default function StudyTab({ f, examId, mode, go }) {
  const exam = examsById.get(examId);
  if (!exam) return <ExamPicker f={f} go={go} />;
  return <ExamHome f={f} exam={exam} mode={mode} go={go} />;
}

function ExamPicker({ f, go }) {
  const { data } = f;
  return (
    <div className="fy-stack">
      <section className="fy-card fy-hero">
        <div className="fy-hero-text">
          <p className="fy-kicker">Study</p>
          <h1>Pass your knowledge test</h1>
          <p>Notes for every subject, practice questions that explain themselves, and timed tests scored like the FAA's — with calculation questions that come with fresh numbers every time.</p>
        </div>
      </section>
      <div className="fy-exams">
        {EXAMS.map(e => {
          const ids = bankFor(e.id).map(q => q.id);
          const p = progressFor(data.study, e.id, ids);
          const last = data.study[e.id]?.exams.at(-1);
          return (
            <button key={e.id} type="button" className={`fy-exam${data.goal === e.license ? " is-goal" : ""}`} onClick={() => go({ tab: "study", exam: e.id })}>
              <span className="fy-exam-code">{e.code}</span>
              <strong>{e.name}</strong>
              <span className="fy-muted">{e.blurb}</span>
              <span className="fy-progress" aria-label={`${p.mastered} of ${p.total} mastered`}>
                <i style={{ width: `${(p.mastered / Math.max(1, p.total)) * 100}%` }} />
              </span>
              <small>
                {p.mastered}/{p.total} mastered{last ? ` · last test ${Math.round((last.score / last.total) * 100)}%` : ""}
                {data.goal === e.license && " · your goal"}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExamHome({ f, exam, mode, go }) {
  const { data } = f;
  const topics = topicsFor(exam.id);
  const ids = bankFor(exam.id).map(q => q.id);
  const p = progressFor(data.study, exam.id, ids);
  const history = data.study[exam.id]?.exams ?? [];
  const view = mode === "practice" || mode === "test" ? mode : "notes";

  return (
    <div className="fy-stack">
      <section className="fy-card fy-exam-head">
        <div>
          <p className="fy-kicker">{exam.code} knowledge test</p>
          <h1>{exam.name}</h1>
          <p className="fy-muted">The real test: {exam.questions} questions, {exam.minutes >= 60 ? `${exam.minutes / 60} hours`.replace(".5 hours", "½ hours") : `${exam.minutes} minutes`}, 70% to pass, at an FAA testing center.</p>
        </div>
        <div className="fy-exam-stats">
          <div><strong>{p.mastered}</strong><span>mastered</span></div>
          <div><strong>{p.missed}</strong><span>to review</span></div>
          <div><strong>{history.length ? `${Math.round((history.at(-1).score / history.at(-1).total) * 100)}%` : "—"}</strong><span>last test</span></div>
        </div>
      </section>

      <div className="fy-seg is-wide" role="tablist">
        <button type="button" role="tab" aria-selected={view === "notes"} className={view === "notes" ? "is-on" : ""} onClick={() => go({ tab: "study", exam: exam.id })}><BookOpen size={15} /> Study notes</button>
        <button type="button" role="tab" aria-selected={view === "practice"} className={view === "practice" ? "is-on" : ""} onClick={() => go({ tab: "study", exam: exam.id, mode: "practice" })}><Dices size={15} /> Practice</button>
        <button type="button" role="tab" aria-selected={view === "test"} className={view === "test" ? "is-on" : ""} onClick={() => go({ tab: "study", exam: exam.id, mode: "test" })}><Clock size={15} /> Practice test</button>
      </div>

      {view === "notes" && <Notes topics={topics} go={go} exam={exam} />}
      {view === "practice" && <Practice f={f} exam={exam} topics={topics} />}
      {view === "test" && <Test f={f} exam={exam} history={history} />}
    </div>
  );
}

function Notes({ topics, exam, go }) {
  const [open, setOpen] = useState(topics[0]?.id);
  return (
    <div className="fy-notes">
      {topics.map(t => (
        <section key={t.id} className={`fy-card fy-topic${open === t.id ? " is-open" : ""}`}>
          <button type="button" className="fy-topic-head" onClick={() => setOpen(open === t.id ? null : t.id)} aria-expanded={open === t.id}>
            <h2>{t.title}</h2>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
          {open === t.id && (
            <div className="fy-topic-body">
              {t.sections.map(s => (
                <div key={s.h} className="fy-section">
                  <h3>{s.h}</h3>
                  {s.p && <p>{s.p}</p>}
                  {s.list && <ul className="fy-ticks">{s.list.map(x => <li key={x}>{x}</li>)}</ul>}
                  {s.table && (
                    <div className="fy-scroll-x">
                      <table className="fy-table">
                        <thead><tr>{s.table.head.map(h => <th key={h}>{h}</th>)}</tr></thead>
                        <tbody>{s.table.rows.map(r => <tr key={r[0]}>{r.map((c, i) => (i === 0 ? <th key={i}>{c}</th> : <td key={i}>{c}</td>))}</tr>)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" className="fy-btn is-small" onClick={() => go({ tab: "study", exam: exam.id, mode: "practice", topic: t.id })}>
                <Target size={14} /> Practice {t.title.toLowerCase()}
              </button>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Question({ q, picked, onPick, reveal, number, total }) {
  return (
    <div className="fy-q">
      <p className="fy-q-meta">
        {number && <span>Question {number}{total ? ` of ${total}` : ""}</span>}
        <span>{topicsById.get(q.topic)?.title ?? q.topic}</span>
        {q.generated && <span className="fy-pill">Fresh numbers</span>}
      </p>
      <p className={`fy-q-text${q.mono ? " has-mono" : ""}`}>
        {q.text.split("\n").map((line, i) => (i === 0 ? <span key={i}>{line}</span> : <code key={i}>{line}</code>))}
      </p>
      <ol className="fy-choices" type="A">
        {q.choices.map((c, i) => {
          const state = reveal ? (i === q.answer ? "is-right" : i === picked ? "is-wrong" : "") : i === picked ? "is-picked" : "";
          return (
            <li key={i}>
              <button type="button" className={`fy-choice ${state}`} onClick={() => onPick(i)} disabled={reveal} aria-pressed={i === picked}>
                <span className="fy-letter">{"ABC"[i]}</span>
                <span>{c}</span>
                {reveal && i === q.answer && <Check size={16} aria-hidden="true" />}
                {reveal && i === picked && i !== q.answer && <X size={16} aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      {reveal && (
        <div className={`fy-why ${picked === q.answer ? "is-right" : "is-wrong"}`}>
          <strong>{picked === q.answer ? "Correct." : `The answer is ${"ABC"[q.answer]}.`}</strong> {q.why}
          {q.ref && <em> — {q.ref}</em>}
        </div>
      )}
    </div>
  );
}

function Practice({ f, exam, topics }) {
  const { data, patch } = f;
  const params = new URLSearchParams(window.location.search);
  const [topic, setTopic] = useState(() => (topics.some(t => t.id === params.get("topic")) ? params.get("topic") : "all"));
  const [onlyMissed, setOnlyMissed] = useState(false);
  const [q, setQ] = useState(null);
  const [picked, setPicked] = useState(null);
  const [streak, setStreak] = useState({ right: 0, total: 0 });
  const recent = useRef([]);

  const pool = useMemo(() => {
    const seen = data.study[exam.id]?.seen ?? {};
    return bankFor(exam.id).filter(x => (topic === "all" || x.topic === topic) && (!onlyMissed || (seen[x.id] && !seen[x.id].last)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id, topic, onlyMissed]);
  const gens = useMemo(() => generatorsFor(exam.id).filter(g => topic === "all" || g.topic === topic), [exam.id, topic]);

  function next() {
    setPicked(null);
    const useGen = !onlyMissed && gens.length && (pool.length === 0 || Math.random() < 0.3);
    if (useGen) {
      setQ(makeQuestion(gens[Math.floor(Math.random() * gens.length)], newSeed()));
      return;
    }
    if (!pool.length) {
      setQ(null);
      return;
    }
    const seen = data.study[exam.id]?.seen ?? {};
    // Unseen and missed questions come up more often.
    const fresh = pool.filter(x => !recent.current.includes(x.id));
    const from = fresh.length ? fresh : pool;
    const weighted = from.flatMap(x => (!seen[x.id] ? [x, x, x] : !seen[x.id].last ? [x, x] : [x]));
    const pick = weighted[Math.floor(Math.random() * weighted.length)];
    recent.current = [pick.id, ...recent.current].slice(0, Math.min(8, Math.floor(pool.length / 2)));
    setQ(pick);
  }

  useEffect(next, [pool, gens]); // eslint-disable-line react-hooks/exhaustive-deps

  function answer(i) {
    setPicked(i);
    const right = i === q.answer;
    setStreak(s => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    if (!q.generated) patch(d => ({ study: recordAnswer(d.study, exam.id, q.id, right) }));
  }

  return (
    <section className="fy-card fy-practice">
      <div className="fy-toolbar">
        <select value={topic} onChange={e => setTopic(e.target.value)} aria-label="Subject">
          <option value="all">All subjects</option>
          {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <label className="fy-check">
          <input type="checkbox" checked={onlyMissed} onChange={e => setOnlyMissed(e.target.checked)} /> Only ones I've missed
        </label>
        <span className="fy-muted">{streak.total ? `${streak.right}/${streak.total} this session` : ""}</span>
      </div>
      {q ? (
        <>
          <Question q={q} picked={picked} onPick={answer} reveal={picked !== null} />
          {picked !== null && (
            <button type="button" className="fy-btn" onClick={next} autoFocus>
              Next question
            </button>
          )}
        </>
      ) : (
        <p className="fy-muted">{onlyMissed ? "Nothing to review here — you've answered every question you've seen correctly the last time." : "No questions for this subject yet."}</p>
      )}
    </section>
  );
}

function Test({ f, exam, history }) {
  const { patch } = f;
  const [count, setCount] = useState(Math.min(exam.questions, 20));
  const [test, setTest] = useState(null); // { questions, answers, start, done }
  const [i, setI] = useState(0);
  const [now, setNow] = useState(Date.now());
  const limitMs = (exam.minutes * 60000 * count) / exam.questions;

  useEffect(() => {
    if (!test || test.done) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [test]);

  const left = test ? Math.max(0, test.start + limitMs - now) : limitMs;
  useEffect(() => {
    if (test && !test.done && left <= 0) finish();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function start() {
    setTest({ questions: buildTest(exam.id, count), answers: {}, start: Date.now(), done: false });
    setI(0);
    setNow(Date.now());
  }

  function finish() {
    setTest(t => {
      if (!t || t.done) return t;
      const score = t.questions.filter(q => t.answers[q.id] === q.answer).length;
      patch(d => {
        let study = d.study;
        for (const q of t.questions) if (!q.generated && t.answers[q.id] !== undefined) study = recordAnswer(study, exam.id, q.id, t.answers[q.id] === q.answer);
        return { study: recordExam(study, exam.id, { at: new Date().toISOString(), score, total: t.questions.length, seconds: Math.round((Date.now() - t.start) / 1000) }) };
      });
      return { ...t, done: true, score };
    });
  }

  if (!test) {
    return (
      <section className="fy-card fy-test-start">
        <h2>Practice test</h2>
        <p className="fy-muted">Questions from every subject, no hints until the end, and a clock scaled to the real test's pace. Score {Math.round(PASS * 100)}% to pass.</p>
        <div className="fy-seg" role="group" aria-label="Length">
          {[10, 20, exam.questions].filter((v, k, a) => a.indexOf(v) === k).map(n => (
            <button key={n} type="button" className={n === count ? "is-on" : ""} onClick={() => setCount(n)}>
              {n === exam.questions ? `Full (${n})` : `${n} questions`}
            </button>
          ))}
        </div>
        <p className="fy-muted">Time: {Math.round(limitMs / 60000)} minutes</p>
        <button type="button" className="fy-btn" onClick={start}><Clock size={16} /> Start</button>
        {history.length > 0 && (
          <>
            <h3>Your tests</h3>
            <ul className="fy-history">
              {[...history].reverse().slice(0, 8).map(h => (
                <li key={h.at} className={h.score / h.total >= PASS ? "is-pass" : "is-fail"}>
                  <strong>{Math.round((h.score / h.total) * 100)}%</strong>
                  <span>{h.score}/{h.total}</span>
                  <span className="fy-muted">{new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    );
  }

  if (test.done) {
    const total = test.questions.length;
    const pct = test.score / total;
    const byTopic = new Map();
    for (const q of test.questions) {
      const r = byTopic.get(q.topic) ?? { right: 0, total: 0 };
      r.total += 1;
      if (test.answers[q.id] === q.answer) r.right += 1;
      byTopic.set(q.topic, r);
    }
    const missed = test.questions.filter(q => test.answers[q.id] !== q.answer);
    return (
      <section className="fy-card fy-result">
        <div className={`fy-score ${pct >= PASS ? "is-pass" : "is-fail"}`}>
          <strong>{Math.round(pct * 100)}%</strong>
          <span>{pct >= PASS ? "Pass" : "Not yet"} · {test.score} of {total}</span>
        </div>
        <h3>By subject</h3>
        <ul className="fy-bytopic">
          {[...byTopic].sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total).map(([t, r]) => (
            <li key={t}>
              <span>{topicsById.get(t)?.title ?? t}</span>
              <span className="fy-progress"><i style={{ width: `${(r.right / r.total) * 100}%` }} /></span>
              <em>{r.right}/{r.total}</em>
            </li>
          ))}
        </ul>
        {missed.length > 0 && <h3>Review what you missed</h3>}
        {missed.map((q, k) => (
          <Question key={q.id} q={q} picked={test.answers[q.id] ?? -1} reveal onPick={() => {}} number={k + 1} />
        ))}
        <button type="button" className="fy-btn" onClick={() => setTest(null)}><RotateCcw size={16} /> Another test</button>
      </section>
    );
  }

  const q = test.questions[i];
  const answered = Object.keys(test.answers).length;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  return (
    <section className="fy-card fy-testing">
      <div className="fy-toolbar">
        <span className={`fy-clock${left < 120000 ? " is-low" : ""}`}><Clock size={15} /> {mm}:{String(ss).padStart(2, "0")}</span>
        <span className="fy-muted">{answered} of {test.questions.length} answered</span>
        <button type="button" className="fy-btn is-small is-ghost" onClick={finish}>Finish and score</button>
      </div>
      <Question q={q} number={i + 1} total={test.questions.length} picked={test.answers[q.id] ?? null} reveal={false} onPick={k => setTest(t => ({ ...t, answers: { ...t.answers, [q.id]: k } }))} />
      <div className="fy-test-nav">
        <button type="button" className="fy-btn is-ghost" onClick={() => setI(i - 1)} disabled={i === 0}>Back</button>
        <div className="fy-dots" aria-label="Questions">
          {test.questions.map((x, k) => (
            <button key={x.id} type="button" className={`${k === i ? "is-on" : ""}${test.answers[x.id] !== undefined ? " is-done" : ""}`} onClick={() => setI(k)} aria-label={`Question ${k + 1}`} />
          ))}
        </div>
        {i < test.questions.length - 1 ? (
          <button type="button" className="fy-btn" onClick={() => setI(i + 1)}>Next</button>
        ) : (
          <button type="button" className="fy-btn" onClick={finish}>Score it</button>
        )}
      </div>
    </section>
  );
}
