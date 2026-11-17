// The sports and races PaceFox trains for. Each event says what racing it
// is like, how long a plan for it usually runs, which key workouts matter
// most in each phase, and how big the long session and the week can grow
// for someone new, someone who trains regularly, and an experienced racer.

export const SPORTS = {
  run: { id: "run", name: "Run", verb: "Run", noun: "run", maxSpeed: 12 },
  ride: { id: "ride", name: "Ride", verb: "Ride", noun: "ride", maxSpeed: 30 },
  row: { id: "row", name: "Row", verb: "Row", noun: "row", maxSpeed: 8 },
};
export const SPORT_IDS = Object.keys(SPORTS);

export const LEVELS = [
  { id: "new", name: "Just starting", detail: "New to the sport or coming back after a long break" },
  { id: "regular", name: "Train regularly", detail: "A few sessions most weeks, maybe a race or two" },
  { id: "experienced", name: "Experienced racer", detail: "Years of training and racing, ready for big weeks" },
];
export const LEVEL_IDS = LEVELS.map(l => l.id);

// Minutes a week someone at each level usually starts from.
export const START_MINUTES = {
  run: { new: 75, regular: 180, experienced: 300 },
  ride: { new: 120, regular: 300, experienced: 480 },
  row: { new: 90, regular: 210, experienced: 360 },
};

const cap = (n, r, e) => ({ new: n, regular: r, experienced: e });

export const EVENTS = [
  // Running
  {
    id: "run-mile", sport: "run", name: "Mile", group: "Track", distanceM: 1609.344,
    blurb: "Four laps of the track, about as fast as you can hold. Speed and the ability to suffer for the last 400 m decide it.",
    weeks: { min: 6, typical: 10 },
    focus: { base: ["fartlek", "hills"], build: ["vo2", "speed"], peak: ["speed", "racepace"] },
    longCap: cap(50, 70, 90), weekCap: cap(150, 260, 420),
  },
  {
    id: "run-5k", sport: "run", name: "5K", group: "Road", distanceM: 5000,
    blurb: "3.1 miles. Most of it run just below your limit, so VO2 max intervals and threshold work carry the most weight.",
    weeks: { min: 6, typical: 10 },
    focus: { base: ["fartlek", "hills"], build: ["vo2", "threshold"], peak: ["racepace", "vo2"] },
    longCap: cap(60, 80, 100), weekCap: cap(160, 280, 450),
  },
  {
    id: "run-10k", sport: "run", name: "10K", group: "Road", distanceM: 10000,
    blurb: "6.2 miles at about your one-hour pace or a little quicker. Threshold runs are the engine, with VO2 work for the top end.",
    weeks: { min: 8, typical: 12 },
    focus: { base: ["fartlek", "hills"], build: ["threshold", "vo2"], peak: ["racepace", "threshold"] },
    longCap: cap(75, 95, 110), weekCap: cap(180, 320, 500),
  },
  {
    id: "run-half", sport: "run", name: "Half marathon", group: "Road", distanceM: 21097.5,
    blurb: "13.1 miles run just under threshold. Long runs build the endurance, tempo and threshold runs build the speed you can hold.",
    weeks: { min: 10, typical: 14 },
    focus: { base: ["hills", "tempo"], build: ["threshold", "tempo"], peak: ["racepace", "threshold"] },
    longCap: cap(120, 135, 150), weekCap: cap(220, 380, 560), longRacePace: true,
  },
  {
    id: "run-marathon", sport: "run", name: "Marathon", group: "Road", distanceM: 42195,
    blurb: "26.2 miles. Mostly an endurance and fueling event: long runs, steady miles and marathon-pace work, with the race won or lost after mile 20.",
    weeks: { min: 14, typical: 18 },
    focus: { base: ["hills", "tempo"], build: ["tempo", "threshold"], peak: ["racepace", "threshold"] },
    longCap: cap(180, 195, 210), weekCap: cap(270, 450, 660), longRacePace: true, taperWeeks: 3,
  },
  {
    id: "run-trail", sport: "run", name: "Trail or ultra (50K)", group: "Trail", distanceM: 50000,
    blurb: "Hours on your feet over hills and rough ground. Time on feet, climbing strength, downhill legs and eating on the move matter more than speed.",
    weeks: { min: 14, typical: 20 },
    focus: { base: ["hills", "tempo"], build: ["hills", "tempo"], peak: ["hills", "racepace"] },
    longCap: cap(210, 270, 330), weekCap: cap(300, 500, 720), taperWeeks: 2,
  },
  {
    id: "run-fit", sport: "run", name: "Get fitter (no race)", group: "Fitness", distanceM: null,
    blurb: "An eight-week block that builds your running steadily and ends with a 5K time trial so you can see the progress.",
    weeks: { min: 8, typical: 8 }, noRace: true, testName: "5K time trial", testDistanceM: 5000,
    focus: { base: ["fartlek", "hills"], build: ["tempo", "vo2"], peak: ["threshold", "vo2"] },
    longCap: cap(60, 90, 110), weekCap: cap(160, 300, 450),
  },

  // Cycling
  {
    id: "ride-crit", sport: "ride", name: "Criterium", group: "Road", distanceM: null, raceMinutes: 50,
    blurb: "Fast laps of a short circuit with a corner every few seconds. Repeated sprints out of corners, then a bunch sprint at the end.",
    weeks: { min: 6, typical: 10 },
    focus: { base: ["tempo", "cadence"], build: ["vo2", "sprints"], peak: ["sprints", "racesim"] },
    longCap: cap(120, 180, 240), weekCap: cap(240, 420, 600),
  },
  {
    id: "ride-road", sport: "ride", name: "Road race", group: "Road", distanceM: 100000,
    blurb: "Long, tactical racing in a group. Endurance to stay with the pack, power for the climbs and attacks, and something left for the finish.",
    weeks: { min: 8, typical: 12 },
    focus: { base: ["tempo", "cadence"], build: ["threshold", "vo2"], peak: ["racesim", "vo2"] },
    longCap: cap(180, 240, 300), weekCap: cap(300, 540, 780),
  },
  {
    id: "ride-tt", sport: "ride", name: "Time trial (40K)", group: "Road", distanceM: 40000,
    blurb: "You against the clock, alone, at the highest power you can hold for about an hour. Threshold work and pacing win it.",
    weeks: { min: 8, typical: 10 },
    focus: { base: ["tempo", "cadence"], build: ["threshold", "tempo"], peak: ["racepace", "threshold"] },
    longCap: cap(150, 180, 240), weekCap: cap(240, 450, 660),
  },
  {
    id: "ride-fondo", sport: "ride", name: "Gran fondo or century", group: "Endurance", distanceM: 160934,
    blurb: "A long mass-start ride, 100 miles or so, often hilly. Endurance, steady climbing and eating and drinking every hour.",
    weeks: { min: 10, typical: 14 },
    focus: { base: ["tempo", "cadence"], build: ["tempo", "threshold"], peak: ["threshold", "tempo"] },
    longCap: cap(300, 360, 420), weekCap: cap(360, 600, 840),
  },
  {
    id: "ride-gravel", sport: "ride", name: "Gravel race", group: "Off-road", distanceM: 100000,
    blurb: "Long races on dirt and gravel roads. Steady power for hours, surges over rough climbs, and handling skills on loose ground.",
    weeks: { min: 10, typical: 14 },
    focus: { base: ["tempo", "cadence"], build: ["threshold", "vo2"], peak: ["racesim", "tempo"] },
    longCap: cap(240, 330, 420), weekCap: cap(330, 570, 810),
  },
  {
    id: "ride-mtb", sport: "ride", name: "Mountain bike (XC)", group: "Off-road", distanceM: null, raceMinutes: 90,
    blurb: "About 90 minutes of laps on a singletrack course. Punchy climbs well over threshold, little recovery, and technical descents.",
    weeks: { min: 8, typical: 12 },
    focus: { base: ["tempo", "cadence"], build: ["vo2", "threshold"], peak: ["racesim", "sprints"] },
    longCap: cap(150, 210, 270), weekCap: cap(270, 480, 690),
  },
  {
    id: "ride-fit", sport: "ride", name: "Get fitter (no race)", group: "Fitness", distanceM: null,
    blurb: "An eight-week block that builds your riding and ends with a 20-minute power test so you can set your zones.",
    weeks: { min: 8, typical: 8 }, noRace: true, testName: "20-minute test", testMinutes: 20,
    focus: { base: ["tempo", "cadence"], build: ["threshold", "tempo"], peak: ["vo2", "threshold"] },
    longCap: cap(120, 180, 240), weekCap: cap(240, 450, 660),
  },

  // Rowing
  {
    id: "row-2k", sport: "row", name: "2K erg test", group: "Indoor", distanceM: 2000,
    blurb: "Six to eight minutes flat out on the rowing machine. A fast start, a long hold in the middle and a sprint for the last 500 m.",
    weeks: { min: 6, typical: 10 },
    focus: { base: ["ut1", "starts"], build: ["threshold", "vo2"], peak: ["racepace", "vo2"] },
    longCap: cap(60, 80, 100), weekCap: cap(180, 330, 540),
  },
  {
    id: "row-6k", sport: "row", name: "6K erg test", group: "Indoor", distanceM: 6000,
    blurb: "About 20 to 25 minutes at just under threshold. Aerobic base and holding an even split decide it.",
    weeks: { min: 8, typical: 10 },
    focus: { base: ["ut1", "threshold"], build: ["threshold", "ut1"], peak: ["racepace", "threshold"] },
    longCap: cap(70, 90, 110), weekCap: cap(180, 360, 570),
  },
  {
    id: "row-head", sport: "row", name: "Head race (about 5K)", group: "On the water", distanceM: 5000,
    blurb: "Boats start one after another and race the clock over a long, winding course, usually 15 to 25 minutes. Steady power and a strong rhythm.",
    weeks: { min: 8, typical: 12 },
    focus: { base: ["ut1", "threshold"], build: ["threshold", "vo2"], peak: ["racepace", "threshold"] },
    longCap: cap(75, 100, 120), weekCap: cap(200, 380, 600),
  },
  {
    id: "row-sprint", sport: "row", name: "Sprint race (1000–2000 m)", group: "On the water", distanceM: 2000,
    blurb: "Side by side in lanes, three to seven minutes all out. Starts, a high stroke rate, and holding speed when it hurts.",
    weeks: { min: 6, typical: 10 },
    focus: { base: ["ut1", "starts"], build: ["vo2", "starts"], peak: ["racepace", "starts"] },
    longCap: cap(60, 80, 100), weekCap: cap(180, 330, 540),
  },
  {
    id: "row-fit", sport: "row", name: "Get fitter (no race)", group: "Fitness", distanceM: null,
    blurb: "An eight-week block on the rowing machine or the water that ends with a 2K test so you can set your splits.",
    weeks: { min: 8, typical: 8 }, noRace: true, testName: "2K test", testDistanceM: 2000,
    focus: { base: ["ut1", "starts"], build: ["threshold", "ut1"], peak: ["vo2", "threshold"] },
    longCap: cap(60, 80, 100), weekCap: cap(180, 330, 540),
  },
];

export const eventById = new Map(EVENTS.map(e => [e.id, e]));
export const eventsFor = sport => EVENTS.filter(e => e.sport === sport);
