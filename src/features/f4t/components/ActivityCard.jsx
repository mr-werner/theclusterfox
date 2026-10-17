import { Minus, Plus, Star } from "lucide-react";

import { formatDuration } from "../../../domain/exercise/energy";
import { milesFor, minutesFor, selectedOptionIndex } from "../activityHelpers";

export default function ActivityCard({ group, calories, weightLbs, selections, favorite, onToggleFavorite, onSelect }) {
  const index = selectedOptionIndex(group, selections);
  const selected = group.options[index];
  const adjustable = group.options.length > 1;
  const minutes = minutesFor(calories, selected.met, weightLbs);
  const miles = minutes == null ? null : milesFor(minutes, selected.adjustmentValue || "");
  const label = group.adjustmentLabel || "Option";
  const inputId = `ff-adjust-${group.key}`;

  function choose(next) {
    if (next >= 0 && next < group.options.length) onSelect(group.key, group.options[next].id);
  }

  let result;
  if (minutes == null) result = <span className="ff-card-time is-waiting">—</span>;
  else if (!Number.isFinite(minutes)) result = <span className="ff-card-time is-rest">About resting rate</span>;
  else result = <span className="ff-card-time">{formatDuration(minutes)}</span>;

  return (
    <article className={`ff-card ${favorite ? "is-favorite" : ""}`}>
      <div className="ff-card-head">
        <div>
          <span className="ff-card-category">{group.category}</span>
          <h3>{group.title}</h3>
        </div>
        <button
          type="button"
          className="ff-star"
          aria-pressed={favorite}
          aria-label={favorite ? `Remove ${group.title} from favorites` : `Add ${group.title} to favorites`}
          title={favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={() => onToggleFavorite(group.key)}
        >
          <Star size={20} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      {adjustable && (
        <div className="ff-adjust">
          <div className="ff-adjust-label">
            <label htmlFor={inputId}>{label}</label>
            <output htmlFor={inputId}>{selected.adjustmentValue}</output>
          </div>
          <div className="ff-adjust-row">
            <button type="button" onClick={() => choose(index - 1)} disabled={index === 0} aria-label={`Lower ${label}`}>
              <Minus size={15} />
            </button>
            <input
              id={inputId}
              type="range"
              min="0"
              max={group.options.length - 1}
              step="1"
              value={index}
              onChange={event => choose(Number(event.target.value))}
              aria-valuetext={selected.adjustmentValue}
            />
            <button
              type="button"
              onClick={() => choose(index + 1)}
              disabled={index === group.options.length - 1}
              aria-label={`Raise ${label}`}
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      )}

      <div className="ff-card-result" aria-live="polite">
        {result}
        <span className="ff-card-meta">
          {miles != null && `≈ ${miles.toFixed(1)} mi · `}
          {selected.met} MET
        </span>
      </div>
      <p className="ff-card-desc" title={`Compendium code ${selected.id}`}>{selected.description}</p>
    </article>
  );
}
