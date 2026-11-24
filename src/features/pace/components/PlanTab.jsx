import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, ChevronDown, Flag, Plus, Trash2 } from "lucide-react";

import { eventById } from "../data/events";
import { allSessions, moveSession, nextSession, PHASE_NAMES, weekOf } from "../model/plan";
import { sessionTitle } from "../model/planLink";
import { addDays, daysBetween, fmtDay, fmtMinutes, WEEKDAYS } from "../model/units";
import PlanBuilder from "./PlanBuilder";
import SessionDetail from "./SessionDetail";
import { SportIcon } from "./ui";

function statusOf(plan, s, today) {
  if (plan.completed[s.id]) return "done";
  if (plan.skipped?.[s.id]) return "skipped";
  if (s.day < today) return "missed";
  if (s.day === today) return "today";
  return "ahead";
}

export default function PlanTab({ store, today, focusId, onFocus, onStart }) {
  const { data, savePlan, deletePlan, setActivePlan, markSession, skipSession, updatePlan } = store;
  const [building, setBuilding] = useState(false);
  const plan = data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0];
  const [openWeek, setOpenWeek] = useState(null);

  if (!plan || building) {
    return (
      <PlanBuilder
        today={today}
        defaultSport={data.prefs.sport}
        onCancel={plan ? () => setBuilding(false) : null}
        onSave={p => {
          savePlan(p);
          setBuilding(false);
        }}
      />
    );
  }

  const event = eventById.get(plan.eventId);
  const sessions = allSessions(plan);
  const todays = sessions.filter(s => s.day === today);
  const next = nextSession(plan, today);
  const focus = (focusId && sessions.find(s => s.id === focusId)) || null;
  const current = weekOf(plan, today) ?? plan.weeks[0];
  const doneCount = sessions.filter(s => plan.completed[s.id]).length;
  const end = sessions.at(-1)?.day;
  const daysLeft = end ? daysBetween(today, end) : null;
  const shownWeek = openWeek ?? current?.index ?? 0;
  const { unit } = data.prefs;

  const actions = {
    onStart,
    onDone: (s, on) => markSession(plan.id, s.id, on ? true : null),
    onSkip: (s, on) => skipSession(plan.id, s.id, on),
    onMove: (s, day) => updatePlan(plan.id, p => moveSession(p, s.id, day)),
  };

  return (
    <div className="pc-plan">
      <section className="pc-plan-head">
        <div className="pc-race">
          <span className="pc-race-icon">
            <SportIcon sport={plan.sport} size={22} />
          </span>
          <div>
            <p className="pc-kicker">{event.noRace ? "Training block" : "Training for"}</p>
            <h2>{event.name}</h2>
            <p className="pc-race-meta">
              {event.noRace ? `Ends ${fmtDay(end)}` : `${fmtDay(plan.raceDate, { weekday: "long", month: "long", day: "numeric" })}`}
              {daysLeft != null && daysLeft >= 0 && <> · {daysLeft === 0 ? "today!" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} to go`}</>}
            </p>
          </div>
        </div>
        <div className="pc-plan-stats">
          <div>
            <strong>{current ? current.index + 1 : "–"}</strong>
            <span>of {plan.weeks.length} weeks</span>
          </div>
          <div>
            <strong>{current ? PHASE_NAMES[current.phase] : "–"}</strong>
            <span>phase</span>
          </div>
          <div>
            <strong>
              {doneCount}/{sessions.length}
            </strong>
            <span>sessions done</span>
          </div>
        </div>
        <div className="pc-progress" aria-hidden="true">
          <span style={{ width: `${(doneCount / Math.max(1, sessions.length)) * 100}%` }} />
        </div>
      </section>

      {focus ? (
        <>
          <button type="button" className="pc-link" onClick={() => onFocus(null)}>
            ← Back to today
          </button>
          <SessionDetail plan={plan} session={focus} profile={data.profile} unit={unit} today={today} {...actions} />
        </>
      ) : todays.length ? (
        todays.map(s => <SessionDetail key={s.id} plan={plan} session={s} profile={data.profile} unit={unit} today={today} {...actions} />)
      ) : (
        <section className="pc-card pc-rest">
          <h3>Rest day</h3>
          <p>Recovery is when the training sinks in. Walk, stretch, sleep well.</p>
          {next && (
            <p>
              Next up:{" "}
              <button type="button" className="pc-link" onClick={() => onFocus(next.id)}>
                {sessionTitle(plan, next)}, {fmtDay(next.day)}
              </button>
            </p>
          )}
        </section>
      )}

      <section className="pc-weeks" aria-label="All weeks">
        <div className="pc-section-head">
          <h2>The plan</h2>
          <Link className="pc-link" to="/task">
            <CalendarRange size={15} /> Also on your TaskFox calendar
          </Link>
        </div>
        {plan.weeks.map(w => {
          const open = w.index === shownWeek;
          const done = w.sessions.filter(s => plan.completed[s.id]).length;
          return (
            <div key={w.index} className={`pc-week pc-ph-${w.phase}${open ? " is-open" : ""}${w.index === current?.index ? " is-now" : ""}`}>
              <button type="button" className="pc-week-head" aria-expanded={open} onClick={() => setOpenWeek(open ? -1 : w.index)}>
                <span className="pc-week-n">W{w.index + 1}</span>
                <span className="pc-week-what">
                  <strong>
                    {PHASE_NAMES[w.phase]}
                    {w.recovery ? " · easier week" : ""}
                  </strong>
                  <small>
                    {fmtDay(w.start, { month: "short", day: "numeric" })} · {w.sessions.some(s => s.type === "race") ? "race week" : fmtMinutes(w.minutes)} · {done}/{w.sessions.length} done
                  </small>
                </span>
                <span className="pc-week-dots" aria-hidden="true">
                  {w.sessions.map(s => (
                    <i key={s.id} className={`is-${statusOf(plan, s, today)}`} />
                  ))}
                </span>
                <ChevronDown size={18} className="pc-chev" aria-hidden="true" />
              </button>
              {open && (
                <ul className="pc-week-days">
                  {w.sessions.map(s => {
                    const st = statusOf(plan, s, today);
                    return (
                      <li key={s.id}>
                        <button type="button" className={`is-${st}`} onClick={() => onFocus(s.id)}>
                          <span className="pc-wd">{WEEKDAYS[(new Date(s.day + "T12:00").getDay() + 6) % 7]}</span>
                          <span className="pc-wname">
                            {s.type === "race" && <Flag size={14} aria-hidden="true" />} {sessionTitle(plan, s)}
                          </span>
                          <span className="pc-wmin">{s.minutes ? fmtMinutes(s.minutes) : ""}</span>
                          <span className="pc-wst">{st === "done" ? "✓" : st === "skipped" ? "skipped" : st === "missed" ? "missed" : ""}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <section className="pc-plan-tools">
        {data.plans.length > 1 && (
          <label>
            Plan
            <select value={plan.id} onChange={e => setActivePlan(e.target.value)}>
              {data.plans.map(p => (
                <option key={p.id} value={p.id}>
                  {eventById.get(p.eventId)?.name} {p.raceDate ? `(${fmtDay(p.raceDate, { month: "short", day: "numeric", year: "numeric" })})` : `(from ${fmtDay(p.weeks[0]?.start ?? today, { month: "short", day: "numeric" })})`}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="pc-btn pc-btn-quiet" onClick={() => setBuilding(true)}>
          <Plus size={16} /> New plan
        </button>
        <button
          type="button"
          className="pc-btn pc-btn-quiet pc-danger"
          onClick={() => {
            if (window.confirm(`Delete the ${event.name} plan? Your logged workouts stay.`)) deletePlan(plan.id);
          }}
        >
          <Trash2 size={16} /> Delete plan
        </button>
      </section>
      {end && end < addDays(today, 0) && <p className="pc-hint">This plan is finished. Make a new one for your next goal.</p>}
    </div>
  );
}
