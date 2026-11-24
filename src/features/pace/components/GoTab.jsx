import { useMemo, useState } from "react";
import { Info, MapPin, Play, Warehouse } from "lucide-react";

import { SPORTS } from "../data/events";
import { sessionTitle } from "../model/planLink";
import { planSessionSteps as stepsFor, sessionWhy } from "../model/sessions";
import { fmtMinutes } from "../model/units";
import { FuelTip } from "./SessionDetail";
import Sensors from "./Sensors";
import LiveView from "./LiveView";
import { SessionShape, SportIcon, StepList } from "./ui";
import RowWorkouts from "./RowWorkouts";
import { hasDistanceSteps, rowWorkoutById, rowWorkoutSteps, timeOnly } from "../data/rowWorkouts";

/** Before you start: what, where, which sensors. Then the live screen. */
export default function GoTab({ store, recorder, sensors, preset, defaultSport, onClearPreset, onSaved }) {
  const { data, setPrefs, setProfile } = store;
  const { unit } = data.prefs;
  const plan = preset?.plan ?? null;
  const session = preset?.session ?? null;
  const [sportPick, setSport] = useState(defaultSport ?? data.prefs.sport);
  const sport = plan?.sport ?? sportPick;
  const indoorDefault = sport === "row" && plan?.eventId && /2k|6k/.test(plan.eventId);
  const [where, setWhere] = useState(null);
  const [rowPick, setRowPick] = useState(null);
  const [rowLen, setRowLen] = useState("standard");
  const mode = where ?? (indoorDefault || (sport === "row" && rowPick) ? "indoor" : "gps");
  const workout = !plan && sport === "row" && rowPick ? rowWorkoutById.get(rowPick) : null;
  const workoutSteps = useMemo(() => (workout ? rowWorkoutSteps(workout.id, rowLen, data.profile) : null), [workout, rowLen, data.profile]);
  const machineOn = ["machine", "pm5"].some(k => sensors.devices[k]?.status === "on");
  const measuresDistance = mode === "gps" || machineOn;
  const distanceWarn = hasDistanceSteps(workoutSteps) && !measuresDistance;

  if (recorder.live) return <LiveView store={store} recorder={recorder} sensors={sensors} onSaved={onSaved} />;

  const planSteps = plan && session ? stepsFor(plan, session) : null;
  const steps = planSteps ?? (workoutSteps ? (measuresDistance ? workoutSteps : timeOnly(workoutSteps)) : null);

  function start() {
    if (!plan) setPrefs({ sport });
    recorder.start({
      sport,
      mode,
      steps,
      planId: plan?.id ?? null,
      sessionId: session?.id ?? null,
      sessionType: session?.type ?? null,
      title: plan && session ? sessionTitle(plan, session) : workout ? `${workout.name}: ${workout.detail(rowLen)}` : null,
    });
  }

  return (
    <div className="pc-go">
      {plan && session ? (
        <section className="pc-card">
          <div className="pc-card-head">
            <div>
              <p className="pc-kicker">From your plan</p>
              <h2>{sessionTitle(plan, session)}</h2>
              <p className="pc-session-sub">{session.minutes ? fmtMinutes(session.minutes) : "Race effort"}</p>
            </div>
            <button type="button" className="pc-link" onClick={onClearPreset}>
              Just record instead
            </button>
          </div>
          <SessionShape steps={planSteps} />
          <p className="pc-why">{sessionWhy(session.type)}</p>
          <StepList steps={planSteps} sport={plan.sport} profile={data.profile} unit={unit} />
          <FuelTip minutes={session.minutes} type={session.type} />
        </section>
      ) : (
        <section className="pc-card">
          <h2>Start a workout</h2>
          <div className="pc-sports" role="radiogroup" aria-label="Sport">
            {Object.values(SPORTS).map(s => (
              <button key={s.id} type="button" role="radio" aria-checked={sport === s.id} className={sport === s.id ? "is-on" : ""} onClick={() => setSport(s.id)}>
                <SportIcon sport={s.id} size={22} />
                {s.name}
              </button>
            ))}
          </div>
          <p className="pc-hint">
            Records time, distance, pace and heart rate. {sport === "row" ? "Pick a rowing workout below, or a session from your plan, for step-by-step voice cues." : "Pick a session from your plan to get step-by-step voice cues."}
          </p>
        </section>
      )}

      {!plan && sport === "row" && (
        <RowWorkouts pick={rowPick} length={rowLen} steps={workoutSteps} onPick={setRowPick} onLength={setRowLen} profile={data.profile} setProfile={setProfile} unit={unit} />
      )}

      <section className="pc-card">
        <p className="pc-label">Where?</p>
        <div className="pc-where" role="radiogroup" aria-label="Where">
          <button type="button" role="radio" aria-checked={mode === "gps"} className={mode === "gps" ? "is-on" : ""} onClick={() => setWhere("gps")}>
            <MapPin size={20} aria-hidden="true" />
            <strong>Outdoors</strong>
            <small>GPS distance and pace</small>
          </button>
          <button type="button" role="radio" aria-checked={mode === "indoor"} className={mode === "indoor" ? "is-on" : ""} onClick={() => setWhere("indoor")}>
            <Warehouse size={20} aria-hidden="true" />
            <strong>Indoors</strong>
            <small>{sport === "run" ? "Treadmill or track" : sport === "ride" ? "Trainer or spin bike" : "Rowing machine"}</small>
          </button>
        </div>
        <p className="pc-label">Sensors (optional)</p>
        <Sensors sensors={sensors} sport={sport} />
        {distanceWarn && (
          <p className="pc-warn">
            This workout has distance pieces. Connect your rowing machine above (or row outdoors with GPS) so each piece ends on the meter. Without it, each piece runs for the time it would take at your target split.
          </p>
        )}
      </section>

      <button type="button" className="pc-btn pc-btn-go" onClick={start}>
        <Play size={24} /> Start
      </button>

      <details className="pc-notes">
        <summary>
          <Info size={16} aria-hidden="true" /> Tracking on a phone: what to expect
        </summary>
        <ul>
          <li>
            <strong>Keep PaceFox open on screen.</strong> It keeps your screen awake while recording. Browsers pause GPS when the screen locks or you switch apps; when you come back, the gap is counted as a straight line and noted on the workout.
          </li>
          <li>
            <strong>Time is never lost.</strong> The clock runs from timestamps, and the recording is saved as you go, so a closed tab picks up where it left off.
          </li>
          <li>
            <strong>Voice cues</strong> play through your phone speaker or Bluetooth headphones: each step, its target, every {sport === "row" ? "500 m" : unit === "km" ? "kilometer" : "mile"}, and a nudge when you drift out of your zone.
          </li>
          <li>
            <strong>Got a watch?</strong> Turn on heart rate broadcast (Garmin, Coros, Polar, Suunto) and connect it above as a heart rate monitor. Or record on the watch and import the FIT, TCX or GPX file in the Log afterwards.
          </li>
          <li>
            <strong>Add it to your home screen</strong> (Share → Add to Home Screen on iPhone, or Install app in Chrome) so it opens full screen like an app.
          </li>
        </ul>
      </details>
    </div>
  );
}
