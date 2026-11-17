import { useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";

import { eventById, eventsFor, LEVELS, SPORTS, START_MINUTES } from "../data/events";
import { makePlan, planWeeks, PHASE_NAMES } from "../model/plan";
import { addDays, fmtDay, fmtMinutes, mondayOf, WEEKDAY_NAMES } from "../model/units";
import { SportIcon } from "./ui";

/** Pick a sport, a race and a date, and get a plan. */
export default function PlanBuilder({ today, defaultSport, onSave, onCancel }) {
  const [sport, setSport] = useState(defaultSport ?? "run");
  const [eventId, setEventId] = useState(null);
  const [raceDate, setRaceDate] = useState("");
  const [level, setLevel] = useState("regular");
  const [days, setDays] = useState(4);
  const [longDay, setLongDay] = useState(5);
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState(null);

  const event = eventById.get(eventId);
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of eventsFor(sport)) map.set(e.group, [...(map.get(e.group) ?? []), e]);
    return [...map.entries()];
  }, [sport]);

  const weeks = event ? planWeeks(event.id, raceDate || null, today) : 0;
  const startMinutes = Number(minutes) || START_MINUTES[sport][level];

  const preview = useMemo(() => {
    if (!event || (!event.noRace && !raceDate)) return null;
    try {
      return makePlan({ eventId: event.id, raceDate, today, days, longDay, level, startMinutes });
    } catch {
      return null;
    }
  }, [event, raceDate, today, days, longDay, level, startMinutes]);

  function pickEvent(e) {
    setEventId(e.id);
    setError(null);
    // Races are usually on a weekend: default to the Sunday about a typical plan away.
    if (!e.noRace && !raceDate) setRaceDate(addDays(mondayOf(today), e.weeks.typical * 7 - 1));
  }

  function create() {
    try {
      onSave(makePlan({ eventId, raceDate, today, days, longDay, level, startMinutes }));
    } catch (e) {
      setError(e.message);
    }
  }

  const short = event && !event.noRace && weeks > 0 && weeks < event.weeks.min;

  return (
    <section className="pc-card pc-builder" aria-label="Make a training plan">
      <div className="pc-card-head">
        <h2>Make a training plan</h2>
        {onCancel && (
          <button type="button" className="pc-icon-btn" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        )}
      </div>

      <p className="pc-label">1. Your sport</p>
      <div className="pc-sports" role="radiogroup" aria-label="Sport">
        {Object.values(SPORTS).map(s => (
          <button key={s.id} type="button" role="radio" aria-checked={sport === s.id} className={sport === s.id ? "is-on" : ""} onClick={() => { setSport(s.id); setEventId(null); }}>
            <SportIcon sport={s.id} size={22} />
            {s.name}
          </button>
        ))}
      </div>

      <p className="pc-label">2. What are you training for?</p>
      {groups.map(([group, list]) => (
        <div key={group} className="pc-event-group">
          <span>{group}</span>
          <div className="pc-events">
            {list.map(e => (
              <button key={e.id} type="button" className={`pc-event${eventId === e.id ? " is-on" : ""}`} onClick={() => pickEvent(e)} aria-pressed={eventId === e.id}>
                <strong>{e.name}</strong>
                <small>{e.noRace ? "8 weeks" : `${e.weeks.typical} weeks is typical`}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
      {event && <p className="pc-blurb">{event.blurb}</p>}

      {event && (
        <>
          <p className="pc-label">3. A few details</p>
          <div className="pc-form">
            {!event.noRace && (
              <label>
                Race date
                <input type="date" value={raceDate} min={addDays(today, 1)} onChange={e => setRaceDate(e.target.value)} />
                {weeks > 0 && <small>{weeks} week{weeks === 1 ? "" : "s"} away{weeks > 24 ? ", the plan covers the last 24" : ""}</small>}
              </label>
            )}
            <label>
              Days a week
              <select value={days} onChange={e => setDays(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map(n => (
                  <option key={n} value={n}>{n} days</option>
                ))}
              </select>
            </label>
            <label>
              Long session on
              <select value={longDay} onChange={e => setLongDay(Number(e.target.value))}>
                <option value={5}>{WEEKDAY_NAMES[5]}</option>
                <option value={6}>{WEEKDAY_NAMES[6]}</option>
              </select>
            </label>
            <label>
              Minutes a week now
              <input type="number" inputMode="numeric" min={30} max={1200} step={15} placeholder={String(START_MINUTES[sport][level])} value={minutes} onChange={e => setMinutes(e.target.value)} />
              <small>Roughly, across the last month</small>
            </label>
          </div>
          <div className="pc-levels" role="radiogroup" aria-label="Experience">
            {LEVELS.map(l => (
              <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className={level === l.id ? "is-on" : ""} onClick={() => setLevel(l.id)}>
                <strong>{l.name}</strong>
                <small>{l.detail}</small>
              </button>
            ))}
          </div>
          {short && (
            <p className="pc-warn">
              {weeks} weeks is short for a {event.name.toLowerCase()} ({event.weeks.min}+ is better). The plan squeezes in what it can; go easy on race day.
            </p>
          )}
        </>
      )}

      {preview && (
        <div className="pc-preview">
          <div className="pc-phases" aria-label="Plan phases">
            {preview.weeks.map(w => (
              <span key={w.index} className={`pc-ph-${w.phase}${w.recovery ? " is-easy" : ""}`} style={{ height: `${Math.max(14, (w.minutes / Math.max(...preview.weeks.map(x => x.minutes))) * 100)}%` }} title={`Week ${w.index + 1}: ${PHASE_NAMES[w.phase]}, ${fmtMinutes(w.minutes)}`} />
            ))}
          </div>
          <p>
            <strong>{preview.weeks.length} weeks</strong> from {fmtDay(preview.weeks[0].start, { month: "short", day: "numeric" })}, building from about {fmtMinutes(preview.weeks[0].minutes)} to{" "}
            {fmtMinutes(Math.max(...preview.weeks.map(w => w.minutes)))} a week, with an easier week every fourth week{event.noRace ? "" : " and a taper before race day"}.
          </p>
        </div>
      )}

      {error && <p className="pc-warn">{error}</p>}
      <button type="button" className="pc-btn pc-btn-big" disabled={!preview} onClick={create}>
        Make my plan <ArrowRight size={18} />
      </button>
    </section>
  );
}
