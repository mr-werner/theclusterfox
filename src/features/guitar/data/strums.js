// Strum and picking patterns, one bar long, in eighth-note slots.
// D = strum down, U = strum up, . = let it ring (hand keeps moving, misses
// the strings). A picking pattern lists strings instead: B = the chord's
// bass note (thumb), 1-6 = string number counted from the high e (1) to
// the low E (6), the way guitar teachers count them.

export const STRUMS = {
  "4/4": {
    easy: { name: "Four downs", slots: "D.D.D.D." },
    medium: { name: "Folk pattern", slots: "D.DU.UDU" },
    hard: { name: "Thumb and fingers", pick: ["B", 3, 2, 3, 1, 3, 2, 3] },
  },
  "3/4": {
    easy: { name: "Three downs", slots: "D.D.D." },
    medium: { name: "Waltz strum", slots: "D.DUDU" },
    hard: { name: "Waltz picking", pick: ["B", 3, 2, 1, 2, 3] },
  },
  "6/8": {
    easy: { name: "Two big downs", slots: "D..D.." },
    medium: { name: "Rocking 6/8", slots: "D.UD.U" },
    hard: { name: "Rolling arpeggio", pick: ["B", 3, 2, 1, 2, 3] },
  },
};

/** Every pattern, for the Strums page. */
export const STRUM_LIBRARY = [
  { id: "downs", name: "Four downs", sig: "4/4", slots: "D.D.D.D.", tip: "Count 1 2 3 4 and strum down on each number. Start here." },
  { id: "eighths", name: "Down-up eighths", sig: "4/4", slots: "DUDUDUDU", tip: "Your hand never stops: down on the numbers, up on the 'and'." },
  { id: "folk", name: "Folk pattern", sig: "4/4", slots: "D.DU.UDU", tip: "Down, down-up, up-down-up. Keep the hand moving on the gaps and just miss the strings." },
  { id: "pop", name: "Pop push", sig: "4/4", slots: "D..U.UD.", tip: "Leave space after the first down; the ups carry the groove." },
  { id: "rock", name: "Driving rock", sig: "4/4", slots: "D.D.DUDU", tip: "Steady downs, then a burst of eighths into the next bar." },
  { id: "waltz", name: "Waltz", sig: "3/4", slots: "D.DUDU", tip: "Big down on 1, lighter strums on 2 and 3." },
  { id: "six-eight", name: "Rocking 6/8", sig: "6/8", slots: "D.UD.U", tip: "Two pulses per bar: ONE two three FOUR five six." },
  { id: "travis", name: "Thumb and fingers", sig: "4/4", pick: ["B", 3, 2, 3, 1, 3, 2, 3], tip: "Thumb plays the bass, fingers roll through strings 3, 2 and 1." },
  { id: "arp", name: "Rolling arpeggio", sig: "6/8", pick: ["B", 3, 2, 1, 2, 3], tip: "Up the chord and back down, one string at a time." },
];

export const slotsPerBar = sig => {
  const [n, d] = sig.split("/").map(Number);
  return d === 8 ? n : n * 2;
};
