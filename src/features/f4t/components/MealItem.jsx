import { Minus, Plus, X } from "lucide-react";

const STEP = 0.25;

export default function MealItem({ item, onChangeServings, onRemove }) {
  const calories = item.caloriesPerServing * item.servings;

  return (
    <li className="ff-item">
      <div className="ff-item-info">
        <strong>{item.name}</strong>
        <span>
          {item.brand || "USDA"}
          {item.servingDescription && ` · ${item.servingDescription}`}
        </span>
      </div>

      <div className="ff-stepper" role="group" aria-label={`Servings of ${item.name}`}>
        <button
          type="button"
          onClick={() => onChangeServings(item.id, Math.max(STEP, item.servings - STEP))}
          disabled={item.servings <= STEP}
          aria-label="Fewer servings"
        >
          <Minus size={15} />
        </button>
        <input
          type="number"
          min={STEP}
          step={STEP}
          inputMode="decimal"
          value={item.servings}
          onChange={event => onChangeServings(item.id, Math.max(STEP, Number(event.target.value) || STEP))}
          aria-label="Servings"
        />
        <button type="button" onClick={() => onChangeServings(item.id, item.servings + STEP)} aria-label="More servings">
          <Plus size={15} />
        </button>
      </div>

      <strong className="ff-item-cal">{Math.round(calories).toLocaleString()} cal</strong>

      <button type="button" className="ff-icon-btn" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}>
        <X size={17} />
      </button>
    </li>
  );
}
