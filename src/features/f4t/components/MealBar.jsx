import { formatCalories } from "../mealMath";

const COLORS = ["#ff7a59", "#ffc23d", "#7fd47a", "#5cc8ff", "#c79bff", "#ff9ec7", "#f6e27a", "#7ae0d0"];

/** What the meal is made of: each food's share of the calories. */
export default function MealBar({ meal, total }) {
  if (!(total > 0)) return null;
  const parts = meal
    .map(item => ({ id: item.id, name: item.name, cal: Number(item.caloriesPerServing || 0) * Number(item.servings || 0) }))
    .filter(p => p.cal > 0);
  return (
    <figure className="ff-mealbar">
      <div className="ff-mealbar-track" role="img" aria-label={parts.map(p => `${p.name} ${formatCalories(p.cal)} calories`).join(", ")}>
        {parts.map((p, i) => (
          <span key={p.id} style={{ flexGrow: p.cal, background: COLORS[i % COLORS.length] }} title={`${p.name}: ${formatCalories(p.cal)} cal`} />
        ))}
      </div>
      <figcaption className="ff-mealbar-key">
        {parts.map((p, i) => (
          <span key={p.id}>
            <i style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />
            {p.name} <b>{Math.round((p.cal / total) * 100)}%</b>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
