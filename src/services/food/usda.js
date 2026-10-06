export async function searchFoods(query) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const response = await fetch(
    `/api/f4t/food-search?q=${encodeURIComponent(trimmedQuery)}`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || "Unable to search for food."
    );
  }

  return data.foods ?? [];
}