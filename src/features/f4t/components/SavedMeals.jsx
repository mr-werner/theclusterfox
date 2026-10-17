import { useState } from "react";
import { Bookmark, Plus, Trash2 } from "lucide-react";

import { formatCalories, mealCalories } from "../mealMath";

function SavedMealCard({ meal, active, onLoad, onAppend, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const calories = mealCalories(meal.items);
  const names = meal.items.map(item => item.name).join(", ");

  return (
    <li className={`ff-saved ${active ? "is-active" : ""}`}>
      <div className="ff-saved-top">
        <strong>{meal.name}</strong>
        <span className="ff-saved-cal">{formatCalories(calories)} cal</span>
      </div>
      <p className="ff-saved-items" title={names}>
        {meal.items.length} {meal.items.length === 1 ? "item" : "items"} · {names}
      </p>
      <div className="ff-saved-actions">
        {confirming ? (
          <>
            <span>Delete this meal?</span>
            <button type="button" className="ff-btn ff-btn-small ff-btn-danger" onClick={() => onDelete(meal.id)}>
              Delete
            </button>
            <button type="button" className="ff-btn ff-btn-small ff-btn-ghost" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <>
            <button type="button" className="ff-btn ff-btn-small ff-btn-primary" onClick={() => onLoad(meal)}>
              {active ? "Loaded" : "Use this meal"}
            </button>
            <button
              type="button"
              className="ff-btn ff-btn-small ff-btn-ghost"
              onClick={() => onAppend(meal)}
              aria-label={`Add ${meal.name} to the current meal`}
            >
              <Plus size={15} /> Add to meal
            </button>
            <button
              type="button"
              className="ff-icon-btn ff-saved-delete"
              onClick={() => setConfirming(true)}
              aria-label={`Delete ${meal.name}`}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </li>
  );
}

export default function SavedMeals({ meals, activeMealId, onLoad, onAppend, onDelete }) {
  return (
    <section className="ff-section" aria-labelledby="ff-saved-title">
      <div className="ff-section-head">
        <div>
          <p className="ff-eyebrow">SAVED MEALS</p>
          <h2 id="ff-saved-title">Your go-to meals</h2>
        </div>
        <span className="ff-count">{meals.length}</span>
      </div>

      {meals.length ? (
        <ul className="ff-saved-grid">
          {meals.map(meal => (
            <SavedMealCard
              key={meal.id}
              meal={meal}
              active={meal.id === activeMealId}
              onLoad={onLoad}
              onAppend={onAppend}
              onDelete={onDelete}
            />
          ))}
        </ul>
      ) : (
        <p className="ff-empty">
          <Bookmark size={18} aria-hidden="true" />
          Build a meal above and select <strong>Save meal</strong> to reuse it in one tap.
        </p>
      )}
    </section>
  );
}
