import { CalendarDays, ExternalLink, Trash2 } from "lucide-react";

import { localDay } from "../model/snow";
import { findSpot } from "../model/spots";
import { Card } from "./ui";

// Planned ski days and tours. Each one also shows on the TaskFox calendar.
export default function TripsTab({ s, open }) {
  const { data, patch } = s;
  const today = localDay(new Date());
  const upcoming = data.trips.filter(t => t.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const past = data.trips.filter(t => t.day < today).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 10);
  const remove = id => patch(d => ({ trips: d.trips.filter(t => t.id !== id) }));
  const setTime = (id, time) => patch(d => ({ trips: d.trips.map(t => (t.id === id ? { ...t, time: time || null } : t)) }));

  const row = t => {
    const spot = findSpot(t.spot, data);
    return (
      <li key={t.id} className="sf-trip">
        <button type="button" className="sf-trip-main" onClick={() => open(t.spot, t.day)}>
          <span className="sf-trip-date">
            <b>{new Date(`${t.day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}</b>
            {new Date(`${t.day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
          <span>
            <strong>{t.name || spot?.name || t.spot}</strong>
            <small>{spot?.kind === "backcountry" ? "Backcountry tour" : "Ski day"} · check conditions</small>
          </span>
        </button>
        <input type="time" value={t.time ?? ""} onChange={e => setTime(t.id, e.target.value)} aria-label="Start time" />
        <button type="button" className="sf-btn is-quiet" onClick={() => remove(t.id)} aria-label={`Remove ${t.name}`}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <div className="sf-trips">
      <Card
        title="Planned days"
        icon={CalendarDays}
        aside={
          <a className="sf-link" href="/task">
            Open TaskFox <ExternalLink size={13} aria-hidden="true" />
          </a>
        }
      >
        {upcoming.length ? <ul className="sf-trip-list">{upcoming.map(row)}</ul> : <p className="sf-muted">No ski days planned yet. Open a mountain, pick a day and tap “Plan a ski day”. It goes on your TaskFox calendar with a link back to that day's conditions.</p>}
      </Card>
      {past.length > 0 && (
        <Card title="Recent days" icon={CalendarDays}>
          <ul className="sf-trip-list is-past">{past.map(row)}</ul>
        </Card>
      )}
      <Card title="Settings">
        <div className="sf-seg" role="group" aria-label="Units">
          <button type="button" aria-pressed={data.units === "us"} onClick={() => patch({ units: "us" })}>
            Inches, °F, mph
          </button>
          <button type="button" aria-pressed={data.units === "metric"} onClick={() => patch({ units: "metric" })}>
            cm, °C, km/h
          </button>
        </div>
        {data.home && (
          <p className="sf-muted">
            Drive times start from {data.home.name}.{" "}
            <button type="button" className="sf-link" onClick={() => patch({ home: null })}>
              Clear
            </button>
          </p>
        )}
      </Card>
    </div>
  );
}
