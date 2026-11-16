import { useEffect, useMemo, useState } from "react";

import { normalizeData as normalizeCook, STORAGE_KEY as COOK_KEY } from "../../cook/state/cookStore.js";
import { customizedRecipes } from "../../cook/model/swaps.js";
import { SOURCES } from "../model/training.js";
import { allowedRecipes } from "../model/planner.js";

function readRaw(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

const KEYS = [COOK_KEY, ...SOURCES.map(s => s.storageKey)];

/**
 * What the planner reads from the apps it pairs with, from this browser:
 * CookFox's recipes (with your swaps), profile, favorites and pantry, and the
 * training apps' saved data. Stays current when another tab changes them.
 */
export function useLinkedApps() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onStorage = e => {
      if (!e.key || KEYS.includes(e.key)) setVersion(v => v + 1);
    };
    const onFocus = () => setVersion(v => v + 1);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return useMemo(() => {
    const cookRaw = readRaw(COOK_KEY);
    const cook = normalizeCook(cookRaw);
    const recipes = customizedRecipes(cook.custom);
    const byId = new Map(recipes.map(r => [r.id, r]));
    const training = Object.fromEntries(SOURCES.map(s => [s.storageKey, readRaw(s.storageKey)]));
    return {
      version,
      cook,
      cookUsed: cookRaw !== null,
      recipes,
      allowed: allowedRecipes(recipes, cook.profile),
      getRecipe: id => byId.get(id) ?? null,
      readTraining: key => training[key] ?? null,
      hasTrainingApp: SOURCES.some(s => training[s.storageKey] !== null),
    };
  }, [version]);
}
