// GrowFox specialty grows: mushrooms, cannabis, coffee, saffron and other
// crops that need more than a plant tag to grow well. Each one carries a
// step-by-step guide: what to do at each stage, how to harvest and store
// it, and how to stay safe. Plain data, testable in Node.
//
// Some of these are against the law to grow in many places. Those are
// marked legal: "restricted" and the app asks people to confirm they'll
// check their local law before it shows the guide. The guides are general
// education, not legal or medical advice.
//
// Sources: university extension guides (Penn State, Cornell, NC State,
// Oregon State, UC ANR, Missouri), the ASPCA poison lists, US DEA and
// state statutes (Colorado Natural Medicine Health Act, Oregon Psilocybin
// Services Act), Health Canada and the German Cannabis Act (2024).
//
// A specialty grow uses the same fields as the rest of the library:
// outdoor ones have sun, when, zones or days, heat; indoor ones have
// light, humidity and petSafe; ones that can go either way have both.
//   setting   "indoor", "outdoor" or "both"
//   cycle     true when it's grown in one run from start to harvest
//   indoorDays days from start to harvest indoors, when different
//   legal     "restricted" or "open"
//   law       what to know about the law, in plain words
//   guide     { overview, stages: [{ name, time, steps }], harvest, after, safety }

export const SPECIALTY_TYPES = [
  { id: "fungi", name: "Mushrooms", one: "Mushroom" },
  { id: "specialty", name: "Specialty plants", one: "Specialty plant" },
];

export const LAW_NOTICE =
  "Laws on growing some of these change often and differ by country, state and city. GrowFox's guides are general education, not legal or medical advice. You're responsible for checking the law where you live before you buy seeds, spores or anything else, or start a grow.";

export const SPECIALTY = [
  // ── Restricted ─────────────────────────────────────────────
  {
    id: "cannabis", name: "Cannabis", latin: "Cannabis sativa", type: "specialty", color: "#3f8a3a", art: "palmate",
    setting: "both", cycle: true, legal: "restricted",
    sun: ["full"], water: 2, heat: 3, base: 3, when: "warmVeg", indoors: 3, days: 130, indoorDays: 110,
    light: ["bright"], humidity: 2, petSafe: false,
    size: "3–8 ft outdoors; 2–4 ft indoors", spacing: "4–6 ft outdoors", soil: "Loose, rich, well drained; pH 6.0–7.0",
    care: [
      "water every2@growing: When the top inch is dry. Soggy pots rot roots faster than anything else",
      "feed weekly@growing: Light feeds: more nitrogen while it grows leaves, more phosphorus and potassium once it flowers",
      "trim weekly@summer: Top or bend early for an even canopy; pull yellow lower leaves",
      "check weekly@growing: Under leaves for spider mites and aphids; late in the season, inside buds for gray mold",
      "harvest every2@harvest: Check the resin glands with a loupe: harvest when most look cloudy",
    ],
    tip: "Outdoors it flowers on its own as nights lengthen in late summer; indoors you decide when by switching the lights to 12 hours a day.",
    tags: ["toxic"],
    law:
      "Cannabis is still illegal under US federal law and in most countries. Some places let adults grow a few plants at home: several US states (usually 21+, with plant limits), most of Canada (4 per household; Quebec and Manitoba ban it), Germany (3 per adult since 2024), Malta and Uruguay. Others sell it but ban home growing (Washington State, for one), and many ban it outright with serious penalties. Plant counts, locked or hidden grows, renters' rules and medical licenses all vary.",
    guide: {
      overview: "An annual that grows leaves under long days and flowers when nights get long. Indoors that means 18 hours of light to grow and 12 to flower; outdoors the season does it for you. Only the female flowers are harvested.",
      stages: [
        { name: "Pick your plants", time: "Before you start", steps: ["Buy seeds or clones only from a licensed source where that's legal.", "Feminized seeds skip the male plants. Autoflowering kinds finish in 10–12 weeks no matter the light; photoperiod kinds wait for long nights.", "Outdoors, pick a variety bred to finish before your first fall frost."] },
        { name: "Sprout the seed", time: "3–7 days", steps: ["Keep seeds in a damp paper towel or a starter plug at 70–80°F (21–27°C).", "Plant the sprouted seed root-down, ¼–½ in deep."] },
        { name: "Seedling", time: "2–3 weeks", steps: ["Gentle light: 18 hours a day indoors, or a bright window before planting out after your last frost.", "Water lightly around the stem; seedlings drown easily.", "Keep it 70–80°F (21–27°C) with 60–70% humidity."] },
        { name: "Growing leaves (vegetative)", time: "3–8 weeks indoors; until midsummer outdoors", steps: ["Indoors, keep the lights on 18 hours a day.", "Move it to its final pot (3–7 gal indoors) or bed.", "Feed a nitrogen-rich mix at the strength on the label or less.", "Top the main stem or bend branches down to spread the canopy."] },
        { name: "Flowering", time: "7–10 weeks", steps: ["Indoors, switch to 12 hours of light and 12 of total darkness. Light leaks at night stress plants into making seeds.", "Remove male plants (small pollen sacs, no white hairs) as soon as you spot them unless you want seeds.", "Switch to a bloom feed and drop humidity to 40–50% so the flowers don't rot."] },
        { name: "Harvest", time: "When it's ripe", steps: ["Look at the resin glands with a 30–60× loupe: harvest when most are cloudy, with a few amber.", "Most of the white hairs will have darkened and curled.", "Cut whole branches."] },
      ],
      after: ["Hang branches upside down in a dark room around 60°F (16°C) and 60% humidity, with a fan moving the air but not pointed at them, for 7–14 days.", "They're dry when small stems snap instead of bend.", "Trim, then cure in airtight glass jars about ¾ full. Open them daily for the first 1–2 weeks to let moisture out.", "Throw away anything with fuzzy white or gray mold or a musty smell; moldy flower is a real health risk."],
      safety: [
        "Lock up plants, harvest and anything made from them. Children and dogs who eat cannabis often end up in the emergency room.",
        "Grow lights, fans and heaters draw a lot of power: use rated cords, no daisy-chained power strips, and keep water away from plugs.",
        "Humid grow spaces grow mold on walls and floors too. Vent the air out, and keep humidity in check.",
        "Only use pest sprays labeled for crops people consume. Some, like myclobutanil, turn into toxic gas when burned.",
        "Never drive or operate machinery while impaired.",
      ],
    },
  },
  {
    id: "psilocybin", name: "Psilocybin mushrooms", latin: "Psilocybe cubensis", type: "fungi", color: "#b08a5a", art: "mushroom",
    setting: "indoor", cycle: true, legal: "restricted",
    light: ["low", "medium"], water: 3, humidity: 3, base: 4, petSafe: false, days: 56,
    size: "2–6 in mushrooms", soil: "Sterilized grain, then a coir and vermiculite bulk substrate",
    care: [
      "check every2@all: Look for contamination: anything green, blue-green, black, pink or orange, slimy or sour smelling",
      "mist daily@harvest: Keep the tub walls beaded with water once it's fruiting; mist the walls, not the mushrooms",
      "harvest daily@harvest: Pick each one just before or as the thin veil under the cap tears",
    ],
    tip: "Blue bruising where you touch them is normal for this species and isn't mold.",
    tags: ["toxic"],
    law:
      "Psilocybin is a Schedule I drug under US federal law and controlled in most countries, so growing these mushrooms is a crime in most places, even for yourself. The exceptions are narrow and changing: Colorado lets adults 21+ grow them for personal use under its 2022 Natural Medicine law; Oregon licenses supervised psilocybin services but doesn't allow home growing; a number of cities have made enforcement a low priority, which isn't the same as legal. In the US, spores contain no psilocybin and are sold for microscopy in most states, but California, Georgia and Idaho ban them, and sprouting them is cultivation. The Netherlands sells 'truffles' legally but bans the mushrooms.",
    guide: {
      overview: "Mushrooms aren't plants. You grow a fungus (mycelium) through sterile food, then give it fresh air, humidity and a little light so it fruits. The hard part isn't the mushroom: it's keeping molds and bacteria out, because they grow faster than the fungus does.",
      stages: [
        { name: "Learn clean technique first", time: "Before you start", steps: ["Work in a still-air box (a clear tote with arm holes) or in front of a laminar flow hood.", "Wipe every surface, glove and jar lid with 70% isopropyl alcohol.", "Grain is sterilized in a pressure cooker (about 90 minutes at 15 psi); a pot of boiling water isn't enough.", "Many people practice the whole process with legal gourmet mushrooms like oysters first."] },
        { name: "Colonize the grain", time: "2–4 weeks", steps: ["Spores or liquid culture go into sterilized grain jars or bags (rye, millet or brown rice flour cakes).", "Keep them dark at 75–80°F (24–27°C).", "White, ropey or fluffy growth is the fungus. Any other color, slime or a sour smell means contamination: seal it and throw it out without opening it indoors."] },
        { name: "Move to bulk substrate", time: "1–2 weeks", steps: ["Mix the fully colonized grain into a pasteurized bulk mix (coco coir and vermiculite, about half and half, with a little gypsum) in a tub.", "Pasteurize, don't sterilize, the bulk mix: about 1–2 hours at 150–170°F (65–77°C).", "It should be as wet as a wrung-out sponge: a hard squeeze gives a few drops, not a stream.", "Keep it closed and dark until the surface is white."] },
        { name: "Fruiting", time: "1–2 weeks", steps: ["Once the surface is covered, give it fresh air (holes with filter patches or fanning a few times a day), 12 hours of indirect light and 90%+ humidity at 70–75°F (21–24°C).", "Long, thin stems and small caps mean too little fresh air.", "Tiny bumps called pins appear first and grow into mushrooms in 5–7 days."] },
        { name: "Harvest and later flushes", time: "2–4 flushes", steps: ["Twist and pull each mushroom at the base just before or as the veil tears; after that it drops dark spores.", "Take the whole flush at once.", "Rehydrate the substrate with clean water after each flush; it fruits again in 1–2 weeks."] },
      ],
      after: ["Dry right away: a fan first, then a food dehydrator on its lowest setting (95–110°F / 35–43°C) until they snap like a cracker.", "Store airtight with a food-safe desiccant packet, cool and dark. Label them clearly.", "Anything that grew mold or smells off goes in the trash, not in storage."],
      safety: [
        "Never pick wild mushrooms that look similar. Deadly species like Galerina, which carries the same toxins as the death cap, grow in the same places and can look alike. Poisonings and deaths happen every year.",
        "Molds from contaminated jars can trigger allergies and asthma. Dispose of them sealed, outdoors.",
        "A big flush drops a lot of spores that can irritate your lungs. Wear a mask when handling mature mushrooms and keep the space ventilated.",
        "Follow the pressure cooker's instructions and never open it while it's under pressure.",
        "Psilocybin can set off severe anxiety or psychosis, especially with a personal or family history of psychosis or bipolar disorder, and it's dangerous with lithium and some other medications. Don't mix it with other substances, never drive, and have a sober person you trust nearby.",
        "Keep them away from children and pets. In the US, poison control is 1-800-222-1222; in a mental health crisis, call or text 988.",
      ],
    },
  },

  // ── Legal mushrooms ────────────────────────────────────────
  {
    id: "oyster", name: "Oyster mushroom", latin: "Pleurotus ostreatus", type: "fungi", color: "#c8c0b0", art: "mushroom",
    setting: "indoor", cycle: true, legal: "open",
    light: ["low", "medium"], water: 3, humidity: 3, base: 1, petSafe: true, days: 28,
    size: "Clusters 4–10 in", soil: "Pasteurized straw, coffee grounds or a ready-to-fruit kit",
    care: [
      "mist daily@harvest: Two or three times a day once pins appear",
      "check every2@all: Green or black mold means toss it; white is good",
      "harvest daily@harvest: When cap edges start to flatten, before they curl up",
    ],
    tip: "The best first mushroom: fast, forgiving and grows on straw or used coffee grounds.",
    tags: ["edible", "petsafe"],
    law: "Legal to grow almost everywhere.",
    guide: {
      overview: "Oysters are aggressive growers that outrun most molds, which makes them the classic beginner mushroom. A ready-to-fruit kit is the easiest start; growing on straw is the next step.",
      stages: [
        { name: "Get spawn", time: "Day 1", steps: ["Buy grain spawn or a ready-to-fruit block from a mushroom supplier.", "For straw: chop it into 2–4 in pieces and pasteurize it in 160°F (71°C) water for an hour, then drain and cool."] },
        { name: "Colonize", time: "2–3 weeks", steps: ["Layer spawn and straw in a bag or bucket with holes, about 1 part spawn to 10 parts straw.", "Keep it at 65–75°F (18–24°C), out of direct light, until it's solid white."] },
        { name: "Fruit", time: "5–10 days", steps: ["Cut slits in the bag (or open the kit) and move it somewhere with fresh air and indirect light.", "Mist 2–3 times a day; aim for 85–95% humidity.", "Lots of fresh air is the key: long stems and tiny caps mean it's starving for air."] },
      ],
      harvest: ["Twist off the whole cluster when the cap edges are flattening out but before they curl upward.", "A block usually gives 2–3 flushes; soak it in cold water for a few hours between them."],
      after: ["Refrigerate in a paper bag and use within a week, or dry them.", "Spent blocks and straw make great compost or garden mulch."],
      safety: ["Cook them; don't eat wild or cultivated mushrooms raw.", "Growing lots of oysters indoors fills the air with spores that can cause an allergic lung condition. Fruit large batches in a garage or shed, or pick before caps fully open.", "Only eat what you grew from a known culture."],
    },
  },
  {
    id: "lionsmane", name: "Lion's mane", latin: "Hericium erinaceus", type: "fungi", color: "#efe6cf", art: "mushroom",
    setting: "indoor", cycle: true, legal: "open",
    light: ["low", "medium"], water: 3, humidity: 3, base: 2, petSafe: true, days: 35,
    size: "Clumps 3–8 in", soil: "Supplemented hardwood sawdust block",
    care: [
      "mist daily@harvest: Keep the growing clump humid; it yellows in dry air",
      "harvest every2@harvest: When the spines are about ¼ in long, before they turn yellow",
    ],
    tip: "Tastes like crab or lobster when sliced and seared in butter.",
    tags: ["edible", "petsafe"],
    law: "Legal to grow almost everywhere.",
    guide: {
      overview: "Grows as a white pom-pom of hanging spines from hardwood. Easiest from a colonized sawdust block or kit.",
      stages: [
        { name: "Colonize", time: "2–3 weeks", steps: ["Start with a colonized hardwood sawdust block or kit at 65–75°F (18–24°C)."] },
        { name: "Fruit", time: "10–14 days", steps: ["Cut a small X in the bag, mist the opening often and keep humidity at 85–95%.", "Give it fresh air and indirect light."] },
      ],
      harvest: ["Cut the whole clump at the base once the spines are about ¼ in long and still white."],
      after: ["Keeps about a week in the fridge in a paper bag. Cook it well."],
      safety: ["Cook before eating.", "Buy from a reputable supplier; only eat what you're sure of."],
    },
  },
  {
    id: "shiitake", name: "Shiitake on logs", latin: "Lentinula edodes", type: "fungi", color: "#8a5a3a", art: "mushroom",
    setting: "outdoor", legal: "open",
    sun: ["shade"], water: 2, heat: 2, base: 3, zones: [4, 9], when: "tree",
    size: "Caps 2–4 in", spacing: "Logs 3–4 ft long, 3–8 in across", soil: "Freshly cut oak, maple or other hardwood logs",
    care: [
      "water weekly@summer: Soak or sprinkle the logs in dry weeks; they shouldn't dry out",
      "check monthly@growing: Look for white mottling on the log ends, the sign it's colonizing",
      "harvest weekly@summer: Pick when caps are about 70% open",
    ],
    tip: "One afternoon of drilling feeds you shiitake for 3–5 years.",
    tags: ["edible", "shade"],
    law: "Legal to grow almost everywhere.",
    guide: {
      overview: "You drill holes in fresh hardwood logs, plug them with shiitake spawn, and leave them in the shade. They start fruiting 6–18 months later and keep going for years.",
      stages: [
        { name: "Cut logs", time: "Late winter", steps: ["Cut healthy oak, maple or sweetgum while it's dormant, 3–8 in across and 3–4 ft long.", "Let them rest 2–4 weeks, but inoculate before they dry out."] },
        { name: "Inoculate", time: "Early spring", steps: ["Drill holes 1 in deep, 6 in apart in rows, offset like a diamond pattern.", "Hammer in plug spawn and seal each hole and the cut ends with melted cheese wax."] },
        { name: "Incubate", time: "6–18 months", steps: ["Stack logs in deep shade, off the ground, and keep them from drying out.", "White mottling on the ends means the fungus has taken over."] },
        { name: "Fruit", time: "Spring through fall", steps: ["Soak a colonized log in cold water for 24 hours to 'shock' it into fruiting, then stand it up in the shade.", "Mushrooms appear in about a week. Rest each log 6–8 weeks between soakings."] },
      ],
      harvest: ["Cut or twist caps off when they're about 70% open, before the edges flatten."],
      after: ["Keeps a week in the fridge; dries very well."],
      safety: ["Cook shiitake thoroughly: eating them raw or undercooked can cause an itchy, whip-like rash in some people.", "Wear eye protection and gloves when drilling."],
    },
  },

  // ── Legal specialty plants ─────────────────────────────────
  {
    id: "hops", name: "Hops", latin: "Humulus lupulus", type: "specialty", color: "#9ac84a", art: "vine",
    setting: "outdoor", legal: "open",
    sun: ["full"], water: 2, heat: 2, base: 2, zones: [3, 8], when: "perennial",
    size: "Bines 15–25 ft a season", spacing: "3–5 ft", soil: "Deep, rich, well drained",
    care: [
      "trim weekly@lateSpring: Wind 2–3 shoots clockwise up each twine; pull the rest",
      "water weekly@summer: Deep soak about 1–2 in a week",
      "feed yearly@spring: Compost or balanced feed as shoots emerge",
      "check biweekly@summer: Aphids, spider mites and downy mildew",
      "harvest yearly@lateSummer: Pick cones when papery, springy and full of yellow powder",
      "trim yearly@fall: Cut bines to the ground after harvest",
    ],
    tip: "Grows up to a foot a day in early summer. A tall trellis or a twine to the roof line is a must.",
    tags: ["toxic"],
    law: "Legal to grow everywhere. Brewing beer at home is legal in the US and most countries.",
    guide: {
      overview: "A hardy perennial vine that dies to the ground each winter and climbs 15–25 ft each summer. Only female plants make the cones brewers use.",
      stages: [
        { name: "Plant rhizomes", time: "Spring", steps: ["Buy named female rhizomes or plants (Cascade and Centennial are forgiving).", "Plant 2 in deep, 3–5 ft apart, in full sun."] },
        { name: "Train", time: "Late spring", steps: ["Run twine from the ground to a tall support.", "When shoots are 1–2 ft long, wrap 2–3 clockwise around each twine and remove the rest."] },
        { name: "Grow", time: "Summer", steps: ["Water deeply and strip the lowest 3 ft of leaves to cut disease.", "The first year's crop is small; full crops start in year two or three."] },
      ],
      harvest: ["Cones are ready in late summer when they feel dry and papery, spring back when squeezed, and smell strong. Inside you'll see yellow lupulin powder."],
      after: ["Dry on a screen in a warm, airy room or a dehydrator below 140°F (60°C) until the center stem is brittle.", "Store sealed in the freezer."],
      safety: ["Hops are very toxic to dogs: even spent hops from brewing can cause a deadly fever. Keep them, and brewing waste, away from pets.", "The bines have rough hairs that scratch skin; wear long sleeves and gloves to harvest."],
    },
  },
  {
    id: "saffron", name: "Saffron crocus", latin: "Crocus sativus", type: "specialty", color: "#8a5ac8", art: "flower",
    setting: "outdoor", legal: "open",
    sun: ["full"], water: 1, heat: 2, base: 2, zones: [6, 9], when: "bulbFall",
    size: "6 in", spacing: "4–6 in apart, 4 in deep", soil: "Sandy, very well drained",
    care: [
      "harvest daily@fall: Pluck the three red threads the morning each flower opens",
      "water never: Rain is enough; wet summer soil rots the corms",
      "divide yearly@lateSummer: Every 3–4 years, lift and replant the crowded corms",
    ],
    tip: "It takes about 150 flowers for a gram of saffron, so plant at least 50 corms if you want to cook with it.",
    tags: ["edible", "container"],
    law: "Legal to grow everywhere.",
    guide: {
      overview: "A fall-blooming crocus. Each flower has three red stigmas: that's the spice.",
      stages: [
        { name: "Plant corms", time: "Late summer", steps: ["Plant corms 4 in deep and 4–6 in apart in sandy, fast-draining soil or a raised bed.", "Buy from a bulb supplier that sells Crocus sativus by name."] },
        { name: "Flowering", time: "Mid to late fall", steps: ["Purple flowers open 6–8 weeks after planting. Leaves follow and stay green through winter."] },
      ],
      harvest: ["Pick on the morning each flower opens: pinch out the three red threads (not the yellow ones)."],
      after: ["Dry the threads on paper in a warm room for a day or two, then store in a sealed jar away from light."],
      safety: ["Don't confuse it with autumn crocus (Colchicum), which blooms at the same time, looks similar and is deadly poisonous. Saffron crocus has three red stigmas and narrow, grass-like leaves; buy it labeled by name."],
    },
  },
  {
    id: "flytrap", name: "Venus flytrap", latin: "Dionaea muscipula", type: "specialty", color: "#c83a3a", art: "flytrap",
    setting: "both", legal: "open",
    sun: ["full"], water: 3, heat: 2, base: 4, zones: [7, 10], when: "perennial",
    light: ["bright"], humidity: 2, petSafe: true,
    size: "4–6 in", spacing: "In a bog pot", soil: "Peat moss and perlite, no fertilizer, no potting soil",
    care: [
      "water every2@growing: Distilled, reverse-osmosis or rain water only: tap water minerals kill it. Keep the tray wet",
      "protect yearly@fall: Give it a cool winter rest of 3–4 months (35–50°F / 2–10°C)",
      "feed never: It catches its own food; never fertilize",
      "trim yearly@spring: Snip off black traps and the flower stalk",
    ],
    tip: "Every trap closing costs it energy. Don't set them off for fun.",
    tags: ["native", "petsafe", "container"],
    law: "Legal to grow, but buy nursery-grown plants. Taking them from the wild is a felony in North Carolina, the only place they grow naturally.",
    guide: {
      overview: "A bog plant from the Carolinas that needs sun, pure water, poor soil and a cold winter nap. Most die from tap water, rich soil or skipping winter.",
      stages: [
        { name: "Set up", time: "Any time", steps: ["Pot it in a 1:1 mix of peat moss and perlite in a plastic pot with drainage holes.", "Stand the pot in a tray of distilled or rain water."] },
        { name: "Growing season", time: "Spring to fall", steps: ["At least 4–6 hours of direct sun, outdoors or on the sunniest sill; or a strong grow light.", "Outside it catches plenty of insects on its own."] },
        { name: "Winter rest", time: "3–4 months", steps: ["Let it go dormant somewhere cold but above freezing: an unheated garage window or a cold porch. It'll look half dead; that's normal."] },
      ],
      harvest: ["Nothing to harvest: enjoy the show."],
      after: [],
      safety: ["Harmless to people and pets."],
    },
  },
  {
    id: "coffee", name: "Coffee plant", latin: "Coffea arabica", type: "specialty", color: "#a0302a", art: "foliage",
    setting: "both", legal: "open",
    sun: ["part"], water: 2, heat: 2, base: 4, zones: [10, 11], when: "tree", tags: ["toxic", "container"],
    light: ["bright", "medium"], humidity: 3, petSafe: false,
    size: "3–6 ft in a pot", spacing: "5–8 ft outdoors", soil: "Rich, acidic, well drained; pH 6.0–6.5",
    care: [
      "water weekly@growing: When the top inch is dry; it hates both drought and soggy roots",
      "feed monthly@growing: Acid-loving plant feed",
      "mist every2@winter: Dry indoor air browns the leaf edges",
      "harvest weekly@harvest: Pick cherries one at a time as they turn deep red",
    ],
    tip: "Flowers smell like jasmine. Expect your first cherries after 3–5 years.",
    law: "Legal to grow everywhere.",
    guide: {
      overview: "A glossy evergreen shrub. Indoors it's a handsome houseplant that, with luck and bright light, flowers and fruits after a few years. Outdoors only in frost-free places.",
      stages: [
        { name: "Grow the plant", time: "Years 1–3", steps: ["Bright, indirect light; a little morning sun is fine.", "Keep it warm (60–80°F / 16–27°C) and humid."] },
        { name: "Flower and fruit", time: "Year 3–5 on", steps: ["White flowers in spring are self-pollinating; a soft brush helps indoors.", "Green cherries take 7–9 months to ripen red."] },
      ],
      harvest: ["Pick only the ripe red cherries."],
      after: ["Squeeze out the two beans, soak them a day or two to loosen the slimy coating, rinse, and dry for 1–2 weeks.", "Peel off the papery parchment, then roast in a skillet or oven until brown and fragrant. Rest a day before brewing."],
      safety: ["Leaves and berries are toxic to cats and dogs."],
    },
  },
  {
    id: "teaplant", name: "Tea plant", latin: "Camellia sinensis", type: "specialty", color: "#3a7a3a", art: "foliage",
    setting: "both", legal: "open",
    sun: ["part", "full"], water: 2, heat: 2, base: 3, zones: [7, 9], when: "tree",
    light: ["bright", "medium"], humidity: 2, petSafe: true,
    size: "3–6 ft kept pruned", spacing: "3–5 ft", soil: "Acidic, rich, well drained; pH 4.5–6.0",
    care: [
      "water weekly@growing: Keep evenly moist",
      "feed yearly@spring,earlySummer: Acid-loving plant feed",
      "harvest weekly@spring: Pick two leaves and a bud from new shoots",
      "trim yearly@lateSummer: Shape after the last flush to keep it a waist-high bush",
    ],
    tip: "All tea (green, black, oolong, white) comes from this one plant; only the processing differs.",
    tags: ["acid", "petsafe", "container"],
    law: "Legal to grow everywhere.",
    guide: {
      overview: "A camellia that grows outdoors in zones 7–9 and in a big pot elsewhere. Wait until it's about three years old before picking.",
      stages: [
        { name: "Establish", time: "Years 1–3", steps: ["Plant in acidic soil with morning sun and afternoon shade.", "In colder areas, keep it in a pot and bring it in when nights drop below 20°F (−7°C)."] },
        { name: "Pick", time: "Spring and summer flushes", steps: ["Pinch off the top two leaves and the unopened bud of each new shoot."] },
      ],
      harvest: ["Pick in the morning after the dew dries, two leaves and a bud at a time."],
      after: ["Green tea: wilt the leaves an hour, heat them in a dry pan or steam a minute to stop browning, roll them, then dry in a low oven (about 200°F / 95°C).", "Black tea: wilt overnight, roll and bruise them, leave them in a warm spot 2–3 hours until coppery, then dry in a low oven."],
      safety: ["Safe for people and pets."],
    },
  },
];
