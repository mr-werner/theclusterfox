import { CalendarDays, ChevronRight, Route, Trash2 } from "lucide-react";

import { fmtMiles, fmtMinutes } from "../model/geo";
import { THEME_ICONS } from "./links";

export default function TripsTab({ store, openTrip, goPlan }) {
  const { data, patch } = store;
  if (!data.trips.length) {
    return (
      <section className="rf-panel rf-empty">
        <p>Trips you save show up here and work with no signal. Saved trips with a start date also show up in PlanFox, one day at a time.</p>
        <button type="button" className="rf-btn" onClick={goPlan}>
          <Route size={15} aria-hidden="true" /> Plan a trip
        </button>
      </section>
    );
  }
  return (
    <section className="rf-panel">
      <header className="rf-panel-head">
        <h2>Saved trips</h2>
      </header>
      <ul className="rf-trips">
        {data.trips.map(t => {
          const Icon = THEME_ICONS[t.theme] ?? Route;
          return (
            <li key={t.id}>
              <button type="button" className="rf-trip" onClick={() => openTrip(t.id)}>
                <Icon size={18} aria-hidden="true" />
                <span className="rf-stop-body">
                  <strong>{t.title}</strong>
                  <span className="rf-muted">
                    {fmtMiles(t.miles)} · {fmtMinutes(t.minutes)} driving · {t.days.length || 1} day{t.days.length > 1 ? "s" : ""} · {t.stops.length} stop{t.stops.length === 1 ? "" : "s"}
                  </span>
                  {t.departDate && (
                    <span className="rf-muted">
                      <CalendarDays size={12} aria-hidden="true" /> Leaving {new Date(`${t.departDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
              <button type="button" className="rf-icon-btn" onClick={() => patch(d => ({ trips: d.trips.filter(x => x.id !== t.id) }))} aria-label={`Delete ${t.title}`} title="Delete">
                <Trash2 size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
