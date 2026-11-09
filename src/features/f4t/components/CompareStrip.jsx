import { ChevronLeft, ChevronRight, Star } from "lucide-react";

import { formatDuration } from "../../../domain/exercise/energy";
import { minutesFor, selectedOptionIndex } from "../activityHelpers";

/**
 * The answer, side by side: roughly how long each favorite activity would
 * take to use the meal's energy, with bars to compare and a pace control.
 */
export default function CompareStrip({ groups, selections, calories, weightLbs, onSelect, onBrowse }) {
  const rows = groups.map(group => {
    const index = selectedOptionIndex(group, selections);
    const option = group.options[index];
    return { group, index, option, minutes: minutesFor(calories, option.met, weightLbs) };
  });
  const finite = rows.map(r => r.minutes).filter(m => Number.isFinite(m));
  const longest = Math.max(1, ...finite);
  const ready = calories > 0 && weightLbs > 0;

  return (
    <section className="ff-compare" aria-labelledby="ff-compare-title">
      <div className="ff-compare-head">
        <h2 id="ff-compare-title">In activity, that's about</h2>
        <button type="button" className="ff-btn ff-btn-ghost" onClick={onBrowse}>
          <Star size={15} aria-hidden="true" /> Choose activities
        </button>
      </div>

      {!ready && (
        <p className="ff-compare-hint">
          {calories > 0 ? "Add your weight and the times appear here." : "Add a food and the times appear here."}
        </p>
      )}

      <ul className="ff-compare-list">
        {rows.map(({ group, index, option, minutes }, i) => (
          <li key={group.key} className="ff-compare-card" style={{ "--i": i }}>
            <div className="ff-compare-top">
              <span className="ff-compare-name">{group.title}</span>
              <strong className="ff-compare-time">{ready ? (minutes == null ? "—" : formatDuration(minutes)) : "—"}</strong>
            </div>
            <span className="ff-compare-bar" aria-hidden="true">
              <span style={{ width: ready && Number.isFinite(minutes) ? `${Math.max(3, (minutes / longest) * 100)}%` : "0%" }} />
            </span>
            {group.options.length > 1 && (
              <div className="ff-compare-pace">
                <button
                  type="button"
                  onClick={() => onSelect(group.key, group.options[index - 1].id)}
                  disabled={index === 0}
                  aria-label={`Easier ${group.title.toLowerCase()}`}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{option.adjustmentValue}</span>
                <button
                  type="button"
                  onClick={() => onSelect(group.key, group.options[index + 1].id)}
                  disabled={index === group.options.length - 1}
                  aria-label={`Harder ${group.title.toLowerCase()}`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
