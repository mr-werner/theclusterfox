// Car games that work with no signal: road trip bingo, would-you-rather and
// talk cards, the alphabet game and state trivia.

import { STATES } from "./states.js";

export const BINGO_ITEMS = [
  "Cow", "Horse", "Red barn", "Water tower", "Windmill", "Wind turbine", "Tractor", "Motorcycle", "Bridge", "Tunnel",
  "Train", "School bus", "Fire truck", "Police car", "RV", "Car towing a boat", "Convertible with top down", "Yellow car",
  "Pink car", "Out-of-state plate", "Billboard with a lawyer", "Welcome to ___ sign", "State line", "Rest area", "Speed limit 75",
  "Construction cone", "Detour sign", "Deer crossing sign", "Cattle guard", "Hawk on a post", "Dog with head out the window",
  "Someone singing", "Gas under $3.50", "Church steeple", "Silo", "Covered bridge", "Lake", "River", "Mountain",
  "Mile marker 100", "Exit 1", "Drive-in or diner", "Giant roadside statue", "Hitchhiker sign", "Hot air balloon", "Airplane",
  "Helicopter", "Semi with a funny name", "Car with a bike rack", "Kayak on a roof", "Flag", "Sunflower", "Cactus", "Snow",
  "Rainbow", "Car wash", "Ice cream sign", "Farm stand", "Horse trailer", "Pickup full of hay", "Bumper sticker that makes you laugh",
  "Antique car", "Limo", "Tollbooth", "Scenic overlook sign", "Historic marker",
];

/** A seeded shuffle so a bingo card stays the same after reloading. */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function shuffle(list, rand = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 25 squares for a seed; the middle one is free. */
export function bingoCard(seed) {
  const picks = shuffle(BINGO_ITEMS, seeded(seed)).slice(0, 24);
  return [...picks.slice(0, 12), "FREE", ...picks.slice(12)];
}

const LINES = [
  ...[0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => r * 5 + c)),
  ...[0, 1, 2, 3, 4].map(c => [0, 1, 2, 3, 4].map(r => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

/** The completed lines on a card (the free square always counts). */
export function bingoLines(marks) {
  const on = new Set([...marks, 12]);
  return LINES.filter(line => line.every(i => on.has(i)));
}

export const WOULD_YOU_RATHER = [
  "Would you rather only eat gas station snacks for a week or only eat food from one restaurant?",
  "Would you rather drive across the whole country or fly around the world?",
  "Would you rather have a car that can fly or one that can drive underwater?",
  "Would you rather always have to sing along to the radio or never be allowed to pick the music?",
  "Would you rather visit every national park or every big city in the country?",
  "Would you rather have a talking dog or a cat that can drive?",
  "Would you rather camp under the stars or stay in a fancy hotel with a pool?",
  "Would you rather be able to stop time or rewind it ten seconds?",
  "Would you rather explore the ocean or outer space?",
  "Would you rather live in a treehouse or a houseboat?",
  "Would you rather never get carsick again or never have to stop for a bathroom?",
  "Would you rather have a road trip with no phones or with no snacks?",
  "Would you rather be the best singer or the best dancer in the world?",
  "Would you rather meet a dinosaur or a real dragon?",
  "Would you rather be really tall or really small for a day?",
  "Would you rather only drive back roads or only drive highways forever?",
  "Would you rather eat pizza for breakfast every day or pancakes for dinner every day?",
  "Would you rather be famous or be really good at something nobody knows about?",
  "Would you rather it always be summer or always be winter where you live?",
  "Would you rather speak every language or play every instrument?",
  "Would you rather find a hidden waterfall or a secret cave?",
  "Would you rather drive a monster truck or a race car?",
  "Would you rather know the end of every movie or never know how anything ends?",
  "Would you rather take a train across Canada or a boat down the Mississippi?",
  "Would you rather have breakfast at a diner or a picnic at an overlook?",
];

export const TALK_CARDS = [
  "What's the best thing you've ever eaten on a trip?",
  "If you could live anywhere we drive through today, where would it be?",
  "What's a song everyone in this car has to hear?",
  "What's one thing you want to do before this trip is over?",
  "Tell the story of the funniest thing that happened to you this year.",
  "If this car could talk, what would it say about us?",
  "What's the weirdest thing you've seen out the window so far?",
  "What would your perfect day on this trip look like?",
  "If you could add one person to this road trip, who would it be?",
  "What's a place you've never been that you really want to see?",
  "Rate the snacks so far, best to worst.",
  "What's the best road trip you've ever been on, and why?",
  "Make up a name for this trip, like a movie title.",
  "If we had to stay one extra day somewhere, where should it be?",
  "Name three things you're grateful for right now.",
  "What would you do with a free day in the next town?",
  "Invent a new rule for car rides.",
  "What's a skill you'd love to learn this year?",
  "Who in this car would win a reality show, and which one?",
  "What's your favorite memory with someone in this car?",
];

export const ALPHABET_RULES = "Find each letter of the alphabet, in order, on signs, plates or buildings outside the car. Q, X and Z can come from anywhere on a word. First to Z wins.";

/**
 * A multiple-choice state question. states narrows which states to ask
 * about (the ones on your route), falling back to all of them.
 */
export function triviaQuestion(rand = Math.random, codes = []) {
  const pool = codes.length ? STATES.filter(s => codes.includes(s.code)) : STATES;
  const s = pool[Math.floor(rand() * pool.length)];
  const kinds = s.code === "DC" ? ["nickname"] : ["capital", "nickname", "byCapital"];
  const kind = kinds[Math.floor(rand() * kinds.length)];
  const others = shuffle(STATES.filter(o => o.code !== s.code && o.code !== "DC"), rand).slice(0, 3);
  if (kind === "capital") return { prompt: `What's the capital of ${s.name}?`, answer: s.capital, choices: shuffle([s.capital, ...others.map(o => o.capital)], rand), code: s.code };
  if (kind === "byCapital") return { prompt: `${s.capital} is the capital of which state?`, answer: s.name, choices: shuffle([s.name, ...others.map(o => o.name)], rand), code: s.code };
  return { prompt: `Which state is "${s.nickname}"?`, answer: s.name, choices: shuffle([s.name, ...others.map(o => o.name)], rand), code: s.code };
}
