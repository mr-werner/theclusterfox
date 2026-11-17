import { Link } from "react-router-dom";
import { Check, Play, SkipForward, Undo2, Utensils } from "lucide-react";

import { planSessionSteps as stepsFor, sessionWhy, stepsSeconds } from "../model/sessions";
import { sessionTitle } from "../model/planLink";
import { addDays, fmtDay, fmtMinutes, WEEKDAYS } from "../model/units";
import { PHASE_NAMES } from "../model/plan";
import { SessionShape, SportIcon, StepList } from "./ui";

/** Eating advice for the day, with the diet planner a tap away. */
export function FuelTip({ minutes, type }) {
  const long = minutes >= 75 || type === "race" || type === "long";
  if (!long && !["vo2", "threshold", "racepace", "racesim", "test"].includes(type)) return null;
  return (
    <p className="pc-fuel">
      <Utensils size={16} aria-hidden="true" />
      <span>
        {type === "race"
          ? "Race day: a familiar, carb-rich breakfast 2–3 hours before. For anything over 75 minutes take 30–60 g of carbs an hour."
          : long && minutes >= 75
            ? "Over 75 minutes: eat a carb-rich meal beforehand and take 30–60 g of carbs an hour (a gel, a banana, a sports drink)."
            : "A hard day: have carbs 2–3 hours before and protein afterwards."}{" "}
        <Link to="/f4t">Plan meals around it</Link>
      </span>
    </p>
  );
}

export default function SessionDetail({ plan, session, profile, unit, today, onStart, onDone, onSkip, onMove, compact = false }) {
  const steps = stepsFor(plan, session);
  const done = plan.completed[session.id];
  const skipped = plan.skipped?.[session.id];
  const minutes = session.minutes || Math.round(stepsSeconds(steps) / 60);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(session.week.start, i)).filter(d => d >= today);
  const isToday = session.day === today;

  return (
    <article className={`pc-session${done ? " is-done" : ""}${skipped ? " is-skipped" : ""}`}>
      <header>
        <span className="pc-session-icon">
          <SportIcon sport={plan.sport} size={20} />
        </span>
        <div>
          <p className="pc-kicker">
            {isToday ? "Today" : fmtDay(session.day)} · Week {session.week.index + 1} · {PHASE_NAMES[session.week.phase]}
            {session.week.recovery ? " (easier week)" : ""}
          </p>
          <h3>{sessionTitle(plan, session)}</h3>
          <p className="pc-session-sub">
            {session.type === "race" || session.type === "test" ? "Warm-up, the effort, cool-down" : fmtMinutes(minutes)}
            {done ? " · done" : skipped ? " · skipped" : ""}
          </p>
        </div>
      </header>
      <SessionShape steps={steps} />
      <p className="pc-why">{sessionWhy(session.type)}</p>
      {!compact && <StepList steps={steps} sport={plan.sport} profile={profile} unit={unit} />}
      <FuelTip minutes={minutes} type={session.type} />
      <div className="pc-actions">
        {!done && onStart && (
          <button type="button" className="pc-btn" onClick={() => onStart(session)}>
            <Play size={17} /> Start
          </button>
        )}
        {onDone && (
          <button type="button" className="pc-btn pc-btn-quiet" onClick={() => onDone(session, !done)}>
            {done ? <Undo2 size={16} /> : <Check size={16} />} {done ? "Not done" : "Mark done"}
          </button>
        )}
        {!done && onSkip && (
          <button type="button" className="pc-btn pc-btn-quiet" onClick={() => onSkip(session, !skipped)}>
            <SkipForward size={16} /> {skipped ? "Unskip" : "Skip"}
          </button>
        )}
        {!done && onMove && weekDays.length > 1 && (
          <label className="pc-move">
            Move to
            <select value={session.day} onChange={e => onMove(session, e.target.value)}>
              {weekDays.map(d => (
                <option key={d} value={d}>{WEEKDAYS[(new Date(d + "T12:00").getDay() + 6) % 7]} {fmtDay(d, { month: "short", day: "numeric" })}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </article>
  );
}
