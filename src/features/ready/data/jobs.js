// The jobs ReadyFox trains for, each with the fitness test it has to pass.
// Every number here comes from an official, public source listed under
// SOURCES (and on each test). Where a source gives a higher "elevated" or
// "recommended" score, it is kept as `aim`; otherwise only the minimum is
// shown, with a reminder to train well past it.
//
// Event kinds:
//   "reps"  more is better (push-ups, pull-ups…)
//   "time"  less is better, in seconds (runs, swims)
//   "hold"  more is better, in seconds (plank)
//   "lbs"   more is better, in pounds (deadlift)
// A Marine IST style "either/or" event lists `options`; any one passes.

export const SOURCES = {
  milpersman: {
    name: "MILPERSMAN 1220-410: Physical Screening Test for Special Programs (CH-77, 3 Dec 2021)",
    org: "U.S. Navy, MyNavy HR",
    url: "https://www.mynavyhr.navy.mil/Portals/55/Reference/MILPERSMAN/1000/1200Classification/1220-410.pdf",
  },
  navySeal: {
    name: "Navy SEAL career page: minimum and elevated PST",
    org: "U.S. Navy, navy.com",
    url: "https://www.navy.com/seals",
  },
  aft: {
    name: "Army Fitness Test (AFT): events, standards and score tables",
    org: "U.S. Army, army.mil",
    url: "https://www.army.mil/aft/",
  },
  aftTables: {
    name: "AFT score tables (approved 15 May 2025, effective 1 June 2025)",
    org: "U.S. Army, army.mil",
    url: "https://www.army.mil/e2/downloads/rv7/aft/AFT_Scoring_Scales_250601.pdf",
  },
  aftArticle: {
    name: "Army establishes new fitness test of record",
    org: "U.S. Army, army.mil",
    url: "https://www.army.mil/article/284799",
  },
  marines: {
    name: "Marine Corps requirements: Initial Strength Test",
    org: "U.S. Marine Corps, marines.com",
    url: "https://aem.marines.com/become/requirements",
  },
  marinesTests: {
    name: "Marine Corps fitness tests: IST, PFT and CFT",
    org: "U.S. Marine Corps, marines.com",
    url: "https://www.marines.com/ethos/articles/fitness-tests",
  },
  afpc: {
    name: "Retraining into AFSPECWAR: Initial Fitness Test standards",
    org: "U.S. Air Force, Air Force Personnel Center",
    url: "https://www.afpc.af.mil/portals/70/documents/AF%20SPECWAR/Retraining%20v2%20Desktop.pdf",
  },
  afPj: {
    name: "Pararescue brochure: Initial Fitness Test events",
    org: "U.S. Air Force, Air Force Accessions Center",
    url: "https://www.afaccessionscenter.af.mil/Portals/78/EA%2023-048%20PJ%20Brochure%20Digital.pdf",
  },
  afPrep: {
    name: "Special Warfare pre-accession training manual",
    org: "U.S. Air Force, Special Warfare Training Wing",
    url: "https://www.specialwarfaretw.af.mil/Portals/69/Pre-accessions%20manual_1.pdf",
  },
};

// How each event is done, from the source that defines it.
export const EVENTS = {
  swim500y: {
    name: "500-yard swim",
    short: "Swim",
    kind: "time",
    sport: "swim",
    how: "Swim 500 yards (450 m) for time. Side-stroke or breaststroke only: your hands stay under the water, no overhand recovery. No fins, wetsuit or flotation; goggles are optional. You may tread water or float to rest, but standing or holding the wall ends the swim.",
  },
  swim500yAirr: {
    name: "500-yard swim",
    short: "Swim",
    kind: "time",
    sport: "swim",
    how: "Swim 500 yards (450 m) for time. Aircrew Rescue Swimmer candidates may use freestyle (American crawl), side-stroke or breaststroke. No fins, wetsuit or flotation; goggles are optional.",
  },
  navyPushups: {
    name: "Push-ups in 2 minutes",
    short: "Push-ups",
    kind: "reps",
    sport: "push",
    how: "As many as you can in 2 minutes. Body straight from head to heels; go down until your upper arms are parallel to the deck (elbows at right angles), then all the way up. Rest only in the up position.",
  },
  navyCurlups: {
    name: "Curl-ups in 2 minutes",
    short: "Curl-ups",
    kind: "reps",
    sport: "core",
    how: "As many as you can in 2 minutes with a partner holding your feet. Hands stay on your chest or shoulders; curl up until your elbows touch your thighs no more than 3 inches below the knees, then back down until your shoulder blades touch. Resting down for more than 5 seconds ends the event.",
  },
  navyPullups: {
    name: "Pull-ups (no time limit)",
    short: "Pull-ups",
    kind: "reps",
    sport: "pull",
    how: "Start from a dead hang, palms either way. Pull until your chin is even with or above the bar, then lower all the way. No kipping or swinging. Letting go or touching anything but the bar ends the event.",
  },
  run15: {
    name: "1.5-mile run",
    short: "Run",
    kind: "time",
    sport: "run",
    how: "Run 1.5 miles for time on a flat, firm course in running shoes, t-shirt and shorts. Walking or stopping ends the event (except to retie a shoe).",
  },

  // Army Fitness Test
  mdl: {
    name: "3-rep max deadlift",
    short: "Deadlift",
    kind: "lbs",
    sport: "strength",
    aft: "mdl",
    how: "Deadlift the heaviest weight you can for three controlled reps with a 60-lb hex bar and plates. Lower the bar to the ground each rep. A failed set gets one retry at a lower weight.",
  },
  hrp: {
    name: "Hand-release push-ups in 2 minutes",
    short: "HR push-ups",
    kind: "reps",
    sport: "push",
    aft: "hrp",
    how: "As many as you can in 2 minutes. Lower until your chest, hips and thighs touch the ground together, move your hands out into a T and back, then push up to a straight plank.",
  },
  sdc: {
    name: "Sprint-drag-carry",
    short: "Sprint-drag-carry",
    kind: "time",
    sport: "sprint",
    aft: "sdc",
    how: "Five 50-meter shuttles for time: sprint 25 m and back; drag a 90-lb sled 25 m and back; lateral shuffle 25 m and back; carry two 40-lb kettlebells 25 m and back; sprint 25 m and back.",
  },
  plk: {
    name: "Plank",
    short: "Plank",
    kind: "hold",
    sport: "core",
    aft: "plk",
    how: "Hold a straight forearm plank as long as you can. Touching the ground with anything but feet and forearms or fists, or losing a straight line after one warning, ends it.",
  },
  run2: {
    name: "2-mile run",
    short: "2-mile run",
    kind: "time",
    sport: "run",
    aft: "2mr",
    how: "Run two miles for time on a measured, generally flat course (track, road or sidewalk).",
  },

  // Marine Corps Initial Strength Test
  istUpper: {
    name: "Pull-ups or push-ups",
    short: "Pull-ups / push-ups",
    kind: "reps",
    sport: "pull",
    options: [
      { id: "pullups", name: "Pull-ups" },
      { id: "pushups", name: "Push-ups (2 min)" },
    ],
    how: "Your choice of pull-ups or push-ups. Push-ups have a 2-minute limit.",
  },
  istPlank: {
    name: "Plank",
    short: "Plank",
    kind: "hold",
    sport: "core",
    how: "Hold a forearm plank with your body straight for at least 40 seconds.",
  },
  run15Ist: {
    name: "1.5-mile run",
    short: "Run",
    kind: "time",
    sport: "run",
    how: "Run 1.5 miles for time.",
  },

  // Air Force Special Warfare Initial Fitness Test
  afPullups: {
    name: "Pull-ups in 1 minute",
    short: "Pull-ups",
    kind: "reps",
    sport: "pull",
    how: "As many strict pull-ups as you can in the time allowed, to failure or time.",
  },
  afSitups: {
    name: "Sit-ups in 2 minutes",
    short: "Sit-ups",
    kind: "reps",
    sport: "core",
    how: "As many sit-ups as you can in 2 minutes, to failure or time.",
  },
  afPushups: {
    name: "Push-ups in 2 minutes",
    short: "Push-ups",
    kind: "reps",
    sport: "push",
    how: "As many push-ups as you can in 2 minutes, to failure or time.",
  },
  run15Af: {
    name: "1.5-mile run",
    short: "Run",
    kind: "time",
    sport: "run",
    how: "Run 1.5 miles for time.",
  },
  run3Af: {
    name: "3-mile run",
    short: "3-mile run",
    kind: "time",
    sport: "run",
    how: "Run 3 miles for time.",
  },
  afUnderwater: {
    name: "25-meter underwater swims (×2)",
    short: "Underwater 25 m",
    kind: "pass",
    sport: "swim",
    how: "Swim 25 meters underwater on one breath, twice, each in its own 3-minute cycle. Pass or fail.",
  },
  swim500m: {
    name: "500-meter swim",
    short: "Swim",
    kind: "time",
    sport: "swim",
    how: "Swim 500 meters for time: freestyle, breaststroke and/or side-stroke.",
  },
  swim1500m: {
    name: "1,500-meter swim",
    short: "1,500 m swim",
    kind: "time",
    sport: "swim",
    how: "Swim 1,500 meters for time.",
  },
};

const t = (m, s = 0) => m * 60 + s;

// Rest between events, in test order. `after` is the event the rest follows.
const NAVY_ORDER = [
  { event: "swim", rest: 600 },
  { event: "pushups", rest: 120 },
  { event: "curlups", rest: 120 },
  { event: "pullups", rest: 600 },
  { event: "run", rest: 0 },
];

/** A Navy PST with its minimums (and the elevated scores, where official). */
function navyPst(min, aim, swimEvent = "swim500y", note = null) {
  const ev = { swim: swimEvent, pushups: "navyPushups", curlups: "navyCurlups", pullups: "navyPullups", run: "run15" };
  return {
    id: "pst",
    name: "Navy Physical Screening Test (PST)",
    note,
    order: NAVY_ORDER.map(o => ({ ...o, event: ev[o.event] })),
    events: Object.entries(ev).map(([k, id]) => ({ id, min: min[k], aim: aim?.[k] ?? null })),
    sources: aim ? ["milpersman", "navySeal"] : ["milpersman"],
  };
}

const AFT = (standard) => ({
  id: `aft-${standard}`,
  name: "Army Fitness Test (AFT)",
  scoring: "aft",
  standard,
  passEvent: 60,
  passTotal: standard === "combat" ? 350 : 300,
  note:
    standard === "combat"
      ? "Combat standard: the same scores for everyone (sex-neutral), adjusted by age. At least 60 points in every event and 350 in total."
      : "General standard: scored by sex and age. At least 60 points in every event and 300 in total.",
  order: [
    { event: "mdl", rest: 0 },
    { event: "hrp", rest: 0 },
    { event: "sdc", rest: 0 },
    { event: "plk", rest: 0 },
    { event: "run2", rest: 0 },
  ],
  events: ["mdl", "hrp", "sdc", "plk", "run2"].map(id => ({ id })),
  sources: ["aft", "aftTables", "aftArticle"],
});

const AF_IFT = ({ pull, sit, push, run, runAim, runEvent = "run15Af", swim, swimAim, swimEvent = "swim500m", underwater = true, pullAim, sitAim, pushAim }) => {
  const events = [
    { id: "afPullups", min: pull, aim: pullAim },
    { id: "afSitups", min: sit, aim: sitAim },
    { id: "afPushups", min: push, aim: pushAim },
    { id: runEvent, min: run, aim: runAim },
  ];
  if (underwater) events.push({ id: "afUnderwater", min: null, aim: null });
  if (swim) events.push({ id: swimEvent, min: swim, aim: swimAim });
  return {
    id: "ift",
    name: "Air Force Special Warfare Initial Fitness Test (IFT)",
    note: "Every event in one session; failing any event fails the test. The higher scores are the Air Force's recommended numbers: the average first IFT of people who went on to graduate.",
    order: [
      { event: "afPullups", rest: 120 },
      { event: "afSitups", rest: 120 },
      { event: "afPushups", rest: 600 },
      { event: runEvent, rest: swim ? 1800 : 0 },
      ...(underwater ? [{ event: "afUnderwater", rest: 0 }] : []),
      ...(swim ? [{ event: swimEvent, rest: 0 }] : []),
    ],
    events,
    sources: ["afpc", "afPj", "afPrep"],
  };
};

const IST = {
  id: "ist",
  name: "Marine Corps Initial Strength Test (IST)",
  note: "Recruits take the IST before boot camp and again on arrival. Marines say to show up well above the minimums.",
  bySex: true,
  order: [
    { event: "istUpper", rest: 0 },
    { event: "istPlank", rest: 0 },
    { event: "run15Ist", rest: 0 },
  ],
  events: [
    { id: "istUpper", min: { m: { pullups: 3, pushups: 34 }, f: { pullups: 1, pushups: 15 } } },
    { id: "istPlank", min: { m: 40, f: 40 } },
    { id: "run15Ist", min: { m: t(13, 30), f: t(15) } },
  ],
  sources: ["marines", "marinesTests"],
};

export const BRANCHES = [
  { id: "navy", name: "Navy" },
  { id: "army", name: "Army" },
  { id: "marines", name: "Marine Corps" },
  { id: "airforce", name: "Air Force" },
];

export const JOBS = [
  {
    id: "navy-seal",
    branch: "navy",
    name: "Navy SEAL",
    code: "SO",
    blurb: "Sea, air and land special operations. The hardest swim, pull-up and run minimums in the Navy PST.",
    selective: true,
    test: navyPst(
      { swim: t(12, 30), pushups: 50, curlups: 50, pullups: 10, run: t(10, 30) },
      { swim: t(9, 30), pushups: 75, curlups: 75, pullups: 15, run: t(9, 30) },
      "swim500y",
      "The higher scores are the Navy's Elevated PST (EPST). Meeting them on your 14-day shipping PST may qualify you for an enlistment bonus.",
    ),
    extra: ["Long ocean swims with fins, soft-sand runs and log PT come in training, so build swimming and running volume, not just test scores."],
  },
  {
    id: "navy-swcc",
    branch: "navy",
    name: "Special Warfare Combatant-craft Crewman",
    code: "SB",
    blurb: "Runs high-speed boats for special operations missions.",
    selective: true,
    test: navyPst({ swim: t(13), pushups: 50, curlups: 50, pullups: 6, run: t(12) }),
  },
  {
    id: "navy-eod",
    branch: "navy",
    name: "Explosive Ordnance Disposal",
    code: "EOD",
    blurb: "Finds and disarms explosives on land and underwater; also trains as a diver and parachutist.",
    selective: true,
    test: {
      ...navyPst({ swim: t(12, 30), pushups: 50, curlups: 50, pullups: 6, run: t(12, 30) }),
      combined: { events: ["swim500y", "run15"], max: t(21) },
      note: "Your swim and run times added together must be 21:00 or less, and neither one can be slower than 12:30.",
    },
  },
  {
    id: "navy-diver",
    branch: "navy",
    name: "Navy Diver (second class)",
    code: "ND",
    blurb: "Salvage, repair and recovery work underwater.",
    selective: true,
    test: navyPst({ swim: t(12), pushups: 50, curlups: 50, pullups: 6, run: t(11, 30) }),
  },
  {
    id: "navy-airr",
    branch: "navy",
    name: "Aircrew Rescue Swimmer",
    code: "AIRR",
    blurb: "Jumps from helicopters to rescue people at sea.",
    selective: true,
    test: navyPst({ swim: t(12), pushups: 42, curlups: 50, pullups: 4, run: t(12) }, null, "swim500yAirr"),
  },
  {
    id: "army-combat",
    branch: "army",
    name: "Army combat jobs",
    code: "11/12/13F/18/19",
    blurb: "Infantry (11), combat engineers (12A/12B), fire support (13A/13F), Special Forces (18) and armor and cavalry (19). They take the AFT at the combat standard.",
    selective: false,
    test: AFT("combat"),
    extra: [
      "The Army lists these combat jobs: 11A, 11B, 11C, 11Z, 12A, 12B, 13A, 13F, 18A, 180A, 18B, 18C, 18D, 18E, 18F, 18Z, 19A, 19C, 19D, 19K and 19Z.",
      "Special Forces and Ranger selection go well past the AFT, with long ruck marches and land navigation. Build rucking into your week once the AFT is comfortable.",
    ],
  },
  {
    id: "army-general",
    branch: "army",
    name: "Army: all other jobs",
    code: "All MOS",
    blurb: "Every other Army job takes the AFT at the general standard, scored by sex and age.",
    selective: false,
    test: AFT("general"),
  },
  {
    id: "marines-recruit",
    branch: "marines",
    name: "Marine Corps recruit",
    code: "IST",
    blurb: "Every future Marine passes the Initial Strength Test before boot camp, then the PFT and CFT to graduate.",
    selective: false,
    test: IST,
    extra: [
      "To graduate boot camp you also pass the PFT (pull-ups or push-ups, plank and a 3-mile run) and the CFT (880-yard sprint, 30-lb ammo can lifts and a maneuver-under-fire course).",
    ],
  },
  {
    id: "af-specwar",
    branch: "airforce",
    name: "Special Warfare: PJ, CCT, SR, TACP",
    code: "1Z1–1Z4",
    blurb: "Pararescue, Combat Control, Special Reconnaissance and Tactical Air Control Party.",
    selective: true,
    test: AF_IFT({
      pull: 8, pullAim: 13,
      sit: 50, sitAim: 70,
      push: 40, pushAim: 70,
      run: t(10, 20), runAim: t(9, 50),
      swim: t(12, 30), swimAim: t(11),
    }),
    extra: ["The Air Force's pre-accession guide also asks you to be able to ruck for an hour with 30 pounds before you ship."],
  },
  {
    id: "af-sere",
    branch: "airforce",
    name: "SERE Specialist",
    code: "1T0",
    blurb: "Teaches survival, evasion, resistance and escape.",
    selective: true,
    test: AF_IFT({
      pull: 8, pullAim: 13,
      sit: 48, sitAim: 70,
      push: 40, pushAim: 70,
      run: t(11), runAim: t(10),
      underwater: false,
    }),
  },
  {
    id: "af-sto",
    branch: "airforce",
    name: "Special Tactics or Combat Rescue Officer",
    code: "19ZXA/C",
    blurb: "Officers who lead Special Tactics and Combat Rescue teams.",
    selective: true,
    test: AF_IFT({
      pull: 12, pullAim: 16,
      sit: 75, sitAim: 90,
      push: 64, pushAim: 80,
      run: t(22), runAim: t(20), runEvent: "run3Af",
      swim: t(32), swimAim: t(28), swimEvent: "swim1500m",
    }),
  },
  {
    id: "af-tacpo",
    branch: "airforce",
    name: "Tactical Air Control Party Officer",
    code: "19ZXB",
    blurb: "Officers who lead TACP teams alongside ground forces.",
    selective: true,
    test: AF_IFT({
      pull: 12, pullAim: 16,
      sit: 75, sitAim: 90,
      push: 64, pushAim: 80,
      run: t(22), runAim: t(20), runEvent: "run3Af",
      swim: t(12, 30), swimAim: t(11),
      underwater: false,
    }),
  },
];

export const jobById = new Map(JOBS.map(j => [j.id, j]));
