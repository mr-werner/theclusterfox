import { useState } from "react";
import { CalendarDays, CloudSun, Dumbbell, MapPin, Trash2, X } from "lucide-react";

import { gearList } from "../model/gear";
import { mainGrade } from "../model/grades";
import { climbSnap } from "../state/climbStore";
import { dayName, directionsHref, localDay } from "./format";
import { ConditionsStrip, DayDetail, GradeChip, TypeTags } from "./ui";
import { useConditions } from "./useConditions";

// Climbing days: where, when, which routes, the forecast for that day and
// what to pack. Each one shows on the PlanFox calendar automatically.
export default function PlanTab({ c, tripId, openTrip, openArea, openRoute, goExplore }) {
  const { data } = c;
  const trip = tripId ? data.trips.find(t => t.id === tripId) : null;
  if (trip) return <TripView key={trip.id} trip={trip} c={c} openArea={openArea} openRoute={openRoute} onClose={() => openTrip(null)} />;

  const today = localDay();
  const upcoming = data.trips.filter(t => t.day >= today).sort((a, b) => a.day.localeCompare(b.day));
  const past = data.trips.filter(t => t.day < today).sort((a, b) => b.day.localeCompare(a.day));

  return (
    <div className="cb-plan">
      <section className="cb-hero cb-hero--small">
        <p className="cb-kicker">Plan</p>
        <h1>Climbing days</h1>
        <p className="cb-muted">Open any area and tap <strong>Plan a day here</strong>, or tap + on a route. Each day gets its forecast and a gear list, and shows up on your PlanFox calendar.</p>
      </section>
      {tripId && <p className="cb-error">That plan was deleted or lives in another browser.</p>}
      {upcoming.length === 0 && past.length === 0 && (
        <div className="cb-empty">
          <CalendarDays size={28} aria-hidden="true" />
          <p>No climbing days planned yet.</p>
          <button type="button" className="cb-btn" onClick={goExplore}>
            Find a crag
          </button>
        </div>
      )}
      {upcoming.length > 0 && <TripList title="Coming up" trips={upcoming} openTrip={openTrip} />}
      {past.length > 0 && <TripList title="Past days" trips={past} openTrip={openTrip} />}
    </div>
  );
}

function TripList({ title, trips, openTrip }) {
  return (
    <section className="cb-section">
      <h2>{title}</h2>
      <ul className="cb-list">
        {trips.map(t => (
          <li key={t.id}>
            <button type="button" className="cb-row" onClick={() => openTrip(t.id)}>
              <span className="cb-tripdate">
                <strong>{new Date(`${t.day}T12:00:00`).getDate()}</strong>
                <small>{new Date(`${t.day}T12:00:00`).toLocaleDateString(undefined, { month: "short" })}</small>
              </span>
              <span className="cb-row-main">
                <strong>{t.title}</strong>
                <small>
                  {dayName(t.day)} · {t.routes.length} route{t.routes.length === 1 ? "" : "s"}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TripView({ trip, c, openArea, openRoute, onClose }) {
  const { data, patch } = c;
  const cond = useConditions(trip.area.lat, trip.area.lng, trip.area.path);
  const [confirm, setConfirm] = useState(false);
  const update = changes => patch(d => ({ trips: d.trips.map(t => (t.id === trip.id ? { ...t, ...changes } : t)) }));
  const day = cond.days?.find(d => d.day === trip.day) ?? null;
  const inRange = cond.days?.length && trip.day <= cond.days[cond.days.length - 1].day;
  const gear = gearList(trip.routes, { conditions: day });
  const routeIds = new Set(trip.routes.map(r => r.uuid));
  const todoHere = data.todo.filter(t => t.areaUuid && !routeIds.has(t.uuid) && (t.areaUuid === trip.area.uuid || trip.routes.some(r => r.areaUuid === t.areaUuid)));
  const sorted = [...trip.routes].sort((a, b) => (mainGrade(a).score ?? 99) - (mainGrade(b).score ?? 99));

  return (
    <article className="cb-trip">
      <header className="cb-area-head">
        <button type="button" className="cb-link cb-backlink" onClick={onClose}>
          ← All climbing days
        </button>
        <input className="cb-title-input" value={trip.title} onChange={e => update({ title: e.target.value.slice(0, 120) })} aria-label="Plan name" />
        <div className="cb-tickform-row">
          <label>
            Day
            <input type="date" value={trip.day} onChange={e => e.target.value && update({ day: e.target.value })} />
          </label>
          <label>
            Start
            <input type="time" value={trip.time ?? ""} onChange={e => update({ time: e.target.value || null })} />
          </label>
          <button type="button" className="cb-btn cb-btn--ghost" onClick={() => openArea(trip.area.uuid)}>
            <MapPin size={16} aria-hidden="true" /> {trip.area.name}
          </button>
          {Number.isFinite(trip.area.lat) && (
            <a className="cb-btn cb-btn--ghost" href={directionsHref(trip.area.lat, trip.area.lng)} target="_blank" rel="noreferrer">
              Directions
            </a>
          )}
        </div>
        <p className="cb-muted">On your PlanFox calendar for {dayName(trip.day)}.</p>
      </header>

      <section className="cb-section">
        <h2>Conditions</h2>
        <ConditionsStrip cond={cond} units={data.units} onPick={d => update({ day: d })} picked={trip.day} />
        {day ? <DayDetail day={day} units={data.units} sandstone={cond.sandstone} /> : !cond.days?.length || inRange ? null : <p className="cb-muted">The forecast doesn't reach {dayName(trip.day)} yet. Check back within two weeks of the day. Tap a day above to move the plan.</p>}
      </section>

      <div className="cb-area-grid">
        <section className="cb-section">
          <h2>Routes ({trip.routes.length})</h2>
          {trip.routes.length === 0 && <p className="cb-muted">No routes yet. Open the area and tap + on the ones you want.</p>}
          <ol className="cb-routelist">
            {sorted.map(r => (
              <li key={r.uuid}>
                <div className="cb-route">
                  <button type="button" className="cb-route-main" onClick={() => openRoute(r.uuid)}>
                    <GradeChip climb={r} />
                    <span className="cb-route-name">
                      <strong>{r.name}</strong>
                      <small>
                        <TypeTags types={r.types} />
                        {r.areaName && <span>{r.areaName}</span>}
                      </small>
                    </span>
                  </button>
                  <button type="button" className="cb-iconbtn" aria-label={`Remove ${r.name}`} onClick={() => update({ routes: trip.routes.filter(x => x.uuid !== r.uuid) })}>
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          {todoHere.length > 0 && (
            <>
              <h3>From your to-do list</h3>
              <div className="cb-chips">
                {todoHere.slice(0, 20).map(t => (
                  <button type="button" key={t.uuid} className="cb-chip" onClick={() => update({ routes: [...trip.routes, climbSnap(t)] })}>
                    + {t.name} <small>{mainGrade(t).text}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>Notes</h3>
          <textarea className="cb-notes" value={trip.notes} onChange={e => update({ notes: e.target.value.slice(0, 1000) })} placeholder="Partners, carpool, camping, the warm-up you want…" rows={3} />
        </section>

        <section className="cb-section">
          <h2>Pack</h2>
          <div className="cb-gear">
            {gear.map(g => (
              <div key={g.title}>
                <h3>{g.title}</h3>
                <ul>
                  {g.items.map(i => (
                    <li key={i}>
                      <label>
                        <input type="checkbox" /> {i}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="cb-section cb-links">
        <a className="cb-linkcard" href="/clocast?tab=plan">
          <CloudSun size={18} aria-hidden="true" />
          <span>
            <strong>What to wear</strong>
            <small>Plan the hours outside in SkyFox</small>
          </span>
        </a>
        <a className="cb-linkcard" href="/lift?muscles=forearms,lats,biceps,abs,shoulders">
          <Dumbbell size={18} aria-hidden="true" />
          <span>
            <strong>Train for it</strong>
            <small>A pulling and grip workout in LiftFox</small>
          </span>
        </a>
        <a className="cb-linkcard" href="/plan">
          <CalendarDays size={18} aria-hidden="true" />
          <span>
            <strong>See your week</strong>
            <small>Open PlanFox</small>
          </span>
        </a>
      </section>

      <div className="cb-actions">
        {confirm ? (
          <>
            <span>Delete this plan?</span>
            <button
              type="button"
              className="cb-btn cb-btn--danger"
              onClick={() => {
                patch(d => ({ trips: d.trips.filter(t => t.id !== trip.id) }));
                onClose();
              }}
            >
              Delete
            </button>
            <button type="button" className="cb-btn cb-btn--ghost" onClick={() => setConfirm(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className="cb-btn cb-btn--ghost" onClick={() => setConfirm(true)}>
            <Trash2 size={16} aria-hidden="true" /> Delete plan
          </button>
        )}
      </div>
    </article>
  );
}
