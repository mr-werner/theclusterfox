import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Flag, Lightbulb, Play, RotateCcw, Siren, Timer, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { GROUPS } from "../data/skills";
import { levelById } from "../data/levels";
import { act, answerEvent, clock, currentPhase, finishRun, hint, MODES, pendingEvent, resolveStation, scoreRun, startRun } from "../model/sim";
import { recordFor } from "../state/medicStore";
import { todayKey } from "../model/dates";
import { MODE_ICONS } from "./SkillsTab";

// Event handlers stamp the real time a decision was made.
const nowMs = () => Date.now();
const newSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

export default function Runner({ skill, mode, level, store, onMode }) {
  const walkPasses = recordFor(store.data, skill.id, "walk").passes;
  const [run, setRun] = useState(() => startRun(skill, { level, mode, seed: newSeed(), walkPasses }));
  const [started, setStarted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [hinted, setHinted] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const recorded = useRef(false);

  const station = useMemo(() => resolveStation(skill, run.scenarioId, level), [skill, run.scenarioId, level]);
  const { scenario, steps, distractors } = station;
  const event = pendingEvent(skill, run);
  const timed = mode !== "crawl";

  // A live clock while you decide.
  useEffect(() => {
    if (!started || run.finished || !timed) return undefined;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [started, run.finished, timed]);

  const result = run.finished ? scoreRun(skill, run) : null;

  // Save each finished run once.
  useEffect(() => {
    if (!result || recorded.current) return;
    recorded.current = true;
    store.recordResult({ id: `${Date.now().toString(36)}`, day: todayKey(), skillId: skill.id, mode, pass: result.pass, points: result.points, possible: result.possible, secs: result.secs });
  }, [result, skill.id, mode, store]);

  function begin() {
    setStarted(true);
    setRun(r => ({ ...r, lastTick: Date.now() }));
    setNow(Date.now());
  }
  function again(sameScenario = false) {
    recorded.current = false;
    const passes = recordFor(store.data, skill.id, "walk").passes;
    setRun(startRun(skill, { level, mode, seed: newSeed(), walkPasses: passes, scenarioId: sameScenario ? run.scenarioId : null }));
    setFeedback(null);
    setHinted(null);
    setStarted(false);
  }
  function doAction(id) {
    const out = act(skill, run, id, nowMs());
    setRun(out.run);
    setFeedback(out.feedback);
    setHinted(null);
  }
  function answer(index) {
    const out = answerEvent(skill, run, index, nowMs());
    setRun(out.run);
    setFeedback(out.feedback);
  }

  const liveSecs = run.simSecs + (started && !run.finished && run.lastTick ? Math.min(45, Math.max(0, (now - run.lastTick) / 1000)) : 0);
  const phase = currentPhase(steps, run.done);
  const doneCount = steps.filter(s => run.done[s.id]).length;
  const grouped = useMemo(() => {
    const byId = new Map([...steps, ...distractors].map(a => [a.id, a]));
    const groups = new Map(Object.keys(GROUPS).map(g => [g, []]));
    for (const id of run.actions) {
      const a = byId.get(id);
      if (a) groups.get(a.group)?.push(a);
    }
    return [...groups.entries()].filter(([, list]) => list.length);
  }, [run.actions, steps, distractors]);

  const ModeIcon = MODE_ICONS[mode];

  return (
    <section className={`mx-runner mx-runner--${mode}`}>
      <div className="mx-runner-top">
        <Link to="/medic?tab=skills" className="mx-link">
          <ArrowLeft size={16} aria-hidden="true" /> All practicals
        </Link>
        <h1>{skill.name}</h1>
        <div className="mx-mode-switch" role="radiogroup" aria-label="Pace">
          {MODES.map(m => {
            const Icon = MODE_ICONS[m.id];
            return (
              <button key={m.id} type="button" role="radio" aria-checked={m.id === mode} className={`mx-pace--${m.id}${m.id === mode ? " is-on" : ""}`} onClick={() => onMode(m.id)}>
                <Icon size={15} aria-hidden="true" /> {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {!started ? (
        <div className="mx-card mx-brief">
          <p className="mx-kicker">
            <ModeIcon size={15} aria-hidden="true" /> {MODES.find(m => m.id === mode).name} · {levelById.get(level).short}
          </p>
          <h2>{scenario.title}</h2>
          <p className="mx-dispatch">
            <Siren size={16} aria-hidden="true" /> {scenario.dispatch}
          </p>
          <p>{scenario.patient}</p>
          <ul className="mx-brief-rules">
            {mode === "crawl" && <li>No clock. Pick each step in a sensible order; if something is out of order or wrong, you'll be told why and can try again. Aim for a clean run.</li>}
            {mode === "walk" && (
              <li>
                Target time <strong>{clock(run.target)}</strong>
                {walkPasses ? ` (round ${walkPasses + 1}: it shrinks each time you pass)` : " (it shrinks each time you pass)"}. Every action costs about the time it takes on a real station, plus your thinking time. Wrong picks cost 10 seconds.
              </li>
            )}
            {mode === "run" && <li>Real time limit of <strong>{skill.minutes} minutes</strong>. Vitals are randomized and the patient may change on you. Handle surprises when they happen.</li>}
            <li>Pass {mode === "crawl" ? "with no mistakes" : "with 80% of the points and no critical fails"}.</li>
          </ul>
          <div className="mx-row">
            <button type="button" className="mx-btn mx-btn--primary" onClick={begin}>
              <Play size={16} aria-hidden="true" /> Start
            </button>
            <button type="button" className="mx-btn" onClick={() => again(false)}>
              <RotateCcw size={15} aria-hidden="true" /> Different patient
            </button>
          </div>
        </div>
      ) : result ? (
        <Results skill={skill} run={run} result={result} steps={steps} onAgain={again} onMode={onMode} mode={mode} />
      ) : (
        <>
          <div className="mx-status">
            {timed ? (
              <span className={`mx-clock${run.target && liveSecs > run.target ? " is-over" : ""}`}>
                <Timer size={16} aria-hidden="true" /> {clock(liveSecs)} <small>/ {clock(run.target)}</small>
              </span>
            ) : (
              <span className="mx-phase">Now: {skill.phases[phase] ?? "Finishing up"}</span>
            )}
            <span className="mx-progress" aria-label={`${doneCount} of ${steps.length} steps`}>
              <span style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </span>
            <span className="mx-small">
              {mode === "crawl" ? `${doneCount}/${steps.length} steps` : `${doneCount} done`} · {run.mistakes} {run.mistakes === 1 ? "mistake" : "mistakes"}
            </span>
          </div>

          <div className="mx-play">
            <aside className="mx-card mx-patient">
              <h2>{scenario.title}</h2>
              <p className="mx-dispatch">
                <Siren size={15} aria-hidden="true" /> {scenario.dispatch}
              </p>
              <p className="mx-muted">{scenario.patient}</p>
              <ol className="mx-log" aria-live="polite">
                {run.log.map((l, i) => (
                  <li key={i} className={`is-${l.kind}`}>
                    <span className="mx-log-at">{clock(l.at)}</span>
                    <span>
                      <strong>{l.text}</strong>
                      {l.detail && <span>{l.detail}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </aside>

            <div className="mx-board">
              {grouped.map(([group, list]) => (
                <div key={group} className="mx-group">
                  <h3>{GROUPS[group]}</h3>
                  <div className="mx-actions">
                    {list.map(a => {
                      const done = Boolean(run.done[a.id]);
                      const isHint = hinted === a.id;
                      return (
                        <button key={a.id} type="button" className={`mx-action${done ? " is-done" : ""}${isHint ? " is-hint" : ""}`} disabled={done || Boolean(event)} onClick={() => doAction(a.id)}>
                          {done && <CheckCircle2 size={15} aria-hidden="true" />}
                          <span>{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Sticks to the bottom of the screen so it is in view wherever you tapped. */}
              {feedback && (
                <div className={`mx-feedback is-${feedback.kind}`} role="status">
                  <strong>{feedback.title}</strong>
                  {/* Sticks to the bottom of the screen so it is in view wherever you tapped. */}
              {feedback.finding && <p className="mx-finding">{feedback.finding}</p>}
                  <p>{feedback.text}</p>
                </div>
              )}
              <div className="mx-row mx-board-foot">
                {mode === "crawl" && (
                  <button type="button" className="mx-btn" onClick={() => setHinted(hint(skill, run)?.id ?? null)}>
                    <Lightbulb size={15} aria-hidden="true" /> Hint
                  </button>
                )}
                <button type="button" className="mx-btn" onClick={() => setRun(finishRun(run))}>
                  <Flag size={15} aria-hidden="true" /> Finish station
                </button>
              </div>
            </div>
          </div>

          {event && (
            <div className="mx-event-backdrop">
              <div className="mx-card mx-event" role="alertdialog" aria-labelledby="mx-event-title">
                <p className="mx-kicker">
                  <AlertTriangle size={16} aria-hidden="true" /> The patient changes
                </p>
                <h2 id="mx-event-title">{event.text}</h2>
                <div className="mx-choices">
                  {event.options.map(o => (
                    <button key={o.index} type="button" className="mx-choice" onClick={() => answer(o.index)}>
                      <span>{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Results({ skill, run, result, steps, onAgain, onMode, mode }) {
  const nextMode = mode === "crawl" ? "walk" : mode === "walk" ? "run" : null;
  return (
    <div className="mx-card mx-results">
      <div className={`mx-verdict ${result.pass ? "is-pass" : "is-fail"}`}>
        {result.pass ? <CheckCircle2 size={28} aria-hidden="true" /> : <XCircle size={28} aria-hidden="true" />}
        <div>
          <h2>{result.pass ? (mode === "crawl" ? "Clean run" : "Pass") : mode === "crawl" && result.complete ? "Finished, not clean yet" : "Not a pass yet"}</h2>
          <p>
            {result.points} of {result.possible} points ({Math.round(result.share * 100)}%)
            {mode !== "crawl" && ` · ${clock(result.secs)} of ${clock(result.target)}`} · {result.mistakes} {result.mistakes === 1 ? "mistake" : "mistakes"}
          </p>
        </div>
      </div>

      {result.criticals.length > 0 && (
        <div className="mx-sheet">
          <h3>Critical criteria</h3>
          <ul className="mx-crit">{result.criticals.map(c => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      {result.missed.length > 0 && (
        <div className="mx-sheet">
          <h3>Missed steps</h3>
          <ul>
            {result.missed.map(s => (
              <li key={s.id}>
                <strong>{s.label}.</strong> {s.why}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.late.length > 0 && (
        <div className="mx-sheet">
          <h3>Done out of order</h3>
          <ul>{result.late.map(s => <li key={s.id}>{s.label} <span className="mx-muted">({skill.phases[s.phase]})</span></li>)}</ul>
        </div>
      )}
      {run.log.some(l => l.kind === "wrong" || l.kind === "danger" || l.kind === "early" || l.kind === "event-bad") && (
        <div className="mx-sheet">
          <h3>What to fix</h3>
          <ul>
            {run.log.filter(l => ["wrong", "danger", "early", "event-bad"].includes(l.kind)).map((l, i) => (
              <li key={i}>
                <strong>{l.text}</strong> {l.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.log.some(l => l.kind === "event-ok" || l.kind === "event-bad") && (
        <div className="mx-sheet">
          <h3>Surprises</h3>
          <ul>
            {run.log.filter(l => l.kind === "event-ok" || l.kind === "event-bad").map((l, i) => (
              <li key={i} className={l.kind === "event-ok" ? "is-done" : "is-missed"}>
                {l.kind === "event-ok" ? "✓" : "✗"} <strong>{l.text}</strong> <span className="mx-muted">You chose: {l.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mx-sheet">
        <summary>The full skill sheet</summary>
        {skill.phases.map((p, i) => (
          <div key={p}>
            <h4>{p}</h4>
            <ul>
              {steps.filter(s => s.phase === i).map(s => (
                <li key={s.id} className={run.done[s.id] ? "is-done" : "is-missed"}>
                  {run.done[s.id] ? "✓" : "✗"} {s.label} <span className="mx-muted">({s.pts} {s.pts === 1 ? "pt" : "pts"}{s.critical ? ", critical" : ""})</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>

      <div className="mx-row">
        <button type="button" className="mx-btn mx-btn--primary" onClick={() => onAgain(false)}>
          <RotateCcw size={15} aria-hidden="true" /> New patient
        </button>
        <button type="button" className="mx-btn" onClick={() => onAgain(true)}>Same patient again</button>
        {result.pass && nextMode && (
          <button type="button" className="mx-btn" onClick={() => onMode(nextMode)}>
            Try {MODES.find(m => m.id === nextMode).name}
          </button>
        )}
      </div>
    </div>
  );
}
