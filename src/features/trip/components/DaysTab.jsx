import { useEffect, useState } from "react";
import { BedDouble, Car, CloudRain, ExternalLink, Plane, Plus, Trash2 } from "lucide-react";

import { fmtHours, shortDay } from "../model/days";
import { kindName } from "../model/places";
import { DayWeather } from "./ui";

const byTime = (a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.title.localeCompare(b.title);
const wet = w => w && (w.rain >= 60 || w.snow);

function PlanRow({ item, days, onChange, onRemove }) {
  return (
    <li className="tx-plan-row">
      <input type="time" value={item.time ?? ""} onChange={e => onChange({ time: e.target.value || null })} aria-label={`Time for ${item.title}`} />
      <span className="tx-plan-title">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer">
            {item.title} <ExternalLink size={11} aria-hidden="true" />
          </a>
        ) : (
          item.title
        )}
        <span className="tx-muted tx-small">
          {item.kind !== "custom" ? kindName(item.kind) : ""}
          {item.cost ? `${item.kind !== "custom" ? " · " : ""}$${item.cost}${item.perPerson ? " each" : ""}` : ""}
        </span>
      </span>
      <select value={item.day ?? ""} onChange={e => onChange({ day: e.target.value || null })} aria-label={`Day for ${item.title}`}>
        <option value="">Ideas</option>
        {days.map(d => (
          <option key={d} value={d}>
            {shortDay(d)}
          </option>
        ))}
      </select>
      <button type="button" className="tx-icon-btn" onClick={onRemove} aria-label={`Remove ${item.title}`}>
        <Trash2 size={15} />
      </button>
    </li>
  );
}

function AddCustom({ day, onAdd }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [cost, setCost] = useState("");
  if (!open) {
    return (
      <button type="button" className="tx-link tx-add-own" onClick={() => setOpen(true)}>
        <Plus size={14} aria-hidden="true" /> Add your own
      </button>
    );
  }
  return (
    <form
      className="tx-add-form"
      onSubmit={e => {
        e.preventDefault();
        if (!title.trim()) return;
        const n = Number.parseFloat(cost);
        onAdd({ id: crypto.randomUUID(), day, time: time || null, title: title.trim(), kind: "custom", cost: Number.isFinite(n) ? n : null, perPerson: false });
        setTitle("");
        setTime("");
        setCost("");
        setOpen(false);
      }}
    >
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Dinner, a hike, the pool…" aria-label="What" maxLength={120} autoFocus />
      <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="Time" />
      <input value={cost} onChange={e => setCost(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="$ cost" inputMode="decimal" aria-label="Cost for everyone" />
      <button type="submit" className="tx-btn is-small">
        Add
      </button>
    </form>
  );
}

/** The trip day by day: weather, travel, where you sleep and what's planned. */
export default function DaysTab({ data, trip, setTrip, sources, focusDay, go }) {
  const { days } = sources;
  const weather = sources.weather.value;
  const typical = weather?.source === "typical";
  const ideas = trip.plan.filter(p => !p.day || !days.includes(p.day)).sort(byTime);
  const indoorIdeas = [...ideas.filter(p => p.indoor), ...sources.things.filter(t => t.indoor && !t.day && !trip.plan.some(p => p.id === t.id))].slice(0, 3);
  const setItem = (id, change) => setTrip({ plan: trip.plan.map(p => (p.id === id ? { ...p, ...change } : p)) });
  const remove = id => setTrip({ plan: trip.plan.filter(p => p.id !== id) });
  const add = item => setTrip({ plan: [...trip.plan, item] });
  const drive = trip.travel === "drive" && sources.drive.value;

  useEffect(() => {
    if (focusDay) document.getElementById(`day-${focusDay}`)?.scrollIntoView({ block: "start" });
  }, [focusDay]);

  if (!days.length) {
    return (
      <section className="tx-card">
        <p>Pick your dates to lay the trip out day by day.</p>
        <button type="button" className="tx-btn" onClick={() => go("plan")}>
          Pick dates
        </button>
      </section>
    );
  }

  const travelLine = leaving => {
    const Icon = trip.travel === "fly" ? Plane : Car;
    const where = leaving ? trip.dest?.name : (data.home?.name ?? "home");
    let text = `${trip.travel === "fly" ? "Fly" : trip.travel === "drive" ? "Drive" : `Take the ${trip.travel}`} ${leaving ? "to" : "back to"} ${where}`;
    if (drive) {
      const legs = Math.ceil(drive.minutes / 60 / 8);
      text += `, about ${fmtHours(drive.minutes)}${legs > 1 ? ` over ${legs} days of driving` : ""}`;
    }
    if (trip.travel === "fly" && data.homeAirport && trip.airport) text = `Fly ${leaving ? `${data.homeAirport.code} to ${trip.airport.code}` : `${trip.airport.code} to ${data.homeAirport.code}`}`;
    return (
      <p className="tx-travel">
        <Icon size={15} aria-hidden="true" /> {text}
      </p>
    );
  };

  return (
    <div className="tx-stack">
      {ideas.length > 0 && (
        <section className="tx-card">
          <h2>
            Ideas <small>not on a day yet</small>
          </h2>
          <ul className="tx-plan">
            {ideas.map(item => (
              <PlanRow key={item.id} item={item} days={days} onChange={c => setItem(item.id, c)} onRemove={() => remove(item.id)} />
            ))}
          </ul>
        </section>
      )}
      {typical && <p className="tx-muted tx-small">Weather is what's typical for these dates until the forecast reaches them.</p>}
      <ol className="tx-days">
        {days.map((day, i) => {
          const w = weather?.days?.[day];
          const items = trip.plan.filter(p => p.day === day).sort(byTime);
          const outdoorWhenWet = wet(w) && items.some(p => !p.indoor && p.kind !== "custom" && p.kind !== "events");
          const last = i === days.length - 1;
          return (
            <li key={day} id={`day-${day}`} className={`tx-card tx-day${day === focusDay ? " is-focus" : ""}`}>
              <header className="tx-day-head">
                <h3>
                  {shortDay(day)} <small>Day {i + 1}</small>
                </h3>
                <DayWeather w={w} units={data.units} typical={typical} />
              </header>
              {i === 0 && travelLine(true)}
              {items.length > 0 && (
                <ul className="tx-plan">
                  {items.map(item => (
                    <PlanRow key={item.id} item={item} days={days} onChange={c => setItem(item.id, c)} onRemove={() => remove(item.id)} />
                  ))}
                </ul>
              )}
              {outdoorWhenWet && (
                <div className="tx-callout is-warn">
                  <p>
                    <CloudRain size={14} aria-hidden="true" /> {w.snow ? "Snow" : "Rain"} is likely. Swap something outdoors for a day that looks drier, or go somewhere inside.
                  </p>
                  {indoorIdeas.length > 0 && (
                    <ul className="tx-mini">
                      {indoorIdeas.map(t => (
                        <li key={t.id}>
                          <button
                            type="button"
                            className="tx-link"
                            onClick={() =>
                              trip.plan.some(p => p.id === t.id) ? setItem(t.id, { day }) : add({ id: t.id, day, time: null, title: t.title, kind: t.kind, indoor: true, cost: null, perPerson: false, lat: t.lat, lon: t.lon, url: t.url })
                            }
                          >
                            + {t.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {last && days.length > 1 && travelLine(false)}
              {!last && trip.stay && (
                <p className="tx-travel">
                  <BedDouble size={15} aria-hidden="true" /> Night at {trip.stay.name}
                </p>
              )}
              <div className="tx-day-foot">
                <AddCustom day={day} onAdd={add} />
                {!items.length && (
                  <button type="button" className="tx-link" onClick={() => go("do")}>
                    Find things to do
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="tx-muted tx-small">Every day of the trip shows on your TaskFox calendar, with what you've planned.</p>
    </div>
  );
}
