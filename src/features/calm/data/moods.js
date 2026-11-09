import { goalsById, STYLES } from "./sessions.js";

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

// The second way in: by how you want to practice, not by how you feel.
// Only breathing techniques give you a rhythm to follow.
export const PRACTICES = [
  { id: "techniques", style: "technique", name: STYLES.technique.plural, blurb: STYLES.technique.blurb },
  { id: "awareness", style: "awareness", name: STYLES.awareness.plural, blurb: STYLES.awareness.blurb },
  { id: "bodyscan", style: "bodyscan", name: STYLES.bodyscan.plural, blurb: STYLES.bodyscan.blurb },
];

const find = id => MOODS.find(m => m.id === id) ?? PRACTICES.find(p => p.id === id);
export const moodName = id => find(id)?.name ?? goalsById.get(id)?.name ?? "Favorites";
export const moodBlurb = id => find(id)?.blurb ?? goalsById.get(id)?.blurb ?? "";

