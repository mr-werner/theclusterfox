import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bookmark, Fuel, Gamepad2, Luggage, Route } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useRoadData } from "./state/useRoadData";
import { useTrip } from "./state/useTrip";
import shapes from "./data/stateShapes.json";
import { cumulative, statesAlong } from "./model/geo";
import { splitDays } from "./model/route";
import PlanTab from "./components/PlanTab";
import FuelTab from "./components/FuelTab";
import GamesTab from "./components/GamesTab";
import TripsTab from "./components/TripsTab";
import PackTab from "./components/PackTab";
import "./road.css";
import "./identity.css";

const TABS = [
  { id: "plan", name: "Trip", icon: Route },
  { id: "pack", name: "Pack", icon: Luggage },
  { id: "fuel", name: "Fuel", icon: Fuel },
  { id: "games", name: "Games", icon: Gamepad2 },
  { id: "saved", name: "Saved", icon: Bookmark },
];

// RoadTripFox (it was RoadFox, at /road): the road trip planner. It's the
// journey, not the destination: routes built around scenery, food, history
// or the outdoors, split into days, a packing list from the weather where
// you're staying, gas or charging stops, this week's gas prices, and car games.
export default function RoadPage() {
  const store = useRoadData();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : "plan";
  const savedTrip = store.data.trips.find(t => t.id === params.get("trip")) ?? null;
  const { data } = store;
  const from = savedTrip?.from ?? data.from;
  const to = savedTrip?.to ?? data.to;
  const trip = useTrip(from, to, savedTrip);
  const [selectedId, setSelectedId] = useState(null);

  // Coming back to a trip you were planning picks up where you left off.
  useEffect(() => {
    if (!savedTrip && from && to && trip.status === "idle") trip.run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback(
    next => {
      const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== undefined && v !== null && v !== "" && !(k === "tab" && v === "plan")));
      setParams(clean);
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );

  // Changing where you're going leaves a saved trip for a fresh plan.
  const patch = useCallback(
    fn => {
      if (savedTrip) {
        store.patch({ from: savedTrip.from, to: savedTrip.to, departDate: savedTrip.departDate, hoursPerDay: savedTrip.hoursPerDay });
        go({ tab });
      }
      store.patch(fn);
    },
    [savedTrip, store, go, tab]
  );
  const pageStore = useMemo(() => ({ data: savedTrip ? { ...data, from, to, departDate: savedTrip.departDate, hoursPerDay: savedTrip.hoursPerDay } : data, patch }), [data, savedTrip, from, to, patch]);

  const current = trip.routes.find(r => r.id === selectedId) ?? trip.routes[0] ?? null;
  const driveDays = savedTrip ? savedTrip.days.length || 1 : current ? splitDays(current.route, current.stops, data.hoursPerDay).length : 1;
  const routeStates = useMemo(() => (current ? statesAlong(shapes, current.route.points, cumulative(current.route.points), 10).map(s => s.code) : []), [current]);

  function runFresh() {
    if (savedTrip) {
      store.patch({ from: savedTrip.from, to: savedTrip.to, departDate: savedTrip.departDate, hoursPerDay: savedTrip.hoursPerDay });
      go({});
    }
    setSelectedId(null);
    trip.run();
  }

  const planTitle = from && to ? `Road trip: ${from.name} to ${to.name}` : "Plan a road trip in RoadTripFox";

  return (
    <div className="rf">
      <AppBar appId="roadfox" planTitle={planTitle} planHref={savedTrip ? `/roadtrip?trip=${savedTrip.id}` : undefined} />
      <nav className="rf-tabs" aria-label="RoadTripFox sections">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" className={t.id === tab ? "is-on" : ""} aria-current={t.id === tab ? "page" : undefined} onClick={() => go({ tab: t.id, trip: t.id === "saved" ? undefined : savedTrip?.id })}>
              <Icon size={18} aria-hidden="true" />
              <span>{t.name}</span>
            </button>
          );
        })}
      </nav>
      <main className="rf-main">
        {tab === "plan" && <PlanTab store={pageStore} trip={{ ...trip, run: runFresh }} selectedId={current?.id} setSelectedId={setSelectedId} savedTrip={savedTrip} openDay={Number(params.get("day")) || null} />}
        {tab === "pack" && <PackTab store={store} savedTrip={savedTrip} to={to} driveDays={driveDays} goPlan={() => go({})} />}
        {tab === "fuel" && <FuelTab store={store} current={current} goPlan={() => go({})} />}
        {tab === "games" && <GamesTab store={store} routeStates={routeStates} game={params.get("game")} setGame={g => go({ tab: "games", game: g, trip: savedTrip?.id })} />}
        {tab === "saved" && <TripsTab store={store} openTrip={id => go({ trip: id })} goPlan={() => go({})} />}
      </main>
    </div>
  );
}
