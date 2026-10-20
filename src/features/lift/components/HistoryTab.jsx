import { useState } from "react";
import { History, Trash2 } from "lucide-react";

import { muscleName } from "../data/muscles";
import { GOALS } from "../model/generate";
import { mondayOf, toIsoDay } from "../model/program";

function formatDay(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** Finished workouts, newest first. */
export default function HistoryTab({ history, isSignedIn, onDelete }) {
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
