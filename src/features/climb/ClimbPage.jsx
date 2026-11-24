import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Compass, ListChecks, Ruler, X } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useClimbData } from "./state/useClimbData";
import ExploreTab from "./components/ExploreTab";
import AreaView from "./components/AreaView";
import RouteView from "./components/RouteView";
import PlanTab from "./components/PlanTab";
import LogTab from "./components/LogTab";
import GradesTab from "./components/GradesTab";
import "./climb.css";
import "./identity.css";

const TABS = [
  { id: "explore", name: "Explore", icon: Compass },
  { id: "plan", name: "Plan", icon: CalendarDays },
  { id: "log", name: "My climbs", icon: ListChecks },
  { id: "grades", name: "Grades", icon: Ruler },
];

// ClimbFox: climbing routes, packaged. Find crags on a map or by name,
// read every route under an area with filters, see the week's climbing
// conditions, keep a to-do list and a tick log, and plan climbing days
// with a gear list that land on your TaskFox calendar. Route data is
// OpenBeta's open, public-domain database.
export default function ClimbPage() {
  const store = useClimbData();
  const [params, setParams] = useSearchParams();
  const [toast, setToast] = useState(null);

  const area = params.get("area");
  const route = params.get("route");
  const trip = params.get("trip");
  const requested = params.get("tab");
  const tab = route || area ? null : TABS.some(t => t.id === requested) ? requested : "explore";

  const go = useCallback(
    next => {
      const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== undefined && v !== null && v !== "" && !(k === "tab" && v === "explore")));
      setParams(clean);
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const c = useMemo(() => ({ ...store, toast: (text, tripId) => setToast({ text, tripId, at: Date.now() }) }), [store]);
  const openArea = useCallback(uuid => go({ area: uuid }), [go]);
  const openRoute = useCallback(uuid => go({ route: uuid }), [go]);
  const openTrip = useCallback(id => go({ tab: "plan", trip: id }), [go]);

  const tripObj = trip ? store.data.trips.find(t => t.id === trip) : null;
  const recentArea = area ? store.data.recent.find(r => r.uuid === area) : null;
  const planTitle = tripObj ? tripObj.title : recentArea ? `Climb at ${recentArea.name}` : tab === "log" ? "Climbing session" : undefined;

  return (
    <div className="cb">
      <AppBar appId="climbfox" planTitle={planTitle} />
      <nav className="cb-tabs" aria-label="ClimbFox sections">
        {TABS.map(t => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button key={t.id} type="button" className={on ? "is-on" : ""} aria-current={on ? "page" : undefined} onClick={() => go({ tab: t.id })}>
              <Icon size={18} aria-hidden="true" />
              <span>{t.name}</span>
            </button>
          );
        })}
      </nav>
      <main className="cb-main">
        {route ? (
          <RouteView key={route} uuid={route} c={c} openArea={openArea} openRoute={openRoute} />
        ) : area ? (
          <AreaView key={area} uuid={area} c={c} openArea={openArea} openRoute={openRoute} openTrip={openTrip} />
        ) : tab === "plan" ? (
          <PlanTab c={c} tripId={trip} openTrip={id => go({ tab: "plan", trip: id ?? undefined })} openArea={openArea} openRoute={openRoute} goExplore={() => go({})} />
        ) : tab === "log" ? (
          <LogTab c={c} openArea={openArea} openRoute={openRoute} goExplore={() => go({})} />
        ) : tab === "grades" ? (
          <GradesTab />
        ) : (
          <ExploreTab c={c} openArea={openArea} />
        )}
      </main>
      {toast && (
        <div className="cb-toast" role="status" key={toast.at}>
          <span>{toast.text}</span>
          {toast.tripId && (
            <button type="button" className="cb-link" onClick={() => { openTrip(toast.tripId); setToast(null); }}>
              Open plan
            </button>
          )}
          <button type="button" className="cb-iconbtn" onClick={() => setToast(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
