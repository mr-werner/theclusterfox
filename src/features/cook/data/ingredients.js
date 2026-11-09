// The ingredient catalog. Recipes store every quantity in an ingredient's
// canonical unit (grams, milliliters or a count) and the display layer converts
// from here, so switching Volume/Weight never loses precision.
//
// unit      canonical unit: "g", "ml" or "each"
// us        for "g" items, how Volume mode shows them: "volume" (cups, spoons)
//           or "weight" (oz, lb), since nobody measures chicken in cups
// gPerCup   grams in one US cup, for "g" items shown by volume. Every ingredient
//           has its own; flour and sugar are nowhere near each other.
// density   grams per milliliter, for "ml" items (used for nutrition)
// gEach     grams in one, for "each" items (used for nutrition)
// whole     counts that should round to whole numbers (you can't add 1.5 eggs)
// n         approximate nutrition per 100 g, from USDA FoodData Central values:
//           [kcal, protein g, carbs g, fat g, fiber g, sugar g, sodium mg]

export const ALLERGENS = {
  milk: "Milk",
  egg: "Egg",
  gluten: "Gluten (wheat)",
  soy: "Soy",
  fish: "Fish",
  shellfish: "Shellfish",
  peanut: "Peanuts",
  treenut: "Tree nuts",
  sesame: "Sesame",
};

export const AISLES = {
  produce: "Produce",
  meat: "Meat & fish",
  dairy: "Dairy & eggs",
  pantry: "Pantry",
  spices: "Spices",
  baking: "Baking",
  bakery: "Bread & tortillas",
  frozen: "Frozen",
};

export const ingredients = [
  // Pantry basics
  { id: "salt", name: "fine salt", unit: "g", us: "volume", gPerCup: 288, aisle: "spices", n: [0, 0, 0, 0, 0, 0, 38758] },
  { id: "black-pepper", name: "ground black pepper", unit: "g", us: "volume", gPerCup: 110, aisle: "spices", aliases: ["pepper"], n: [251, 10, 64, 3, 25, 0.6, 20] },
  { id: "olive-oil", name: "olive oil", unit: "ml", density: 0.91, aisle: "pantry", aliases: ["oil"], n: [884, 0, 0, 100, 0, 0, 2] },
  { id: "neutral-oil", name: "neutral oil", unit: "ml", density: 0.92, aisle: "pantry", aliases: ["oil", "vegetable oil", "canola oil"], n: [884, 0, 0, 100, 0, 0, 0] },
  { id: "sesame-oil", name: "toasted sesame oil", unit: "ml", density: 0.92, aisle: "pantry", allergens: ["sesame"], aliases: ["oil", "sesame"], n: [884, 0, 0, 100, 0, 0, 0] },
  { id: "soy-sauce", name: "soy sauce", unit: "ml", density: 1.15, aisle: "pantry", allergens: ["soy", "gluten"], aliases: ["soy", "wheat"], n: [53, 8.1, 4.9, 0.6, 0.8, 0.4, 5493], note: "Use tamari labeled gluten-free if you avoid gluten." },
  { id: "honey", name: "honey", unit: "ml", density: 1.42, aisle: "pantry", animal: "honey", n: [304, 0.3, 82, 0, 0.2, 82, 4] },
  { id: "maple-syrup", name: "maple syrup", unit: "ml", density: 1.32, aisle: "pantry", n: [260, 0, 67, 0.1, 0, 60, 12] },
  { id: "vanilla", name: "vanilla extract", unit: "ml", density: 0.88, aisle: "baking", n: [288, 0.1, 12.7, 0.1, 0, 12.7, 9] },
  { id: "chicken-broth", name: "low-sodium chicken broth", unit: "ml", density: 1, aisle: "pantry", animal: "meat", aliases: ["chicken", "broth", "stock"], n: [7, 1.1, 0.4, 0.2, 0, 0.2, 140] },
  { id: "crushed-tomatoes", name: "canned crushed tomatoes", unit: "g", us: "volume", gPerCup: 242, aisle: "pantry", aliases: ["tomato"], n: [32, 1.6, 7.3, 0.3, 1.9, 4.4, 186] },
  { id: "tomato-paste", name: "tomato paste", unit: "g", us: "volume", gPerCup: 262, aisle: "pantry", aliases: ["tomato"], n: [82, 4.3, 19, 0.5, 4.1, 12, 59] },
  { id: "coconut-milk", name: "canned coconut milk", unit: "ml", density: 0.97, aisle: "pantry", aliases: ["coconut"], n: [197, 2, 2.8, 21.3, 0, 3.3, 13], note: "Coconut isn't a major allergen in the US, but some people with tree-nut allergies avoid it." },
  { id: "black-beans", name: "canned black beans, drained", unit: "g", us: "volume", gPerCup: 172, aisle: "pantry", aliases: ["beans"], n: [91, 6, 16.6, 0.3, 6.9, 0.3, 200] },
  { id: "kidney-beans", name: "canned kidney beans, drained", unit: "g", us: "volume", gPerCup: 177, aisle: "pantry", aliases: ["beans"], n: [84, 5.2, 15, 0.4, 5.4, 2, 230] },
  { id: "chickpeas", name: "canned chickpeas, drained", unit: "g", us: "volume", gPerCup: 164, aisle: "pantry", aliases: ["garbanzo", "beans"], n: [139, 7, 22.5, 2.6, 7, 0, 246] },
  { id: "spaghetti", name: "dried spaghetti", unit: "g", us: "weight", aisle: "pantry", allergens: ["gluten"], aliases: ["pasta", "wheat"], n: [371, 13, 75, 1.5, 3.2, 2.7, 6] },
  { id: "rice", name: "long-grain white rice", unit: "g", us: "volume", gPerCup: 185, aisle: "pantry", n: [365, 7.1, 80, 0.7, 1.3, 0.1, 5] },
  { id: "cooked-rice", name: "cold cooked rice", unit: "g", us: "volume", gPerCup: 158, aisle: "pantry", aliases: ["rice"], n: [130, 2.7, 28, 0.3, 0.4, 0, 1] },
  { id: "rolled-oats", name: "rolled oats", unit: "g", us: "volume", gPerCup: 80, aisle: "pantry", allergens: ["gluten"], aliases: ["oats"], n: [379, 13, 68, 6.5, 10, 1, 6], note: "Oats are often processed with wheat. Choose oats labeled gluten-free if you avoid gluten." },
  { id: "chia-seeds", name: "chia seeds", unit: "g", us: "volume", gPerCup: 192, aisle: "pantry", aliases: ["chia"], n: [486, 17, 42, 31, 34, 0, 16] },
  { id: "chocolate-chips", name: "semisweet chocolate chips", unit: "g", us: "volume", gPerCup: 170, aisle: "baking", allergens: ["milk", "soy"], animal: "dairy", aliases: ["chocolate"], n: [479, 4.2, 63.9, 30, 5.9, 54.5, 11], note: "Most chips contain milk and soy lecithin. Check the label." },

  // Spices and herbs
  { id: "oregano", name: "dried oregano", unit: "g", us: "volume", gPerCup: 48, aisle: "spices", n: [265, 9, 69, 4.3, 42.5, 4.1, 25] },
  { id: "thyme", name: "dried thyme", unit: "g", us: "volume", gPerCup: 48, aisle: "spices", n: [276, 9.1, 64, 7.4, 37, 1.7, 55] },
  { id: "smoked-paprika", name: "smoked paprika", unit: "g", us: "volume", gPerCup: 110, aisle: "spices", aliases: ["paprika"], n: [282, 14, 54, 13, 35, 10, 68] },
  { id: "cumin", name: "ground cumin", unit: "g", us: "volume", gPerCup: 100, aisle: "spices", n: [375, 18, 44, 22, 11, 2.3, 168] },
  { id: "chili-powder", name: "chili powder", unit: "g", us: "volume", gPerCup: 128, aisle: "spices", aliases: ["chili"], n: [282, 13.5, 50, 14, 35, 7, 1640] },
  { id: "curry-powder", name: "curry powder", unit: "g", us: "volume", gPerCup: 100, aisle: "spices", aliases: ["curry"], n: [325, 14, 56, 14, 53, 2.8, 52] },
  { id: "red-pepper-flakes", name: "red pepper flakes", unit: "g", us: "volume", gPerCup: 85, aisle: "spices", aliases: ["chili", "pepper"], n: [318, 12, 57, 17, 27, 10, 30] },
  { id: "cinnamon", name: "ground cinnamon", unit: "g", us: "volume", gPerCup: 125, aisle: "spices", n: [247, 4, 81, 1.2, 53, 2.2, 10] },
  { id: "bay-leaf", name: "bay leaf", plural: "bay leaves", unit: "each", gEach: 0.2, aisle: "spices", n: [313, 7.6, 75, 8.4, 26, 0, 23] },

  // Baking
  { id: "flour", name: "all-purpose flour", unit: "g", us: "volume", gPerCup: 125, aisle: "baking", allergens: ["gluten"], aliases: ["wheat"], n: [364, 10.3, 76, 1, 2.7, 0.3, 2] },
  { id: "sugar", name: "granulated sugar", unit: "g", us: "volume", gPerCup: 200, aisle: "baking", n: [387, 0, 100, 0, 0, 100, 1] },
  { id: "brown-sugar", name: "packed brown sugar", unit: "g", us: "volume", gPerCup: 213, aisle: "baking", aliases: ["sugar"], n: [380, 0.1, 98, 0, 0, 97, 28] },
  { id: "baking-powder", name: "baking powder", unit: "g", us: "volume", gPerCup: 220, aisle: "baking", n: [53, 0, 28, 0, 0.2, 0, 10600] },
  { id: "baking-soda", name: "baking soda", unit: "g", us: "volume", gPerCup: 220, aisle: "baking", n: [0, 0, 0, 0, 0, 0, 27360] },

  // Dairy and eggs
  { id: "butter", name: "unsalted butter", unit: "g", us: "volume", gPerCup: 227, aisle: "dairy", allergens: ["milk"], animal: "dairy", n: [717, 0.9, 0.1, 81, 0, 0.1, 11] },
  { id: "milk", name: "milk", unit: "ml", density: 1.03, aisle: "dairy", allergens: ["milk"], animal: "dairy", n: [61, 3.2, 4.8, 3.3, 0, 5, 43] },
  { id: "greek-yogurt", name: "plain Greek yogurt", unit: "g", us: "volume", gPerCup: 245, aisle: "dairy", allergens: ["milk"], animal: "dairy", aliases: ["yogurt"], n: [73, 10, 3.9, 1.9, 0, 3.6, 34] },
  { id: "parmesan", name: "grated Parmesan", unit: "g", us: "volume", gPerCup: 100, aisle: "dairy", allergens: ["milk"], animal: "dairy", aliases: ["cheese"], n: [420, 28.4, 13.9, 27.8, 0, 0.9, 1804], note: "Traditional Parmesan is made with animal rennet. Look for a vegetarian hard cheese if that matters to you." },
  { id: "feta", name: "crumbled feta", unit: "g", us: "volume", gPerCup: 150, aisle: "dairy", allergens: ["milk"], animal: "dairy", aliases: ["cheese"], n: [265, 14, 3.9, 21, 0, 4, 917] },
  { id: "egg", name: "large egg", plural: "large eggs", unit: "each", gEach: 50, whole: true, aisle: "dairy", allergens: ["egg"], animal: "egg", aliases: ["eggs"], n: [143, 12.6, 0.7, 9.5, 0, 0.4, 142] },

  // Meat and fish
  { id: "chicken-thighs", name: "boneless, skinless chicken thighs", unit: "g", us: "weight", aisle: "meat", animal: "meat", aliases: ["chicken", "poultry"], n: [121, 19.7, 0, 4.1, 0, 0, 95] },
  { id: "ground-beef", name: "85% lean ground beef", unit: "g", us: "weight", aisle: "meat", animal: "meat", aliases: ["beef", "meat"], n: [215, 18.6, 0, 15, 0, 0, 66] },
  { id: "salmon", name: "salmon fillets", unit: "g", us: "weight", aisle: "meat", allergens: ["fish"], animal: "fish", aliases: ["fish"], n: [208, 20, 0, 13.4, 0, 0, 59] },

  // Produce
  { id: "garlic", name: "garlic", unit: "each", gEach: 3, countUnit: ["clove", "cloves"], aisle: "produce", n: [149, 6.4, 33, 0.5, 2.1, 1, 17] },
  { id: "onion", name: "yellow onion", plural: "yellow onions", unit: "each", gEach: 150, aisle: "produce", aliases: ["onions"], n: [40, 1.1, 9.3, 0.1, 1.7, 4.2, 4] },
  { id: "green-onion", name: "green onion", plural: "green onions", unit: "each", gEach: 15, aisle: "produce", aliases: ["scallion", "onion"], n: [32, 1.8, 7.3, 0.2, 2.6, 2.3, 16] },
  { id: "carrot", name: "carrot", plural: "carrots", unit: "each", gEach: 60, aisle: "produce", n: [41, 0.9, 9.6, 0.2, 2.8, 4.7, 69] },
  { id: "celery", name: "celery", unit: "each", gEach: 40, countUnit: ["stalk", "stalks"], aisle: "produce", n: [14, 0.7, 3, 0.2, 1.6, 1.3, 80] },
  { id: "bell-pepper", name: "bell pepper", plural: "bell peppers", unit: "each", gEach: 120, aisle: "produce", aliases: ["pepper"], n: [26, 1, 6, 0.3, 2.1, 4.2, 4] },
  { id: "lemon", name: "lemon", plural: "lemons", unit: "each", gEach: 85, aisle: "produce", n: [29, 1.1, 9.3, 0.3, 2.8, 2.5, 2] },
  { id: "lime", name: "lime", plural: "limes", unit: "each", gEach: 67, aisle: "produce", n: [30, 0.7, 10.5, 0.2, 2.8, 1.7, 2] },
  { id: "avocado", name: "ripe avocado", plural: "ripe avocados", unit: "each", gEach: 150, aisle: "produce", n: [160, 2, 8.5, 14.7, 6.7, 0.7, 7] },
  { id: "baby-potatoes", name: "baby potatoes", unit: "g", us: "weight", aisle: "produce", aliases: ["potato"], n: [77, 2, 17.5, 0.1, 2.2, 0.8, 6] },
  { id: "sweet-potatoes", name: "sweet potatoes", unit: "g", us: "weight", aisle: "produce", aliases: ["potato", "sweet potato"], n: [86, 1.6, 20, 0.1, 3, 4.2, 55] },
  { id: "green-beans", name: "green beans", unit: "g", us: "weight", aisle: "produce", aliases: ["beans"], n: [31, 1.8, 7, 0.2, 2.7, 3.3, 6] },
  { id: "spinach", name: "baby spinach", unit: "g", us: "volume", gPerCup: 30, aisle: "produce", n: [23, 2.9, 3.6, 0.4, 2.2, 0.4, 79] },
  { id: "ginger", name: "fresh ginger, grated", unit: "g", us: "volume", gPerCup: 96, aisle: "produce", n: [80, 1.8, 18, 0.8, 2, 1.7, 13] },
  { id: "basil", name: "fresh basil leaves", unit: "g", us: "volume", gPerCup: 24, aisle: "produce", n: [23, 3.2, 2.7, 0.6, 1.6, 0.3, 4] },
  { id: "parsley", name: "fresh parsley, chopped", unit: "g", us: "volume", gPerCup: 60, aisle: "produce", n: [36, 3, 6.3, 0.8, 3.3, 0.9, 56] },
  { id: "cilantro", name: "fresh cilantro, chopped", unit: "g", us: "volume", gPerCup: 16, aisle: "produce", n: [23, 2.1, 3.7, 0.5, 2.8, 0.9, 46] },
  { id: "berries", name: "mixed berries", unit: "g", us: "volume", gPerCup: 145, aisle: "produce", aliases: ["berry", "blueberries", "strawberries", "raspberries"], n: [50, 0.7, 12, 0.3, 2.4, 7.6, 1] },
  { id: "peas-carrots", name: "frozen peas and carrots", unit: "g", us: "volume", gPerCup: 134, aisle: "frozen", aliases: ["peas", "carrot"], n: [53, 3.4, 11, 0.4, 3.4, 3.5, 79] },

  // Bread
  { id: "corn-tortillas", name: "corn tortilla", plural: "corn tortillas", unit: "each", gEach: 26, aisle: "bakery", aliases: ["tortilla"], n: [218, 5.7, 44.6, 2.9, 6.3, 0.9, 45] },
  { id: "flour-tortillas", name: "large flour tortilla", plural: "large flour tortillas", unit: "each", gEach: 45, aisle: "bakery", allergens: ["gluten"], aliases: ["tortilla", "wheat"], n: [306, 8.2, 50, 7.8, 3.5, 3, 600] },
  { id: "bread", name: "crusty bread", unit: "each", gEach: 50, countUnit: ["slice", "slices"], aisle: "bakery", allergens: ["gluten"], aliases: ["toast", "wheat"], n: [260, 9, 49, 3.2, 2.5, 4, 500] },

  // Added with the second batch of recipes
  { id: "cheddar", name: "shredded cheddar", unit: "g", us: "volume", gPerCup: 113, aisle: "dairy", allergens: ["milk"], animal: "dairy", aliases: ["cheese"], n: [403, 23, 3.1, 33, 0, 0.5, 650] },
  { id: "heavy-cream", name: "heavy cream", unit: "ml", density: 1, aisle: "dairy", allergens: ["milk"], animal: "dairy", aliases: ["cream"], n: [340, 2.8, 2.7, 36, 0, 2.9, 27] },
  { id: "shrimp", name: "large shrimp, peeled and deveined", unit: "g", us: "weight", aisle: "meat", allergens: ["shellfish"], animal: "fish", aliases: ["prawns", "seafood"], n: [85, 20, 0, 0.5, 0, 0, 119] },
  { id: "ground-turkey", name: "93% lean ground turkey", unit: "g", us: "weight", aisle: "meat", animal: "meat", aliases: ["turkey", "poultry", "meat"], n: [150, 19, 0, 8, 0, 0, 70] },
  { id: "chicken-breast", name: "boneless, skinless chicken breasts", unit: "g", us: "weight", aisle: "meat", animal: "meat", aliases: ["chicken", "poultry"], n: [120, 22.5, 0, 2.6, 0, 0, 45] },
  { id: "pork-chops", name: "boneless pork chops, about 1 inch thick", unit: "g", us: "weight", aisle: "meat", animal: "meat", aliases: ["pork", "meat"], n: [143, 21, 0, 6, 0, 0, 60] },
  { id: "cucumber", name: "cucumber", plural: "cucumbers", unit: "each", gEach: 300, aisle: "produce", n: [15, 0.7, 3.6, 0.1, 0.5, 1.7, 2] },
  { id: "cherry-tomatoes", name: "cherry tomatoes", unit: "g", us: "volume", gPerCup: 149, aisle: "produce", aliases: ["tomato", "grape tomatoes"], n: [18, 0.9, 3.9, 0.2, 1.2, 2.6, 5] },
  { id: "red-onion", name: "red onion", plural: "red onions", unit: "each", gEach: 150, aisle: "produce", aliases: ["onion", "onions"], n: [40, 1.1, 9.3, 0.1, 1.7, 4.2, 4] },
  { id: "broccoli", name: "broccoli florets", unit: "g", us: "volume", gPerCup: 71, aisle: "produce", n: [34, 2.8, 6.6, 0.4, 2.6, 1.7, 33] },
  { id: "mushrooms", name: "cremini mushrooms", unit: "g", us: "weight", aisle: "produce", aliases: ["mushroom"], n: [22, 2.5, 4.3, 0.1, 0.6, 1.7, 6] },
  { id: "banana", name: "ripe banana", plural: "ripe bananas", unit: "each", gEach: 118, aisle: "produce", aliases: ["bananas"], n: [89, 1.1, 23, 0.3, 2.6, 12, 1] },
  { id: "kale", name: "kale, stems removed", unit: "g", us: "volume", gPerCup: 30, aisle: "produce", n: [43, 2.9, 4.4, 1.5, 4.1, 1, 53] },
  { id: "frozen-corn", name: "frozen corn", unit: "g", us: "volume", gPerCup: 136, aisle: "frozen", aliases: ["corn"], n: [88, 3, 21, 0.8, 2.4, 4.5, 1] },
  { id: "red-lentils", name: "red lentils", unit: "g", us: "volume", gPerCup: 192, aisle: "pantry", aliases: ["lentils"], n: [358, 24, 63, 2.2, 11, 2, 7] },
  { id: "vegetable-broth", name: "low-sodium vegetable broth", unit: "ml", density: 1, aisle: "pantry", aliases: ["broth", "stock"], n: [5, 0.2, 1, 0.1, 0, 0.5, 130] },
  { id: "peanut-butter", name: "creamy peanut butter", unit: "g", us: "volume", gPerCup: 258, aisle: "pantry", allergens: ["peanut"], aliases: ["peanut"], n: [588, 25, 20, 50, 6, 9, 430] },
  { id: "tahini", name: "tahini", unit: "g", us: "volume", gPerCup: 240, aisle: "pantry", allergens: ["sesame"], aliases: ["sesame"], n: [595, 17, 21, 54, 9, 0.5, 115] },
  { id: "penne", name: "dried penne", unit: "g", us: "weight", aisle: "pantry", allergens: ["gluten"], aliases: ["pasta", "wheat"], n: [371, 13, 75, 1.5, 3.2, 2.7, 6] },
  { id: "dijon", name: "Dijon mustard", unit: "g", us: "volume", gPerCup: 250, aisle: "pantry", aliases: ["mustard"], n: [66, 4, 6, 3.3, 3.3, 1, 1100] },
  { id: "panko", name: "panko breadcrumbs", unit: "g", us: "volume", gPerCup: 50, aisle: "pantry", allergens: ["gluten"], aliases: ["breadcrumbs", "wheat"], n: [370, 12, 74, 3, 4, 4, 300] },
  { id: "cornstarch", name: "cornstarch", unit: "g", us: "volume", gPerCup: 128, aisle: "baking", aliases: ["corn starch"], n: [381, 0.3, 91, 0.1, 0.9, 0, 9] },
  { id: "cocoa", name: "unsweetened cocoa powder", unit: "g", us: "volume", gPerCup: 86, aisle: "baking", aliases: ["cocoa", "chocolate"], n: [228, 20, 58, 14, 37, 1.8, 21] },

  // Mostly here as swaps, though recipes can use them too
  { id: "plant-butter", name: "plant-based butter", unit: "g", us: "volume", gPerCup: 227, aisle: "dairy", aliases: ["vegan butter"], n: [717, 0, 0, 80, 0, 0, 400] },
  { id: "oat-milk", name: "oat milk", unit: "ml", density: 1.03, aisle: "dairy", aliases: ["oatmilk"], n: [48, 1, 7, 1.5, 0.8, 4, 42], note: "Most oat milk isn't certified gluten-free. Check the label if you avoid gluten." },
  { id: "almond-milk", name: "unsweetened almond milk", unit: "ml", density: 1.01, aisle: "dairy", allergens: ["treenut"], aliases: ["almond"], n: [15, 0.6, 0.3, 1.2, 0.3, 0, 72] },
  { id: "coconut-yogurt", name: "plain coconut yogurt", unit: "g", us: "volume", gPerCup: 245, aisle: "dairy", aliases: ["yogurt", "coconut"], n: [90, 0.5, 8, 6, 0.5, 6, 20] },
  { id: "nutritional-yeast", name: "nutritional yeast", unit: "g", us: "volume", gPerCup: 60, aisle: "pantry", aliases: ["nooch"], n: [400, 50, 33, 5, 20, 0, 50] },
  { id: "flax-egg", name: "flax egg (1 tbsp ground flax + 3 tbsp water)", plural: "flax eggs (1 tbsp ground flax + 3 tbsp water each)", unit: "each", gEach: 52, whole: true, aisle: "baking", aliases: ["flax"], n: [72, 2.5, 3.9, 5.7, 3.7, 0.2, 2] },
  { id: "firm-tofu", name: "firm tofu, pressed", unit: "g", us: "weight", aisle: "produce", allergens: ["soy"], aliases: ["tofu", "soy"], n: [144, 17, 3, 9, 2.3, 0.6, 14] },
  { id: "gf-spaghetti", name: "gluten-free spaghetti", unit: "g", us: "weight", aisle: "pantry", aliases: ["pasta"], n: [357, 7, 79, 1.5, 2, 1, 10] },
  { id: "gf-penne", name: "gluten-free penne", unit: "g", us: "weight", aisle: "pantry", aliases: ["pasta"], n: [357, 7, 79, 1.5, 2, 1, 10] },
  { id: "ww-spaghetti", name: "whole wheat spaghetti", unit: "g", us: "weight", aisle: "pantry", allergens: ["gluten"], aliases: ["pasta", "wheat"], n: [348, 15, 72, 1.6, 9, 3, 8] },
  { id: "tamari", name: "gluten-free tamari", unit: "ml", density: 1.15, aisle: "pantry", allergens: ["soy"], aliases: ["soy", "soy sauce"], n: [60, 10.5, 5.6, 0.1, 0.8, 1.7, 5600] },
  { id: "coconut-aminos", name: "coconut aminos", unit: "ml", density: 1.1, aisle: "pantry", aliases: ["soy sauce"], n: [91, 0, 22, 0, 0, 20, 1640] },
  { id: "gf-flour", name: "gluten-free 1-to-1 baking flour", unit: "g", us: "volume", gPerCup: 140, aisle: "baking", aliases: ["gluten-free flour"], n: [355, 6, 79, 1.5, 3, 0.5, 10], note: "Use a blend labeled 1-to-1 or cup-for-cup; it already has the binder plain rice flour lacks." },
  { id: "light-coconut-milk", name: "canned light coconut milk", unit: "ml", density: 0.98, aisle: "pantry", aliases: ["coconut"], n: [73, 0.7, 1.5, 7, 0, 1, 20] },
  { id: "df-chocolate-chips", name: "dairy-free chocolate chips", unit: "g", us: "volume", gPerCup: 170, aisle: "baking", aliases: ["chocolate"], n: [480, 4, 62, 30, 6, 52, 10], note: "Check the label for soy and for shared equipment with milk." },
  { id: "brown-rice", name: "long-grain brown rice", unit: "g", us: "volume", gPerCup: 190, aisle: "pantry", aliases: ["rice"], n: [367, 7.5, 76, 3.2, 3.4, 0.7, 7] },
  { id: "cooked-brown-rice", name: "cold cooked brown rice", unit: "g", us: "volume", gPerCup: 195, aisle: "pantry", aliases: ["rice", "brown rice"], n: [123, 2.7, 25.6, 1, 1.6, 0.2, 4] },
];

export const ingredientsById = new Map(ingredients.map(i => [i.id, i]));
