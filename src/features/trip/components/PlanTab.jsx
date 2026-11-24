import { Bus, Car, ExternalLink, Plane, TrainFront } from "lucide-react";
import { Link } from "react-router-dom";

import { TRAVEL, VEHICLES } from "../state/tripStore";
import { addDays, dateSpan, fmtHours, shortDay } from "../model/days";
import { fmtMoney } from "../model/geo";
import { travelLinks } from "../model/places";
import { AirportField, Loading, PlaceField, Segmented, Stepper, WeatherStrip } from "./ui";

const TRAVEL_ICONS = { drive: Car, fly: Plane, train: TrainFront, bus: Bus };
const DRIVE_DAY_HOURS = 8;

function Drive({ trip, home, sources }) {
  const { drive } = sources;
  if (!home) return <p className="tx-note">Set where you're leaving from to see the drive.</p>;
  if (drive.status === "loading") return <Loading>Finding the drive…</Loading>;
  if (drive.status === "error") return <p className="tx-note">{drive.error} The budget uses a straight-line guess for now.</p>;
  if (drive.status !== "ok") return null;
  const { miles, minutes } = drive.value;
  const days = Math.ceil(minutes / 60 / DRIVE_DAY_HOURS);
  return (
    <div className="tx-callout">
      <p>
        <strong>{fmtHours(minutes)}</strong> of driving, {Math.round(miles).toLocaleString("en-US")} miles each way.
        {days > 1 && ` At ${DRIVE_DAY_HOURS} hours a day that's ${days} days on the road each way, with ${days - 1} night${days > 2 ? "s" : ""} on the way.`}
      </p>
      <p className="tx-muted">
        Plan the stops, gas and where to sleep on the way in <Link to="/roadtrip">RoadTripFox</Link>.
      </p>
      {trip.kids > 0 && minutes > 240 && <p className="tx-muted">With kids, plan a 15 minute stop about every two hours.</p>}
    </div>
  );
}

function Fares({ trip, homeAirport, sources, onUseDates }) {
  const { fares } = sources;
  if (!homeAirport || !trip.airport) return <p className="tx-note">Pick both airports to see the cheapest days to fly.</p>;
  if (homeAirport.code === trip.airport.code) return <p className="tx-note">Those are the same airport.</p>;
  if (fares.status === "loading") return <Loading>Checking recent fares…</Loading>;
  if (fares.status === "no-key") return <p className="tx-note">Fare search isn't switched on for this site yet. Use the Google Flights link below.</p>;
  if (fares.status === "error") return <p className="tx-note">{fares.error}</p>;
  if (!fares.pairs?.length) return <p className="tx-note">No recent fares for those dates. Try other dates or the Google Flights link below.</p>;
  return (
    <div className="tx-callout">
      <p className="tx-label">Cheapest round trips per seat{trip.start ? " near your dates" : " in the next month"}</p>
      <ul className="tx-fares">
        {fares.pairs.map(p => (
          <li key={p.depart}>
            <span>
              {shortDay(p.depart)} → {shortDay(p.back)} <span className="tx-muted">· {p.nights} nights{p.out.transfers === 0 && p.ret.transfers === 0 ? " · nonstop" : ""}</span>
            </span>
            <strong>{fmtMoney(p.total)}</strong>
            {(p.depart !== trip.start || p.back !== trip.end) && (
              <button type="button" className="tx-btn is-small" onClick={() => onUseDates(p.depart, p.back, p.total)}>
                Use these dates
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="tx-muted">From fares travelers found recently, so treat them as a guide. Southwest doesn't share its fares.</p>
    </div>
  );
}

/** Where, when, who and how: the trip's basics, with the weather and a cost at a glance. */
export default function PlanTab({ data, trip, setTrip, change, sources, budget, today, go }) {
  const days = sources.days;
  const setStart = start => {
    const nights = trip.start && trip.end ? Math.max(0, (Date.parse(trip.end) - Date.parse(trip.start)) / 86400000) : 3;
    setTrip({ start: start || null, end: start ? (trip.end && trip.end >= start ? trip.end : addDays(start, nights)) : null });
  };
  return (
    <div className="tx-stack">
      <section className="tx-card tx-hero">
        <PlaceField label="Where are you going?" place={trip.dest} onPick={dest => setTrip({ dest })} placeholder="A city, town or park" />
        <div className="tx-row">
          <label className="tx-field">
            <span className="tx-label">Leave</span>
            <input type="date" value={trip.start ?? ""} min={today} onChange={e => setStart(e.target.value)} />
          </label>
          <label className="tx-field">
            <span className="tx-label">Come home</span>
            <input type="date" value={trip.end ?? ""} min={trip.start ?? today} disabled={!trip.start} onChange={e => setTrip({ end: e.target.value || null })} />
          </label>
        </div>
        <div className="tx-row">
          <Stepper label="Adults" value={trip.adults} min={1} max={12} onChange={adults => setTrip({ adults })} />
          <Stepper label="Kids" value={trip.kids} min={0} max={12} onChange={kids => setTrip({ kids })} />
          <Stepper label="Rooms" value={trip.rooms} min={1} max={6} onChange={rooms => setTrip({ rooms })} />
        </div>
        {trip.adults + trip.kids > 4 && trip.rooms === 1 && <p className="tx-note">Most hotel rooms sleep four. A second room or a rental home fits a bigger group.</p>}
      </section>

      {trip.dest && (
        <section className="tx-card">
          <header className="tx-card-head">
            <h2>
              {trip.dest.name} <small>{dateSpan(trip)}</small>
            </h2>
            <button type="button" className="tx-link" onClick={() => go("budget")}>
              About {fmtMoney(budget.total)}
              {trip.budget ? ` of ${fmtMoney(trip.budget)}` : ""}
            </button>
          </header>
          {!days.length && <p className="tx-note">Pick your dates to see the weather for each day.</p>}
          {sources.weather.status === "loading" && <Loading>Getting the weather…</Loading>}
          {sources.weather.status === "error" && <p className="tx-note">{sources.weather.error}</p>}
          <WeatherStrip days={days} weather={sources.weather.value} units={data.units} />
          {sources.weather.value?.source === "typical" && <p className="tx-muted tx-small">Too far out for a forecast, so this is what the last three years were like on these dates. The forecast takes over about two weeks before you go.</p>}
          {sources.weather.value && (
            <p className="tx-small">
              <Link to="/clocast">Open SkyFox</Link> for hour by hour weather and what to wear once you're there.
            </p>
          )}
        </section>
      )}

      <section className="tx-card">
        <h2>Getting there</h2>
        <Segmented label="Travel by" value={trip.travel} options={TRAVEL.map(m => ({ ...m, icon: TRAVEL_ICONS[m.id] }))} onChange={travel => setTrip({ travel, travelCost: null })} />
        {trip.travel === "fly" ? (
          <div className="tx-row">
            <AirportField label="Fly from" airport={data.homeAirport} onPick={homeAirport => change(() => ({ homeAirport }))} />
            <AirportField label="Fly to" airport={trip.airport} onPick={airport => setTrip({ airport })} placeholder={trip.dest ? `Near ${trip.dest.name}` : "City or airport code"} />
          </div>
        ) : (
          <PlaceField label="Leaving from" place={data.home} onPick={home => change(() => ({ home }))} allowLocate />
        )}
        {trip.travel === "drive" && (
          <>
            <label className="tx-field">
              <span className="tx-label">Vehicle</span>
              <select value={trip.vehicle} onChange={e => setTrip({ vehicle: e.target.value })}>
                {VEHICLES.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                    {v.mpg ? ` (${v.mpg} mpg)` : ""}
                  </option>
                ))}
              </select>
            </label>
            {trip.dest && <Drive trip={trip} home={data.home} sources={sources} />}
          </>
        )}
        {trip.travel === "fly" && trip.dest && <Fares trip={trip} homeAirport={data.homeAirport} sources={sources} onUseDates={(start, end) => setTrip({ start, end })} />}
        {trip.travel === "fly" && !trip.dest && <p className="tx-note">Pick where you're going first.</p>}
        <ul className="tx-links">
          {travelLinks(trip, { home: data.home, homeAirport: data.homeAirport }).map(l => (
            <li key={l.id}>
              <a href={l.href} target="_blank" rel="noreferrer">
                {l.name} <ExternalLink size={13} aria-hidden="true" />
              </a>
              <span className="tx-muted">{l.note}</span>
            </li>
          ))}
        </ul>
      </section>

      {trip.dest && (
        <nav className="tx-next" aria-label="Next steps">
          <button type="button" className="tx-btn" onClick={() => go("do")}>
            Find things to do
          </button>
          <button type="button" className="tx-btn" onClick={() => go("stay")}>
            Find a place to stay
          </button>
        </nav>
      )}
    </div>
  );
}
