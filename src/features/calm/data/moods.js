import { goalsById } from "./sessions.js";

// The first thing CalmFox asks. Each choice is one tap to a short list,
// or straight to the breathing rhythm.
export const MOODS = [
  { id: "breathe", name: "Breathe", blurb: "Set your own rhythm and follow the light." },
  { id: "quick", name: "Quick reset", blurb: "Five minutes or less." },
  { id: "stress", name: "Stress relief" },
  { id: "anxiety", name: "Grounding" },
  { id: "focus", name: "Focus" },
  { id: "sleep", name: "Sleep" },
  { id: "energy", name: "Gentle energy" },
  { id: "kindness", name: "Kindness" },
  { id: "start", name: "Mindfulness", blurb: "New to this? A few easy minutes to begin." },
  { id: "timer", name: "Silence", blurb: "Sit quietly with soft bells." },
];

export const moodName = id => MOODS.find(m => m.id === id)?.name ?? goalsById.get(id)?.name ?? "Favorites";
export const moodBlurb = id => MOODS.find(m => m.id === id)?.blurb ?? goalsById.get(id)?.blurb ?? "";

