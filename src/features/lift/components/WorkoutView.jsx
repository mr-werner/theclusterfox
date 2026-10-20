import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, RefreshCw, Repeat, Shuffle, Timer, Trash2, Trophy, X } from "lucide-react";

import HowTo from "./HowTo";
import { exercisesById } from "../data/exercises";
import { alternatives, GOALS, swapItem } from "../model/generate";
import { describeItem, formatRest, restFor } from "../model/format";

function loadHint(exercise) {
  if (exercise.gear.includes("bands")) return "e.g. red band";
  if (exercise.gear.includes("cable") || exercise.gear.includes("machines")) return "e.g. 50 lb";
  return exercise.gear.length ? "e.g. 25 lb" : "bodyweight";
}

function RestTimer({ rest, onDone }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  useEffect(() => {
    if (left > 0) return;
    navigator.vibrate?.(200);
    const id = setTimeout(onDone, 1500);
    return () => clearTimeout(id);
  }, [left, onDone]);

  return (
    <div className={`lf-rest ${left === 0 ? "is-done" : ""}`} role="status" aria-live="polite">
      <Timer size={18} aria-hidden="true" />
      <span>{left === 0 ? "Rest's over. Next set!" : <>Rest <strong>{formatRest(left)}</strong></>}</span>
      <div className="lf-rest-bar" aria-hidden="true">
        <span style={{ width: `${100 - (left / rest.total) * 100}%` }} />
      </div>
      <button type="button" className="lf-icon-btn" onClick={onDone} aria-label="Skip rest">
        <X size={16} />
      </button>
    </div>
  );
}

function ExerciseCard({ index, item, workout, lastLoad, onChange, onSetDone }) {
  const exercise = exercisesById.get(item.exerciseId);
  const [open, setOpen] = useState(index === 0);
  const [swapping, setSwapping] = useState(false);
  if (!exercise) return null;
  const complete = item.done.every(Boolean);
  const options = swapping
    ? alternatives(item.exerciseId, { gear: workout.gear, level: workout.level, skip: workout.items.map(i => i.exerciseId) }).slice(0, 6)
    : [];

  return (
    <li className={`lf-exercise ${complete ? "is-complete" : ""}`}>
      <div className="lf-exercise-head">
        <span className="lf-num" aria-hidden="true">{complete ? <Check size={16} /> : index + 1}</span>
        <div className="lf-exercise-title">
          <h3>{exercise.name}</h3>
          <p>
            {describeItem(item)} · rest {formatRest(item.restSec)}
          </p>
        </div>
        <button type="button" className="lf-ghost" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          How to
          <ChevronDown size={15} className={open ? "is-flipped" : ""} aria-hidden="true" />
        </button>
      </div>

      {open && <HowTo exercise={exercise} />}

      <div className="lf-sets" role="group" aria-label={`${exercise.name} sets`}>
        {item.done.map((done, i) => (
          <button
            key={i}
            type="button"
            className="lf-set"
            aria-pressed={done}
            onClick={() => onSetDone(i, !done)}
            aria-label={`Set ${i + 1}${done ? ", done" : ""}`}
          >
            {done ? <Check size={16} /> : `Set ${i + 1}`}
          </button>
        ))}
        <label className="lf-load">
          <span>Weight</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder={lastLoad ? `last: ${lastLoad}` : loadHint(exercise)}
            value={item.load}
            maxLength={24}
            onChange={event => onChange({ load: event.target.value })}
          />
        </label>
      </div>

      <div className="lf-exercise-foot">
        <button type="button" className="lf-ghost" onClick={() => setSwapping(v => !v)} aria-expanded={swapping}>
          <Repeat size={14} aria-hidden="true" /> Swap exercise
        </button>
      </div>
      {swapping && (
        <div className="lf-swap">
          {options.length === 0 && <p className="lf-muted lf-small">No other moves for this muscle with your gear.</p>}
          {options.map(alt => (
            <button
              key={alt.id}
              type="button"
              className="lf-chip"
              onClick={() => {
                onChange(swapItem(item, alt.id, workout.goal, workout.level));
                setSwapping(false);
              }}
            >
              {alt.name}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function Checklist({ title, steps, done, onToggle }) {
  return (
    <section className={`lf-panel lf-routine ${done ? "is-complete" : ""}`}>
      <div className="lf-panel-head">
        <h2>{title}</h2>
        <button type="button" className="lf-set" aria-pressed={done} onClick={onToggle}>
          {done ? <><Check size={16} /> Done</> : "Mark done"}
        </button>
      </div>
      <ul>
        {steps.map(step => <li key={step}>{step}</li>)}
      </ul>
    </section>
  );
}

/** The workout being followed: tick sets off, rest, swap moves, finish. */
export default function WorkoutView({ workout, history, onChange, onShuffle, onFinish, onDiscard }) {
  const [rest, setRest] = useState(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const endRest = useCallback(() => setRest(null), []);
  const setsTotal = workout.items.reduce((n, i) => n + i.sets, 0);
  const setsDone = workout.items.reduce((n, i) => n + i.done.filter(Boolean).length, 0);
  const started = setsDone > 0;
  const lastLoads = {};
  for (const h of [...history].reverse()) Object.assign(lastLoads, h.loads);

  const changeItem = (index, change) =>
    onChange(w => ({ items: w.items.map((it, i) => (i === index ? { ...it, ...change } : it)) }));

  const setDone = (index, setIndex, value) => {
    const item = workout.items[index];
    changeItem(index, { done: item.done.map((d, i) => (i === setIndex ? value : d)) });
    const last = item.done.filter(Boolean).length + 1 === item.sets;
    if (value && !(last && index === workout.items.length - 1)) {
      setRest(restFor(item.restSec));
    }
  };

  return (
    <div className="lf-workout">
      <section className="lf-panel lf-summary">
        <div>
          <p className="lf-eyebrow">{GOALS[workout.goal]?.name.toUpperCase()} · ABOUT {workout.estMinutes} MIN</p>
          <h2>{workout.title}</h2>
          {workout.estMinutes < workout.minutes - 8 && (
            <p className="lf-muted lf-small">
              That's all the useful work we could fit for these muscles with your gear. Add muscles or gear for a longer session.
            </p>
          )}
        </div>
        <div className="lf-progress" aria-label={`${setsDone} of ${setsTotal} sets done`}>
          <span style={{ width: `${(setsDone / Math.max(1, setsTotal)) * 100}%` }} />
        </div>
        <p className="lf-muted lf-small">{setsDone} of {setsTotal} sets done</p>
        <div className="lf-actions">
          {!started && !workout.planId && (
            <button type="button" className="lf-ghost" onClick={onShuffle}>
              <Shuffle size={14} aria-hidden="true" /> Different exercises
            </button>
          )}
          {confirmDiscard ? (
            <span className="lf-confirm">
              Throw this workout away?
              <button type="button" className="lf-ghost lf-danger" onClick={onDiscard}>Yes</button>
              <button type="button" className="lf-ghost" onClick={() => setConfirmDiscard(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="lf-ghost" onClick={() => (started ? setConfirmDiscard(true) : onDiscard())}>
              {started ? <Trash2 size={14} aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
              {started ? "Discard" : "Change inputs"}
            </button>
          )}
        </div>
      </section>

      {workout.warmup.length > 0 && (
        <Checklist title="Warm-up" steps={workout.warmup} done={workout.warmupDone} onToggle={() => onChange({ warmupDone: !workout.warmupDone })} />
      )}

      <ol className="lf-exercises">
        {workout.items.map((item, index) => (
          <ExerciseCard
            key={`${index}-${item.exerciseId}`}
            index={index}
            item={item}
            workout={workout}
            lastLoad={lastLoads[item.exerciseId]}
            onChange={change => changeItem(index, change)}
            onSetDone={(setIndex, value) => setDone(index, setIndex, value)}
          />
        ))}
      </ol>

      {workout.cooldown.length > 0 && (
        <Checklist title="Cool-down stretches" steps={workout.cooldown} done={workout.cooldownDone} onToggle={() => onChange({ cooldownDone: !workout.cooldownDone })} />
      )}

      <button type="button" className="lf-btn lf-btn--big" onClick={onFinish} disabled={!started}>
        <Trophy size={18} aria-hidden="true" />
        {setsDone === setsTotal ? "Finish workout" : started ? `Finish early (${setsDone}/${setsTotal} sets)` : "Tick off a set to start"}
      </button>

      {rest && <RestTimer key={rest.key} rest={rest} onDone={endRest} />}
    </div>
  );
}
