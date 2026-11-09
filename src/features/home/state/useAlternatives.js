import { useEffect, useState } from "react";

// The 3rd party directory carries hundreds of brand icons, so it is only
// loaded once the home screen needs it: when an alternative is pinned, or
// someone searches or opens Add.

let cache = null;
let pending = null;

function load() {
  if (!pending) {
    pending = import("../../free/freeApps").then(({ freeCategories, freeAppCount }) => {
      const list = [];
      const byName = new Map();
      for (const category of freeCategories) {
        for (const app of category.apps) {
          if (byName.has(app.name)) continue;
          const entry = { ...app, category: category.name, categoryId: category.id };
          list.push(entry);
          byName.set(app.name, entry);
        }
      }
      cache = { categories: freeCategories, list, byName, count: freeAppCount };
      return cache;
    });
  }
  return pending;
}

export function useAlternatives(wanted) {
  const [data, setData] = useState(cache);

  useEffect(() => {
    if (!wanted || data) return;
    let cancelled = false;
    load().then(result => {
      if (!cancelled) setData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, data]);

  return data;
}
