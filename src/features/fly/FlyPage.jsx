import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Gamepad2, GraduationCap, Plane, Radar, Radio, Route, Wind } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useFlyData } from "./state/useFlyData";
import WindsTab from "./components/WindsTab";
import PlanTab from "./components/PlanTab";
import TrafficTab from "./components/TrafficTab";
import LearnTab from "./components/LearnTab";
import StudyTab from "./components/StudyTab";
import AirplaneTab from "./components/AirplaneTab";
import SimTab from "./components/SimTab";
import RadioTab from "./components/RadioTab";
import "./fly.css";
import "./identity.css";

const TABS = [
  { id: "plan", name: "Plan", icon: Route },
  { id: "winds", name: "Winds", icon: Wind },
  { id: "traffic", name: "Tracker", icon: Radar },
  { id: "airplane", name: "Airplane", icon: Plane },
  { id: "sim", name: "Sim", icon: Gamepad2 },
  { id: "radio", name: "Radio", icon: Radio },
  { id: "learn", name: "License", icon: GraduationCap },
  { id: "study", name: "Study", icon: BookOpen },
];

// PilotFox: the pilot's app. Plan a flight with winds and weather along the
// route, read winds aloft anywhere, watch live traffic, play with how an
// airplane flies, fly the simulator, practice radio calls, find the path
// to a license and study for the FAA knowledge tests.
export default function FlyPage() {
  const store = useFlyData();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : "plan";

  const go = useCallback(
    next => {
      const clean = Object.fromEntries(Object.entries(next).filter(([k, v]) => v !== undefined && v !== null && v !== "" && !(k === "tab" && v === "plan")));
      setParams(clean);
      window.scrollTo({ top: 0 });
    },
    [setParams]
  );

  const flight = params.get("flight");
  const saved = flight ? store.data.flights.find(f => f.id === flight) : null;
  const route = store.data.route;
  const planTitle = tab === "plan" && route.length >= 2 ? `Fly ${route[0].id} → ${route[route.length - 1].id}` : tab === "study" && params.get("exam") ? `Study for the ${params.get("exam").toUpperCase()} test` : undefined;

  return (
    <div className="fy">
      <AppBar appId="flyfox" planTitle={planTitle} />
      <nav className="fy-tabs" aria-label="PilotFox sections">
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
      <main className="fy-main">
        {tab === "plan" && <PlanTab f={store} key={saved?.id} openFlight={saved} />}
        {tab === "winds" && <WindsTab f={store} />}
        {tab === "traffic" && <TrafficTab f={store} />}
        {tab === "airplane" && <AirplaneTab section={params.get("section")} go={go} />}
        {tab === "sim" && <SimTab />}
        {tab === "radio" && <RadioTab />}
        {tab === "learn" && <LearnTab f={store} openExam={exam => go({ tab: "study", exam })} />}
        {tab === "study" && <StudyTab f={store} examId={params.get("exam")} mode={params.get("mode")} go={go} />}
      </main>
    </div>
  );
}
