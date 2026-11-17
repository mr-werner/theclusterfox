import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Mountain, ShieldAlert } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useSnowData } from "./state/useSnowData";
import { findSpot } from "./model/spots";
import MountainList from "./components/MountainList";
import SpotDetail from "./components/SpotDetail";
import BackcountryTab from "./components/BackcountryTab";
import TripsTab from "./components/TripsTab";
import "./snow.css";
import "./identity.css";

const TABS = [
  { id: "mountains", name: "Mountains", icon: Mountain },
  { id: "backcountry", name: "Backcountry", icon: ShieldAlert },
  { id: "trips", name: "My days", icon: CalendarDays },
];

// SnowFox: ski, snowboard and mountain conditions. Snow that fell and is
// coming at the top and base of each mountain, wind holds, live lifts, the
// trail map, snowpack sensors, avalanche danger, and the drive up.
export default function SnowPage() {
  const s = useSnowData();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : "mountains";
  const spot = params.get("spot") ? findSpot(params.get("spot"), s.data) : null;
  const day = params.get("day");

  const go = useCallback(
    next => {
      const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== undefined && v !== null && v !== "" && !(k === "tab" && v === "mountains")));
      setParams(clean);
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );
  const open = (id, d) => go({ spot: id, day: d, from: tab === "mountains" ? undefined : tab });

  const planTitle = spot ? `${spot.kind === "backcountry" ? "Tour" : "Ski"} ${spot.name}` : undefined;

  return (
    <div className="sf">
      <AppBar appId="snowfox" planTitle={planTitle} />
      <nav className="sf-tabs" aria-label="SnowFox sections">
        {TABS.map(t => {
          const Icon = t.icon;
          const on = !spot && t.id === tab;
          return (
            <button key={t.id} type="button" className={on ? "is-on" : ""} aria-current={on ? "page" : undefined} onClick={() => go({ tab: t.id })}>
              <Icon size={18} aria-hidden="true" />
              <span>{t.name}</span>
            </button>
          );
        })}
        <div className="sf-units" role="group" aria-label="Units">
          <button type="button" aria-pressed={s.data.units === "us"} onClick={() => s.patch({ units: "us" })}>
            °F
          </button>
          <button type="button" aria-pressed={s.data.units === "metric"} onClick={() => s.patch({ units: "metric" })}>
            °C
          </button>
        </div>
      </nav>
      <main className="sf-main">
        {spot ? (
          <SpotDetail key={spot.id} spot={spot} s={s} day={day} setDay={d => setParams({ spot: spot.id, day: d, ...(params.get("from") ? { from: params.get("from") } : {}) }, { replace: true })} back={() => go({ tab: params.get("from") ?? undefined })} />
        ) : (
          <>
            {tab === "mountains" && <MountainList s={s} open={open} />}
            {tab === "backcountry" && <BackcountryTab s={s} open={open} />}
            {tab === "trips" && <TripsTab s={s} open={open} />}
          </>
        )}
      </main>
    </div>
  );
}
