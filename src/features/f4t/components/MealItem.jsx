import { Minus, Plus, X } from "lucide-react";

export default function MealItem({
  item,
  onChangeServings,
  onRemove,
}) {
  const calories =
    item.caloriesPerServing * item.servings;

  function decrease() {
    const next = Math.max(
      0.25,
      item.servings - 0.25
    );

    onChangeServings(item.id, next);
  }

  function increase() {
    onChangeServings(
      item.id,
      item.servings + 0.25
    );
  }

  return (
    <div className="meal-item">
      <div className="meal-item-main">
        <div>
          <h3>{item.name}</h3>

          <p>
            {item.brand || "USDA"}
            {item.servingDescription &&
              ` • ${item.servingDescription}`}
          </p>
        </div>

        <strong>
          {Math.round(calories)} cal
        </strong>
      </div>

      <div className="meal-item-controls">
        <div className="serving-control">
          <button
            type="button"
            onClick={decrease}
            aria-label="Decrease servings"
          >
            <Minus size={16} />
          </button>

          <input
            type="number"
            min="0.25"
            step="0.25"
            value={item.servings}
            onChange={(event) =>
              onChangeServings(
                item.id,
                Math.max(
                  0.25,
                  Number(event.target.value) || 0.25
                )
              )
            }
            aria-label="Servings"
          />

          <button
            type="button"
            onClick={increase}
            aria-label="Increase servings"
          >
            <Plus size={16} />
          </button>

          <span>servings</span>
        </div>

        <button
          type="button"
          className="remove-food"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name}`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}