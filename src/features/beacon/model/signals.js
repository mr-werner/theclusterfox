// The signals BeaconFox can send. Each one is a light pattern in
// milliseconds: [{ on, ms, at? }], played on a loop until you stop it.

import { SOS_CODE, lettersToUnits, unitMs, unitsToMs } from "./morse.js";

// Three of anything (flashes, whistle blasts, fires, shots) is the
// long-standing sign for "help" in the backcountry.
const THREE = [
  { on: true, ms: 500 }, { on: false, ms: 500 },
  { on: true, ms: 500 }, { on: false, ms: 500 },
  { on: true, ms: 500 }, { on: false, ms: 2500 },
];

export const SIGNALS = [
  {
    id: "sos",
    name: "SOS",
    short: "··· ─── ···",
    what: "The distress signal everyone knows. Three short, three long, three short, over and over.",
    morse: true,
    build: wpm => unitsToMs(lettersToUnits([{ char: "SOS", code: SOS_CODE }]), unitMs(wpm)),
  },
  {
    id: "three",
    name: "Groups of three",
    short: "● ● ●   ● ● ●",
    what: "Three flashes, a pause, repeat. Three of anything means help to hikers, rangers and search teams.",
    build: () => THREE,
  },
  {
    id: "strobe",
    name: "Rescue strobe",
    short: "● · · ● · · ●",
    what: "A quick bright flash once a second, like a rescue beacon. Easy to spot from the air or far away.",
    build: () => [{ on: true, ms: 120 }, { on: false, ms: 880 }],
  },
  {
    id: "beacon",
    name: "Battery saver",
    short: "●       ●",
    what: "One flash every four seconds. Marks where you are for hours while using very little battery.",
    build: () => [{ on: true, ms: 150 }, { on: false, ms: 3850 }],
  },
  {
    id: "steady",
    name: "Steady light",
    short: "━━━━━━━",
    what: "Just a light. Use it to see, or to be seen once someone is heading your way.",
    build: () => [{ on: true, ms: Infinity }],
  },
];

export const signalById = new Map(SIGNALS.map(s => [s.id, s]));

/** True when a pattern flashes faster than three times a second (a seizure risk). */
export function flashesTooFast(segments) {
  const finite = segments.filter(s => Number.isFinite(s.ms));
  for (let i = 0; i + 1 < finite.length; i += 1) {
    if (finite[i].on && finite[i].ms + finite[i + 1].ms < 333) return true;
  }
  return false;
}
