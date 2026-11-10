// How each ingredient is sold in a typical US grocery store, so the shopping
// list can say what to actually buy ("2 × 15-oz can") instead of only how
// much the recipes use ("2 ¾ cups").
//
// Amounts are in the ingredient's canonical unit (see ingredients.js): grams,
// milliliters or a count. Canned beans are listed by their drained weight,
// since that's what recipes measure. Sizes are common ones, not every size a
// store might stock.
//
// Ingredients missing here fall back to sensible defaults: counted produce is
// bought whole (2.5 lemons means 3 lemons) and everything else shows the
// amount needed, like meat from the counter.

const can15 = [{ amount: 240, label: "15-oz can" }];
const jar = (amount, oz) => [{ amount, label: `${oz}-oz jar` }];
const box1lb = [{ amount: 454, label: "1-lb box" }];

export const packages = {
  // Pantry basics
  salt: [{ amount: 737, label: "26-oz canister" }],
  "black-pepper": jar(57, 2),
  "olive-oil": [{ amount: 500, label: "16.9-oz bottle" }, { amount: 1000, label: "33.8-oz bottle" }],
  "neutral-oil": [{ amount: 710, label: "24-oz bottle" }, { amount: 1420, label: "48-oz bottle" }],
  "sesame-oil": [{ amount: 148, label: "5-oz bottle" }],
  "soy-sauce": [{ amount: 296, label: "10-oz bottle" }, { amount: 444, label: "15-oz bottle" }],
  honey: [{ amount: 239, label: "12-oz bottle" }],
  "maple-syrup": [{ amount: 236, label: "8-oz bottle" }, { amount: 354, label: "12-oz bottle" }],
  vanilla: [{ amount: 59, label: "2-oz bottle" }],
  "chicken-broth": [{ amount: 411, label: "14.5-oz can" }, { amount: 946, label: "32-oz carton" }],
  "vegetable-broth": [{ amount: 946, label: "32-oz carton" }],
  "crushed-tomatoes": [{ amount: 411, label: "14.5-oz can" }, { amount: 794, label: "28-oz can" }],
  "tomato-paste": [{ amount: 170, label: "6-oz can" }],
  "coconut-milk": [{ amount: 400, label: "13.5-oz can" }],
  "light-coconut-milk": [{ amount: 400, label: "13.5-oz can" }],
  "black-beans": can15,
  "kidney-beans": can15,
  chickpeas: can15,
  "white-beans": can15,
  spaghetti: box1lb,
  "ww-spaghetti": box1lb,
  penne: box1lb,
  "gf-spaghetti": [{ amount: 340, label: "12-oz box" }],
  "gf-penne": [{ amount: 340, label: "12-oz box" }],
  rice: [{ amount: 907, label: "2-lb bag" }],
  "brown-rice": [{ amount: 907, label: "2-lb bag" }],
  "rolled-oats": [{ amount: 510, label: "18-oz canister" }],
  "chia-seeds": [{ amount: 340, label: "12-oz bag" }],
  "chocolate-chips": [{ amount: 340, label: "12-oz bag" }],
  "df-chocolate-chips": [{ amount: 283, label: "10-oz bag" }],
  "red-lentils": [{ amount: 454, label: "1-lb bag" }],
  "peanut-butter": jar(454, 16),
  tahini: jar(454, 16),
  dijon: jar(227, 8),
  panko: [{ amount: 227, label: "8-oz box" }],
  "nutritional-yeast": [{ amount: 142, label: "5-oz container" }],
  tamari: [{ amount: 296, label: "10-oz bottle" }],
  "coconut-aminos": [{ amount: 237, label: "8-oz bottle" }],
  "rice-vinegar": [{ amount: 355, label: "12-oz bottle" }],
  gochujang: [{ amount: 250, label: "8.8-oz tub" }, { amount: 500, label: "17.6-oz tub" }],
  peanuts: jar(454, 16),
  couscous: [{ amount: 283, label: "10-oz box" }],
  quinoa: [{ amount: 340, label: "12-oz bag" }],
  "rice-noodles": [{ amount: 227, label: "8-oz pack" }, { amount: 454, label: "16-oz pack" }],
  olives: [{ amount: 110, label: "6-oz jar" }],

  // Spices
  oregano: jar(21, 0.75),
  thyme: jar(21, 0.75),
  "smoked-paprika": jar(60, 2.1),
  cumin: jar(43, 1.5),
  "chili-powder": jar(71, 2.5),
  "curry-powder": jar(48, 1.7),
  "red-pepper-flakes": jar(43, 1.5),
  cinnamon: jar(67, 2.4),
  "garam-masala": jar(45, 1.6),
  turmeric: jar(40, 1.4),
  coriander: jar(35, 1.25),
  "sesame-seeds": jar(57, 2),
  "bay-leaf": [{ amount: 30, label: "jar (about 30 leaves)" }],

  // Baking
  flour: [{ amount: 2268, label: "5-lb bag" }],
  "gf-flour": [{ amount: 907, label: "2-lb bag" }],
  sugar: [{ amount: 1814, label: "4-lb bag" }],
  "brown-sugar": [{ amount: 907, label: "2-lb bag" }],
  "baking-powder": [{ amount: 231, label: "8.1-oz can" }],
  "baking-soda": box1lb,
  cornstarch: [{ amount: 454, label: "16-oz box" }],
  cocoa: [{ amount: 227, label: "8-oz can" }],
  "sliced-almonds": [{ amount: 64, label: "2.25-oz bag" }, { amount: 170, label: "6-oz bag" }],
  "flax-egg": [{ amount: 64, label: "16-oz bag of ground flaxseed (about 64 flax eggs)" }],

  // Dairy and eggs
  butter: [{ amount: 113, label: "stick (4 oz)" }, { amount: 454, label: "1-lb box (4 sticks)" }],
  "plant-butter": [{ amount: 113, label: "stick (4 oz)" }, { amount: 425, label: "15-oz tub" }],
  milk: [{ amount: 946, label: "quart" }, { amount: 1892, label: "half gallon" }, { amount: 3785, label: "gallon" }],
  "oat-milk": [{ amount: 946, label: "quart" }, { amount: 1892, label: "half gallon" }],
  "almond-milk": [{ amount: 946, label: "quart" }, { amount: 1892, label: "half gallon" }],
  "heavy-cream": [{ amount: 236, label: "half pint" }, { amount: 473, label: "pint" }],
  "greek-yogurt": [{ amount: 150, label: "5.3-oz cup" }, { amount: 907, label: "32-oz tub" }],
  "coconut-yogurt": [{ amount: 150, label: "5.3-oz cup" }, { amount: 680, label: "24-oz tub" }],
  parmesan: [{ amount: 142, label: "5-oz container" }, { amount: 227, label: "8-oz container" }],
  feta: [{ amount: 113, label: "4-oz container" }, { amount: 170, label: "6-oz container" }],
  cheddar: [{ amount: 227, label: "8-oz bag" }, { amount: 454, label: "16-oz bag" }],
  mozzarella: [{ amount: 227, label: "8-oz bag" }, { amount: 454, label: "16-oz bag" }],
  egg: [{ amount: 6, label: "carton of 6" }, { amount: 12, label: "carton of 12" }],
  "firm-tofu": [{ amount: 397, label: "14-oz block" }],

  // Meat and fish
  "chicken-thighs": [{ amount: 680, label: "1.5-lb pack" }, { amount: 1360, label: "3-lb family pack" }],
  "chicken-breast": [{ amount: 680, label: "1.5-lb pack" }, { amount: 1360, label: "3-lb family pack" }],
  "ground-beef": [{ amount: 454, label: "1-lb pack" }],
  "ground-turkey": [{ amount: 454, label: "1-lb pack" }],
  "pork-chops": [{ amount: 454, label: "1-lb pack" }],
  "pork-shoulder": [{ amount: 907, label: "2-lb roast" }, { amount: 1360, label: "3-lb roast" }, { amount: 1814, label: "4-lb roast" }],
  "beef-chuck": [{ amount: 907, label: "2-lb roast" }, { amount: 1360, label: "3-lb roast" }],
  salmon: [{ amount: 170, label: "6-oz fillet" }],
  cod: [{ amount: 170, label: "6-oz fillet" }],
  shrimp: [{ amount: 454, label: "1-lb bag" }, { amount: 907, label: "2-lb bag" }],

  // Produce
  garlic: [{ amount: 10, label: "head (about 10 cloves)" }],
  "green-onion": [{ amount: 7, label: "bunch (about 7)" }],
  celery: [{ amount: 8, label: "bunch (about 8 stalks)" }],
  "baby-potatoes": [{ amount: 680, label: "1.5-lb bag" }],
  "sweet-potatoes": [{ amount: 250, label: "medium sweet potato" }],
  "green-beans": [{ amount: 340, label: "12-oz bag" }],
  spinach: [{ amount: 142, label: "5-oz box" }, { amount: 283, label: "10-oz bag" }],
  kale: [{ amount: 200, label: "bunch" }],
  ginger: [{ amount: 15, label: "2-inch piece" }],
  basil: [{ amount: 21, label: "0.75-oz pack" }, { amount: 57, label: "2-oz pack" }],
  parsley: [{ amount: 60, label: "bunch" }],
  cilantro: [{ amount: 30, label: "bunch" }],
  mint: [{ amount: 21, label: "0.75-oz pack" }],
  berries: [{ amount: 170, label: "6-oz container" }, { amount: 454, label: "1-lb container" }],
  "cherry-tomatoes": [{ amount: 283, label: "10-oz pint" }],
  broccoli: [{ amount: 340, label: "12-oz bag of florets" }],
  mushrooms: [{ amount: 227, label: "8-oz pack" }, { amount: 454, label: "16-oz pack" }],
  cabbage: [{ amount: 900, label: "head (about 2 lb)" }],
  cauliflower: [{ amount: 600, label: "head" }],

  // Frozen
  "peas-carrots": [{ amount: 340, label: "12-oz bag" }, { amount: 454, label: "1-lb bag" }],
  "frozen-corn": [{ amount: 340, label: "12-oz bag" }, { amount: 454, label: "1-lb bag" }],

  // Bread
  "corn-tortillas": [{ amount: 10, label: "pack of 10" }, { amount: 30, label: "pack of 30" }],
  "flour-tortillas": [{ amount: 8, label: "pack of 8" }],
  bread: [{ amount: 16, label: "loaf (about 16 slices)" }],
  pita: [{ amount: 6, label: "pack of 6" }],
};
