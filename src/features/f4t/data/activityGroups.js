import { activities } from './activities';
import manifest from './activityGroupManifest.json';

// Explicit, reviewed groups. Unknown entries stay standalone: no heuristic
// merging based solely on words such as "mph", "kg", or "vigorous".
export function validateActivityManifest(source = activities, definitions = manifest) {
  const byId = new Map(source.map(a => [a.id, a]));
  const used = new Set();
  const errors = [];
  const types = new Set(['speed','power','intensity','incline','load','cadence','throughput','assistance','temperature']);
  for (const g of definitions) {
    if (!types.has(g.adjustmentType)) errors.push(`${g.key}: invalid adjustment type`);
    if (g.ids.length < 2 || new Set(g.ids).size !== g.ids.length) errors.push(`${g.key}: invalid or repeated options`);
    if (g.optionLabels.length !== g.ids.length || new Set(g.optionLabels).size < 2) errors.push(`${g.key}: adjustment labels are missing or unchanged`);
    for (const id of g.ids) {
      const a = byId.get(id);
      if (!a) errors.push(`${g.key}: missing source code ${id}`);
      else if (a.category !== g.category) errors.push(`${g.key}: category mismatch ${id}`);
      if (used.has(id)) errors.push(`${g.key}: source code ${id} is in multiple groups`);
      used.add(id);
    }
  }
  return errors;
}

export function buildActivityGroups(source = activities, definitions = manifest) {
  const errors = validateActivityManifest(source, definitions);
  if (errors.length) throw new Error(`Invalid F4T activity manifest:\n${errors.join('\n')}`);
  const byId = new Map(source.map(a => [a.id, a]));
  const assigned = new Set();
  const grouped = definitions.map(g => {
    const options = g.ids.map((id, i) => {
      assigned.add(id);
      return { ...byId.get(id), adjustmentValue: g.optionLabels[i] };
    });
    // Sort numeric measurements by the documented first value, not MET.
    // Preserve the authored order for ordinal intensity and assistance.
    if (!['intensity','assistance'].includes(g.adjustmentType)) {
      const num = v => Number(v.match(/-?\d+(?:\.\d+)?/)?.[0] ?? Infinity);
      options.sort((a,b) => num(a.adjustmentValue) - num(b.adjustmentValue));
    }
    return {key:g.key,title:g.title,category:g.category,adjustmentType:g.adjustmentType,
      adjustmentLabel:g.adjustmentLabel,options};
  });
  const standalone = source.filter(a => !assigned.has(a.id)).map(a => ({
    key:`entry::${a.id}`, title:a.description, category:a.category,
    adjustmentType:null, adjustmentLabel:null, options:[a]
  }));
  // Keep curated cards first within each original category; all entries accounted for.
  const categoryOrder = [...new Set(source.map(a => a.category))];
  return [...grouped,...standalone].sort((a,b) =>
    categoryOrder.indexOf(a.category)-categoryOrder.indexOf(b.category) ||
    Number(b.options.length>1)-Number(a.options.length>1) || a.title.localeCompare(b.title));
}
