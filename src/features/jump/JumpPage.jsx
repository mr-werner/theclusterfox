import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, BookOpen, CloudSun, MapPin, PartyPopper, Shirt, Sparkles } from "lucide-react";

import AppBar from "../../components/AppBar";
import { dzById } from "./data/dropzones";
import { useJumpData } from "./state/useJumpData";
import TodayTab from "./components/TodayTab";
import PlacesTab from "./components/PlacesTab";
import LicenseTab from "./components/LicenseTab";
import SkillsTab from "./components/SkillsTab";
import EventsTab from "./components/EventsTab";
import GearTab from "./components/GearTab";
import LogbookTab from "./components/LogbookTab";
import "./jump.css";
import "./identity.css";

const TABS = [
  { id: "today", name: "Jump check", icon: CloudSun },
  { id: "places", name: "Drop zones", icon: MapPin },
  { id: "license", name: "License", icon: Award },
  { id: "skills", name: "Skills", icon: Sparkles },
  { id: "events", name: "Events", icon: PartyPopper },
  { id: "gear", name: "Gear", icon: Shirt },
  { id: "log", name: "Logbook", icon: BookOpen },
];

// JumpFox: the skydiver's app. Can you jump today at your DZ, where to jump
// and fly a tunnel, the USPA license path, how to fly the maneuvers, boogies,
// gear, and a logbook you can download.
export default function JumpPage() {
  const j = useJumpData();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const dzParam = params.get("dz");
  const tab = TABS.some(t => t.id === requested) ? requested : "today";

  const go = useCallback(
    next => {
      const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== undefined && v !== null && v !== "" && !(k === "tab" && v === "today")));
      setParams(clean);
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );

  const dzId = dzById[dzParam] ? dzParam : j.data.homeDz;
  const setDz = id => setParams(id ? { dz: id } : {}, { replace: true });
  const openDz = id => go({ dz: id });
  const kind = params.get("show") === "tunnels" ? "tunnels" : "dz";
  const planTitle = tab === "today" && dzById[dzId] ? `Jump at ${dzById[dzId].name}` : tab === "log" ? "Log my jumps" : undefined;

  return (
    <div className="jf">
      <AppBar appId="jumpfox" planTitle={planTitle} />
      <nav className="jf-tabs jf-noprint" aria-label="JumpFox sections">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" className={t.id === tab ? "is-on" : ""} aria-current={t.id === tab ? "page" : undefined} onClick={() => go({ tab: t.id })}>
              <Icon size={18} aria-hidden="true" />
              <span>{t.name}</span>
            </button>
          );
        })}
      </nav>
      <main className="jf-main">
        {tab === "today" && <TodayTab j={j} dzId={dzId} setDz={setDz} />}
        {tab === "places" && <PlacesTab j={j} kind={kind} setKind={k => setParams(k === "tunnels" ? { tab: "places", show: "tunnels" } : { tab: "places" }, { replace: true })} openDz={openDz} />}
        {tab === "license" && <LicenseTab j={j} openLog={() => go({ tab: "log" })} />}
        {tab === "skills" && <SkillsTab />}
        {tab === "events" && <EventsTab j={j} openDz={openDz} />}
        {tab === "gear" && <GearTab j={j} />}
        {tab === "log" && <LogbookTab j={j} />}
      </main>
    </div>
  );
}
