// Search shared by the desktop search bar and the Add sheet.

function score(fields, q) {
  const [name, ...rest] = fields.map(f => (f || "").toLowerCase());
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(/[\s.-]+/).some(word => word.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  if (rest.some(f => f.includes(q))) return 4;
  return -1;
}

function rank(items, q, fields) {
  return items
    .map(item => ({ item, s: score(fields(item), q) }))
    .filter(r => r.s >= 0)
    .sort((a, b) => a.s - b.s)
    .map(r => r.item);
}

export function normalize(query) {
  return query.trim().toLowerCase();
}

export function searchOriginals(originals, q) {
  if (!q) return [];
  return rank(originals, q, app => [app.subtitle, app.name, app.fullName, app.description]);
}

export function searchAlternatives(alts, q) {
  if (!q || !alts) return [];
  return rank(alts.list, q, app => [app.name, app.alt, app.description, app.category, app.country, app.note]);
}
