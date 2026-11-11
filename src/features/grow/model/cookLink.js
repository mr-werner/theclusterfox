// What GrowFox tells CookFox: the food growing in your garden and whether
// it's ready to pick, so CookFox can suggest recipes for your harvest.
// CookFox loads this module on demand and passes in GrowFox's saved data
// exactly as stored (JSON.parse of localStorage["growfox-data-v1"]).
import { plantsById } from "../data/plants.js";
import { normalizeData } from "../state/growStore.js";
import { dayKey, dayNum, isDayKey } from "./dates.js";

// Herbs can be snipped a few weeks after planting out.
const HERB_READY_DAYS = 21;
// An annual crop this long past its harvest date is probably finished.
const ANNUAL_DONE_DAYS = 120;

/**
 * [{ plantId, name, ready, readyOn }] for each edible plant you're growing,
 * one row per kind of plant. ready is true when it can be picked now;
 * readyOn is the day it should be ready ("YYYY-MM-DD"), when known.
 */
export function gardenHarvest(raw, today) {
  if (!raw || !isDayKey(today)) return [];
  const data = normalizeData(raw);
  const now = dayNum(today);
  const byPlant = new Map();
  for (const e of data.garden) {
    if (e.status !== "growing") continue;
    const plant = plantsById.get(e.plantId);
    if (!plant?.tags?.includes("edible")) continue;
    const row = harvestRow(plant, e, now);
    if (!row) continue;
    const prev = byPlant.get(plant.id);
    // Keep the most useful row: ready beats growing, then the sooner date.
    if (!prev || (row.ready && !prev.ready) || (!row.ready && !prev.ready && (row.readyOn ?? "9") < (prev.readyOn ?? "9"))) byPlant.set(plant.id, row);
  }
  return [...byPlant.values()].sort((a, b) => Number(b.ready) - Number(a.ready) || a.name.localeCompare(b.name));
}

function harvestRow(plant, entry, now) {
  const planted = entry.planted ? dayNum(entry.planted) : null;
  const base = { plantId: plant.id, name: plant.name };
  if (plant.type === "herb") {
    const at = planted == null ? null : planted + HERB_READY_DAYS;
    return { ...base, ready: at == null || now >= at, readyOn: at == null ? null : dayKey(at) };
  }
  // Fruit and perennial vegetables crop every year once established; with
  // no planting day we can't say more than "growing".
  if (!plant.days || planted == null) return { ...base, ready: false, readyOn: null };
  const at = planted + plant.days;
  if (plant.type !== "fruit" && now > at + ANNUAL_DONE_DAYS) return null;
  return { ...base, ready: now >= at, readyOn: dayKey(at) };
}
