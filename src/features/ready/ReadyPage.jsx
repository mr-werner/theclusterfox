import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, CalendarRange, Cloud, CloudOff, ClipboardCheck, HardDrive, LoaderCircle, Medal, Users } from "lucide-react";

import AppBar from "../../components/AppBar";
import { useAuth } from "../../context/AuthContext";
import { withNext } from "../../lib/redirect";
import { jobById } from "./data/jobs";
import { AFT_TABLES } from "./data/aftTables";
import { buildPlan, nextSession } from "./model/plan";
import { daysBetween, toIsoDay } from "./model/units";
import { useReadyData } from "./state/useReadyData";
import JobsTab from "./components/JobsTab";
import TestTab from "./components/TestTab";
import PlanTab from "./components/PlanTab";
import GuideTab from "./components/GuideTab";
import "./ready.css";
import "./identity.css";

const TABS = [
  { id: "jobs", name: "Jobs", icon: Users },
  { id: "test", name: "Test", icon: ClipboardCheck },
  { id: "plan", name: "Plan", icon: CalendarRange },
  { id: "guide", name: "Guide", icon: BookOpen },
];

function SyncNote({ status, signedIn }) {
  if (!signedIn) {
    return (
      <p className="rf-sync">
        <HardDrive size={14} aria-hidden="true" /> Saved on this device. <Link to={withNext("/login", "/ready")}>Log in</Link> to keep your plan on every device.
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
    <p className="rf-sync" aria-live="polite">
      {icon} {text}
    </p>
  );
}

export default function ReadyPage() {
  const store = useReadyData();
  const { data, syncStatus } = store;
  const { isAuthenticated } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = toIsoDay(new Date());

  const job = jobById.get(data.jobId) ?? null;
  const planJob = data.plan ? jobById.get(data.plan.jobId) : null;
  const weeks = useMemo(() => (data.plan && planJob ? buildPlan(data.plan, planJob, AFT_TABLES) : []), [data.plan, planJob]);

  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : params.get("session") ? "plan" : "jobs";

  const openTab = (id, extra = {}) => {
    setParams(id === "jobs" ? { ...extra } : { tab: id, ...extra });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = data.plan ? nextSession(weeks, data.plan, today) : null;
  const planTitle = next ? `Training: ${next.title}` : job ? `Training for ${job.name}` : "Military fitness training";
  const planHref = next ? `/ready?tab=plan&session=${encodeURIComponent(next.id)}` : "/ready";
  const daysLeft = data.plan && data.plan.jobId === data.jobId ? daysBetween(today, data.plan.testDay) : null;

  return (
    <main className="rf">
      <AppBar appId="readyfox" planTitle={planTitle} planHref={planHref} />
      <div className="rf-shell">
        <header className="rf-hero">
          <div className="rf-logo" aria-hidden="true">
            <Medal size={28} />
          </div>
          <div>
            <p className="rf-eyebrow">ReadyFox</p>
            <h1>Train for the job you want.</h1>
            <SyncNote status={syncStatus} signedIn={isAuthenticated} />
          </div>
        </header>

        {job && (
          <button type="button" className="rf-goal" onClick={() => openTab(data.plan ? "plan" : "test")}>
            <span className="rf-goal-label">Your goal</span>
            <strong>{job.name}</strong>
            <span>{job.test.name}</span>
            {daysLeft != null && (
              <span className="rf-goal-days">{daysLeft > 0 ? `${daysLeft} days to test day` : daysLeft === 0 ? "Test day is today" : "Test day has passed"}</span>
            )}
          </button>
        )}

        <nav className="rf-tabs" aria-label="ReadyFox">
          {TABS.map(t => (
            <button key={t.id} type="button" aria-current={tab === t.id ? "page" : undefined} onClick={() => openTab(t.id)}>
              <t.icon size={17} aria-hidden="true" />
              <span>{t.name}</span>
            </button>
          ))}
        </nav>

        {tab === "jobs" && (
          <JobsTab
            selectedId={data.jobId}
            branch={params.get("branch")}
            onBranch={b => setParams(b ? { branch: b } : {}, { replace: true })}
            onPick={id => {
              store.setJob(id);
              openTab("test");
            }}
          />
        )}
        {tab === "test" && <TestTab key={job?.id ?? "none"} store={store} job={job} today={today} onPickJob={() => openTab("jobs")} onPlan={() => openTab("plan")} />}
        {tab === "plan" && (
          <PlanTab
            store={store}
            job={job}
            weeks={weeks}
            today={today}
            focusId={params.get("session")}
            onFocus={id => setParams(id ? { tab: "plan", session: id } : { tab: "plan" }, { replace: true })}
            onPickJob={() => openTab("jobs")}
            onTest={sessionId => openTab("test", sessionId ? { session: sessionId } : {})}
          />
        )}
        {tab === "guide" && <GuideTab job={job} profile={data.profile} onPickJob={() => openTab("jobs")} />}

        <p className="rf-credit">
          Standards come from the services' own published pages, linked in the Guide. They change from time to time, so check with a recruiter before you test. Training plans are general guidance, not medical advice: build up gradually, and see a doctor before starting if you have a health condition.
        </p>
      </div>
    </main>
  );
}
