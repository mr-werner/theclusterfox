import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Bookmark, Footprints, Search } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useHikeData } from "./state/useHikeData";
import { useTracker } from "./state/useTracker";
import { fmt } from "./state/hikeStore";
import { registerOffline } from "./offline";
import FindTab from "./components/FindTab";
import TrailView from "./components/TrailView";
import GoTab from "./components/GoTab";
import SavedTab from "./components/SavedTab";
import "./hike.css";
import "./identity.css";

const TABS = [
  { id: "find", name: "Find", icon: Search },
  { id: "go", name: "Hike", icon: Footprints },
  { id: "saved", name: "Saved", icon: Bookmark },
];

// TrailFox: plan a hike from open data. Find a trail on OpenStreetMap, see
// its climb, get the best start time from the forecast at the trailhead and
// up high, pack the right gear, save the map for offline use, then follow
// it with GPS and a compass while a light-touch tracker records your hike.
export default function HikePage() {
  const h = useHikeData();
  const tracker = useTracker(h);
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const trailId = params.get("trail");
  const trail = trailId ? h.data.trails.find(t => t.id === trailId) : null;
  // A hike in progress opens straight to it.
  const tab = TABS.some(t => t.id === requested) ? requested : h.data.active && !trailId ? "go" : "find";
  const f = useMemo(() => fmt(h.data.units), [h.data.units]);

  useEffect(() => registerOffline(), []);

  const go = useCallback(
    next => {
      const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== undefined && v !== null && v !== "" && !(k === "tab" && v === "find")));
      setParams(clean);
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );
  const openTrail = useCallback(id => go({ trail: id }), [go]);

  const showTrail = tab === "find" && trail;
  const planTitle = showTrail ? `Hike ${trail.name}` : undefined;

  return (
    <div className="hk">
      <AppBar appId="trailfox" planTitle={planTitle} />
      <nav className="hk-tabs" aria-label="TrailFox sections">
        {TABS.map(t => {
          const Icon = t.icon;
          const on = t.id === tab;
          return (
            <button key={t.id} type="button" className={on ? "is-on" : ""} aria-current={on ? "page" : undefined} onClick={() => go({ tab: t.id, trail: t.id === "go" ? trailId : undefined })}>
              <Icon size={18} aria-hidden="true" />
              <span>{t.name}</span>
              {t.id === "go" && h.data.active && <i className="hk-tab-dot" aria-label="(recording)" />}
            </button>
          );
        })}
      </nav>
      <main className="hk-main">
        {tab === "find" && (showTrail ? <TrailView key={trail.id} h={h} f={f} trail={trail} go={go} /> : trailId ? <MissingTrail go={go} /> : <FindTab h={h} f={f} openTrail={openTrail} />)}
        {tab === "go" && <GoTab h={h} f={f} tracker={tracker} trailId={trailId} />}
        {tab === "saved" && <SavedTab h={h} f={f} openTrail={openTrail} />}
      </main>
    </div>
  );
}

function MissingTrail({ go }) {
  return (
    <section className="hk-empty">
      <p>That trail isn't saved in this browser. Trails live on the device you planned them on.</p>
      <button type="button" className="hk-btn" onClick={() => go({})}>Find a trail</button>
    </section>
  );
}
