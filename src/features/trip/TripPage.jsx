import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { BedDouble, CalendarDays, Compass, MapPinned, PiggyBank, Plus, Trash2 } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useAuth } from "../../context/AuthContext";
import { searchPlaces } from "../../services/weather/openMeteo";
import { newTrip, taskFoxDestination, tripTitle } from "./state/tripStore";
import { readTaskFox, useTripData } from "./state/useTripData";
import { useTripSources } from "./state/useTripSources";
import { budgetFor } from "./model/budget";
import { dateSpan, localDay } from "./model/days";
import { tripHref } from "./model/planLink";
import PlanTab from "./components/PlanTab";
import DoTab from "./components/DoTab";
import StayTab from "./components/StayTab";
import BudgetTab from "./components/BudgetTab";
import DaysTab from "./components/DaysTab";
import "./trip.css";
import "./identity.css";

const TABS = [
  { id: "plan", name: "Trip", icon: MapPinned },
  { id: "do", name: "Do", icon: Compass },
  { id: "stay", name: "Stay", icon: BedDouble },
  { id: "budget", name: "Budget", icon: PiggyBank },
  { id: "days", name: "Days", icon: CalendarDays },
];

const SYNC_TEXT = { synced: "Saved to your account.", syncing: "Saving…", error: "Couldn't reach your account; saved on this device." };

// TripFox: plan a trip for yourself or the family in one place. Where and
// when, how you get there, the weather each day, things to do, where to
// stay, what it all costs, and a day by day plan that lands on TaskFox.
export default function TripPage() {
  const { data, change, changeTrip, syncStatus } = useTripData();
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = localDay();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "plan";

  // TaskFox's "Plan a trip" lands here with ?new=1&start=<day>&fly=<code>.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || params.get("new") !== "1") return;
    started.current = true;
    const start = /^\d{4}-\d{2}-\d{2}$/.test(params.get("start") ?? "") && params.get("start") >= today ? params.get("start") : null;
    const code = /^[A-Z]{3}$/.test(params.get("fly") ?? "") ? params.get("fly") : null;
    const airport = code ? taskFoxDestination(readTaskFox(), code) : null;
    const trip = newTrip({ start, end: null, travel: code ? "fly" : "drive", airport });
    const fresh = trip.start ? { ...trip, end: new Date(Date.parse(`${trip.start}T12:00:00Z`) + 3 * 86400000).toISOString().slice(0, 10) } : trip;
    change(d => ({ trips: [fresh, ...d.trips], currentId: fresh.id }));
    setParams({ trip: fresh.id }, { replace: true });
    // Find the city for a fare's airport so weather and things to do work too.
    if (airport && airport.name !== airport.code) {
      searchPlaces(airport.name.replace(/\b(international|airport|intl)\b/gi, "").trim())
        .then(found => found[0] && changeTrip(fresh.id, t => (t.dest ? null : { dest: { id: found[0].id, name: found[0].name, region: found[0].region, lat: found[0].latitude, lon: found[0].longitude } })))
        .catch(() => {});
    }
  }, [params, today, change, changeTrip, setParams]);

  const requested = params.get("trip");
  const trip = data.trips.find(t => t.id === requested) ?? data.trips.find(t => t.id === data.currentId) ?? null;
  const setTrip = useCallback(patch => trip && changeTrip(trip.id, () => patch), [trip, changeTrip]);

  const go = useCallback(
    id => {
      const next = {};
      if (trip) next.trip = trip.id;
      if (id !== "plan") next.tab = id;
      setParams(next);
      window.scrollTo({ top: 0 });
    },
    [trip, setParams]
  );

  const sources = useTripSources(trip, { home: data.home, homeAirport: data.homeAirport, today, wantThings: tab === "do" || tab === "days", wantStays: tab === "stay" });
  const fare = useMemo(() => {
    const pairs = sources.fares.pairs ?? [];
    return (pairs.find(p => p.depart === trip?.start && p.back === trip?.end) ?? pairs[0])?.total ?? null;
  }, [sources.fares, trip?.start, trip?.end]);
  const context = useMemo(
    () => ({ home: data.home, route: sources.drive.value, fare, gasPrice: sources.gas.value }),
    [data.home, sources.drive.value, fare, sources.gas.value]
  );
  const budget = useMemo(() => (trip ? budgetFor(trip, context) : null), [trip, context]);

  function startTrip() {
    const fresh = newTrip();
    change(d => ({ trips: [fresh, ...d.trips], currentId: fresh.id }));
    setParams({ trip: fresh.id });
  }
  function pick(id) {
    change(() => ({ currentId: id }));
    setParams(tab === "plan" ? { trip: id } : { trip: id, tab });
  }
  function removeTrip() {
    if (!trip) return;
    change(d => ({ trips: d.trips.filter(t => t.id !== trip.id), currentId: null }));
    setParams({});
  }
  // Ideas from the Do tab: on a day, or the ideas list (day null).
  const addThing = (t, day) =>
    trip &&
    changeTrip(trip.id, x => ({
      plan: [...x.plan.filter(p => p.id !== t.id), { id: t.id, day, time: t.time ?? null, title: t.title, kind: t.kind, indoor: t.indoor, cost: t.price ?? null, perPerson: t.price != null, lat: t.lat, lon: t.lon, url: t.url }],
    }));

  const planTitle = trip ? tripTitle(trip) : "Plan a trip in TripFox";
  const shared = { data, trip, setTrip, change, sources, budget, context, today, go };

  return (
    <div className="tx">
      <AppBar appId="tripfox" planTitle={planTitle} planHref={trip ? tripHref(trip.id) : undefined} />
      <main className="tx-wrap">
        <header className="tx-head">
          {trip ? (
            <div className="tx-head-trip">
              <label className="tx-trip-pick">
                <span className="tx-sr">Trip</span>
                <select value={trip.id} onChange={e => pick(e.target.value)}>
                  {data.trips.map(t => (
                    <option key={t.id} value={t.id}>
                      {tripTitle(t)} · {dateSpan(t)}
                    </option>
                  ))}
                </select>
              </label>
              <h1>{tripTitle(trip)}</h1>
              <p className="tx-muted">
                {dateSpan(trip)} · {trip.adults} adult{trip.adults > 1 ? "s" : ""}
                {trip.kids ? `, ${trip.kids} kid${trip.kids > 1 ? "s" : ""}` : ""}
              </p>
            </div>
          ) : (
            <div className="tx-head-trip">
              <h1>Plan a trip</h1>
              <p className="tx-muted">Weather, things to do, places to stay, the budget and a day by day plan, all in one place.</p>
            </div>
          )}
          <div className="tx-head-actions">
            <div className="tx-segment is-small" role="radiogroup" aria-label="Temperature">
              {[["us", "°F"], ["metric", "°C"]].map(([id, name]) => (
                <button key={id} type="button" role="radio" aria-checked={data.units === id} onClick={() => change(() => ({ units: id }))}>
                  {name}
                </button>
              ))}
            </div>
            <button type="button" className="tx-btn" onClick={startTrip}>
              <Plus size={15} aria-hidden="true" /> New trip
            </button>
          </div>
        </header>

        {trip ? (
          <>
            <nav className="tx-tabs" aria-label="TripFox">
              {TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>
                    <Icon size={17} aria-hidden="true" />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </nav>
            {tab === "plan" && <PlanTab {...shared} />}
            {tab === "do" && <DoTab {...shared} addThing={addThing} />}
            {tab === "stay" && <StayTab {...shared} />}
            {tab === "budget" && <BudgetTab {...shared} />}
            {tab === "days" && <DaysTab {...shared} focusDay={params.get("day")} />}
            <p className="tx-foot">
              <button type="button" className="tx-link" onClick={removeTrip}>
                <Trash2 size={13} aria-hidden="true" /> Delete this trip
              </button>
            </p>
          </>
        ) : (
          <section className="tx-card tx-empty">
            <p>Start with where you want to go. TripFox fills in the weather for your dates, finds things to do and places to stay, and adds up what it costs.</p>
            <button type="button" className="tx-btn is-primary" onClick={startTrip}>
              <Plus size={15} aria-hidden="true" /> Plan a trip
            </button>
          </section>
        )}

        <p className="tx-foot tx-muted">
          {isAuthenticated && SYNC_TEXT[syncStatus] ? SYNC_TEXT[syncStatus] : "Your trips are saved on this device."} Things to do from Wikipedia, OpenStreetMap and Ticketmaster; weather from Open-Meteo; drive times from OSRM. Prices are estimates, so check before you book.
        </p>
      </main>
    </div>
  );
}
