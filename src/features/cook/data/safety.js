// Food-safety notes, following USDA FSIS and FoodSafety.gov guidance.
// Temperatures are stored in Celsius and shown in the cook's chosen unit;
// {temp:74} tokens render as 165°F or 74°C.

export const SAFETY_SOURCE = {
  name: "USDA FoodSafety.gov",
  url: "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures",
};

export const safetyNotes = {
  poultry: {
    title: "Chicken",
    text: "Cook chicken to {temp:74} in the thickest part. Color and clear juices aren't reliable signs; a thermometer is.",
  },
  "ground-meat": {
    title: "Ground meat",
    text: "Cook ground beef to {temp:71}. Grinding spreads surface bacteria all through the meat, so it needs to be cooked through.",
  },
  "ground-poultry": {
    title: "Ground turkey or chicken",
    text: "Cook ground turkey and chicken to {temp:74}, higher than ground beef. Break it up and cook until no pink remains, then check with a thermometer.",
  },
  pork: {
    title: "Pork",
    text: "Cook pork chops to {temp:63} in the center, then let them rest for 3 minutes before cutting. A little blush of pink is fine at that temperature.",
  },
  shellfish: {
    title: "Shrimp",
    text: "Cook shrimp until the flesh is pearly and opaque all the way through and the shrimp curl into a loose C, about {temp:63}. Thaw frozen shrimp in the fridge or under cold running water, not on the counter.",
  },
  "slow-cooker": {
    title: "Slow cooker",
    text: "Start with thawed meat, keep the lid on, and don't fill the cooker more than two-thirds full. Check that chicken reaches {temp:74} before serving. Don't reheat leftovers in the slow cooker; use the stove or microwave.",
  },
  fish: {
    title: "Fish",
    text: "Cook fish to {temp:63}, or until the flesh is opaque and separates easily with a fork.",
  },
  eggs: {
    title: "Eggs",
    text: "Egg dishes are safest cooked to {temp:71}. Runny yolks carry a small risk, so cook them firm for young children, pregnant people, older adults, or anyone with a weakened immune system.",
  },
  "raw-meat": {
    title: "Raw meat and fish",
    text: "Keep raw meat away from food that won't be cooked. Use a separate board, and wash your hands, knives and surfaces after handling it.",
  },
  "raw-flour": {
    title: "Raw dough and batter",
    text: "Don't taste raw dough or batter. Uncooked flour and eggs can carry harmful bacteria.",
  },
  rice: {
    title: "Cooked rice",
    text: "Cool cooked rice quickly and refrigerate it within 2 hours. Don't leave it sitting out at room temperature.",
  },
  leftovers: {
    title: "Leftovers",
    text: "Refrigerate leftovers within 2 hours (1 hour on a hot day) and eat within 3 to 4 days. Reheat until steaming hot, {temp:74}. Freeze for longer storage.",
  },
};
