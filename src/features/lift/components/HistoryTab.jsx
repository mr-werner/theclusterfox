import { useState } from "react";
import { History, Trash2 } from "lucide-react";

import { muscleName } from "../data/muscles";
import { GOALS } from "../model/generate";
import { mondayOf, toIsoDay } from "../model/program";
import { exercisesById } from "../data/exercises";
import { bestByExercise, fmtWeight, weeklyVolume } from "../model/records";

function formatDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** Weight × reps per week, as bars. */
function VolumeChart({ weeks, unit }) {
  const max = Math.max(1, ...weeks.map(w => w.volume));
  const label = iso => {
    const [, m, d] = iso.split("-").map(Number);
    return `${m}/${d}`;
  };
  return (
    <figure className="lf-volume">
      <figcaption>
        <h2>Weekly volume</h2>
        <span className="lf-muted lf-small">weight × reps, {unit}</span>
      </figcaption>
      <div className="lf-volume-bars" role="img" aria-label={`Weekly volume for the last ${weeks.length} weeks: ${weeks.map(w => `${label(w.week)} ${w.volume}`).join(", ")}`}>
        {weeks.map((w, i) => (
          <div key={w.week} className={`lf-volume-col ${i === weeks.length - 1 ? "is-now" : ""}`}>
            <span className="lf-volume-val">{w.volume ? (w.volume >= 1000 ? `${Math.round(w.volume / 100) / 10}k` : w.volume) : ""}</span>
            <span className="lf-volume-bar" style={{ height: `${(w.volume / max) * 100}%` }} />
            <span className="lf-volume-week">{i === weeks.length - 1 ? "This wk" : label(w.week)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

function Records({ best, unit }) {
  const rows = Object.entries(best)
    .map(([id, b]) => ({ id, name: exercisesById.get(id)?.name ?? id, ...b }))
    .sort((a, b) => b.e1rm - a.e1rm)
    .slice(0, 8);
  if (!rows.length) return null;
  return (
    <section className="lf-panel lf-records">
      <h2>Personal records</h2>
      <p className="lf-muted lf-small">Best estimated one-rep max from sets of 12 reps or fewer.</p>
      <ol>
        {rows.map(r => (
          <li key={r.id}>
            <span className="lf-records-name">{r.name}</span>
            <span className="lf-records-best">{fmtWeight(r.w, unit)} × {r.r}</span>
            <strong className="lf-records-e1rm">{fmtWeight(r.e1rm, unit)}</strong>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Finished workouts, newest first, with volume and records on top. */
export default function HistoryTab({ history, isSignedIn, onDelete, unit = "lb" }) {
  const [confirm, setConfirm] = useState(null);
  const thisWeek = mondayOf(toIsoDay(new Date()));
  const weekCount = history.filter(h => h.date >= thisWeek).length;
  const sets = history.reduce((n, h) => n + h.setsDone, 0);

  if (!history.length) {
    return (
      <section className="lf-panel lf-empty">
        <History size={32} aria-hidden="true" />
        <h2>No workouts yet</h2>
        <p className="lf-muted">Finish a workout and it shows up here, with the weights you used.</p>
      </section>
    );
  }

  return (
    <>
      <section className="lf-panel lf-stats">
        <div><strong>{weekCount}</strong><span>this week</span></div>
        <div><strong>{history.length}</strong><span>workouts</span></div>
        <div><strong>{sets}</strong><span>sets done</span></div>
      </section>
      {history.some(h => Object.keys(h.sets ?? {}).length) ? (
        <>
          <VolumeChart weeks={weeklyVolume(history, unit, toIsoDay(new Date()))} unit={unit} />
          <Records best={bestByExercise(history, unit)} unit={unit} />
        </>
      ) : (
        <p className="lf-note">Log weight and reps in training mode to see your records and weekly volume here.</p>
      )}
      {!isSignedIn && <p className="lf-note">Saved on this device only. Sign up to keep your history everywhere.</p>}
      <ul className="lf-history">
        {history.map(h => (
          <li key={h.id} className="lf-panel">
            <div>
              <p className="lf-eyebrow">{formatDay(h.date)} · {GOALS[h.goal]?.name.toUpperCase()}</p>
              <strong>{h.title}</strong>
              <p className="lf-muted lf-small">
                {h.setsDone} of {h.setsTotal} sets
                {h.muscles.length > 0 && <> · {h.muscles.map(muscleName).join(", ")}</>}
              </p>
            </div>
            {confirm === h.id ? (
              <span className="lf-confirm">
                <button type="button" className="lf-ghost lf-danger" onClick={() => onDelete(h.id)}>Delete</button>
                <button type="button" className="lf-ghost" onClick={() => setConfirm(null)}>Keep</button>
              </span>
            ) : (
              <button type="button" className="lf-icon-btn" aria-label={`Delete ${h.title} on ${h.date}`} onClick={() => setConfirm(h.id)}>
                <Trash2 size={15} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
