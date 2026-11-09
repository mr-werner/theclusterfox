import { useEffect, useRef, useState } from "react";
import { AArrowDown, AArrowUp, Bell, Check, ChevronLeft, ChevronRight, ListChecks, Lightbulb, Pause, Play, Plus, RotateCcw, Store, Sun, Timer, X } from "lucide-react";
import { Segmented } from "./ui";
import { clockText } from "./format";
import { IngredientLine } from "./RecipeDetail";
import { ingredientsById } from "../data/ingredients";
import { linesByKey, scaledUses, scaleFactor, servingWord } from "../model/recipe";
import { amountText, renderTemps } from "../model/units";
import * as S from "../model/session";
import { primeAlarm, useWakeLock } from "../state/device";

export default function CookMode({ recipe, session, prefs, setPrefs, update, now, onExit, onFinish, onPlanB }) {
  const [overview, setOverview] = useState(false);
  const headingRef = useRef(null);
  const i = session.step;
  const step = recipe.steps[i];
  const last = i === recipe.steps.length - 1;
  const uses = scaledUses(recipe, i, session.servings);
  const timer = S.timerFor(session, i);
  const tState = S.timerState(timer, now);
  const otherTimers = session.timers.filter(t => t.step !== i);
  const wake = useWakeLock(prefs.keepAwake);
  const doneCount = session.doneSteps.length;

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [i]);

  // Arrow keys move between steps.
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.("input, textarea, select, dialog")) return;
      if (e.key === "ArrowRight") update(s => S.goToStep(s, recipe, s.step + 1));
      if (e.key === "ArrowLeft") update(s => S.goToStep(s, recipe, s.step - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recipe, update]);

  const startTimer = (stepIndex, t) => {
    primeAlarm();
    update(s => S.startTimer(s, stepIndex, t.label, t.minutes * 60, Date.now()));
  };

  return (
    <div className={`ck-cook ck-text-${prefs.textSize}`} role="region" aria-label={`Cooking ${recipe.title}`}>
      <header className="ck-cook-bar">
        <button type="button" className="ck-icon-btn" onClick={onExit} aria-label="Leave cooking mode (progress is saved)">
          <X size={20} />
        </button>
        <div className="ck-cook-title">
          <strong>{recipe.title}</strong>
          <span>
            {session.servings} {servingWord(recipe, session.servings)} · Step {i + 1} of {recipe.steps.length}
          </span>
        </div>
        <div className="ck-cook-tools">
          <button type="button" className="ck-icon-btn" onClick={() => setPrefs({ textSize: Math.max(0, prefs.textSize - 1) })} disabled={prefs.textSize === 0} aria-label="Smaller text">
            <AArrowDown size={20} />
          </button>
          <button type="button" className="ck-icon-btn" onClick={() => setPrefs({ textSize: Math.min(2, prefs.textSize + 1) })} disabled={prefs.textSize === 2} aria-label="Larger text">
            <AArrowUp size={20} />
          </button>
          <button type="button" className="ck-icon-btn" aria-pressed={overview} onClick={() => setOverview(o => !o)} aria-label="All ingredients">
            <ListChecks size={20} />
          </button>
        </div>
      </header>

      <nav className="ck-cook-progress" aria-label="Steps">
        {recipe.steps.map((s, n) => (
          <button
            key={n}
            type="button"
            className={`${session.doneSteps.includes(n) ? "is-done" : ""} ${n === i ? "is-current" : ""}`}
            aria-current={n === i ? "step" : undefined}
            aria-label={`Step ${n + 1}: ${s.title}${session.doneSteps.includes(n) ? " (done)" : ""}`}
            onClick={() => update(x => S.goToStep(x, recipe, n))}
          />
        ))}
      </nav>
      <p className="sr-only" aria-live="polite">
        {doneCount} of {recipe.steps.length} steps done
      </p>

      {otherTimers.length > 0 && (
        <div className="ck-cook-timers" aria-label="Other timers">
          {otherTimers.map(t => {
            const st = S.timerState(t, now);
            return (
              <button key={t.step} type="button" className={`ck-timer-chip${st.finished ? " is-done" : ""}`} onClick={() => update(x => S.goToStep(x, recipe, t.step))}>
                <Timer size={14} aria-hidden="true" /> {t.label} · {st.finished ? "Done!" : clockText(st.left)}
                {st.paused && !st.finished ? " (paused)" : ""}
              </button>
            );
          })}
        </div>
      )}

      <main className="ck-cook-body">
        <p className="ck-eyebrow">
          Step {i + 1}
          {session.doneSteps.includes(i) && (
            <span className="ck-done-tag">
              <Check size={13} aria-hidden="true" /> Done
            </span>
          )}
        </p>
        <h2 ref={headingRef} tabIndex={-1}>
          {step.title}
        </h2>
        <p className="ck-cook-text">{renderTemps(step.text, prefs.temp)}</p>

        {uses.length > 0 && (
          <section className="ck-cook-section" aria-labelledby="ck-uses-h">
            <h3 id="ck-uses-h">Add in this step</h3>
            <ul className="ck-checks">
              {uses.map(u => {
                const on = Boolean(session.used[S.usedKey(i, u.key)]);
                return (
                  <li key={u.key}>
                    <label className={on ? "is-on" : ""}>
                      <input type="checkbox" checked={on} onChange={() => update(s => S.toggleUsed(s, i, u.key))} />
                      <span className="ck-box" aria-hidden="true">
                        <Check size={16} />
                      </span>
                      <span>
                        <IngredientLine line={u} amount={u.amount} mode={prefs.measure} />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="ck-cook-section" aria-labelledby="ck-tasks-h">
          <h3 id="ck-tasks-h">To do</h3>
          <ul className="ck-checks">
            {step.tasks.map(task => {
              const on = Boolean(session.tasks[S.taskKey(i, task)]);
              return (
                <li key={task}>
                  <label className={on ? "is-on" : ""}>
                    <input type="checkbox" checked={on} onChange={() => update(s => S.toggleTask(s, i, task))} />
                    <span className="ck-box" aria-hidden="true">
                      <Check size={16} />
                    </span>
                    <span>{task}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        {step.timer && (
          <section className={`ck-timer${tState?.finished ? " is-done" : ""}${tState?.running ? " is-running" : ""}`} aria-label={`${step.timer.label} timer`}>
            <div className="ck-timer-read">
              {tState?.finished ? <Bell size={22} aria-hidden="true" /> : <Timer size={22} aria-hidden="true" />}
              <div>
                <span className="ck-timer-label">{step.timer.label}</span>
                <strong className="ck-timer-clock" role="timer" aria-live={tState?.finished ? "assertive" : "off"}>
                  {tState?.finished ? "Time's up" : clockText(tState ? tState.left : step.timer.minutes * 60)}
                </strong>
              </div>
            </div>
            <div className="ck-timer-actions">
              {!tState || tState.paused ? (
                <button type="button" className="ck-btn ck-btn--primary" onClick={() => startTimer(i, step.timer)}>
                  <Play size={16} aria-hidden="true" /> {tState?.paused ? "Resume" : `Start ${step.timer.minutes} min`}
                </button>
              ) : tState.running ? (
                <button type="button" className="ck-btn" onClick={() => update(s => S.pauseTimer(s, i, Date.now()))}>
                  <Pause size={16} aria-hidden="true" /> Pause
                </button>
              ) : null}
              {tState && (
                <>
                  <button type="button" className="ck-btn" onClick={() => update(s => S.addTime(s, i, 60, Date.now()))}>
                    <Plus size={16} aria-hidden="true" /> 1 min
                  </button>
                  <button type="button" className="ck-btn ck-btn--quiet" onClick={() => update(s => S.clearTimer(s, i))}>
                    <RotateCcw size={16} aria-hidden="true" /> {tState.finished ? "Clear" : "Reset"}
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {step.tip && (
          <p className="ck-tip">
            <Lightbulb size={18} aria-hidden="true" /> {step.tip}
          </p>
        )}

        <div className="ck-cook-extras">
          <Segmented
            small
            label="Measurements"
            value={prefs.measure}
            onChange={measure => setPrefs({ measure })}
            options={[
              { value: "volume", label: "Volume" },
              { value: "weight", label: "Weight" },
            ]}
          />
          {wake.supported && (
            <button type="button" className="ck-toggle" aria-pressed={prefs.keepAwake} onClick={() => setPrefs({ keepAwake: !prefs.keepAwake })}>
              <Sun size={15} aria-hidden="true" /> Keep screen on
            </button>
          )}
          <button type="button" className="ck-btn ck-btn--quiet" onClick={onPlanB}>
            <Store size={16} aria-hidden="true" /> Change of plans?
          </button>
        </div>
      </main>

      <footer className="ck-cook-nav">
        <button type="button" className="ck-btn ck-btn--big" onClick={() => update(s => S.goToStep(s, recipe, i - 1))} disabled={i === 0}>
          <ChevronLeft size={20} aria-hidden="true" /> Back
        </button>
        {last ? (
          <button
            type="button"
            className="ck-btn ck-btn--primary ck-btn--big"
            onClick={() => {
              update(s => S.toggleStepDone(s, i, true));
              onFinish();
            }}
          >
            <Check size={20} aria-hidden="true" /> Finish
          </button>
        ) : (
          <button type="button" className="ck-btn ck-btn--primary ck-btn--big" onClick={() => update(s => S.completeStep(s, recipe, i))}>
            Next step <ChevronRight size={20} aria-hidden="true" />
          </button>
        )}
      </footer>

      {overview && <IngredientOverview recipe={recipe} session={session} prefs={prefs} onClose={() => setOverview(false)} />}
    </div>
  );
}

function IngredientOverview({ recipe, session, prefs, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    // No close() on cleanup: closing fires onClose, which would undo the open
    // when React re-runs effects. Unmounting removes the dialog anyway.
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);
  const summary = S.usageSummary(recipe, session);
  const lines = linesByKey(recipe);
  const f = scaleFactor(recipe, session.servings);
  return (
    <dialog ref={ref} className="ck-dialog" onClose={onClose} aria-labelledby="ck-ov-h">
      <div className="ck-dialog-head">
        <h2 id="ck-ov-h">Ingredients so far</h2>
        <button type="button" className="ck-icon-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <ul className="ck-overview">
        {summary.map(u => {
          const item = ingredientsById.get(u.ing);
          const line = lines.get(u.key);
          const steps = recipe.steps.map((s, n) => (s.uses.some(x => x.ing === u.key) ? n + 1 : null)).filter(Boolean);
          return (
            <li key={u.key} className={u.done ? "is-done" : u.used > 0 ? "is-partial" : ""}>
              <div>
                <IngredientLine line={line} amount={line.amount * f} mode={prefs.measure} />
                <span className="ck-muted ck-overview-steps"> · step{steps.length > 1 ? "s" : ""} {steps.join(", ")}</span>
              </div>
              <span className="ck-overview-state">
                {u.done ? "All in" : u.used > 0 ? `${amountText(item, u.remaining, prefs.measure).text} left` : "Not yet"}
              </span>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
