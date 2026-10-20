import { useSearchParams, Link } from "react-router-dom";
import { CalendarRange, Cloud, CloudOff, Dumbbell, HardDrive, History, LoaderCircle } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import WorkoutBuilder from "./components/WorkoutBuilder";
import WorkoutView from "./components/WorkoutView";
import PlansTab from "./components/PlansTab";
import HistoryTab from "./components/HistoryTab";
import { generateWorkout, workoutTitle } from "./model/generate";
import { PLAN_GOALS, toIsoDay } from "./model/program";
import { useLiftData } from "./state/useLiftData";
import { withNext } from "../../lib/redirect";
import "./lift.css";

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
  { id: "workout", name: "Workout", icon: Dumbbell },
  { id: "plans", name: "Plans", icon: CalendarRange },
  { id: "history", name: "History", icon: History },
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

  const current = data.current;

  return (
    <main className="lift-page lf">
      <SiteHeader />

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

        {tab === "history" && <HistoryTab history={data.history} isSignedIn={isSignedIn} onDelete={deleteHistory} />}

        <p className="lf-credit">
          Workouts are general guidance, not medical advice. Start light, stop if something hurts, and check with a doctor
          if you have an injury or health condition.
        </p>
      </div>
    </main>
  );
}
