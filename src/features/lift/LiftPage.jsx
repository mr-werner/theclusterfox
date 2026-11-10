import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CalendarRange, Cloud, CloudOff, Dumbbell, HardDrive, History, LoaderCircle } from "lucide-react";

import AppBar from "../../components/AppBar";
import WorkoutBuilder from "./components/WorkoutBuilder";
import WorkoutView from "./components/WorkoutView";
import PlansTab from "./components/PlansTab";
import HistoryTab from "./components/HistoryTab";
import { generateWorkout, workoutTitle } from "./model/generate";
import { nextSession, PLAN_GOALS, toIsoDay } from "./model/program";
import { useLiftData } from "./state/useLiftData";
import { withNext } from "../../lib/redirect";
import "./lift.css";
import "./identity.css";

function SyncBadge({ status, isSignedIn }) {
  if (!isSignedIn) {
    return (
      <p className="lf-sync">
        <HardDrive size={15} aria-hidden="true" />
        Saved on this device.{" "}
        <Link to={withNext("/login", "/lift")}>Log in</Link> or <Link to={withNext("/signup", "/lift")}>sign up</Link> for long-term plans.
      </p>
    );
  }
  const states = {
    syncing: [<LoaderCircle key="i" size={15} className="spin" />, "Syncing…"],
    synced: [<Cloud key="i" size={15} />, "Synced to your account"],
    unavailable: [<HardDrive key="i" size={15} />, "Saved on this device. Account sync isn’t switched on yet."],
    error: [<CloudOff key="i" size={15} />, "Couldn’t sync right now. Your changes are saved on this device."],
    local: [<HardDrive key="i" size={15} />, "Saved on this device"],
  };
  const [icon, text] = states[status] || states.local;
  return (
    <p className={`lf-sync is-${status}`} aria-live="polite">
      {icon}
      {text}
    </p>
  );
}

const TABS = [
  { id: "workout", name: "Train", icon: Dumbbell },
  { id: "plans", name: "Plans", icon: CalendarRange },
  { id: "history", name: "Progress", icon: History },
];

export default function LiftPage() {
  const {
    data, syncStatus, isSignedIn, authLoading, update, setPrefs, startWorkout, updateCurrent, discardWorkout, finishWorkout,
    deleteHistory, savePlan, deletePlan, toggleSession,
  } = useLiftData();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "workout";
  const openTab = id => {
    setParams(id === "workout" ? {} : { tab: id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function build(seed = Math.floor(Math.random() * 1e6) + 1) {
    const workout = generateWorkout({ ...data.prefs, seed });
    startWorkout({ ...workout, title: workoutTitle(data.prefs.muscles) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startSession(plan, week, session) {
    const { program } = plan;
    startWorkout({
      title: `Week ${week.index + 1}: ${session.name}`,
      goal: PLAN_GOALS[program.goal]?.train ?? "size",
      minutes: program.minutes,
      estMinutes: program.minutes,
      muscles: session.muscles,
      gear: program.gear,
      level: program.level,
      warmup: session.warmup,
      cooldown: session.cooldown,
      items: session.items.map(item => ({ ...item, done: Array(item.sets).fill(false), load: "" })),
      planId: plan.id,
      sessionId: session.id,
    });
    openTab("workout");
  }

  // Opened from PlanFox: ?plan=&session= starts that session, ?next=1 the
  // next one in your plan. A workout already in progress is left alone.
  const linkPlan = params.get("plan");
  const linkSession = params.get("session");
  const linkNext = params.get("next");
  useEffect(() => {
    if (!linkSession && !linkNext) return;
    const plan = data.plans.find(p => p.id === linkPlan) ?? data.plans.find(p => p.id === data.activePlanId) ?? data.plans[0];
    let found = null;
    if (plan && linkSession) {
      for (const week of plan.program.schedule) {
        const session = week.sessions.find(s => s.id === linkSession);
        if (session) found = { week, session };
      }
    } else if (plan) {
      found = nextSession(plan.program, plan.completed);
    }
    if (!found) {
      // Plans arrive with the account; wait for sign-in before giving up.
      if (authLoading) return;
      setParams(plan ? { tab: "plans" } : {}, { replace: true });
      return;
    }
    if (data.current) {
      setParams({}, { replace: true });
      return;
    }
    startSession(plan, found.week, found.session);
    // startSession and data are read once, when the link arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkPlan, linkSession, linkNext, data.plans.length, authLoading]);

  const current = data.current;

  return (
    <main className="lift-page lf">
      <AppBar
        appId="liftfox"
        planTitle={data.plans.length ? "Workout: next in my plan" : "Workout"}
        planHref={data.plans.length ? "/lift?next=1" : "/lift"}
      />

      <div className="lf-shell">
        <header className="lf-hero">
          <div className="lf-logo" aria-hidden="true">
            <Dumbbell size={26} />
          </div>
          <div>
            <p className="lf-eyebrow">LIFTFOX</p>
            <h1>Pick your muscles. Get your workout.</h1>
            <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />
          </div>
        </header>

        <nav className="lf-tabs" aria-label="LiftFox">
          {TABS.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => openTab(item.id)}>
                <Icon size={17} aria-hidden="true" />
                {item.name}
                {item.id === "workout" && current && tab !== "workout" && <span className="lf-dot" aria-label="in progress" />}
              </button>
            );
          })}
        </nav>

        {tab === "workout" &&
          (current ? (
            <WorkoutView
              workout={current}
              history={data.history}
              prefs={data.prefs}
              setPrefs={setPrefs}
              onChange={updateCurrent}
              onShuffle={() => build()}
              onFinish={() => {
                finishWorkout(toIsoDay(new Date()));
                openTab(current.planId ? "plans" : "history");
              }}
              onDiscard={discardWorkout}
            />
          ) : (
            <WorkoutBuilder prefs={data.prefs} onPrefs={setPrefs} onGenerate={() => build()} />
          ))}

        {tab === "plans" && (
          <PlansTab
            data={data}
            isSignedIn={isSignedIn}
            authLoading={authLoading}
            onSavePlan={savePlan}
            onDeletePlan={deletePlan}
            onToggleSession={(planId, sessionId) => toggleSession(planId, sessionId, toIsoDay(new Date()))}
            onSelectPlan={id => update({ activePlanId: id })}
            onStartSession={startSession}
          />
        )}

        {tab === "history" && <HistoryTab history={data.history} isSignedIn={isSignedIn} onDelete={deleteHistory} unit={data.prefs.unit} />}

        <p className="lf-credit">
          Workouts are general guidance, not medical advice. Start light, stop if something hurts, and check with a doctor
          if you have an injury or health condition.
        </p>
      </div>
    </main>
  );
}
