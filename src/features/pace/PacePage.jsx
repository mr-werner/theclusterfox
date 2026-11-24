import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, CalendarRange, Cloud, CloudOff, HardDrive, History, LoaderCircle, Play, SlidersHorizontal } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useAuth } from "../../context/AuthContext";
import { withNext } from "../../lib/redirect";
import { SPORT_IDS } from "./data/events";
import { findSession, nextSession } from "./model/plan";
import { sessionTitle } from "./model/planLink";
import { toIsoDay } from "./model/units";
import { usePaceData } from "./state/usePaceData";
import { useSensors } from "./state/useSensors";
import { useRecorder } from "./state/useRecorder";
import PlanTab from "./components/PlanTab";
import GoTab from "./components/GoTab";
import LogTab from "./components/LogTab";
import SetupTab from "./components/SetupTab";
import "./pace.css";
import "./identity.css";

const TABS = [
  { id: "plan", name: "Plan", icon: CalendarRange },
  { id: "go", name: "Go", icon: Play },
  { id: "log", name: "Log", icon: History },
  { id: "setup", name: "Setup", icon: SlidersHorizontal },
];

function SyncNote({ status, signedIn }) {
  if (!signedIn) {
    return (
      <p className="pc-sync">
        <HardDrive size={14} aria-hidden="true" /> Saved on this device. <Link to={withNext("/login", "/pace")}>Log in</Link> to keep your plan on every device.
      </p>
    );
  }
  const states = {
    syncing: [<LoaderCircle key="i" size={14} className="spin" />, "Syncing…"],
    synced: [<Cloud key="i" size={14} />, "Synced to your account"],
    unavailable: [<HardDrive key="i" size={14} />, "Saved on this device. Account sync isn't switched on yet."],
    error: [<CloudOff key="i" size={14} />, "Couldn't sync right now. Saved on this device."],
    local: [<HardDrive key="i" size={14} />, "Saved on this device"],
  };
  const [icon, text] = states[status] ?? states.local;
  return (
    <p className="pc-sync" aria-live="polite">
      {icon} {text}
    </p>
  );
}

export default function PacePage() {
  const store = usePaceData();
  const { data, syncStatus } = store;
  const { isAuthenticated } = useAuth();
  const sensors = useSensors();
  const recorder = useRecorder({ prefs: data.prefs, profile: data.profile, sensors });
  const [params, setParams] = useSearchParams();
  const today = toIsoDay(new Date());

  const plan = data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0] ?? null;

  // ?next=1 (from TaskFox) means the next session of the active plan.
  const nextParam = params.get("next");
  useEffect(() => {
    if (!nextParam || !plan) return;
    const n = nextSession(plan, today);
    setParams(n ? { plan: plan.id, session: n.id } : {}, { replace: true });
  }, [nextParam, plan, today, setParams]);

  const linkedPlan = data.plans.find(p => p.id === params.get("plan")) ?? plan;
  const linkedSession = linkedPlan && params.get("session") ? findSession(linkedPlan, params.get("session")) : null;
  const goSport = SPORT_IDS.includes(params.get("go")) ? params.get("go") : null;

  const requested = params.get("tab");
  const tab = recorder.live && !requested ? "go" : TABS.some(t => t.id === requested) ? requested : linkedSession || goSport ? "go" : "plan";

  const preset = useMemo(() => (linkedSession && tab === "go" ? { plan: linkedPlan, session: linkedSession } : null), [linkedSession, linkedPlan, tab]);

  const openTab = id => {
    setParams(id === "plan" ? {} : { tab: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const planTitle = recorder.live ? `Training: ${recorder.live.title}` : linkedSession ? `Training: ${sessionTitle(linkedPlan, linkedSession)}` : plan ? "Training: next session" : "Cardio training";
  const planHref = linkedSession ? `/pace?plan=${encodeURIComponent(linkedPlan.id)}&session=${encodeURIComponent(linkedSession.id)}` : plan ? "/pace?next=1" : "/pace";

  return (
    <main className="pc">
      <AppBar appId="pacefox" planTitle={planTitle} planHref={planHref} />
      <div className="pc-shell">
        {!recorder.live && (
          <header className="pc-hero">
            <div className="pc-logo" aria-hidden="true">
              <Activity size={26} />
            </div>
            <div>
              <p className="pc-eyebrow">PaceFox</p>
              <h1>Train for race day.</h1>
              <SyncNote status={syncStatus} signedIn={isAuthenticated} />
            </div>
          </header>
        )}

        <nav className={`pc-tabs${recorder.live ? " is-live" : ""}`} aria-label="PaceFox">
          {TABS.map(t => (
            <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => openTab(t.id)}>
              <t.icon size={17} aria-hidden="true" />
              {t.name}
              {t.id === "go" && recorder.live && tab !== "go" && <span className="pc-dot" aria-label="recording" />}
            </button>
          ))}
        </nav>

        {tab === "plan" && (
          <PlanTab
            store={store}
            today={today}
            focusId={params.get("session")}
            onFocus={id => setParams(id ? { plan: plan?.id ?? "", session: id, tab: "plan" } : {})}
            onStart={s => {
              setParams({ tab: "go", plan: plan.id, session: s.id });
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === "go" && (
          <GoTab
            key={`${preset?.session?.id ?? "free"}:${goSport ?? ""}`}
            store={store}
            recorder={recorder}
            sensors={sensors}
            preset={preset}
            defaultSport={goSport}
            onClearPreset={() => setParams({ tab: "go" })}
            onSaved={a => {
              setParams(a ? { tab: "log", a: a.id } : { tab: "log" });
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === "log" && <LogTab store={store} today={today} openId={params.get("a")} onOpen={id => setParams(id ? { tab: "log", a: id } : { tab: "log" }, { replace: true })} />}
        {tab === "setup" && <SetupTab store={store} sensors={sensors} />}

        <p className="pc-credit">Training plans are general guidance, not medical advice. Build up gradually, and check with a doctor before starting if you have a health condition.</p>
      </div>
    </main>
  );
}
