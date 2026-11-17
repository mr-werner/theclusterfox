// The songs that come with FretFox. Every one is a traditional tune or was
// published long enough ago to be in the public domain, and every
// arrangement here (melody, chords, strums) was written for FretFox.
//
// chords: bars separated by "|". A bar holds one or more chord names that
//   share the bar evenly ("C G" = two beats each in 4/4).
// melody: notes as NAME+OCTAVE/BEATS ("G4/1.5"), "r" for a rest, bars "|"
//   only for reading. The melody starts `pickup` beats before bar one.
// bpm is quarter notes per minute at full speed.

export const SONGS = [
  {
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    by: "Traditional (French melody, 1761)",
    sig: "4/4",
    bpm: 96,
    key: "C",
    level: 1,
    chords: "C | F C | F C | G C | C F | C G | C F | C G | C | F C | F C | G C",
    melody:
      "C4/1 C4/1 G4/1 G4/1 | A4/1 A4/1 G4/2 | F4/1 F4/1 E4/1 E4/1 | D4/1 D4/1 C4/2 | " +
      "G4/1 G4/1 F4/1 F4/1 | E4/1 E4/1 D4/2 | G4/1 G4/1 F4/1 F4/1 | E4/1 E4/1 D4/2 | " +
      "C4/1 C4/1 G4/1 G4/1 | A4/1 A4/1 G4/2 | F4/1 F4/1 E4/1 E4/1 | D4/1 D4/1 C4/2",
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    by: "Ludwig van Beethoven (1824)",
    sig: "4/4",
    bpm: 100,
    key: "C",
    level: 1,
    chords: "C | G | C | G | C | G | C | G C | G C | G C | G C | C G | C | G | C | G C",
    melody:
      "E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | E4/1.5 D4/0.5 D4/2 | " +
      "E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | D4/1.5 C4/0.5 C4/2 | " +
      "D4/1 D4/1 E4/1 C4/1 | D4/1 E4/0.5 F4/0.5 E4/1 C4/1 | D4/1 E4/0.5 F4/0.5 E4/1 D4/1 | C4/1 D4/1 G3/2 | " +
      "E4/1 E4/1 F4/1 G4/1 | G4/1 F4/1 E4/1 D4/1 | C4/1 C4/1 D4/1 E4/1 | D4/1.5 C4/0.5 C4/2",
  },
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    by: "John Newton (1779), tune \"New Britain\" (1829)",
    sig: "3/4",
    bpm: 84,
    key: "G",
    level: 1,
    pickup: 1,
    chords: "G | G | C | G | G | G | D | D | G | G | C | G | G | D | G | G",
    melody:
      "D4/1 | G4/2 B4/0.5 G4/0.5 | B4/2 A4/1 | G4/2 E4/1 | D4/2 D4/1 | G4/2 B4/0.5 G4/0.5 | B4/2 A4/1 | D5/3 | D5/2 B4/1 | " +
      "D5/2 B4/0.5 G4/0.5 | B4/2 A4/1 | G4/2 E4/1 | D4/2 D4/1 | G4/2 B4/0.5 G4/0.5 | B4/2 A4/1 | G4/3 | G4/2 r/1",
  },
  {
    id: "happy-birthday",
    title: "Happy Birthday to You",
    by: "Mildred and Patty Hill (1893)",
    sig: "3/4",
    bpm: 100,
    key: "G",
    level: 1,
    pickup: 1,
    chords: "G | D | D | G | G7 | C | G D | G",
    melody:
      "D4/0.75 D4/0.25 | E4/1 D4/1 G4/1 | F#4/2 D4/0.75 D4/0.25 | E4/1 D4/1 A4/1 | G4/2 D4/0.75 D4/0.25 | " +
      "D5/1 B4/1 G4/1 | F#4/1 E4/1 C5/0.75 C5/0.25 | B4/1 G4/1 A4/1 | G4/3",
  },
  {
    id: "saints",
    title: "When the Saints Go Marching In",
    by: "Traditional spiritual",
    sig: "4/4",
    bpm: 112,
    key: "C",
    level: 1,
    chords: "C | C | C | C | C | C | G | G | C | C7 | F | F | C | G | C G | C",
    melody:
      "r/1 C4/1 E4/1 F4/1 | G4/4 | r/1 C4/1 E4/1 F4/1 | G4/4 | r/1 C4/1 E4/1 F4/1 | G4/2 E4/2 | C4/2 E4/2 | D4/4 | " +
      "r/1 E4/1 E4/1 D4/1 | C4/3 C4/1 | E4/2 G4/2 | G4/1 F4/3 | r/1 E4/1 F4/1 G4/1 | E4/2 C4/2 | D4/2 D4/2 | C4/4",
  },
  {
    id: "oh-susanna",
    title: "Oh! Susanna",
    by: "Stephen Foster (1848)",
    sig: "4/4",
    bpm: 108,
    key: "C",
    level: 2,
    pickup: 1,
    chords: "C | C | C G | C | C | C | C G | C",
    melody:
      "C4/0.5 D4/0.5 | E4/1 G4/1 G4/1.5 A4/0.5 | G4/1 E4/1 C4/1.5 D4/0.5 | E4/1 E4/1 D4/1 C4/1 | D4/3 C4/0.5 D4/0.5 | " +
      "E4/1 G4/1 G4/1.5 A4/0.5 | G4/1 E4/1 C4/1.5 D4/0.5 | E4/1 E4/1 D4/1 D4/1 | C4/4",
  },
  {
    id: "auld-lang-syne",
    title: "Auld Lang Syne",
    by: "Robert Burns (1788), traditional Scots tune",
    sig: "4/4",
    bpm: 84,
    key: "G",
    level: 2,
    pickup: 1,
    chords: "G | D | G | C | G | D | Em D | G",
    melody:
      "D4/1 | G4/1.5 G4/0.5 G4/1 B4/1 | A4/1.5 G4/0.5 A4/1 B4/0.5 A4/0.5 | G4/1.5 G4/0.5 B4/1 D5/1 | E5/3 E5/1 | " +
      "D5/1.5 B4/0.5 B4/1 G4/1 | A4/1.5 G4/0.5 A4/1 B4/0.5 A4/0.5 | G4/1.5 E4/0.5 E4/1 D4/1 | G4/3 r/1",
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    by: "Traditional English (16th century)",
    sig: "3/4",
    bpm: 96,
    key: "Am",
    level: 3,
    pickup: 1,
    chords: "Am | C | G | Em | Am | E | E | Am | Am | C | G | Em | Am | E | Am | Am",
    melody:
      "A4/1 | C5/2 D5/1 | E5/1.5 F5/0.5 E5/1 | D5/2 B4/1 | G4/1.5 A4/0.5 B4/1 | C5/2 A4/1 | A4/1.5 G#4/0.5 A4/1 | B4/2 G#4/1 | E4/2 A4/1 | " +
      "C5/2 D5/1 | E5/1.5 F5/0.5 E5/1 | D5/2 B4/1 | G4/1.5 A4/0.5 B4/1 | C5/1.5 B4/0.5 A4/1 | G#4/1.5 F#4/0.5 G#4/1 | A4/3 | A4/2 r/1",
  },
  {
    id: "rising-sun",
    title: "House of the Rising Sun",
    by: "Traditional American folk song",
    sig: "6/8",
    bpm: 72,
    key: "Am",
    level: 2,
    chords: "Am | C | D | F | Am | C | E | E | Am | C | D | F | Am | E | Am | E",
    rhythmOnly: true,
  },
  {
    id: "blues-in-e",
    title: "Twelve-Bar Blues in E",
    by: "FretFox practice piece",
    sig: "4/4",
    bpm: 92,
    key: "E",
    level: 2,
    chords: "E7 | E7 | E7 | E7 | A7 | A7 | E7 | E7 | B7 | A7 | E7 | B7",
    rhythmOnly: true,
  },
  {
    id: "three-chord-campfire",
    title: "Campfire Changes (G, C, D)",
    by: "FretFox practice piece",
    sig: "4/4",
    bpm: 80,
    key: "G",
    level: 1,
    chords: "G | G | C | C | D | D | G | G | C | D | G | Em | C | D | G | G",
    rhythmOnly: true,
  },
  {
    id: "minor-swap",
    title: "Minor Swap (Am, Dm, E)",
    by: "FretFox practice piece",
    sig: "4/4",
    bpm: 76,
    key: "Am",
    level: 1,
    chords: "Am | Am | Dm | Dm | Am | Am | E | E | Am | Dm | Am | E | Am | Dm | E | Am",
    rhythmOnly: true,
  },
];

/** Scales and warm-ups: lead practice that isn't a song. */
export const EXERCISES = [
  {
    id: "spider-walk",
    title: "Spider Walk (1-2-3-4)",
    by: "Finger warm-up, frets 1 to 4 on every string",
    sig: "4/4",
    bpm: 72,
    key: "",
    level: 1,
    exercise: true,
    // Written as tab so every finger lands on its own fret.
    tab: [0, 1, 2, 3, 4, 5].flatMap(s => [1, 2, 3, 4].map(f => [s, f])),
  },
  {
    id: "c-major-scale",
    title: "C Major Scale (open position)",
    by: "Scale practice",
    sig: "4/4",
    bpm: 80,
    key: "C",
    level: 1,
    exercise: true,
    melody: "C3/1 D3/1 E3/1 F3/1 | G3/1 A3/1 B3/1 C4/1 | D4/1 E4/1 F4/1 G4/1 | A4/1 B4/1 C5/2 | B4/1 A4/1 G4/1 F4/1 | E4/1 D4/1 C4/1 B3/1 | A3/1 G3/1 F3/1 E3/1 | D3/1 C3/3",
  },
  {
    id: "e-minor-pentatonic",
    title: "E Minor Pentatonic (box 1)",
    by: "The scale most rock and blues solos come from",
    sig: "4/4",
    bpm: 84,
    key: "Em",
    level: 2,
    exercise: true,
    tab: [[0, 0], [0, 3], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2], [4, 0], [4, 3], [5, 0], [5, 3], [5, 0], [4, 3], [4, 0], [3, 2], [3, 0], [2, 2], [2, 0], [1, 2], [1, 0], [0, 3], [0, 0], [0, 0]],
  },
  {
    id: "a-minor-pentatonic",
    title: "A Minor Pentatonic (5th position)",
    by: "The famous box shape, index finger on fret 5",
    sig: "4/4",
    bpm: 84,
    key: "Am",
    level: 3,
    exercise: true,
    tab: [[0, 5], [0, 8], [1, 5], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [4, 5], [4, 8], [5, 5], [5, 8], [5, 5], [4, 8], [4, 5], [3, 7], [3, 5], [2, 7], [2, 5], [1, 7], [1, 5], [0, 8], [0, 5], [0, 5]],
  },
];

export const ALL_BUILT_IN = [...SONGS, ...EXERCISES];
export const builtInById = new Map(ALL_BUILT_IN.map(s => [s.id, s]));

/** Where to find more free (public domain) music to import. */
export const FREE_SOURCES = [
  { name: "Mutopia Project", href: "https://www.mutopiaproject.org/", what: "Public-domain classical and folk scores with free MIDI downloads." },
  { name: "IMSLP", href: "https://imslp.org/", what: "The largest public-domain sheet music library. Many scores have MIDI or MusicXML." },
  { name: "MuseScore (public domain filter)", href: "https://musescore.com/sheetmusic?license=to_share%2Cto_modify%2Cto_use_commercially", what: "Community scores; export as MusicXML or MIDI, then import here." },
  { name: "The Session", href: "https://thesession.org/", what: "Thousands of traditional folk tunes, many with MIDI." },
];
