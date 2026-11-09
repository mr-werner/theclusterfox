// Plan B: when cooking isn't happening tonight, search for similar dishes
// nearby. These are Google Maps search links (free, no API key). We never
// claim a restaurant serves a dish; Maps shows what it finds and the cook
// checks the menu.

export function planBSearches(recipe, place = "") {
  const where = place.trim() ? `near ${place.trim()}` : "near me";
  const dishes = recipe.planB?.dishes ?? [recipe.title];
  const searches = dishes.map(d => ({ label: d, kind: "dish", query: `${d} ${where}` }));
  if (recipe.planB?.cuisine) {
    searches.push({ label: `${recipe.planB.cuisine} restaurants`, kind: "cuisine", query: `${recipe.planB.cuisine} restaurant ${where}` });
  }
  return searches.map(s => ({ ...s, url: mapsUrl(s.query) }));
}

export function mapsUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
