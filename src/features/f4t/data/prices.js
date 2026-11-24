// Typical US grocery prices, used to estimate what a meal plan costs. They
// are rough averages (late 2025), not any one store's prices: good enough to
// keep a week inside a budget, and the shopper can compare real store prices
// in CookFox.
//
// Each value is dollars per kilogram for ingredients measured in grams,
// dollars per liter for milliliters, and dollars per one for counted items,
// matching the canonical units in CookFox's ingredient catalog.

export const PRICES = {
  // Pantry
  salt: 1.5, "black-pepper": 45, "olive-oil": 12, "neutral-oil": 5, "sesame-oil": 25, "soy-sauce": 9,
  honey: 20, "maple-syrup": 35, vanilla: 150, "chicken-broth": 3, "vegetable-broth": 3.2,
  "crushed-tomatoes": 3.5, "tomato-paste": 6, "coconut-milk": 6, "light-coconut-milk": 6,
  "black-beans": 4.5, "kidney-beans": 4.5, chickpeas: 4.5, "white-beans": 4.5,
  spaghetti: 3, penne: 3, "ww-spaghetti": 4, "gf-spaghetti": 7, "gf-penne": 7, "rice-noodles": 8,
  rice: 3, "cooked-rice": 1.5, "brown-rice": 3.5, "cooked-brown-rice": 1.7, couscous: 8, quinoa: 10,
  "rolled-oats": 4, "chia-seeds": 12, "red-lentils": 5, "brown-lentils": 4,
  "peanut-butter": 6, tahini: 18, dijon: 12, panko: 10, "nutritional-yeast": 35,
  tamari: 16, "popcorn-kernels": 5, "coconut-aminos": 25, "rice-vinegar": 8, gochujang: 18, peanuts: 9, olives: 18, raisins: 9,
  // Spices
  oregano: 100, thyme: 100, "smoked-paprika": 70, cumin: 60, "chili-powder": 50, "curry-powder": 70,
  "red-pepper-flakes": 60, cinnamon: 50, "bay-leaf": 0.15, "garam-masala": 80, turmeric: 60, coriander: 60,
  "sesame-seeds": 15, cardamom: 200, allspice: 80,
  // Baking
  flour: 1.5, "gf-flour": 8, sugar: 2.2, "brown-sugar": 3, "baking-powder": 12, "baking-soda": 3,
  cornstarch: 6, cocoa: 25, "chocolate-chips": 12, "df-chocolate-chips": 20, "sliced-almonds": 18,
  cornmeal: 3, "flax-egg": 0.15,
  // Dairy & eggs
  butter: 10, "plant-butter": 14, milk: 1.1, "oat-milk": 3.5, "almond-milk": 3, "heavy-cream": 9,
  "greek-yogurt": 6, "coconut-yogurt": 10, parmesan: 22, feta: 16, cheddar: 13, mozzarella: 11, ricotta: 9,
  egg: 0.35,
  // Meat & fish
  "chicken-thighs": 8, "chicken-breast": 9, "ground-beef": 12, "ground-turkey": 11, "ground-pork": 8,
  "pork-chops": 9, "pork-shoulder": 7, "beef-chuck": 15, "flank-steak": 20, "canned-tuna": 14, salmon: 22, cod: 20, shrimp: 22,
  // Produce (counted items are priced per one; a garlic "one" is a clove)
  garlic: 0.07, onion: 0.9, "red-onion": 1, "green-onion": 0.12, carrot: 0.2, celery: 0.25,
  "bell-pepper": 1.2, lemon: 0.7, lime: 0.4, avocado: 1.3, cucumber: 0.9, banana: 0.3, zucchini: 1,
  eggplant: 2, tomato: 0.6, jalapeno: 0.15, apple: 0.9, mango: 1.2, orange: 0.9, pineapple: 3.5,
  "baby-potatoes": 4.4, "sweet-potatoes": 3, "green-beans": 5.5, spinach: 9, kale: 8, ginger: 9,
  basil: 100, parsley: 25, cilantro: 25, mint: 60, dill: 60, berries: 11, "cherry-tomatoes": 8,
  broccoli: 6, mushrooms: 9, cabbage: 2.2, cauliflower: 6, "firm-tofu": 5.5,
  // Frozen
  "peas-carrots": 4, "frozen-corn": 4, "frozen-peas": 4,
  // Bread
  "corn-tortillas": 0.1, "flour-tortillas": 0.3, bread: 0.5, pita: 0.5, "burger-buns": 0.6,
};

// For an ingredient this table doesn't know yet, a typical price for its aisle.
const AISLE_FALLBACK = { produce: 6, meat: 12, dairy: 10, pantry: 6, spices: 70, baking: 6, bakery: 0.5, frozen: 4 };

/** Dollars for one canonical unit (a gram, a milliliter, or one) of an ingredient. */
export function pricePerUnit(item) {
  if (!item) return 0;
  const base = PRICES[item.id] ?? AISLE_FALLBACK[item.aisle] ?? 6;
  return item.unit === "each" ? base : base / 1000;
}
