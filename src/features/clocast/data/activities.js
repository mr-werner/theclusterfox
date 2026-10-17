import {
  Armchair,
  Backpack,
  Bike,
  Dog,
  Flag,
  Footprints,
  Mountain,
  MountainSnow,
  PersonStanding,
  Shovel,
  Snowflake,
  Sprout,
  Wind,
  Zap,
} from "lucide-react";

// Outdoor activities. mets are from the 2024 Adult Compendium of Physical
// Activities. speed is how fast you move through the air
// (m/s), which adds to the wind you feel; gait is leg motion that pumps air
// through clothing (ISO 9920 "walking speed", capped at 1.2 m/s).
// wardrobe picks everyday clothes or active wear.
export const activities = [
  { id: "sitting", name: "Sitting outside", hint: "Patio, game, picnic", mets: 1.5, speed: 0, gait: 0, wardrobe: "everyday", icon: Armchair },
  { id: "waiting", name: "Standing around", hint: "Bus stop, sidelines", mets: 1.8, speed: 0, gait: 0, wardrobe: "everyday", icon: PersonStanding },
  { id: "errands", name: "Out and about", hint: "Errands, commute, mixed", mets: 2.5, speed: 0.6, gait: 0.6, wardrobe: "everyday", icon: Footprints },
  { id: "dog", name: "Walking the dog", hint: "Easy pace, stops", mets: 3.0, speed: 1.0, gait: 1.0, wardrobe: "everyday", icon: Dog },
  { id: "brisk", name: "Brisk walk", hint: "3.5 mph / 5.6 km/h", mets: 4.3, speed: 1.6, gait: 1.2, wardrobe: "everyday", icon: Footprints },
  { id: "hike", name: "Hiking", hint: "Trail, day pack", mets: 6.0, speed: 1.0, gait: 1.0, wardrobe: "active", icon: Mountain },
  { id: "hike-hard", name: "Steep hike", hint: "Uphill, heavier pack", mets: 7.8, speed: 0.8, gait: 0.8, wardrobe: "active", icon: Backpack },
  { id: "run-easy", name: "Easy run", hint: "10 min/mile, 6 mph", mets: 9.3, speed: 2.7, gait: 1.2, wardrobe: "active", icon: Wind },
  { id: "run-fast", name: "Fast run", hint: "7.5 min/mile, 8 mph", mets: 11.8, speed: 3.6, gait: 1.2, wardrobe: "active", icon: Zap },
  { id: "bike-easy", name: "Bike commute", hint: "10–12 mph", mets: 6.8, speed: 5.0, gait: 0.5, wardrobe: "active", icon: Bike },
  { id: "bike-road", name: "Road ride", hint: "14–16 mph", mets: 10.0, speed: 6.7, gait: 0.6, wardrobe: "active", icon: Bike },
  { id: "yard", name: "Yard work", hint: "Gardening, raking", mets: 3.8, speed: 0, gait: 0.3, wardrobe: "everyday", icon: Sprout },
  { id: "golf", name: "Golf, walking", hint: "Carrying clubs", mets: 4.8, speed: 0.8, gait: 0.8, wardrobe: "everyday", icon: Flag },
  { id: "shovel", name: "Shoveling snow", hint: "Moderate effort", mets: 5.3, speed: 0, gait: 0.3, wardrobe: "everyday", icon: Shovel },
  { id: "ski", name: "Downhill skiing", hint: "Moderate, groomed runs", mets: 5.3, speed: 8.0, gait: 0.3, wardrobe: "everyday", icon: MountainSnow },
  { id: "xc-ski", name: "Cross-country ski", hint: "Moderate pace", mets: 9.0, speed: 2.5, gait: 1.2, wardrobe: "active", icon: Snowflake },
];

export const activitiesById = new Map(activities.map(activity => [activity.id, activity]));

// Used to judge how cold someone gets when they stop moving.
export const RESTING = { mets: 1.5, speed: 0, gait: 0 };
