import compendium from "./compendiumActivities.json";

export const activities = compendium.map((item) => ({
  ...item,
  name: item.description.split(",")[0].trim(),
}));

export const activityCategories = [...new Set(activities.map((a) => a.category))];
