import { useState } from "react";

import { LENGTHS, ROW_GROUPS, ROW_WORKOUTS, rowWorkoutById } from "../data/rowWorkouts";
import { fmtClock } from "../model/units";
import { stepsSeconds } from "../model/sessions";
import { TimeField } from "./SetupTab";
import { SessionShape, StepList } from "./ui";

/**
 * Pick a rowing workout (or just row). The picked steps go to the live
 * screen, which calls out each piece, its target split, the rest and
 * what's next.
 */
export default function RowWorkouts({ pick, length, steps, onPick, onLength, profile, setProfile, unit }) {
  const [group, setGroup] = useState(() => rowWorkoutById.get(pick)?.group ?? "intervals");
  const w = pick ? rowWorkoutById.get(pick) : null;
  const list = ROW_WORKOUTS.filter(x => x.group === group);
  const g = ROW_GROUPS.find(x => x.id === group);

  return (
    <section className="pc-card pc-roww">
      <h2>Rowing workouts</h2>
      <p className="pc-hint">Pick one and the voice calls out each piece, the split to aim for, your rest and what's next.</p>

      <div className="pc-roww-groups" role="tablist" aria-label="Kind of workout">
        {ROW_GROUPS.map(x => (
          <button key={x.id} type="button" role="tab" aria-selected={group === x.id} className={group === x.id ? "is-on" : ""} onClick={() => setGroup(x.id)}>
            {x.name}
          </button>
        ))}
      </div>
      <p className="pc-roww-blurb">{g.blurb}</p>

      <div className="pc-roww-list" role="radiogroup" aria-label="Workout">
        <button type="button" role="radio" aria-checked={!pick} className={!pick ? "is-on" : ""} onClick={() => onPick(null)}>
          <strong>Just row</strong>
          <small>No set workout. Splits every 500 m.</small>
        </button>
        {list.map(x => (
          <button key={x.id} type="button" role="radio" aria-checked={pick === x.id} className={pick === x.id ? "is-on" : ""} onClick={() => onPick(x.id)}>
            <strong>{x.name}</strong>
            <small>{x.detail(length)}</small>
          </button>
        ))}
      </div>

      {w && (
        <div className="pc-roww-picked">
          <div className="pc-roww-len" role="radiogroup" aria-label="Length">
            {LENGTHS.map(l => (
              <button key={l.id} type="button" role="radio" aria-checked={length === l.id} className={length === l.id ? "is-on" : ""} onClick={() => onLength(l.id)}>
                {l.name}
              </button>
            ))}
          </div>
          <h3>
            {w.name}: {w.detail(length)}
          </h3>
          <p className="pc-why">
            {w.why} About {fmtClock(Math.round(stepsSeconds(steps) / 60) * 60).replace(/:00$/, "")} min with warm up and cool down.
          </p>
          <SessionShape steps={steps} />
          {!profile.row2k && (
            <div className="pc-form pc-roww-2k">
              <TimeField label="Your 2K time (a guess is fine)" seconds={profile.row2k} placeholder="8:00" hint="Turns each piece into a target split. Change it any time in Setup." onChange={s => setProfile({ row2k: s })} />
            </div>
          )}
          <StepList steps={steps} sport="row" profile={profile} unit={unit} />
        </div>
      )}
    </section>
  );
}
