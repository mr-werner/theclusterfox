// GrowFox houseplants: what grows inside, on a windowsill or under a light.
// Plain data, testable in Node. plants.js parses the care lines and adds
// these to the full library.
//
// Sources for light, water, humidity and care: university extension
// houseplant guides (Missouri, Clemson, Penn State, UF/IFAS, RHS) and the
// ASPCA toxic and non-toxic plant lists for pet safety.
//
// Every houseplant:
//   id, name, latin, type (see INDOOR_TYPES), color (for its picture)
//   setting  "indoor"
//   light    the indoor light it takes, best first: any of "bright",
//            "medium", "low" (see INDOOR_LIGHT in model/indoor.js)
//   water    1 let it dry out, 2 water when the top inch is dry, 3 keep moist
//   humidity 1 likes dry air, 2 average home air, 3 wants humid air
//   base     1..5 how hard it is to keep alive in a typical home
//   petSafe  true when the ASPCA lists it as non-toxic to cats and dogs
//   care     the same "kind freq[@period][: note]" lines as outdoor plants.
//            Indoors, "growing" means spring and summer and "winter" the
//            darker months, counted for your hemisphere.
//   size, soil, tip, tags, days (edible ones: days to first harvest)

export const INDOOR_TYPES = [
  { id: "foliage", name: "Leafy houseplants", one: "Leafy houseplant" },
  { id: "trailing", name: "Trailing & hanging", one: "Trailing houseplant" },
  { id: "flowering", name: "Flowering houseplants", one: "Flowering houseplant" },
  { id: "succulent", name: "Succulents & cacti", one: "Succulent" },
  { id: "kitchen", name: "Kitchen garden", one: "Indoor edible" },
];

const WATER_DRY = "water biweekly@growing: Soak, then let the soil dry all the way down before the next drink";
const WATER_DRY_WINTER = "water monthly@winter: Barely any water while light is low";
const FEED_LIGHT = "feed monthly@growing: Half-strength houseplant feed; skip it in winter";
const DUST = "check monthly@all: Wipe dust off the leaves and look under them for mealybugs, mites and scale";
const REPOT = "repot yearly@spring: Move up one pot size (1–2 in wider) only when roots circle the pot";

export const INDOOR = [
  // ── Leafy houseplants ──────────────────────────────────────
  {
    id: "snakeplant", name: "Snake plant", latin: "Dracaena trifasciata", type: "foliage", color: "#4f7a3a",
    light: ["medium", "low", "bright"], water: 1, humidity: 1, base: 1, petSafe: false,
    size: "1–4 ft tall", soil: "Cactus mix or gritty potting mix",
    care: [WATER_DRY, WATER_DRY_WINTER, "feed monthly@growing: A light feed two or three times a summer is plenty", DUST],
    tip: "Overwatering is the only common way to kill one. When in doubt, wait another week.",
    tags: ["toxic", "drought"],
  },
  {
    id: "zzplant", name: "ZZ plant", latin: "Zamioculcas zamiifolia", type: "foliage", color: "#2f6b3a",
    light: ["medium", "low", "bright"], water: 1, humidity: 1, base: 1, petSafe: false,
    size: "2–3 ft", soil: "Well-drained potting mix with extra perlite",
    care: [WATER_DRY, WATER_DRY_WINTER, FEED_LIGHT, DUST],
    tip: "Stores water in its potato-like rhizomes, so it shrugs off a forgotten month.",
    tags: ["toxic", "drought"],
  },
  {
    id: "castiron", name: "Cast iron plant", latin: "Aspidistra elatior", type: "foliage", color: "#3d6a3a",
    light: ["low", "medium"], water: 2, humidity: 2, base: 1, petSafe: true,
    size: "2–3 ft", soil: "Ordinary potting mix",
    care: ["water weekly@growing: When the top inch is dry", "water biweekly@winter: Less in winter", FEED_LIGHT, DUST],
    tip: "The toughest pet-safe plant for a dim hallway or a north room.",
    tags: ["petsafe", "shade"],
  },
  {
    id: "monstera", name: "Monstera", latin: "Monstera deliciosa", type: "foliage", color: "#2e7a45",
    light: ["medium", "bright"], water: 2, humidity: 2, base: 2, petSafe: false,
    size: "3–8 ft indoors", soil: "Chunky aroid mix: potting soil, bark and perlite",
    care: ["water weekly@growing: When the top 2 in are dry", "water biweekly@winter: Less in winter", "feed monthly@growing: Balanced houseplant feed", "trim yearly@spring: Give it a moss pole and tuck aerial roots onto it", DUST, REPOT],
    tip: "The splits and holes only come with enough light. Small, solid leaves mean move it closer to a window.",
    tags: ["toxic"],
  },
  {
    id: "rubberplant", name: "Rubber plant", latin: "Ficus elastica", type: "foliage", color: "#2c4a32",
    light: ["bright", "medium"], water: 2, humidity: 2, base: 2, petSafe: false,
    size: "3–10 ft indoors", soil: "Well-drained potting mix",
    care: ["water weekly@growing: When the top 2 in are dry", "water biweekly@winter: Less in winter", FEED_LIGHT, "trim yearly@spring: Cut the top to make it branch; the sap is sticky and irritating", DUST, REPOT],
    tip: "Hates being moved. Pick its spot and leave it there; dropping leaves after a move is normal.",
    tags: ["toxic"],
  },
  {
    id: "fiddleleaf", name: "Fiddle-leaf fig", latin: "Ficus lyrata", type: "foliage", color: "#3a6a2e",
    light: ["bright"], water: 2, humidity: 2, base: 4, petSafe: false,
    size: "4–10 ft indoors", soil: "Well-drained potting mix",
    care: ["water weekly@growing: When the top 2 in are dry; water until it runs out the bottom", "water biweekly@winter: Less in winter", "feed monthly@growing: Balanced feed", "check weekly@all: Turn it a quarter turn so it grows straight, and dust the big leaves", REPOT],
    tip: "Needs the brightest window you have and no drafts. Brown spots in the middle of leaves usually mean too much water.",
    tags: ["toxic"],
  },
  {
    id: "chineseevergreen", name: "Chinese evergreen", latin: "Aglaonema", type: "foliage", color: "#6f9a5a",
    light: ["low", "medium"], water: 2, humidity: 2, base: 1, petSafe: false,
    size: "1–3 ft", soil: "Ordinary potting mix",
    care: ["water weekly@growing: When the top inch is dry", "water biweekly@winter: Less in winter", FEED_LIGHT, DUST],
    tip: "The pink and red varieties need a bit more light than the plain green ones.",
    tags: ["toxic", "shade"],
  },
  {
    id: "parlorpalm", name: "Parlor palm", latin: "Chamaedorea elegans", type: "foliage", color: "#4f8a42",
    light: ["medium", "low"], water: 2, humidity: 2, base: 2, petSafe: true,
    size: "2–4 ft", soil: "Peaty potting mix",
    care: ["water weekly@growing: Keep lightly moist", "water biweekly@winter: Less in winter", FEED_LIGHT, DUST],
    tip: "A pet-safe palm that copes with low light. Brown tips usually mean dry air or salty tap water.",
    tags: ["petsafe"],
  },
  {
    id: "bostonfern", name: "Boston fern", latin: "Nephrolepis exaltata", type: "foliage", color: "#5a9a3a",
    light: ["medium"], water: 3, humidity: 3, base: 3, petSafe: true,
    size: "1–3 ft", soil: "Peaty, moisture-holding mix",
    care: ["water every2@growing: Never let it dry out", "water weekly@winter: Keep lightly moist", "mist every2@all: Or stand it on a pebble tray; dry air browns the fronds", FEED_LIGHT],
    tip: "A steamy bathroom with a window is its happy place.",
    tags: ["petsafe"],
  },
  {
    id: "calathea", name: "Calathea (prayer plant)", latin: "Goeppertia", type: "foliage", color: "#3f6e4c",
    light: ["medium", "low"], water: 3, humidity: 3, base: 4, petSafe: true,
    size: "1–2 ft", soil: "Peaty, well-drained mix",
    care: ["water weekly@growing: Keep evenly moist with filtered or rain water", "water weekly@winter: A little less", "mist every2@all: Needs humid air; a humidifier works best", FEED_LIGHT],
    tip: "Folds its leaves up at night. Crispy edges mean dry air or hard tap water.",
    tags: ["petsafe"],
  },
  {
    id: "dracaena", name: "Dracaena (corn plant)", latin: "Dracaena fragrans", type: "foliage", color: "#5c8a34",
    light: ["medium", "low"], water: 2, humidity: 2, base: 2, petSafe: false,
    size: "3–6 ft", soil: "Well-drained potting mix",
    care: ["water weekly@growing: When the top 2 in are dry", "water biweekly@winter: Less in winter", FEED_LIGHT, DUST],
    tip: "Sensitive to fluoride in tap water: brown leaf tips are the sign. Rain or filtered water helps.",
    tags: ["toxic"],
  },
  {
    id: "birdofparadise", name: "Bird of paradise", latin: "Strelitzia nicolai / reginae", type: "foliage", color: "#3d7a50",
    light: ["bright"], water: 2, humidity: 2, base: 3, petSafe: false,
    size: "4–8 ft indoors", soil: "Rich, well-drained mix",
    care: ["water weekly@growing: When the top 2 in are dry", "water biweekly@winter: Less in winter", "feed biweekly@growing: Balanced feed", DUST, REPOT],
    tip: "Torn leaves are natural: in the wild the splits let wind through.",
    tags: ["toxic"],
  },
  {
    id: "pilea", name: "Chinese money plant", latin: "Pilea peperomioides", type: "foliage", color: "#5aa040",
    light: ["bright", "medium"], water: 2, humidity: 2, base: 2, petSafe: true,
    size: "8–12 in", soil: "Well-drained potting mix",
    care: ["water weekly@growing: When the top inch is dry", "water biweekly@winter: Less in winter", FEED_LIGHT, "check weekly@all: Turn it so it doesn't lean, and pot up the babies it sends up"],
    tip: "Makes pups at its base: pot them up and give them away.",
    tags: ["petsafe", "container"],
  },

  // ── Trailing & hanging ─────────────────────────────────────
  {
    id: "pothos", name: "Pothos", latin: "Epipremnum aureum", type: "trailing", color: "#6aa83a",
    light: ["medium", "low", "bright"], water: 2, humidity: 2, base: 1, petSafe: false,
    size: "Vines 6–10 ft", soil: "Ordinary potting mix",
    care: ["water weekly@growing: When the top inch is dry; it droops when thirsty and perks up fast", "water biweekly@winter: Less in winter", FEED_LIGHT, "trim yearly@spring: Snip long vines to keep it bushy; the cuttings root in a glass of water"],
    tip: "The easiest houseplant there is. Variegated kinds fade to green in low light.",
    tags: ["toxic"],
  },
  {
    id: "heartleaf", name: "Heartleaf philodendron", latin: "Philodendron hederaceum", type: "trailing", color: "#4c9a3a",
    light: ["medium", "low"], water: 2, humidity: 2, base: 1, petSafe: false,
    size: "Vines 4–8 ft", soil: "Ordinary potting mix",
    care: ["water weekly@growing: When the top inch is dry", "water biweekly@winter: Less in winter", FEED_LIGHT, "trim yearly@spring: Pinch back long vines"],
    tip: "Long gaps between leaves mean it wants more light.",
    tags: ["toxic"],
  },
  {
    id: "spiderplant", name: "Spider plant", latin: "Chlorophytum comosum", type: "trailing", color: "#8ab84a",
    light: ["medium", "bright", "low"], water: 2, humidity: 2, base: 1, petSafe: true,
    size: "1–2 ft, with hanging babies", soil: "Ordinary potting mix",
    care: ["water weekly@growing: When the top inch is dry", "water biweekly@winter: Less in winter", FEED_LIGHT, "trim yearly@spring: Snip off the babies and root them in water or soil"],
    tip: "Pet safe and nearly unkillable, though cats love to chew it.",
    tags: ["petsafe"],
  },
  {
    id: "englishivy", name: "English ivy", latin: "Hedera helix", type: "trailing", color: "#2f5a2a",
    light: ["medium", "bright"], water: 2, humidity: 2, base: 3, petSafe: false,
    size: "Vines 3–6 ft indoors", soil: "Ordinary potting mix",
    care: ["water weekly@growing: Keep lightly moist", "water biweekly@winter: Less in winter", FEED_LIGHT, "check biweekly@all: Spider mites love it in dry winter air; rinse the leaves in the shower"],
    tip: "Likes it cool. A bright, unheated room in winter suits it best.",
    tags: ["toxic"],
  },
  {
    id: "stringofpearls", name: "String of pearls", latin: "Curio rowleyanus", type: "trailing", color: "#7ab05a",
    light: ["bright", "medium"], water: 1, humidity: 1, base: 3, petSafe: false,
    size: "Strands 2–3 ft", soil: "Cactus mix in a shallow pot",
    care: [WATER_DRY, WATER_DRY_WINTER, "feed monthly@growing: Quarter-strength feed"],
    tip: "Water when the pearls look a little wrinkled, never on a schedule alone.",
    tags: ["toxic", "drought"],
  },

  // ── Flowering ──────────────────────────────────────────────
  {
    id: "peacelily", name: "Peace lily", latin: "Spathiphyllum", type: "flowering", color: "#f2f2ea",
    light: ["medium", "low"], water: 3, humidity: 2, base: 1, petSafe: false,
    size: "1–3 ft", soil: "Moisture-holding potting mix",
    care: ["water weekly@growing: It wilts dramatically when dry and bounces back within hours of a drink", "water weekly@winter: Slightly less", FEED_LIGHT, DUST],
    tip: "More light means more white blooms. Not a true lily, but still toxic to pets.",
    tags: ["toxic", "shade"],
  },
  {
    id: "africanviolet", name: "African violet", latin: "Streptocarpus ionanthus", type: "flowering", color: "#8a5ac8",
    light: ["medium", "bright"], water: 2, humidity: 2, base: 3, petSafe: true,
    size: "6–9 in", soil: "African violet mix",
    care: ["water weekly@all: From the bottom with room-temperature water; cold water spots the leaves", "feed biweekly@all: African violet feed keeps it blooming", "deadhead weekly@all: Pinch off spent flowers"],
    tip: "Blooms nearly all year on an east windowsill or under a small LED.",
    tags: ["petsafe", "container"],
  },
  {
    id: "orchid", name: "Moth orchid", latin: "Phalaenopsis", type: "flowering", color: "#d86ab0",
    light: ["medium", "bright"], water: 2, humidity: 3, base: 3, petSafe: true,
    size: "1–2 ft spikes", soil: "Orchid bark, never soil",
    care: ["water weekly@all: Soak the bark, then drain fully; silvery roots mean it's thirsty, green means it's fine", "feed biweekly@growing: Weak orchid feed", "trim yearly@spring: After blooms fall, cut the spike above a node for a second flush", "repot yearly@spring: Fresh bark every 1–2 years, after flowering"],
    tip: "A 10°F (5°C) drop at night in fall is what sets off new flower spikes.",
    tags: ["petsafe"],
  },
  {
    id: "anthurium", name: "Anthurium", latin: "Anthurium andraeanum", type: "flowering", color: "#d32f3a",
    light: ["bright", "medium"], water: 2, humidity: 3, base: 3, petSafe: false,
    size: "1–2 ft", soil: "Chunky orchid-and-peat mix",
    care: ["water weekly@growing: When the top inch is dry", "water biweekly@winter: Less in winter", "mist every2@all: Likes humid air", "feed monthly@growing: Feed higher in phosphorus for blooms"],
    tip: "Each glossy red 'flower' lasts two months or more.",
    tags: ["toxic"],
  },
  {
    id: "christmascactus", name: "Christmas cactus", latin: "Schlumbergera", type: "flowering", color: "#e04a7a",
    light: ["bright", "medium"], water: 2, humidity: 2, base: 2, petSafe: true,
    size: "1–2 ft", soil: "Cactus mix with extra peat",
    care: ["water weekly@growing: When the top inch is dry; it's a forest cactus, not a desert one", "water biweekly@winter: Less after blooming", "protect yearly@fall: Six weeks of long nights (12+ h dark) and cool rooms set the buds"],
    tip: "Don't move it once buds form or it drops them.",
    tags: ["petsafe"],
  },
  {
    id: "bromeliad", name: "Bromeliad", latin: "Guzmania and others", type: "flowering", color: "#f0702a",
    light: ["bright", "medium"], water: 2, humidity: 2, base: 2, petSafe: true,
    size: "1–2 ft", soil: "Orchid bark mix",
    care: ["water weekly@all: Keep a little water in the central cup and flush it out monthly", "feed monthly@growing: Quarter-strength feed in the cup"],
    tip: "Flowers once, then makes pups. Pot those up when they're a third of the mother's size.",
    tags: ["petsafe"],
  },

  // ── Succulents & cacti ─────────────────────────────────────
  {
    id: "aloe", name: "Aloe vera", latin: "Aloe vera", type: "succulent", color: "#6a9a5a",
    light: ["bright"], water: 1, humidity: 1, base: 1, petSafe: false,
    size: "1–2 ft", soil: "Cactus mix in a clay pot",
    care: [WATER_DRY, WATER_DRY_WINTER, "feed yearly@spring: One light feed is plenty"],
    tip: "The gel soothes minor burns on people, but the plant is toxic to cats and dogs.",
    tags: ["toxic", "drought"],
  },
  {
    id: "jade", name: "Jade plant", latin: "Crassula ovata", type: "succulent", color: "#4a8a4a",
    light: ["bright"], water: 1, humidity: 1, base: 1, petSafe: false,
    size: "1–3 ft", soil: "Cactus mix",
    care: [WATER_DRY, WATER_DRY_WINTER, "feed yearly@spring,midSummer: Light feeds", "trim yearly@spring: Prune to shape; cuttings root easily"],
    tip: "Can live for decades. Red leaf edges mean it's getting lots of sun, which is good.",
    tags: ["toxic", "drought"],
  },
  {
    id: "echeveria", name: "Echeveria", latin: "Echeveria", type: "succulent", color: "#8ab0a8",
    light: ["bright"], water: 1, humidity: 1, base: 2, petSafe: true,
    size: "3–8 in rosettes", soil: "Gritty cactus mix",
    care: [WATER_DRY, WATER_DRY_WINTER],
    tip: "Stretching toward the window means it needs more sun or a grow light.",
    tags: ["petsafe", "drought", "container"],
  },
  {
    id: "haworthia", name: "Haworthia (zebra plant)", latin: "Haworthiopsis attenuata", type: "succulent", color: "#3f6a4a",
    light: ["medium", "bright"], water: 1, humidity: 1, base: 1, petSafe: true,
    size: "3–6 in", soil: "Gritty cactus mix",
    care: [WATER_DRY, WATER_DRY_WINTER],
    tip: "The succulent for a spot without much direct sun.",
    tags: ["petsafe", "drought", "container"],
  },

  // ── Kitchen garden ─────────────────────────────────────────
  {
    id: "microgreens", name: "Microgreens", latin: "Radish, pea, sunflower, broccoli and more", type: "kitchen", color: "#7ac04a",
    light: ["bright", "medium"], water: 3, humidity: 2, base: 1, petSafe: true, days: 12,
    size: "2–4 in", soil: "A shallow tray of seed-starting mix",
    care: ["water daily@all: Mist or bottom-water so the tray stays damp", "harvest weekly@harvest: Snip just above the soil when the first true leaves show"],
    tip: "From seed to salad in under two weeks, any time of year. Sow a new tray every week for a steady supply.",
    tags: ["edible", "petsafe"],
  },
  {
    id: "windowherbs", name: "Windowsill herbs", latin: "Basil, parsley, chives, mint, thyme", type: "kitchen", color: "#4a9a3a",
    light: ["bright"], water: 2, humidity: 2, base: 2, petSafe: false, days: 30,
    size: "6–12 in", soil: "Light potting mix, pots with drainage",
    care: ["water every2@all: When the top inch is dry; basil and parsley drink more than thyme", "harvest weekly@harvest: Pinch tops often so they bush out", "feed monthly@all: Half-strength feed"],
    tip: "Most herbs need 6 hours of sun or a grow light inside; a dim kitchen gives spindly, weak plants. Chives and many others are toxic to pets.",
    tags: ["edible", "container"],
  },
  {
    id: "meyerlemon", name: "Meyer lemon (indoors)", latin: "Citrus × meyeri", type: "kitchen", color: "#f2d23a",
    light: ["bright"], water: 2, humidity: 2, base: 4, petSafe: false, days: 270,
    size: "3–6 ft in a pot", soil: "Citrus mix or fast-draining potting mix",
    care: ["water weekly@all: When the top 2 in are dry", "feed monthly@growing: Citrus feed with iron", "mist every2@winter: Dry winter air drops blossoms", "check monthly@all: Scale and spider mites under leaves"],
    tip: "Summer it outside, bring it in before nights drop below 50°F (10°C), and give it your sunniest window. Flowers smell incredible.",
    tags: ["edible"],
  },
  {
    id: "regrowonions", name: "Green onions (regrown)", latin: "Allium fistulosum", type: "kitchen", color: "#6ab04a",
    light: ["bright", "medium"], water: 3, humidity: 2, base: 1, petSafe: false, days: 10,
    size: "6–12 in", soil: "A glass of water or a small pot",
    care: ["water every2@all: Change the water every couple of days", "harvest weekly@harvest: Cut the greens and they grow back"],
    tip: "Stand the white root ends from store-bought onions in water and they regrow for weeks. Toxic to cats and dogs.",
    tags: ["edible"],
  },
];
