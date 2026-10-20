import { useMemo, useState } from "react";
import { Dumbbell, Trash2, X } from "lucide-react";

import { addDays, parseDay, shortDate, todayKey } from "../model/dates";
import { CARDIO_TYPES, GOALS, LEVELS, TIMES, describeProgram, planSessions, weeklyMinutes } from "../model/training";

const nextMonday = () => {
  const today = todayKey();
  const offset = (8 - parseDay(today).getDay()) % 7 || 7;
  return addDays(today, offset);
};

function Choice({ options, value, onChange, label }) {
  return (
    <div className="pf-segment" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

// Builds a plan from a goal, then shows its first week and how it stacks up
// against the guidelines before saving it to the calendar.
export default function TrainingPlanner({ program, onSave, onRemove, onClose }) {
  const [draft, setDraft] = useState(
    () => program ?? { id: crypto.randomUUID(), goal: "general", level: "new", days: 4, start: nextMonday(), weeks: 12, cardio: "run", time: "any" }
  );
  const set = change => setDraft(current => ({ ...current, ...change }));
  const sessions = useMemo(() => planSessions(draft), [draft]);
  const firstWeek = sessions.filter(s => s.week === sessions[0]?.week);
  const peak = Math.max(0, ...[...weeklyMinutes(sessions).values()].map(w => w.cardio));
  const strengthDays = weeklyMinutes(firstWeek).get(firstWeek[0]?.week)?.strengthDays ?? 0;
  const is5k = draft.goal === "5k";

  return (
    <section className="pf-panel pf-planner" aria-label="Training plan">
      <header className="pf-day-head">
        <div>
          <p className="pf-eyebrow">
            <Dumbbell size={12} aria-hidden="true" /> TRAINING PLAN
          </p>
          <h2>{program ? "Your training plan" : "Build a training plan"}</h2>
          <p className="pf-muted">Sessions go on your calendar. Outdoor ones get the best time of day from the forecast, and a heads-up when another day would be better.</p>
        </div>
        <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Close training plan">
          <X size={18} />
        </button>
      </header>

      <div className="pf-planner-grid">
        <div className="pf-form">
          <div className="pf-field">
            <span>Goal</span>
            <ul className="pf-presets pf-goals">
              {GOALS.map(g => (
                <li key={g.id}>
                  <button type="button" className="pf-preset" aria-pressed={draft.goal === g.id} onClick={() => set({ goal: g.id })}>
                    <strong>{g.name}</strong>
                    <span className="pf-muted">{g.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="pf-field">
            <span>Experience</span>
            <Choice options={LEVELS} value={draft.level} onChange={level => set({ level })} label="Experience" />
          </div>
          {!is5k && (
            <div className="pf-field">
              <span>Days a week</span>
              <Choice options={[3, 4, 5, 6].map(n => ({ id: n, name: String(n) }))} value={draft.days} onChange={days => set({ days })} label="Days a week" />
            </div>
          )}
          {!is5k && (
            <div className="pf-field">
              <span>Cardio</span>
              <Choice options={CARDIO_TYPES} value={draft.cardio} onChange={cardio => set({ cardio })} label="Cardio" />
            </div>
          )}
          <div className="pf-field">
            <span>Best time for you</span>
            <Choice options={TIMES} value={draft.time} onChange={time => set({ time })} label="Time of day" />
          </div>
          <div className="pf-field-row">
            <label className="pf-field">
              <span>Start</span>
              <input type="date" value={draft.start} onChange={e => e.target.value && set({ start: e.target.value })} />
            </label>
            {!is5k && (
              <label className="pf-field">
                <span>Length</span>
                <select value={draft.weeks} onChange={e => set({ weeks: Number(e.target.value) })}>
                  {[8, 12, 16].map(w => (
                    <option key={w} value={w}>
                      {w} weeks
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        <div className="pf-planner-preview">
          <p className="pf-eyebrow">FIRST WEEK</p>
          <ul className="pf-entries">
            {firstWeek.map(s => (
              <li key={s.id} className={`pf-entry pf-l-${s.type === "strength" ? "training" : "weather"}`}>
                <span className="pf-dot" aria-hidden="true" />
                <div className="pf-entry-main">
                  <span className="pf-entry-title">{s.title}</span>
                  <span className="pf-entry-meta">
                    {shortDate(s.day)} · {s.minutes} min{s.outdoor ? " · outside" : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="pf-eyebrow pf-planner-check">HOW IT STACKS UP</p>
          <ul className="pf-science">
            {!is5k && (
              <li>
                Strength {strengthDays} day{strengthDays === 1 ? "" : "s"} a week. The WHO recommends at least 2.{strengthDays >= 2 ? " ✓" : " Add a strength day if you can."}
              </li>
            )}
            <li>
              Cardio builds to about {peak} minutes a week. The WHO recommends 150–300 minutes of moderate activity.
              {peak < 150 ? " Brisk walks on other days make up the difference." : " ✓"}
            </li>
            {draft.goal === "cardio" && <li>About 80% easy and 20% hard, the mix most endurance athletes train with. The hard day is 4 × 4-minute intervals, shown to raise VO2max.</li>}
            {(draft.goal === "strength" || draft.goal === "general") && <li>Sets of 6–12 reps stopped 1–3 reps short of failure, adding weight once you hit the top of the range (ACSM progression guidelines).</li>}
            {is5k ? <li>Nine weeks of run/walk building to 30 minutes of running, 3 days a week with rest days between.</li> : <li>Volume rises about 8% a week, with a lighter week every fourth week to recover.</li>}
          </ul>
          <p className="pf-note">General guidance, not medical advice. Check with a doctor before starting if you have a health condition.</p>
        </div>
      </div>

      <footer className="pf-dialog-foot">
        {program && (
          <button type="button" className="pf-btn pf-btn-danger" onClick={onRemove}>
            <Trash2 size={15} aria-hidden="true" /> Remove plan
          </button>
        )}
        <span className="pf-spacer" />
        <span className="pf-muted pf-planner-summary">{describeProgram(draft)}</span>
        <button type="button" className="pf-btn pf-btn-primary" onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}>
          {program ? "Update plan" : "Add to calendar"}
        </button>
      </footer>
    </section>
  );
}
