import { categories, categoryOf, MORE_CATEGORY } from "../../app/apps.js";
import { isOriginalKey, keyId } from "./state/homeStore.js";

/**
 * Splits the home screen's original apps into PlanFox (the hub, shown on its
 * own above everything) and the category sections, keeping the order the
 * person arranged them in within each category. Empty categories are left
 * out; apps without a known category go in "More apps" at the end.
 */
export function groupOriginals(keys, originalsById) {
  let hub = null;
  const byCategory = new Map();
  for (const key of keys) {
    if (!isOriginalKey(key)) continue;
    const app = originalsById.get(keyId(key));
    if (!app) continue;
    const cat = categoryOf(app);
    if (cat === "hub") {
      hub ??= key;
      continue;
    }
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(key);
  }
  const sections = [...categories, MORE_CATEGORY]
    .filter(c => byCategory.has(c.id))
    .map(c => ({ ...c, keys: byCategory.get(c.id) }));
  return { hub, sections };
}

/** Which section a home screen key belongs to, for keeping drags inside it. */
export function sectionOf(key, originalsById) {
  if (!isOriginalKey(key)) return "alts";
  const app = originalsById.get(keyId(key));
  return app ? categoryOf(app) : MORE_CATEGORY.id;
}
