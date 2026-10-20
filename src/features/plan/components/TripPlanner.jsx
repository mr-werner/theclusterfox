import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, Plane, Trash2, X } from "lucide-react";

import { dayRange, shortDate } from "../model/dates";
import { cityName, money } from "../model/entries";
import { FLEX, TOPS, airlineName, airlinesIn, cheapestByDay, departWindow, suggestTrips, tripDefaults, tripMonths } from "../model/trips";
import { useTripFares } from "../state/useLayerData";
import AirportPicker from "./AirportPicker";

const NIGHTS = Array.from({ length: 21 }, (_, i) => i + 1);
const stops = f => (f.transfers === 0 ? "nonstop" : f.transfers ? `${f.transfers} stop${f.transfers > 1 ? "s" : ""}` : "");

function Leg({ arrow, fare }) {
  const Icon = arrow === "out" ? ArrowRight : ArrowLeft;
  return (
    <p className="pf-leg">
      <Icon size={14} aria-hidden="true" className={`pf-leg-arrow is-${arrow}`} />
      <span>
        {shortDate(fare.day)} · {fare.from.code} to {fare.to.code}
        <span className="pf-muted">
          {" "}
          · {airlineName(fare.airline)}
          {stops(fare) && ` · ${stops(fare)}`}
        </span>
      </span>
      <strong>{money(fare.price, fare.currency)}</strong>
      {fare.link && (
        <a href={fare.link} target="_blank" rel="noreferrer">
          See fare
        </a>
      )}
    </p>
  );
}

/**
 * Pick a destination and a rough date, and get the best leave and return
 * pairs from recent one-way fares, plus each day's price both ways.
 */
export default function TripPlanner({ home, trips, start, today, currency, onSetHome, onSave, onRemove, onClose }) {
  const [draft, setDraft] = useState(() => {
    const existing = start.code ? trips.find(t => t.code === start.code) : null;
    return existing ? { ...existing, around: start.day ?? existing.around } : start.code ? tripDefaults({ ...start, around: start.day }) : null;
  });
  const [around, setAround] = useState(start.day && start.day >= today ? start.day : today);
  const trip = draft ? tripDefaults({ ...draft, around }) : null;
  const watched = draft && trips.some(t => t.code === draft.code);
  const set = change => setDraft(current => ({ ...current, ...change }));

  const window = trip ? departWindow(trip, { from: around, to: around, today }) : null;
  const months = trip ? tripMonths(trip, window) : [];
  const fares = useTripFares(home, trip, months, currency);
  const out = useMemo(() => (fares.value?.out ?? []).filter(f => f.day >= today), [fares.value, today]);
  const back = useMemo(() => (fares.value?.back ?? []).filter(f => f.day >= today), [fares.value, today]);
  const suggestions = trip ? suggestTrips(out, back, trip, window) : [];
  const airlines = airlinesIn([...out, ...back]);
  const outByDay = trip ? cheapestByDay(out, trip) : new Map();
  const backByDay = trip ? cheapestByDay(back, trip) : new Map();
  const days = window ? dayRange(window[0], window[1]).slice(0, 31) : [];
  const lowOut = Math.min(...days.map(d => outByDay.get(d)?.price ?? Infinity));
  const lowBack = Math.min(...days.map(d => backByDay.get(d)?.price ?? Infinity));

  return (
    <section className="pf-panel pf-trip" aria-label="Plan a trip">
      <header className="pf-day-head">
        <div>
          <p className="pf-eyebrow">
            <Plane size={12} aria-hidden="true" /> PLAN A TRIP
          </p>
          <h2>{trip ? `Trip to ${cityName(trip)}` : "Where do you want to go?"}</h2>
          <p className="pf-muted">The best days to leave and come back, from fares travelers found recently. Watch a trip to keep its best dates on your calendar.</p>
        </div>
        <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Close trip planner">
          <X size={18} />
        </button>
      </header>

      <div className="pf-trip-grid">
        <div className="pf-form">
          <div className="pf-field">
            <span>From</span>
            {home ? (
              <button type="button" className="pf-chip is-on pf-chip-inline" onClick={() => onSetHome(null)} aria-label={`Change ${home.name}`}>
                {home.name} <X size={12} aria-hidden="true" />
              </button>
            ) : (
              <AirportPicker label="Flying from" placeholder="Your airport or city" onPick={onSetHome} />
            )}
          </div>
          <div className="pf-field">
            <span>To</span>
            {draft ? (
              <button type="button" className="pf-chip is-on pf-chip-inline" onClick={() => setDraft(null)} aria-label={`Change ${draft.name}`}>
                {draft.name} <X size={12} aria-hidden="true" />
              </button>
            ) : (
              <>
                {trips.length > 0 && (
                  <ul className="pf-chips" aria-label="Trips you watch">
                    {trips.map(t => (
                      <li key={t.code}>
                        <button type="button" className="pf-chip" onClick={() => setDraft(t)}>
                          {t.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <AirportPicker label="Destination" placeholder="Where to, e.g. Denver" onPick={dest => setDraft(trips.find(t => t.code === dest.code) ?? tripDefaults(dest))} />
              </>
            )}
          </div>
          {trip && (
            <>
              <div className="pf-field-row">
                <label className="pf-field">
                  <span>Leaving around</span>
                  <input type="date" value={around} min={today} onChange={e => e.target.value && setAround(e.target.value)} />
                </label>
                <label className="pf-field">
                  <span>Nights</span>
                  <span className="pf-nights">
                    <select value={trip.minNights} onChange={e => set({ minNights: Number(e.target.value), maxNights: Math.max(trip.maxNights, Number(e.target.value)) })} aria-label="Fewest nights">
                      {NIGHTS.map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    to
                    <select value={trip.maxNights} onChange={e => set({ maxNights: Number(e.target.value) })} aria-label="Most nights">
                      {NIGHTS.filter(n => n >= trip.minNights).map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              </div>
              <div className="pf-field">
                <span>How flexible</span>
                <div className="pf-segment" role="group" aria-label="How flexible">
                  {FLEX.map(f => (
                    <button key={f.id} type="button" aria-pressed={trip.flex === f.id} onClick={() => set({ flex: f.id })}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pf-field">
                <span>Suggestions</span>
                <div className="pf-segment" role="group" aria-label="How many suggestions">
                  {TOPS.map(n => (
                    <button key={n} type="button" aria-pressed={trip.top === n} onClick={() => set({ top: n })}>
                      Top {n}
                    </button>
                  ))}
                </div>
              </div>
              <label className="pf-check">
                <input type="checkbox" checked={trip.nonstop} onChange={e => set({ nonstop: e.target.checked })} /> Nonstop only
              </label>
              {airlines.length > 0 && (
                <div className="pf-field">
                  <span>Airlines {trip.airlines.length ? "" : "(any)"}</span>
                  <ul className="pf-chips" aria-label="Preferred airlines">
                    {airlines.map(code => (
                      <li key={code}>
                        <button
                          type="button"
                          className="pf-chip"
                          aria-pressed={trip.airlines.includes(code)}
                          onClick={() => set({ airlines: trip.airlines.includes(code) ? trip.airlines.filter(a => a !== code) : [...trip.airlines, code] })}
                        >
                          {airlineName(code)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="pf-trip-results">
          {!home && <p className="pf-note">Pick the airport or city you fly from.</p>}
          {home && !trip && <p className="pf-note">Pick a destination to see the best dates.</p>}
          {fares.status === "loading" && (
            <p className="pf-note">
              <LoaderCircle size={14} className="spin" aria-hidden="true" /> Finding fares…
            </p>
          )}
          {(fares.status === "error" || fares.status === "no-key") && <p className="pf-note is-warn">{fares.error}</p>}
          {fares.status === "ok" && trip && (
            <>
              <p className="pf-eyebrow">BEST DATES</p>
              {suggestions.length ? (
                <ol className="pf-trips">
                  {suggestions.map(s => (
                    <li key={s.depart} className={s.rank === 1 ? "is-top" : ""}>
                      <p className="pf-trip-head">
                        <span className="pf-trip-rank">#{s.rank}</span>
                        <strong>
                          {shortDate(s.depart)} to {shortDate(s.back)}
                        </strong>
                        <span className="pf-muted">
                          {s.nights} night{s.nights === 1 ? "" : "s"}
                        </span>
                        <strong className="pf-trip-total">{money(s.total, s.out.currency)}</strong>
                      </p>
                      <Leg arrow="out" fare={s.out} />
                      <Leg arrow="back" fare={s.ret} />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="pf-note">No fares were found for those dates{trip.nonstop || trip.airlines.length ? " with these filters" : ""}. Try being more flexible, or a different trip length.</p>
              )}
              {days.length > 0 && (
                <>
                  <p className="pf-eyebrow pf-planner-check">PRICES BY DAY</p>
                  <ul className="pf-fare-days">
                    {days.map(day => {
                      const o = outByDay.get(day);
                      const b = backByDay.get(day);
                      return (
                        <li key={day}>
                          <span className="pf-fare-day">{shortDate(day)}</span>
                          <span className={o?.price === lowOut ? "is-low" : ""}>
                            <ArrowRight size={12} aria-label="Leaving" /> {o ? money(o.price, o.currency) : "–"}
                          </span>
                          <span className={b?.price === lowBack ? "is-low" : ""}>
                            <ArrowLeft size={12} aria-label="Coming back" /> {b ? money(b.price, b.currency) : "–"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="pf-dialog-foot">
        {watched && (
          <button type="button" className="pf-btn pf-btn-danger" onClick={() => onRemove(draft.code)}>
            <Trash2 size={15} aria-hidden="true" /> Stop watching
          </button>
        )}
        <span className="pf-spacer" />
        <span className="pf-muted pf-planner-summary">Fares are a guide, not a quote. Southwest doesn't share its fares, so it won't show here.</span>
        <button type="button" className="pf-btn pf-btn-primary" disabled={!trip || !home} onClick={() => onSave({ ...trip, around })}>
          {watched ? "Update trip" : "Watch on calendar"}
        </button>
      </footer>
    </section>
  );
}
