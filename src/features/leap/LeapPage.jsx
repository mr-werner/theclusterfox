import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, CalendarRange, ChevronsUp, Cloud, CloudOff, HardDrive, LoaderCircle, Play, Ruler } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useAuth } from "../../context/AuthContext";
import { withNext } from "../../lib/redirect";
import { buildPlan, findSession, nextSession, toIsoDay } from "./model/program";
import { useLeapData } from "./state/useLeapData";
import PlanTab from "./components/PlanTab";
import TrainTab from "./components/TrainTab";
import TestsTab from "./components/TestsTab";
import DrillsTab from "./components/DrillsTab";
import "./leap.css";
import "./identity.css";

const TABS = [
  { id: "plan", name: "Plan", icon: CalendarRange },
  { id: "train", name: "Train", icon: Play },
  { id: "tests", name: "Tests", icon: Ruler },
  { id: "drills", name: "Drills", icon: BookOpen },
];

function SyncNote({ status, signedIn }) {
  if (!signedIn) {
    return (
      <p className="lp-sync">
        <HardDrive size={14} aria-hidden="true" /> Saved on this device. <Link to={withNext("/login", "/leap")}>Log in</Link> to keep your plan on every device.
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
    <p className="lp-sync" aria-live="polite">
      {icon} {text}
    </p>
  );
}

// The vanes of a jump-measuring stand, the hero's backdrop.
function Vanes() {
  return (
    <div className="lp-vanes" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ "--i": i }} />
      ))}
    </div>
  );
}

export default function LeapPage() {
  const store = useLeapData();
  const { data, syncStatus } = store;
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = toIsoDay(new Date());

  const options = data.plan?.options;
  const plan = useMemo(() => (options ? buildPlan(options) : null), [options]);

  const requested = params.get("tab");
  const sessionParam = params.get("session");
  const tab = TABS.some(t => t.id === requested) ? requested : sessionParam ? "train" : "plan";

  const openTab = id => {
    setParams(id === "plan" ? {} : { tab: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSession = id => {
    setParams({ tab: "train", session: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const linked = plan && sessionParam ? findSession(plan, sessionParam) : null;
  const next = plan ? nextSession(plan, data.plan.done, today) : null;
  const planTitle = linked ? `Jump training: ${linked.name}` : plan ? "Jump training: next session" : "Jump training";
  const planHref = linked ? `/leap?tab=train&session=${encodeURIComponent(linked.id)}` : plan ? "/leap?tab=train" : "/leap";

  return (
    <main className="lp">
      <AppBar appId="leapfox" planTitle={planTitle} planHref={planHref} />
      <div className="lp-shell">
        <header className="lp-hero">
          <Vanes />
          <div className="lp-logo" aria-hidden="true">
            <ChevronsUp size={28} />
          </div>
          <div>
            <p className="lp-eyebrow">LeapFox</p>
            <h1>
              Jump <em>higher.</em>
            </h1>
            <p className="lp-lede">Plans for your sport, your takeoff foot and your event.</p>
            <SyncNote status={syncStatus} signedIn={isAuthenticated} />
          </div>
        </header>

        <nav className="lp-tabs" aria-label="LeapFox">
          {TABS.map(t => (
            <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => openTab(t.id)}>
              <t.icon size={17} aria-hidden="true" />
              {t.name}
              {t.id === "train" && next?.day === today && !data.plan?.done[next.id] && tab !== "train" && <span className="lp-dot" aria-label="session today" />}
            </button>
          ))}
        </nav>

        {tab === "plan" && <PlanTab store={store} plan={plan} today={today} onOpenSession={openSession} />}
        {tab === "train" && (
          <TrainTab store={store} plan={plan} today={today} sessionId={sessionParam} onOpenSession={openSession} onGoPlan={() => openTab("plan")} onGoTests={() => openTab("tests")} />
        )}
        {tab === "tests" && <TestsTab store={store} plan={plan} today={today} />}
        {tab === "drills" && (
          <DrillsTab
            openId={params.get("drill")}
            onOpen={id => setParams(id ? { tab: "drills", drill: id } : { tab: "drills" }, { replace: true })}
          />
        )}

        <p className="lp-credit">
          Jump plans are general guidance, not medical advice. Build up gradually, stop if something hurts, and check with a doctor or physio if you have a knee, ankle or back injury. Under 14? Train with a coach.
        </p>
      </div>
    </main>
  );
}
