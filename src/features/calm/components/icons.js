import { Brain, CloudRain, Feather, Heart, Hourglass, Moon, Sprout, Sunrise, Waves, Wind, Flower2, Timer } from "lucide-react";

export const GOAL_ICONS = {
  start: Sprout,
  sleep: Moon,
  stress: Waves,
  focus: Brain,
  anxiety: Feather,
  energy: Sunrise,
  kindness: Heart,
  timer: Hourglass,
};

export const KIND_ICONS = {
  breath: Wind,
  meditation: Flower2,
  timer: Timer,
};

export const AMBIENT_OPTIONS = [
  { id: "none", name: "Silence" },
  { id: "rain", name: "Rain", icon: CloudRain },
  { id: "ocean", name: "Ocean", icon: Waves },
  { id: "brown", name: "Deep hush" },
  { id: "drone", name: "Warm drone" },
];
