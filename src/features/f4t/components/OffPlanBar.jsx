import { NotebookPen } from "lucide-react";

import { formatDuration, minutesToBurnCalories } from "../../../domain/exercise/energy.js";
import { SLOTS } from "../model/planner.js";

const fmt = n => Math.round(n).toLocaleString();

/**
 * Off the beaten path: which planned meal this plate replaces, how far over
 * (or under) it is, and a button to log it on the plan.
 */
export default function OffPlanBar({ day, slot, entry, planned, getRecipe, total, weightLbs, mode, onMode, onPick, onLog, canLog }) {
  const recipe = entry?.recipeId ? getRecipe(entry.recipeId) : null;
  const extra = planned ? total - planned.kcal : null;
  const walk = extra > 0 ? minutesToBurnCalories(extra, 4.3, weightLbs || 170) : 0;

  return (
    <section className="ff-panel fp-offbar" aria-labelledby="fp-off-title">
      <div className="fp-off-head">
        <div>
          <h2 id="fp-off-title"><NotebookPen size={20} aria-hidden="true" /> Ate something else?</h2>
          <p>Build what you had below. We’ll compare it with the planned meal and show what it takes to burn off the difference.</p>
        </div>
        <div className="fp-off-pick">
          <label>
            <span>Day</span>
            <input type="date" value={day} onChange={e => e.target.value && onPick(e.target.value, slot)} />
          </label>
          <label>
            <span>Meal</span>
            <select value={slot} onChange={e => onPick(day, e.target.value)}>
              {SLOTS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="fp-off-compare">
        <div>
          <span>Planned</span>
          <strong>{planned ? `${fmt(planned.kcal)} cal` : "Nothing planned"}</strong>
          <small>{recipe ? `${recipe.title}${entry.portions !== 1 ? ` (${entry.portions}×)` : ""}` : "Plan meals to compare against them"}</small>
        </div>
        <div>
          <span>On your plate</span>
          <strong>{total > 0 ? `${fmt(total)} cal` : "–"}</strong>
          <small>{total > 0 ? "from the foods below" : "add foods below"}</small>
        </div>
        <div className={total <= 0 ? "" : extra > 0 ? "is-over" : extra < 0 ? "is-under" : ""}>
          <span>Difference</span>
          <strong>{extra == null || total <= 0 ? "–" : `${extra > 0 ? "+" : ""}${fmt(extra)} cal`}</strong>
          <small>
            {extra > 0 && total > 0
              ? `about ${formatDuration(walk)} of brisk walking`
              : extra < 0 && total > 0
                ? "under the plan, nothing to make up"
                : " "}
          </small>
        </div>
      </div>

      <div className="fp-off-actions">
        {planned && (
          <div className="fp-choice" role="group" aria-label="Activities show">
            <button type="button" aria-pressed={mode === "extra"} className={mode === "extra" ? "is-active" : ""} onClick={() => onMode("extra")}>
              Burn the extra
            </button>
            <button type="button" aria-pressed={mode === "all"} className={mode === "all" ? "is-active" : ""} onClick={() => onMode("all")}>
              Burn the whole meal
            </button>
          </div>
        )}
        <button type="button" className="ff-btn ff-btn-primary" disabled={!canLog} onClick={onLog}>
          Log it on my plan
        </button>
      </div>
    </section>
  );
}
