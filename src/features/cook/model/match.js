// Matching typed ingredient names against the catalog.

export const normalize = s =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/(ies)$/, "y")
    .replace(/(oes|ses|shes|ches)$/, m => m.slice(0, -2))
    .replace(/([^s])s$/, "$1");

// Splits "spinach, chickpeas" into normalized terms.
export function parseTerms(text) {
  return String(text ?? "")
    .split(/[,;\n]/)
    .map(normalize)
    .filter(t => t.length > 1);
}

// Does an ingredient match a term? Matches the name, its words and aliases,
// so "chicken" catches chicken thighs and chicken broth alike.
export function ingredientMatches(item, term) {
  const t = normalize(term);
  if (!t) return false;
  const names = [item.name, item.plural, item.id.replace(/-/g, " "), ...(item.aliases ?? [])].filter(Boolean).map(s => s.toLowerCase());
  return names.some(n => n.includes(t) || n.split(/[\s,]+/).map(normalize).includes(t));
}

