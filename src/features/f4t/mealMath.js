export const LBS_PER_KG = 2.2046226218;

export function mealCalories(items) {
  return items.reduce(
    (total, item) => total + Number(item.caloriesPerServing || 0) * Number(item.servings || 0),
    0
  );
}

export function formatCalories(value) {
  return Math.round(value).toLocaleString();
}

// Search results are identified by USDA id; your own entries by name.
export function foodKey(item) {
  return item.fdcId ?? `manual:${item.name}`;
}
