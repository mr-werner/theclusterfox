import { Ambulance, CalendarRange, ChefHat, CloudSun, Dumbbell, Flame, Flower2, MonitorPlay, PersonStanding, Plane, Sigma, Sprout, Trophy, Wrench } from "lucide-react";

// The home screen groups apps into these, in this order. PlanFox is the hub
// above them all. An app without a category (or with one not listed here)
// lands in "More apps", so a new app always shows up somewhere.
export const categories = [
  { id: "health", name: "Health & Fitness", blurb: "Train, eat well and unwind" },
  { id: "food", name: "Food & Cooking", blurb: "Recipes, prep and groceries" },
  { id: "outdoors", name: "Outdoors & Travel", blurb: "Weather, yard and flying" },
  { id: "learn", name: "Learn & Study", blurb: "Practice, explore and pass the test" },
  { id: "fun", name: "Watch & Play", blurb: "Shows, movies and games" },
  { id: "work", name: "Work & Tools", blurb: "Calculators and references for the job" },
];

const categoryIds = new Set(categories.map(c => c.id));
export const MORE_CATEGORY = { id: "more", name: "More apps", blurb: "" };

/** The category an app is shown under on the home screen. */
export const categoryOf = app =>
  app.category === "hub" ? "hub" : categoryIds.has(app.category) ? app.category : MORE_CATEGORY.id;

// PlanFox comes first: it is the calendar every other app feeds into, so it
// leads the home screen.
export const apps = [
  {
    id: "planfox",
    category: "hub",
    name: "Plan",
    subtitle: "PlanFox",
    description: "Calendar • Weather • Life",
    path: "/plan",
    icon: CalendarRange,
    accent: "planfox",
  },
  {
    id: "f4t",
    category: "food",
    name: "F4T",
    subtitle: "Fuel 4 Thought",
    description: "Meals • Groceries • Budget",
    path: "/f4t",
    icon: Flame,
    accent: "f4t",
  },
  {
    id: "clocast",
    category: "outdoors",
    name: "Sky",
    subtitle: "SkyFox",
    description: "Weather • Radar • What to wear",
    path: "/clocast",
    icon: CloudSun,
    accent: "clocast",
  },
  {
    id: "watchfox",
    category: "fun",
    name: "Watch",
    subtitle: "WatchFox",
    description: "Movies • Shows • Streaming",
    path: "/watch",
    icon: MonitorPlay,
    accent: "watchfox",
  },
  {
    id: "scorefox",
    category: "fun",
    name: "Score",
    subtitle: "ScoreFox",
    description: "Games • Scores • Channels",
    path: "/sports",
    icon: Trophy,
    accent: "scorefox",
  },
  {
    id: "liftfox",
    category: "health",
    name: "Lift",
    subtitle: "LiftFox",
    description: "Muscles • Workouts • Plans",
    path: "/lift",
    icon: Dumbbell,
    accent: "liftfox",
  },
  {
    id: "toolfox",
    category: "work",
    name: "Engineer",
    subtitle: "ToolFox",
    fullName: "Engineer ToolFox",
    description: "Calculators • Units • Data",
    path: "/tools",
    icon: Wrench,
    accent: "toolfox",
  },
  {
    id: "calmfox",
    category: "health",
    name: "Calm",
    subtitle: "CalmFox",
    description: "Breathe • Meditate • Sleep",
    path: "/calm",
    icon: Flower2,
    accent: "calmfox",
  },
  {
    id: "mathfox",
    category: "learn",
    name: "Math",
    subtitle: "MathFox",
    description: "Solve • Steps • Graph",
    path: "/math",
    icon: Sigma,
    accent: "mathfox",
  },
  {
    id: "cookfox",
    category: "food",
    name: "Cook",
    subtitle: "CookFox",
    description: "Recipes • Prep • Cook",
    path: "/cook",
    icon: ChefHat,
    accent: "cookfox",
  },
  {
    id: "growfox",
    category: "outdoors",
    name: "Grow",
    subtitle: "GrowFox",
    description: "Garden • Lawn • Trees",
    path: "/grow",
    icon: Sprout,
    accent: "growfox",
  },
  {
    id: "flyfox",
    category: "outdoors",
    name: "Fly",
    subtitle: "FlyFox",
    description: "Winds aloft • Flight plans • Pilot study",
    path: "/fly",
    icon: Plane,
    accent: "flyfox",
  },
  {
    id: "medicfox",
    category: "learn",
    name: "Medic",
    subtitle: "MedicFox",
    description: "EMR • EMT • AEMT • Paramedic",
    path: "/medic",
    icon: Ambulance,
    accent: "medicfox",
  },
  {
    id: "bodyfox",
    category: "health",
    name: "Body",
    subtitle: "BodyFox",
    description: "Anatomy • 3D • Explore",
    path: "/body",
    icon: PersonStanding,
    accent: "bodyfox",
  },
];
