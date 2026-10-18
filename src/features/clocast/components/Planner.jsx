import { useMemo, useState } from "react";
import { ArrowRight, CalendarPlus, ChevronDown, Lightbulb, Pencil, Trash2 } from "lucide-react";

import { activities, activitiesById } from "../data/activities";
import { evaluatePlan } from "../model/planner";
import { notableFactors, rankStarts, scoreHour, scoreWindow } from "../model/score";
import { formatHour, formatTemp } from "../units";
import { dayName, describeWindow, longDay } from "../when";
import OutfitCard from "./OutfitCard";
import ScoreBadge from "./ScoreBadge";
import ScoreStrip from "./ScoreStrip";
import TipList from "./TipList";
import WeatherIcon from "./WeatherIcon";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const LENGTHS = [1, 2, 3, 4];

function shortDate(day) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

const timeRange = (start, length) => `${formatHour(start)}–${formatHour((start + length) % 24)}`;

function PlanForm({ initial, days, hours, place, options, now, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  const activity = activitiesById.get(draft.activityId) ?? activities[0];
  const set = change => setDraft(current => ({ ...current, ...change }));

  const preview = useMemo(() => {
    const dayHours = hours.filter(h => h.localDay === draft.day && h.time.getTime() + 3600000 > now);
    if (!dayHours.length) return null;
    const scores = dayHours.filter(h => h.localHour >= 5 && h.localHour <= 22).map(hour => ({ hour, ...scoreHour(hour, place, activity, options) }));
    const window = dayHours.filter(h => h.localHour >= draft.startHour && h.localHour < draft.startHour + draft.hours);
    const result = window.length === draft.hours ? scoreWindow(window, place, activity, options) : null;
    const best = rankStarts(hours, place, activity, { day: draft.day, duration: draft.hours, earliest: 5, latest: 22, notBefore: now, options })[0];
    return { scores, result, best };
  }, [hours, draft.day, draft.startHour, draft.hours, place, activity, options, now]);

  const today = days[0];

  return (
    <form
      className="cc-plan-form"
      onSubmit={event => {
        event.preventDefault();
        onSave({ ...draft, title: draft.title.trim() });
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
          <span className="cc-label">Name (optional)</span>
          <input type="text" value={draft.title} maxLength={60} placeholder={activity.name} onChange={event => set({ title: event.target.value })} />
        </label>
        <label className="cc-field">
          <span className="cc-label">Day</span>
          <input type="date" value={draft.day} min={today} required onChange={event => event.target.value && set({ day: event.target.value })} />
        </label>
        <label className="cc-field">
          <span className="cc-label">Starts</span>
          <select value={draft.startHour} onChange={event => set({ startHour: Number(event.target.value) })}>
            {HOURS.map(hour => (
              <option key={hour} value={hour}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </label>
        <div className="cc-field">
          <span className="cc-label">How long</span>
          <div className="cc-segment" role="group" aria-label="How long">
            {LENGTHS.map(length => (
              <button key={length} type="button" aria-pressed={draft.hours === length} onClick={() => set({ hours: length })}>
                {length} hr
              </button>
            ))}
          </div>
        </div>
      </div>

      {preview ? (
        <div className="cc-preview">
          <div className="cc-preview-head">
            <span className="cc-label">Weather for {activity.name.toLowerCase()} on {dayName(draft.day, days.indexOf(draft.day)).replace("Today", "today").replace("Tomorrow", "tomorrow")}. Tap an hour to start then.</span>
            <ScoreBadge result={preview.result} size="small" />
          </div>
          <ScoreStrip
            scores={preview.scores}
            selected={HOURS.filter(h => h >= draft.startHour && h < draft.startHour + draft.hours)}
            onPick={hour => set({ startHour: hour })}
            label="Pick a start time"
          />
          {preview.best && preview.best.startHour !== draft.startHour && (!preview.result || preview.best.score > preview.result.score) && (
            <p className="cc-suggest">
              <Lightbulb size={15} aria-hidden="true" />
              <span>
                Best that day is <strong>{timeRange(preview.best.startHour, draft.hours)}</strong> ({preview.best.label.toLowerCase()}, {preview.best.score}).
              </span>
              <button type="button" className="cc-link-btn" onClick={() => set({ startHour: preview.best.startHour })}>
                Use it
              </button>
            </p>
          )}
        </div>
      ) : (
        <p className="cc-note">That day is past the 14-day forecast. CloCast will score it once the forecast reaches it.</p>
      )}

      <div className="cc-form-actions">
        <button type="button" className="cc-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="cc-btn cc-btn-primary">
          {initial.id ? "Save changes" : "Add to plan"}
        </button>
      </div>
    </form>
  );
}

function PlanCard({ plan, evaluation, onEdit, onDelete, onMove }) {
  const [open, setOpen] = useState(false);
  const activity = activitiesById.get(plan.activityId);
  const Icon = activity?.icon;

  return (
    <li className={`cc-plan ${evaluation ? `is-${evaluation.result.tone}` : ""}`}>
      <div className="cc-plan-head">
        <span className="cc-plan-icon" aria-hidden="true">
          {Icon && <Icon size={18} />}
        </span>
        <div className="cc-plan-title">
          <strong>{plan.title || activity?.name}</strong>
          <span className="cc-muted">
            {timeRange(plan.startHour, plan.hours)}
            {plan.title && activity ? ` · ${activity.name}` : ""}
          </span>
        </div>
        {evaluation ? <ScoreBadge result={evaluation.result} /> : <span className="cc-score is-none">No forecast yet</span>}
      </div>

      {evaluation && (
        <>
          <p className="cc-plan-summary">
            {notableFactors(evaluation.result).length
              ? `Watch for: ${notableFactors(evaluation.result).map(f => f.text).join(", ")}.`
              : "Good conditions for it."}{" "}
            Wear: {evaluation.advice.outfit.outfit.name.toLowerCase()}.
          </p>

          {evaluation.better && (
            <p className="cc-suggest">
              <Lightbulb size={15} aria-hidden="true" />
              <span>
                Better at <strong>{timeRange(evaluation.better.startHour, plan.hours)}</strong>
                {evaluation.better.reasons.length ? `: ${evaluation.better.reasons.join(", ")}.` : "."} It scores {evaluation.better.score} instead of {evaluation.result.score}.
              </span>
              <button type="button" className="cc-link-btn" onClick={() => onMove(evaluation.better.startHour)}>
                Move it <ArrowRight size={13} aria-hidden="true" />
              </button>
            </p>
          )}
        </>
      )}

      <div className="cc-plan-actions">
        {evaluation && (
          <button type="button" className="cc-link-btn" aria-expanded={open} onClick={() => setOpen(value => !value)}>
            {open ? "Hide advice" : "What to wear and bring"} <ChevronDown size={14} className={open ? "is-open" : ""} aria-hidden="true" />
          </button>
        )}
        <span className="cc-plan-tools">
          <button type="button" className="cc-icon-btn" onClick={onEdit} title="Edit" aria-label={`Edit ${plan.title || activity?.name}`}>
            <Pencil size={15} />
          </button>
          <button type="button" className="cc-icon-btn" onClick={onDelete} title="Delete" aria-label={`Delete ${plan.title || activity?.name}`}>
            <Trash2 size={15} />
          </button>
        </span>
      </div>

      {open && evaluation && (
        <div className="cc-plan-advice">
          <TipList tips={evaluation.advice.tips} compact />
          <OutfitCard plan={evaluation.advice.outfit} summary={`${activity.name} · ${describeWindow(evaluation.window)}`} />
        </div>
      )}
    </li>
  );
}

/**
 * The calendar: two weeks of forecast with planned activities on it. Each
 * activity is scored against the weather, with a better time when there
 * is one.
 */
export default function Planner({ forecast, place, units, options, plans, defaultActivityId, now, onSave, onDelete }) {
  const { hours, days } = forecast;
  const dayKeys = days.map(d => d.day);
  const [selected, setSelected] = useState(0);
  const [editing, setEditing] = useState(null);
  const day = dayKeys[selected] ?? dayKeys[0];

  const evaluations = useMemo(() => {
    const map = new Map();
    for (const plan of plans) map.set(plan.id, evaluatePlan(plan, hours, place, options, units, now));
    return map;
  }, [plans, hours, place, options, units, now]);

  const dayPlans = plans.filter(p => p.day === day);
  const later = plans.filter(p => p.day > dayKeys[dayKeys.length - 1]);

  function startNew() {
    const nextHour = hours.find(h => h.time.getTime() > now && h.localDay === day)?.localHour;
    setEditing({
      activityId: defaultActivityId,
      title: "",
      day,
      startHour: selected === 0 && nextHour != null ? Math.max(nextHour, 6) : 7,
      hours: 1,
    });
  }

  function save(plan) {
    onSave(plan);
    const index = dayKeys.indexOf(plan.day);
    if (index >= 0) setSelected(index);
    setEditing(null);
  }

  return (
    <section className="cc-panel cc-planner" aria-labelledby="cc-planner-title">
      <div className="cc-section-head">
        <div>
          <p className="cc-eyebrow">PLANNER</p>
          <h2 id="cc-planner-title">Plan around the weather</h2>
        </div>
        <button type="button" className="cc-btn cc-btn-primary" onClick={startNew}>
          <CalendarPlus size={16} aria-hidden="true" /> Add activity
        </button>
      </div>

      <div className="cc-cal" role="group" aria-label="Days">
        {days.map((d, index) => {
          const items = plans.filter(p => p.day === d.day);
          return (
            <button
              key={d.day}
              type="button"
              className={`cc-cal-day ${index === selected ? "is-picked" : ""}`}
              aria-pressed={index === selected}
              onClick={() => {
                setSelected(index);
                setEditing(null);
              }}
            >
              <span className="cc-cal-name">{dayName(d.day, index)}</span>
              <span className="cc-cal-date">{shortDate(d.day)}</span>
              <WeatherIcon code={d.code} size={22} />
              <span className="cc-cal-temps">
                <strong>{formatTemp(d.high, units, { unit: false })}</strong> {formatTemp(d.low, units, { unit: false })}
              </span>
              <span className="cc-cal-dots" aria-label={items.length ? `${items.length} planned` : undefined}>
                {items.slice(0, 3).map(item => (
                  <span key={item.id} className={`is-${evaluations.get(item.id)?.result.tone ?? "none"}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cc-day-detail">
        <h3>{longDay(day)}</h3>

        {editing && (
          <PlanForm
            key={editing.id ?? `new-${editing.day}`}
            initial={editing}
            days={dayKeys}
            hours={hours}
            place={place}
            options={options}
            now={now}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        )}

        {dayPlans.length > 0 ? (
          <ul className="cc-plans">
            {dayPlans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                evaluation={evaluations.get(plan.id)}
                onEdit={() => setEditing(plan)}
                onDelete={() => onDelete(plan.id)}
                onMove={startHour => onSave({ ...plan, startHour })}
              />
            ))}
          </ul>
        ) : (
          !editing && (
            <div className="cc-day-empty">
              <p className="cc-muted">Nothing planned. Add a run, a ride or a hike and CloCast will check the weather for it.</p>
              <button type="button" className="cc-btn" onClick={startNew}>
                <CalendarPlus size={15} aria-hidden="true" /> Plan something
              </button>
            </div>
          )
        )}
      </div>

      {later.length > 0 && (
        <div className="cc-later-plans">
          <h3 className="cc-subhead">Further out</h3>
          <ul className="cc-plans">
            {later.map(plan => (
              <PlanCard
                key={plan.id}
                plan={{ ...plan, title: `${plan.title || activitiesById.get(plan.activityId)?.name} · ${longDay(plan.day)}` }}
                evaluation={null}
                onEdit={() => setEditing(plan)}
                onDelete={() => onDelete(plan.id)}
                onMove={() => {}}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
