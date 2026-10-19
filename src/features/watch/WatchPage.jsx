import { useSearchParams } from "react-router-dom";
import { Clapperboard, MonitorPlay, Trophy, Tv } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import ServicePicker from "./components/ServicePicker";
import ShowSearch from "./components/ShowSearch";
import SportsSchedule from "./components/SportsSchedule";
import { useWatchData } from "./state/useWatchData";
import "./watch.css";

const TABS = [
  { id: "shows", name: "Shows", icon: Clapperboard },
  { id: "sports", name: "Sports", icon: Trophy },
  { id: "services", name: "Services", icon: Tv },
];

export default function WatchPage() {
  const { data, update } = useWatchData();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "shows";
  const openTab = id => setParams(id === "shows" ? {} : { tab: id });
  const serviceCount = data.services.length + data.live.length;

  return (
    <main className="watch-page wf">
      <SiteHeader />

      <div className="wf-shell">
        <header className="wf-hero">
          <div className="wf-mark" aria-hidden="true">
            <MonitorPlay size={26} />
          </div>
          <div>
            <p className="wf-eyebrow">WATCHFOX</p>
            <h1>Find where to watch it.</h1>
            <p className="wf-muted">
              {serviceCount
                ? `Checking against your ${serviceCount} service${serviceCount === 1 ? "" : "s"}. Saved on this device.`
                : "Search any show, movie or game and see where it's on."}
            </p>
          </div>
        </header>

        <nav className="wf-tabs" aria-label="WatchFox">
          {TABS.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => openTab(item.id)}>
                <Icon size={17} aria-hidden="true" />
                {item.name}
                {item.id === "services" && serviceCount > 0 && <span className="wf-count">{serviceCount}</span>}
              </button>
            );
          })}
        </nav>

        {tab === "shows" && <ShowSearch data={data} update={update} onPickServices={() => openTab("services")} />}
        {tab === "sports" && <SportsSchedule data={data} update={update} />}
        {tab === "services" && <ServicePicker data={data} update={update} />}

        <footer className="wf-credits">
          <p>
            Show data and streaming listings from <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a> and{" "}
            <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">JustWatch</a>. This product uses the TMDB API but is not
            endorsed or certified by TMDB.
          </p>
        </footer>
      </div>
    </main>
  );
}
