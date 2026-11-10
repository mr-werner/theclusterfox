import { useSearchParams } from "react-router-dom";
import { CalendarDays, Trophy, Tv } from "lucide-react";

import AppBar from "../../components/AppBar";
import ServicePicker from "../watch/components/ServicePicker";
import SportsSchedule from "./components/SportsSchedule";
import { useSportsData } from "./state/useSportsData";
import "../watch/watch.css";
import "./sports.css";
import "./identity.css";

const TABS = [
  { id: "games", name: "Games", icon: CalendarDays },
  { id: "services", name: "Services", icon: Tv },
];

export default function SportsPage() {
  const { data, update } = useSportsData();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "games";
  const openTab = id => setParams(id === "games" ? {} : { tab: id });
  const serviceCount = data.services.length + data.live.length;
  const leagueCount = data.leagues.length;

  return (
    <main className="sports-page wf sf">
      <AppBar appId="scorefox" />

      <div className="wf-shell">
        <header className="wf-hero">
          <div className="wf-mark" aria-hidden="true">
            <Trophy size={26} />
          </div>
          <div>
            <p className="wf-eyebrow">SCOREFOX</p>
            <h1>Every game, and where it’s on.</h1>
            <p className="wf-muted">
              {serviceCount
                ? `Following ${leagueCount} league${leagueCount === 1 ? "" : "s"} on your ${serviceCount} service${serviceCount === 1 ? "" : "s"}.`
                : "Pick your leagues and services to see which games you can watch."}
            </p>
          </div>
        </header>

        <nav className="wf-tabs" aria-label="ScoreFox">
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

        {tab === "games" && <SportsSchedule data={data} update={update} onPickServices={() => openTab("services")} />}
        {tab === "services" && <ServicePicker data={data} update={update} live />}

        <footer className="wf-credits">
          <p>
            Schedules, scores and US TV listings from <a href="https://www.espn.com" target="_blank" rel="noreferrer">ESPN</a>. Streaming
            service names from <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a>.
          </p>
        </footer>
      </div>
    </main>
  );
}
