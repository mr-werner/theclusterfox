import { useMemo, useState } from "react";
import { CalendarCheck, CalendarPlus, Pencil, Plus, Target, Trash2 } from "lucide-react";

import { activities, activitiesById } from "../data/activities";
import { suggestSessions, TIMES_OF_DAY } from "../model/coach";
import { notableFactors } from "../model/score";
import { formatHour } from "../units";
import { dayName } from "../when";
import ScoreBadge from "./ScoreBadge";

const MINUTES = [30, 45, 60, 90, 120];

// Goals people start from most often.
const STARTERS = [
  { activityId: "run-easy", perWeek: 3, minutes: 45, timeOfDay: "morning", label: "Run 3 times a week" },
  { activityId: "bike-road", perWeek: 2, minutes: 90, timeOfDay: "any", label: "Ride twice a week" },
  { activityId: "brisk", perWeek: 5, minutes: 30, timeOfDay: "any", label: "Walk 5 days a week" },
  { activityId: "hike", perWeek: 1, minutes: 120, timeOfDay: "any", label: "Hike every weekend" },
];

// The one thing to remember for a session: sunscreen, air or heat.
function sessionNote(window) {
  const uv = Math.max(...window.map(h => h.uv ?? 0));
  const aqi = Math.max(0, ...window.map(h => h.aqi).filter(Number.isFinite));
  if (aqi > 100) return `AQI ${Math.round(aqi)}, so keep it easy.`;
  if (uv >= 3) return `UV ${Math.round(uv)}: wear SPF ${uv >= 8 ? 50 : 30}+.`;
  return "";
}

const minutesLabel = minutes => (minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`.replace(".5 hr", "½ hr"));

function GoalForm({ initial, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const set = change => setDraft(current => ({ ...current, ...change }));
  return (
    <form
      className="cc-plan-form"
      onSubmit={event => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div className="cc-field-grid">
        <label className="cc-field">
          <span className="cc-label">Activity</span>
          <select value={draft.activityId} onChange={event => set({ activityId: event.target.value })}>
            {activities.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="cc-field">
          <span className="cc-label">Times a week</span>
          <select value={draft.perWeek} onChange={event => set({ perWeek: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5, 6, 7].map(n => (
              <option key={n} value={n}>
                {n === 7 ? "Every day" : `${n}×`}
              </option>
            ))}
          </select>
        </label>
        <div className="cc-field">
          <span className="cc-label">Each session</span>
          <div className="cc-segment" role="group" aria-label="Each session">
            {MINUTES.map(m => (
              <button key={m} type="button" aria-pressed={draft.minutes === m} onClick={() => set({ minutes: m })}>
                {minutesLabel(m)}
              </button>
            ))}
          </div>
        </div>
        <div className="cc-field">
          <span className="cc-label">When you like to go</span>
          <div className="cc-segment" role="group" aria-label="When you like to go">
            {Object.entries(TIMES_OF_DAY).map(([id, time]) => (
              <button key={id} type="button" aria-pressed={draft.timeOfDay === id} onClick={() => set({ timeOfDay: id })}>
                {time.name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="cc-form-actions">
        <button type="button" className="cc-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="cc-btn cc-btn-primary">
          {initial.id ? "Save goal" : "Add goal"}
        </button>
      </div>
    </form>
  );
}

function GoalCard({ goal, coaching, onEdit, onDelete, onPlan }) {
  const activity = activitiesById.get(goal.activityId);
  if (!activity) return null;
  const Icon = activity.icon;
  const { needed, planned, sessions } = coaching;
  const done = Math.min(goal.perWeek, planned);

  return (
    <li className="cc-goal">
      <div className="cc-plan-head">
        <span className="cc-plan-icon" aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="cc-plan-title">
          <strong>
            {activity.name} {goal.perWeek === 7 ? "every day" : `${goal.perWeek}× a week`}
          </strong>
          <span className="cc-muted">
            {minutesLabel(goal.minutes)} · {TIMES_OF_DAY[goal.timeOfDay]?.name ?? "Any time"}
          </span>
        </div>
        <span className="cc-plan-tools">
          <button type="button" className="cc-icon-btn" onClick={onEdit} title="Edit goal" aria-label={`Edit ${activity.name} goal`}>
            <Pencil size={15} />
          </button>
          <button type="button" className="cc-icon-btn" onClick={onDelete} title="Delete goal" aria-label={`Delete ${activity.name} goal`}>
            <Trash2 size={15} />
          </button>
        </span>
      </div>

      <div className="cc-progress" aria-label={`${done} of ${goal.perWeek} planned in the next 7 days`}>
        <span className="cc-progress-bar">
          <span style={{ width: `${(done / goal.perWeek) * 100}%` }} />
        </span>
        <span className="cc-muted">
          {done} of {goal.perWeek} planned this week
        </span>
      </div>

      {needed === 0 ? (
        <p className="cc-goal-done">
          <CalendarCheck size={16} aria-hidden="true" /> You're set for the week.
        </p>
      ) : sessions.length ? (
        <>
          <div className="cc-goal-sub">
            <span className="cc-label">Best times in the forecast</span>
            {sessions.length > 1 && (
              <button type="button" className="cc-link-btn" onClick={() => onPlan(sessions)}>
                <Plus size={14} aria-hidden="true" /> Add all {sessions.length}
              </button>
            )}
          </div>
          <ul className="cc-sessions">
            {sessions.map(session => (
              <li key={session.day}>
                <div className="cc-session-when">
                  <strong>{dayName(session.day, session.dayIndex)}</strong>
                  <span className="cc-muted">
                    {formatHour(session.startHour)}–{formatHour((session.startHour + session.window.length) % 24)}
                  </span>
                </div>
                <ScoreBadge result={session} size="small" />
                <p className="cc-session-why">{session.why}</p>
                <button type="button" className="cc-btn cc-btn-small" onClick={() => onPlan([session])}>
                  <CalendarPlus size={14} aria-hidden="true" /> Add
                </button>
              </li>
            ))}
          </ul>
          {sessions.length < needed && (
            <p className="cc-note">
              Only {sessions.length} good {sessions.length === 1 ? "slot fits" : "slots fit"} around what you've already planned. Try another time of day for the rest.
            </p>
          )}
        </>
      ) : (
        <p className="cc-note">No free slots left in the next 7 days for this time of day.</p>
      )}
    </li>
  );
}

/**
 * Training goals, and the best times in the forecast to meet them, with
 * the advice for each session.
 */
export default function Coach({ forecast, place, options, goals, plans, now, onSaveGoal, onDeleteGoal, onSavePlan, onOpenPlanner }) {
  const { hours, days } = forecast;
  const dayKeys = useMemo(() => days.map(d => d.day), [days]);
  const [editing, setEditing] = useState(null);
  const [added, setAdded] = useState(0);

  const coaching = useMemo(() => {
    const map = new Map();
    for (const goal of goals) {
      const activity = activitiesById.get(goal.activityId);
      if (!activity) continue;
      const result = suggestSessions(hours, dayKeys, place, goal, activity, plans, { notBefore: now, options });
      result.sessions = result.sessions.map(session => {
        const why = notableFactors(session, 2).length
          ? `The pick of the day, but still ${notableFactors(session, 2).map(f => f.text).join(" and ")}.`
          : "Comfortable, dry and in daylight.";
        return { ...session, dayIndex: dayKeys.indexOf(session.day), why: [why, sessionNote(session.window)].filter(Boolean).join(" ") };
      });
      map.set(goal.id, result);
    }
    return map;
  }, [goals, hours, dayKeys, place, plans, now, options]);

  function plan(goal, sessions) {
    for (const session of sessions) {
      onSavePlan({ activityId: goal.activityId, title: "", day: session.day, startHour: session.startHour, hours: session.window.length });
    }
    setAdded(sessions.length);
  }

  return (
    <section className="cc-panel cc-coach" aria-labelledby="cc-coach-title">
      <div className="cc-section-head">
        <div>
          <p className="cc-eyebrow">COACH</p>
          <h2 id="cc-coach-title">Train when the weather's on your side</h2>
        </div>
        {!editing && goals.length > 0 && (
          <button type="button" className="cc-btn" onClick={() => setEditing({ activityId: "run-easy", perWeek: 3, minutes: 45, timeOfDay: "any" })}>
            <Target size={16} aria-hidden="true" /> New goal
          </button>
        )}
      </div>

      {added > 0 && (
        <p className="cc-added" role="status">
          Added {added} {added === 1 ? "session" : "sessions"} to your plan.{" "}
          <button type="button" className="cc-link-btn" onClick={onOpenPlanner}>
            See the planner
          </button>
        </p>
      )}

      {editing && (
        <GoalForm
          key={editing.id ?? "new"}
          initial={editing}
          onSave={goal => {
            onSaveGoal(goal);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {goals.length === 0 && !editing && (
        <div className="cc-coach-empty">
          <p className="cc-muted">
            Set a goal and CloCast picks the best times in the forecast for it: cooler mornings when it's hot, cleaner air, less UV and
            no rain, spaced through the week.
          </p>
          <div className="cc-starters">
            {STARTERS.map(({ label, ...goal }) => {
              const Icon = activitiesById.get(goal.activityId).icon;
              return (
                <button key={label} type="button" className="cc-starter" onClick={() => onSaveGoal(goal)}>
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
            <button type="button" className="cc-starter" onClick={() => setEditing({ activityId: "run-easy", perWeek: 3, minutes: 45, timeOfDay: "any" })}>
              <Plus size={18} aria-hidden="true" />
              <span>Something else</span>
            </button>
          </div>
        </div>
      )}

      {goals.length > 0 && (
        <ul className="cc-goals">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              coaching={coaching.get(goal.id) ?? { needed: 0, planned: 0, sessions: [] }}
              onEdit={() => setEditing(goal)}
              onDelete={() => onDeleteGoal(goal.id)}
              onPlan={sessions => plan(goal, sessions)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
