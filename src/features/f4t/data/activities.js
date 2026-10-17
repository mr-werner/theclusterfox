import compendium from "./compendiumActivities.json";
import manifest from "./activityGroupManifest.json";
import { buildActivityGroups } from "./activityGroups.js";

export const activities = compendium.map((item) => ({
  ...item,
  name: item.description.split(",")[0].trim(),
}));

export const activityCategories = [...new Set(activities.map((a) => a.category))];

export const activityGroups = buildActivityGroups(activities, manifest);
