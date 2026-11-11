// The food growing in GrowFox, read from this browser. GrowFox's module loads
// only when there's a garden to read, so CookFox's first load stays small.
import { useEffect, useState } from "react";
import { GARDEN_INGREDIENTS, gardenIndex } from "../model/garden";

const GROW_KEY = "growfox-data-v1";

function readRaw() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(GROW_KEY));
    return Array.isArray(raw?.garden) && raw.garden.length ? raw : null;
  } catch {
    return null;
  }
}

// { harvest: [{ plantId, name, ready, readyOn }], index: Map } or null when
// nothing edible is growing.
export function useGarden(today) {
  const [garden, setGarden] = useState(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      const raw = readRaw();
      if (!raw) {
        if (live) setGarden(null);
        return;
      }
      try {
        const { gardenHarvest } = await import("../../grow/model/cookLink.js");
        const harvest = gardenHarvest(raw, today).filter(h => GARDEN_INGREDIENTS[h.plantId]);
        if (live) setGarden(harvest.length ? { harvest, index: gardenIndex(harvest) } : null);
      } catch {
        if (live) setGarden(null);
      }
    };
    load();
    const onStorage = e => {
      if (e.key === GROW_KEY) load();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      live = false;
      window.removeEventListener("storage", onStorage);
    };
  }, [today]);
  return garden;
}
