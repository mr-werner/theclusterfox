import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, Minus, Plus, SkipForward, Trophy, X } from "lucide-react";

import { exercisesById } from "../data/exercises";
import { formatRest, restFor } from "../model/format";
import { bestByExercise, convert, e1rm, fmtWeight, lastSets, parseLoad, targetReps } from "../model/records";

const STEP = { lb: 5, kg: 2.5 };

// First set still to do, as [item index, set index].
function nextOpen(workout) {
  for (let i = 0; i < workout.items.length; i++) {
    const k = workout.items[i].done.indexOf(false);
    if (k !== -1) return [i, k];
  }
  return null;
}

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    osc.onended = () => ctx.close();
  } catch {
    /* no audio available */
  }
}

function Rest({ rest, sound, onAdd, onDone }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const fired = useRef(false);
  useEffect(() => {
    if (left > 0 || fired.current) return undefined;
    fired.current = true;
    navigator.vibrate?.([200, 100, 200]);
    if (sound) beep();
    const id = setTimeout(onDone, 1200);
    return () => clearTimeout(id);
  }, [left, sound, onDone]);
  const share = left / rest.total;

  return (
    <div className={`lff-rest ${left === 0 ? "is-done" : ""}`} role="timer" aria-live="polite" aria-label={`Rest, ${left} seconds left`}>
      <p className="lff-label">{left === 0 ? "Go" : "Rest"}</p>
      <div className="lff-rest-clock" style={{ "--share": share }}>
        <span>{left === 0 ? "GO" : formatRest(left)}</span>
      </div>
      <div className="lff-rest-actions">
        <button type="button" className="lff-ghost" onClick={() => onAdd(15)}>+15s</button>
        <button type="button" className="lff-ghost" onClick={onDone}>
          <SkipForward size={18} aria-hidden="true" /> Skip
        </button>
      </div>
    </div>
  );
}

function Stepper({ label, value, unit, step, onChange, min = 0, empty = "–" }) {
  return (
    <div className="lff-stepper">
      <span className="lff-label">{label}</span>
      <div className="lff-stepper-row">
        <button type="button" onClick={() => onChange(Math.max(min, (value ?? 0) - step))} aria-label={`Less ${label.toLowerCase()}`}>
          <Minus size={28} strokeWidth={2.6} />
        </button>
        <output aria-live="polite">
          {value || empty}
          {unit && value > 0 && <small>{unit}</small>}
        </output>
        <button type="button" onClick={() => onChange((value ?? 0) + step)} aria-label={`More ${label.toLowerCase()}`}>
          <Plus size={28} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

/**
 * Active workout: one set at a time, big controls, logging in one tap,
 * automatic rest and a quiet flash for new records.
 */
export default function FocusMode({ workout, history, prefs, setPrefs, onChange, onFinish, onExit }) {
  const unit = prefs.unit;
  const auto = nextOpen(workout);
  const [pick, setPick] = useState(null); // a set chosen by hand, else the next open one
  const at = pick ?? auto;
  const [rest, setRest] = useState(null);
  const [record, setRecord] = useState(null);
  const best = useMemo(() => bestByExercise(history, unit), [history, unit]);

  const item = at ? workout.items[at[0]] : null;
  const exercise = item ? exercisesById.get(item.exerciseId) : null;
  const timed = Boolean(item?.seconds);
  const previous = item ? lastSets(history, item.exerciseId) : null;

  // Starting numbers: this workout's last logged set, last time's, the typed load, the target.
  const suggested = useMemo(() => {
    if (!item) return { w: null, r: null };
    const inWorkout = [...(item.log ?? [])].slice(0, at[1]).reverse().find(s => s?.w || s?.r);
    const before = previous?.sets[Math.min(at[1], previous.sets.length - 1)];
    const w = inWorkout?.w ?? (before?.w ? Math.round(convert(before.w, previous.unit, unit)) : parseLoad(item.load));
    return { w: w ?? null, r: inWorkout?.r ?? before?.r ?? targetReps(item) };
  }, [item, at, previous, unit]);
  const [draft, setDraft] = useState(suggested);
  const key = at ? `${at[0]}-${at[1]}` : "done";
  const [draftKey, setDraftKey] = useState(key);
  if (draftKey !== key) {
    setDraftKey(key);
    setDraft(suggested);
  }

  const endRest = useCallback(() => setRest(null), []);

  function completeSet() {
    if (!item) return;
    const [i, k] = at;
    const set = timed ? null : { w: draft.w || null, r: draft.r || null };
    onChange(w => ({
      items: w.items.map((it, idx) => {
        if (idx !== i) return it;
        const log = Array.from({ length: it.sets }, (_, n) => (n === k ? set : it.log?.[n] ?? null));
        return {
          ...it,
          done: it.done.map((d, n) => (n === k ? true : d)),
          log,
          load: set?.w ? `${set.w} ${unit}` : it.load,
        };
      }),
    }));
    const est = set ? e1rm(set.w, set.r) : null;
    const prior = best[item.exerciseId]?.e1rm ?? 0;
    if (est && prior > 0 && est > prior + 0.01) {
      setRecord({ name: exercise.name, text: `${fmtWeight(set.w, unit)} × ${set.r}` });
      setTimeout(() => setRecord(null), 3200);
    }
    setPick(null);
    const isLast = !workout.items.some((it, idx) => it.done.some((d, n) => !d && !(idx === i && n === k)));
    if (!isLast) setRest(restFor(item.restSec));
  }

  function move(delta) {
    if (!at) return;
    const flat = workout.items.flatMap((it, i) => it.done.map((_, k) => [i, k]));
    const pos = flat.findIndex(([i, k]) => i === at[0] && k === at[1]);
    const next = flat[pos + delta];
    if (next) setPick(next);
  }

  const setsTotal = workout.items.reduce((n, i) => n + i.sets, 0);
  const setsDone = workout.items.reduce((n, i) => n + i.done.filter(Boolean).length, 0);

  // Rendered at the top of the page so nothing on it can clip or offset it.
  return createPortal(
    <div className="lff" role="dialog" aria-modal="true" aria-label="Active workout">
      <header className="lff-top">
        <button type="button" className="lff-icon" onClick={onExit} aria-label="Leave training mode">
          <X size={22} />
        </button>
        <div className="lff-progress" aria-label={`${setsDone} of ${setsTotal} sets done`}>
          <span style={{ width: `${(setsDone / Math.max(1, setsTotal)) * 100}%` }} />
        </div>
        <button type="button" className="lff-unit" onClick={() => setPrefs({ unit: unit === "lb" ? "kg" : "lb" })} aria-label={`Weights in ${unit}, switch`}>
          {unit}
        </button>
        <button
          type="button"
          className="lff-icon"
          onClick={() => setPrefs({ restSound: !prefs.restSound })}
          aria-pressed={prefs.restSound}
          aria-label={prefs.restSound ? "Rest sound on" : "Rest sound off"}
        >
          {prefs.restSound ? <Bell size={20} /> : <BellOff size={20} />}
        </button>
      </header>

      {rest ? (
        <Rest
          key={rest.key}
          rest={rest}
          sound={prefs.restSound}
          onAdd={sec => setRest(r => ({ ...r, endsAt: r.endsAt + sec * 1000, total: r.total + sec }))}
          onDone={endRest}
        />
      ) : !item ? (
        <div className="lff-finish">
          <Trophy size={56} aria-hidden="true" />
          <h2>Every set done.</h2>
          <p>{setsTotal} sets in the book.</p>
          <button type="button" className="lff-go" onClick={onFinish}>
            Finish workout
          </button>
        </div>
      ) : (
        <div className="lff-set" key={key}>
          <p className="lff-label">
            Exercise {at[0] + 1} of {workout.items.length}
          </p>
          <h2 className="lff-name">{exercise?.name}</h2>

          <div className="lff-dots" aria-label={`Set ${at[1] + 1} of ${item.sets}`}>
            {item.done.map((d, n) => (
              <button
                key={n}
                type="button"
                className={`${d ? "is-done" : ""} ${n === at[1] ? "is-now" : ""}`}
                onClick={() => setPick([at[0], n])}
                aria-label={`Set ${n + 1}${d ? ", done" : ""}`}
              >
                {d ? <Check size={14} strokeWidth={3} /> : n + 1}
              </button>
            ))}
          </div>

          <p className="lff-target">
            Target {timed ? `${item.seconds}s hold` : `${item.reps} reps`}
            {item.perSide ? " each side" : ""}
            {previous && !timed && (
              <span className="lff-last">
                Last time:{" "}
                {previous.sets
                  .slice(0, 4)
                  .map(s => (s.w ? `${Math.round(convert(s.w, previous.unit, unit))}×${s.r ?? "?"}` : `${s.r ?? "?"} reps`))
                  .join(", ")}
              </span>
            )}
          </p>

          {!timed && (
            <div className="lff-steppers">
              <Stepper
                label={exercise?.gear.length ? "Weight" : "Added weight"}
                value={draft.w}
                unit={unit}
                step={STEP[unit]}
                empty={exercise?.gear.length ? "–" : "BW"}
                onChange={w => setDraft(d => ({ ...d, w }))}
              />
              <Stepper label="Reps" value={draft.r} step={1} min={1} onChange={r => setDraft(d => ({ ...d, r }))} />
            </div>
          )}

          <button type="button" className="lff-go" onClick={completeSet}>
            <Check size={28} strokeWidth={3} aria-hidden="true" />
            {item.done[at[1]] ? "Update set" : "Set done"}
          </button>

          <div className="lff-nav">
            <button type="button" className="lff-ghost" onClick={() => move(-1)}>
              <ChevronLeft size={18} aria-hidden="true" /> Back
            </button>
            <button type="button" className="lff-ghost" onClick={() => move(1)}>
              Next <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {record && (
        <div className="lff-record" role="status">
          <Trophy size={22} aria-hidden="true" />
          <span>
            <strong>New record</strong> {record.name} · {record.text}
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}
