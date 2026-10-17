import { groupKeyForActivityId } from "./data/activityGroups";
import { calculateDistance, minutesToBurnCalories } from "../../domain/exercise/energy";

// Starter favorites for first-time visitors, picked by Compendium code so the
// card opens on that exact option: brisk walk, 10-minute mile, 12-14 mph ride,
// and a typical weights session.
const STARTER_ACTIVITY_IDS = ["17190", "12050", "01030", "02054"];

export function starterFavorites(groups) {
  return STARTER_ACTIVITY_IDS.map(id => groupKeyForActivityId(groups, id)).filter(Boolean);
}

export function starterSelections(groups) {
  return Object.fromEntries(
    STARTER_ACTIVITY_IDS.map(id => [groupKeyForActivityId(groups, id), id]).filter(([key]) => key)
  );
}

// Older favorites may point at an entry that has since joined a group.
export function resolveFavoriteKeys(saved, groups, groupsByKey) {
  if (!Array.isArray(saved)) return starterFavorites(groups);
  const keys = saved.map(key => {
    if (groupsByKey.has(key)) return key;
    if (key.startsWith("entry::")) return groupKeyForActivityId(groups, key.slice("entry::".length));
    return null;
  });
  return [...new Set(keys.filter(Boolean))];
}

// Favorites carried over from single-entry cards open on that same entry.
export function migratedSelections(saved, groups) {
  if (!Array.isArray(saved)) return {};
  const picks = saved
    .filter(key => key.startsWith("entry::"))
    .map(key => key.slice("entry::".length))
    .map(id => [groupKeyForActivityId(groups, id), id]);
  return Object.fromEntries(picks.filter(([key]) => key));
}

export function selectedOptionIndex(group, selections) {
  const index = group.options.findIndex(option => option.id === selections[group.key]);
  // Unadjusted cards start in the middle of their range.
  return index >= 0 ? index : Math.floor((group.options.length - 1) / 2);
}

export function minutesFor(calories, met, weightLbs) {
  if (!(calories > 0 && weightLbs > 0)) return null;
  return minutesToBurnCalories(calories, met, weightLbs, "net");
}

// "3.5 to 3.9 mph" → 3.7, so speed cards can show roughly how far you'd go.
export function milesFor(minutes, label) {
  if (!Number.isFinite(minutes) || !/mph/i.test(label)) return null;
  const numbers = (label.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!numbers.length || /less than|</i.test(label)) return null;
  const mph = numbers.length > 1 ? (numbers[0] + numbers[1]) / 2 : numbers[0];
  return calculateDistance(minutes, mph);
}
