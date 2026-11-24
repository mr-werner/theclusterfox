// The store sections a grocery list is sorted into, in the order most stores
// lay them out. Each item lands in the first section with a word it matches;
// anything else goes to "Other", and the shopper can move it.

export const SECTIONS = [
  { id: "produce", name: "Produce", words: ["apple", "banana", "berry", "berries", "grape", "orange", "lemon", "lime", "avocado", "lettuce", "spinach", "kale", "salad", "tomato", "potato", "onion", "garlic", "pepper", "carrot", "celery", "cucumber", "broccoli", "cauliflower", "zucchini", "squash", "mushroom", "herb", "cilantro", "parsley", "basil", "ginger", "peach", "pear", "plum", "melon", "watermelon", "pineapple", "mango", "cabbage", "corn on", "green bean", "asparagus", "fruit", "veggie", "vegetable", "sweet potato", "jalapeno", "scallion", "green onion"] },
  { id: "bakery", name: "Bakery & bread", words: ["bread", "bagel", "bun", "roll", "tortilla", "muffin", "croissant", "pita", "naan", "cake", "donut", "english muffin"] },
  { id: "meat", name: "Meat & seafood", words: ["chicken", "beef", "steak", "pork", "bacon", "sausage", "turkey", "ham", "ground", "salmon", "tuna steak", "shrimp", "fish", "tilapia", "cod", "lamb", "hot dog", "deli", "meat"] },
  { id: "dairy", name: "Dairy & eggs", words: ["milk", "egg", "cheese", "butter", "yogurt", "yoghurt", "cream", "sour cream", "cottage", "half and half", "creamer", "margarine"] },
  { id: "frozen", name: "Frozen", words: ["frozen", "ice cream", "pizza", "waffle", "popsicle", "ice"] },
  { id: "pantry", name: "Pantry", words: ["rice", "pasta", "noodle", "flour", "sugar", "oil", "vinegar", "sauce", "salsa", "soup", "broth", "stock", "bean", "lentil", "cereal", "oat", "oatmeal", "peanut butter", "jelly", "jam", "honey", "syrup", "spice", "salt", "pepper flakes", "seasoning", "ketchup", "mustard", "mayo", "dressing", "canned", "can of", "baking", "yeast", "nut", "almond", "coffee", "tea"] },
  { id: "snacks", name: "Snacks", words: ["chip", "cracker", "cookie", "candy", "chocolate", "popcorn", "pretzel", "granola", "bar", "snack", "jerky", "trail mix"] },
  { id: "drinks", name: "Drinks", words: ["water", "soda", "juice", "sparkling", "beer", "wine", "kombucha", "sports drink", "energy drink", "lemonade", "pop"] },
  { id: "household", name: "Household", words: ["paper towel", "toilet paper", "tissue", "napkin", "trash bag", "garbage bag", "foil", "plastic wrap", "zip", "detergent", "dish soap", "dishwasher", "bleach", "cleaner", "sponge", "battery", "batteries", "light bulb", "laundry"] },
  { id: "care", name: "Personal care", words: ["shampoo", "conditioner", "soap", "body wash", "toothpaste", "toothbrush", "floss", "deodorant", "razor", "lotion", "sunscreen", "vitamin", "medicine", "bandage", "tampon", "pad"] },
  { id: "baby", name: "Baby", words: ["diaper", "wipes", "formula", "baby food"] },
  { id: "pet", name: "Pet", words: ["dog food", "cat food", "litter", "pet", "treats"] },
  { id: "other", name: "Other", words: [] },
];

export const SECTION_IDS = SECTIONS.map(s => s.id);
export const sectionName = id => SECTIONS.find(s => s.id === id)?.name ?? "Other";

// CookFox's aisles, in GroceryFox's sections.
export const FROM_COOK_AISLE = { produce: "produce", meat: "meat", dairy: "dairy", pantry: "pantry", spices: "pantry", baking: "pantry", bakery: "bakery", frozen: "frozen" };

const wordRe = w => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
const compiled = SECTIONS.map(s => ({ id: s.id, res: s.words.map(w => [w, wordRe(w)]) }));

// The section an item name belongs in. Longer (more specific) words win, so
// "peanut butter" is pantry, not dairy, and "ice cream" is frozen.
export function guessSection(name) {
  const text = String(name ?? "").toLowerCase();
  let best = { id: "other", len: 0 };
  for (const s of compiled) {
    for (const [w, re] of s.res) if (w.length > best.len && re.test(text)) best = { id: s.id, len: w.length };
  }
  return best.id;
}
