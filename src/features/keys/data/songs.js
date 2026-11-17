// Built-in KeysFox songs. Every piece here is in the public domain
// (traditional, or written before 1929); the arrangements are KeysFox's own.
// Notation: see parseVoice in ../model/song.js.
import { makeSong, parseVoice } from "../model/song.js";
import { parseNote } from "../../../lib/music/theory.js";

export const CATEGORIES = [
  { id: "start", name: "Start here", blurb: "Warm-ups that teach where your hands go." },
  { id: "folk", name: "Songs everyone knows", blurb: "Folk tunes, hymns and holiday songs." },
  { id: "classical", name: "Classical", blurb: "Famous pieces, arranged to learn in steps." },
];

const repeat = (s, n) => Array.from({ length: n }, () => s).join(" ");

// Bach, Prelude in C (BWV 846): every bar is one chord, broken the same way.
function preludeInC() {
  const bars = [
    "C4 E4 G4 C5 E5", "C4 D4 A4 D5 F5", "B3 D4 G4 D5 F5", "C4 E4 G4 C5 E5",
    "C4 E4 A4 E5 A5", "C4 D4 F#4 A4 D5", "B3 D4 G4 D5 G5", "B3 C4 E4 G4 C5",
    "A3 C4 E4 G4 C5", "D3 A3 D4 F#4 C5", "G3 B3 D4 G4 B4", "G3 Bb3 E4 G4 C#5",
    "F3 A3 D4 A4 D5", "F3 Ab3 D4 F4 B4", "E3 G3 C4 G4 C5",
  ];
  const notes = [];
  bars.forEach((bar, i) => {
    const [n1, n2, n3, n4, n5] = bar.split(" ").map(parseNote);
    for (const half of [0, 2]) {
      const t = i * 4 + half;
      notes.push({ midi: n1, t, d: 2, hand: "L", vel: 0.6 });
      notes.push({ midi: n2, t: t + 0.25, d: 1.75, hand: "L", vel: 0.55 });
      [n3, n4, n5, n3, n4, n5].forEach((m, k) => notes.push({ midi: m, t: t + 0.5 + k * 0.25, d: 0.25, hand: "R", vel: 0.6 }));
    }
  });
  notes.push(...parseVoice("[C3 C4]/4", "L").map(n => ({ ...n, t: bars.length * 4 })));
  notes.push(...parseVoice("[E4 G4 C5]/4", "R").map(n => ({ ...n, t: bars.length * 4 })));
  return notes;
}

const furEliseBody = {
  R: "E5/.25 D#5 E5 B4 D5 C5 | A4/.5 r/.25 C4 E4 A4 | B4/.5 r/.25 E4 G#4 B4 | C5/.5 r/.25 E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4/.5 r/.25 C4 E4 A4 | B4/.5 r/.25 E4 C5 B4 |",
  L: "r/1.5 | A2/.25 E3 A3 r/.75 | E2/.25 E3 G#3 r/.75 | A2/.25 E3 A3 r/.75 | r/1.5 | A2/.25 E3 A3 r/.75 | E2/.25 E3 G#3 r/.75 |",
};

const greensVerse = "C5/2 D5/1 | E5/1.5 F5/.5 E5/1 | D5/2 B4/1 | G4/1.5 A4/.5 B4/1 | C5/2 A4/1 | A4/1.5 G#4/.5 A4/1 | B4/2 G#4/1 | E4/2 A4/1 | C5/2 D5/1 | E5/1.5 F5/.5 E5/1 | D5/2 B4/1 | G4/1.5 A4/.5 B4/1 | C5/1.5 B4/.5 A4/1 | G#4/1.5 F#4/.5 G#4/1 | A4/3 |";
const greensChorus = "G5/3 | G5/1.5 F#5/.5 E5/1 | D5/2 B4/1 | G4/1.5 A4/.5 B4/1 | C5/2 A4/1 | A4/1.5 G#4/.5 A4/1 | B4/2 G#4/1 | E4/3 | G5/3 | G5/1.5 F#5/.5 E5/1 | D5/2 B4/1 | G4/1.5 A4/.5 B4/1 | C5/1.5 B4/.5 A4/1 | G#4/1.5 F#4/.5 G#4/1 | A4/3 |";
const Am = "[A2 E3]/3";
const C = "[C3 G3]/3";
const G = "[G2 D3]/3";
const Em = "[E2 B2]/3";
const E = "[E2 B2]/3";

export const SONGS = [
  makeSong({
    id: "warmup",
    title: "Five-finger warm-up",
    composer: "Exercise",
    tags: ["start"],
    level: 1,
    bpm: 80,
    about: "Each hand sits on five keys starting at C. The small numbers are fingers: 1 is your thumb, 5 your little finger.",
    right: "C4/1:1 D4:2 E4:3 F4:4 | G4:5 F4:4 E4:3 D4:2 | C4/2:1 E4/1:3 G4:5 | C4/4:1 |",
    left: "C3/1:5 D3:4 E3:3 F3:2 | G3:1 F3:2 E3:3 D3:4 | C3/2:5 E3/1:3 G3:1 | C3/4:5 |",
  }),
  makeSong({
    id: "c-scale",
    title: "C major scale",
    composer: "Exercise",
    tags: ["start"],
    level: 1,
    bpm: 72,
    about: "The thumb tucks under after the third finger going up, and the third finger crosses over going down.",
    right: "C4/1:1 D4:2 E4:3 F4:1 | G4:2 A4:3 B4:4 C5:5 | B4:4 A4:3 G4:2 F4:1 | E4:3 D4:2 C4/2:1 |",
    left: "C3/1:5 D3:4 E3:3 F3:2 | G3:1 A3:3 B3:2 C4:1 | B3:2 A3:3 G3:1 F3:2 | E3:3 D3:4 C3/2:5 |",
  }),
  makeSong({
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    composer: "Traditional",
    tags: ["start", "folk"],
    level: 1,
    bpm: 100,
    right: "C4/1 C4 G4 G4 | A4 A4 G4/2 | F4/1 F4 E4 E4 | D4 D4 C4/2 | G4/1 G4 F4 F4 | E4 E4 D4/2 | G4/1 G4 F4 F4 | E4 E4 D4/2 | C4/1 C4 G4 G4 | A4 A4 G4/2 | F4/1 F4 E4 E4 | D4 D4 C4/2 |",
    left: "C3/4 | F3/2 C3 | F3 C3 | G3 C3 | C3 G2 | C3 G2 | C3 G2 | C3 G2 | C3/4 | F3/2 C3 | F3 C3 | G3 C3 |",
  }),
  makeSong({
    id: "mary",
    title: "Mary Had a Little Lamb",
    composer: "Traditional",
    tags: ["start", "folk"],
    level: 1,
    bpm: 100,
    right: "E4/1 D4 C4 D4 | E4 E4 E4/2 | D4/1 D4 D4/2 | E4/1 G4 G4/2 | E4/1 D4 C4 D4 | E4 E4 E4 E4 | D4 D4 E4 D4 | C4/4 |",
    left: "[C3 G3]/4 | [C3 G3] | [G2 D3] | [C3 G3] | [C3 G3] | [C3 G3] | [G2 D3] | [C3 G3] |",
  }),
  makeSong({
    id: "ode-to-joy",
    title: "Ode to Joy",
    composer: "Ludwig van Beethoven",
    tags: ["start", "classical"],
    level: 1,
    bpm: 100,
    about: "From the last movement of the Ninth Symphony (1824).",
    right: "E4/1 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | E4/1.5 D4/.5 D4/2 | E4/1 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/.5 C4/2 | D4/1 D4 E4 C4 | D4 E4/.5 F4 E4/1 C4 | D4 E4/.5 F4 E4/1 D4 | C4 D4 G3/2 | E4/1 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4 | D4/1.5 C4/.5 C4/2 |",
    left: "[C3 G3]/4 | [B2 G3] | [C3 G3] | [G2 D3] | [C3 G3] | [B2 G3] | [C3 G3] | [G2 D3]/2 [C3 G3] | [G2 D3]/4 | [C3 G3] | [G2 D3] | [C3 E3]/2 [B2 D3] | [C3 G3]/4 | [B2 G3] | [C3 G3] | [G2 D3]/2 [C3 G3] |",
  }),
  makeSong({
    id: "jingle-bells",
    title: "Jingle Bells",
    composer: "James Lord Pierpont",
    tags: ["folk"],
    level: 2,
    bpm: 120,
    about: "Published in 1857.",
    right: "E4/1 E4 E4/2 | E4/1 E4 E4/2 | E4/1 G4 C4/1.5 D4/.5 | E4/4 | F4/1 F4 F4/1.5 F4/.5 | F4/1 E4 E4 E4/.5 E4 | E4/1 D4 D4 E4 | D4/2 G4/2 | E4/1 E4 E4/2 | E4/1 E4 E4/2 | E4/1 G4 C4/1.5 D4/.5 | E4/4 | F4/1 F4 F4 F4 | F4 E4 E4 E4/.5 E4 | G4/1 G4 F4 D4 | C4/4 |",
    left: `${repeat("[C3 G3]/2 [C3 G3] |", 4)} [F2 C3] [F2 C3] | [C3 G3] [C3 G3] | [G2 D3] [G2 D3] | [G2 D3] [G2 B2] | ${repeat("[C3 G3] [C3 G3] |", 4)} [F2 C3] [F2 C3] | [C3 G3] [C3 G3] | [G2 D3] [G2 D3] | [C3 G3]/4 |`,
  }),
  makeSong({
    id: "happy-birthday",
    title: "Happy Birthday",
    composer: "Mildred and Patty Hill",
    tags: ["folk"],
    level: 2,
    bpm: 100,
    timeSig: [3, 4],
    pickup: 1,
    right: "G4/.75 G4/.25 | A4/1 G4 C5 | B4/2 G4/.75 G4/.25 | A4/1 G4 D5 | C5/2 G4/.75 G4/.25 | G5/1 E5 C5 | B4 A4 F5/.75 F5/.25 | E5/1 C5 D5 | C5/2",
    left: "r/1 | C3/1 [E3 G3] [E3 G3] | G2 [D3 F3] [D3 F3] | G2 [D3 F3] [D3 F3] | C3 [E3 G3] [E3 G3] | C3 [E3 G3] [E3 G3] | F2 [A2 C3] [A2 C3] | C3 [E3 G3] G2 | [C3 E3 G3]/2",
  }),
  makeSong({
    id: "lullaby",
    title: "Lullaby (Wiegenlied)",
    composer: "Johannes Brahms",
    tags: ["classical"],
    level: 2,
    bpm: 84,
    timeSig: [3, 4],
    pickup: 1,
    about: "Op. 49 No. 4, 1868.",
    right: "E4/.5 E4 | G4/2 E4/.5 E4 | G4/2 E4/.5 G4 | C5/1 B4/1.5 A4/.5 | A4/1 G4 D4/.5 E4 | F4/1 D4 D4/.5 E4 | F4/2 D4/.5 F4 | B4/.5 A4 G4/1 B4 | C5/2 C4/.5 C4 | C5/2 A4/.5 F4 | G4/2 E4/.5 C4 | F4/1 G4 A4 | G4/2 C4/.5 C4 | C5/2 A4/.5 F4 | G4/2 E4/.5 C4 | F4/1 E4 D4 | C4/2",
    left: "r/1 | C3/1 [E3 G3] [E3 G3] | C3 [E3 G3] [E3 G3] | G2 [D3 F3] [D3 F3] | G2 [B2 F3] [B2 F3] | G2 [B2 F3] [B2 F3] | G2 [B2 F3] [B2 F3] | G2 [B2 D3] [B2 D3] | C3 [E3 G3] [E3 G3] | F2 [A2 C3] [A2 C3] | C3 [E3 G3] [E3 G3] | F2 [A2 C3] G2 | C3 [E3 G3] [E3 G3] | F2 [A2 C3] [A2 C3] | C3 [E3 G3] [E3 G3] | G2 [B2 F3] [B2 F3] | [C3 E3 G3]/2",
  }),
  makeSong({
    id: "amazing-grace",
    title: "Amazing Grace",
    composer: "Traditional (words John Newton)",
    tags: ["folk"],
    level: 2,
    bpm: 80,
    timeSig: [3, 4],
    key: 1,
    pickup: 1,
    right: "D4/1 | G4/2 B4/.5 G4/.5 | B4/2 A4/1 | G4/2 E4/1 | D4/2 D4/1 | G4/2 B4/.5 G4/.5 | B4/2 A4/1 | D5/3 | D5/2 B4/1 | D5/1.5 B4/.5 G4/1 | B4/2 A4/1 | G4/2 E4/1 | D4/2 D4/1 | G4/2 B4/.5 G4/.5 | B4/2 A4/1 | G4/2",
    left: "r/1 | G2/1 [B2 D3] [B2 D3] | G2 [B2 D3] [B2 D3] | C3 [E3 G3] [E3 G3] | G2 [B2 D3] [B2 D3] | G2 [B2 D3] [B2 D3] | D3 [F#3 A3] [F#3 A3] | D3 [F#3 A3] [F#3 A3] | G2 [B2 D3] [B2 D3] | G2 [B2 D3] [B2 D3] | G2 [B2 D3] [B2 D3] | C3 [E3 G3] [E3 G3] | G2 [B2 D3] [B2 D3] | G2 [B2 D3] [B2 D3] | D3 [F#3 A3] [F#3 A3] | [G2 D3 G3]/2",
  }),
  makeSong({
    id: "greensleeves",
    title: "Greensleeves",
    composer: "Traditional English",
    tags: ["folk"],
    level: 2,
    bpm: 96,
    timeSig: [3, 4],
    pickup: 1,
    about: "A tune from the 1500s.",
    right: `A4/1 | ${greensVerse} ${greensChorus}`,
    left: `r/1 | ${Am} | ${C} | ${G} | ${Em} | ${Am} | ${E} | ${E} | ${Am} | ${Am} | ${C} | ${G} | ${Em} | ${Am} | ${E} | ${Am} | ${C} | ${C} | ${G} | ${Em} | ${Am} | ${E} | ${E} | ${E} | ${C} | ${C} | ${G} | ${Em} | ${Am} | ${E} | ${Am} |`,
  }),
  makeSong({
    id: "minuet-g",
    title: "Minuet in G",
    composer: "Christian Petzold",
    tags: ["classical"],
    level: 3,
    bpm: 104,
    timeSig: [3, 4],
    key: 1,
    about: "From the 1725 Notebook for Anna Magdalena Bach, long credited to J. S. Bach.",
    right: "D5/1 G4/.5 A4 B4 C5 | D5/1 G4 G4 | E5/1 C5/.5 D5 E5 F#5 | G5/1 G4 G4 | C5/1 D5/.5 C5 B4 A4 | B4/1 C5/.5 B4 A4 G4 | F#4/1 G4/.5 A4 B4 G4 | A4/3 | D5/1 G4/.5 A4 B4 C5 | D5/1 G4 G4 | E5/1 C5/.5 D5 E5 F#5 | G5/1 G4 G4 | C5/1 D5/.5 C5 B4 A4 | B4/1 C5/.5 B4 A4 G4 | A4/1 B4/.5 A4 G4 F#4 | G4/3 |",
    left: "[G3 B3 D4]/2 A3/1 | B3/3 | C4/3 | B3/3 | A3/3 | G3/3 | D4/1 B3 G3 | D4 D3 C4 | B3/2 A3/1 | B3/3 | C4/3 | B3/1 A3 G3 | A3/3 | G3/3 | C4/1 D4 D3 | G3/2 G2/1 |",
  }),
  makeSong({
    id: "canon-d",
    title: "Canon in D",
    composer: "Johann Pachelbel",
    tags: ["classical"],
    level: 3,
    bpm: 66,
    key: 2,
    about: "The left hand repeats the same eight notes the whole way through.",
    right: "F#5/2 E5 | D5 C#5 | B4 A4 | B4 C#5 | D5 C#5 | B4 A4 | G4 F#4 | G4 E4 | D4/1 F#4 A4 G4 | F#4 D4 F#4 E4 | D4 B3 D4 A4 | G4 B4 A4 G4 | [D5 F#5]/2 [C#5 E5] | [B4 D5] [A4 C#5] | [G4 B4] [F#4 A4] | [G4 B4] [A4 C#5] | [D5 F#5 A5]/4 |",
    left: `${repeat("D3/2 A2 | B2 F#2 | G2 D2 | G2 A2 |", 4)} [D2 D3]/4 |`,
  }),
  makeSong({
    id: "gymnopedie",
    title: "Gymnopédie No. 1",
    composer: "Erik Satie",
    tags: ["classical"],
    level: 3,
    bpm: 72,
    timeSig: [3, 4],
    key: 2,
    about: "1888. Slow, and the left hand rocks between two chords the whole way.",
    right: "r/3 | r | r | r | r/1 F#5 A5 | G5 F#5 C#5 | B4 C#5 D5 | A4/3 | F#4/9 | r/1 F#5 A5 | G5 F#5 C#5 | B4 C#5 D5 | A4/3 | C#5/3 | F#5/3 | E5/3 |",
    left: repeat("G2/1 [B3 D4 F#4]/2 | D2/1 [A3 C#4 F#4]/2 |", 9),
  }),
  makeSong({
    id: "fur-elise",
    title: "Für Elise",
    composer: "Ludwig van Beethoven",
    tags: ["classical"],
    level: 4,
    bpm: 66,
    timeSig: [3, 8],
    pickup: 0.5,
    about: "The famous opening theme (1810), played twice.",
    right: `E5/.25 D#5 | ${furEliseBody.R} A4/.5 r/.5 E5/.25 D#5 | ${furEliseBody.R} A4/.5 r/1 |`,
    left: `r/.5 | ${furEliseBody.L} A2/.25 E3 A3 r/.75 | ${furEliseBody.L} A2/.25 E3 A3 r/.75 |`,
  }),
  makeSong({
    id: "prelude-c",
    title: "Prelude in C",
    composer: "Johann Sebastian Bach",
    tags: ["classical"],
    level: 4,
    bpm: 60,
    about: "The opening of The Well-Tempered Clavier (1722). Every bar is one chord broken into the same pattern.",
    notes: preludeInC(),
  }),
];

export const songById = new Map(SONGS.map(s => [s.id, s]));
