// Meals that aren't a CookFox recipe: simple grab-and-go food (no cooking)
// and typical restaurant orders. Values are per portion as described, and
// are rough typical figures, close enough to plan with:
//   kcal, protein / carbs / fat in grams, cost in dollars, veg in fists.
// Restaurant entries are generic dishes, not any chain's menu item.

export const GRAB = [
  { id: "coffee-black", name: "Black coffee", amount: "12-oz mug", kcal: 5, protein: 0, carbs: 0, fat: 0, cost: 0.4, slots: ["breakfast", "snack"] },
  { id: "coffee-milk", name: "Coffee with milk and sugar", amount: "12 oz, 2 tbsp milk, 1 tsp sugar", kcal: 45, protein: 1, carbs: 7, fat: 1, cost: 0.5, slots: ["breakfast", "snack"] },
  { id: "latte-home", name: "Latte made at home", amount: "12 oz with 2% milk", kcal: 150, protein: 10, carbs: 15, fat: 6, cost: 1.2, slots: ["breakfast", "snack"] },
  { id: "protein-coffee", name: "Coffee and a protein shake", amount: "coffee + 11-oz ready-to-drink shake", kcal: 165, protein: 30, carbs: 6, fat: 3, cost: 3, slots: ["breakfast", "lunch", "snack"], tip: "An easy way to get protein in without eating a meal." },
  { id: "banana", name: "Banana", amount: "1 medium", kcal: 105, protein: 1, carbs: 27, fat: 0, cost: 0.3, slots: ["breakfast", "snack"] },
  { id: "apple-pb", name: "Apple with peanut butter", amount: "1 apple + 1 tbsp", kcal: 190, protein: 4, carbs: 26, fat: 8, cost: 1, slots: ["breakfast", "snack"] },
  { id: "greek-yogurt-cup", name: "Greek yogurt cup with honey", amount: "5.3-oz cup + 1 tsp honey", kcal: 120, protein: 15, carbs: 13, fat: 0, cost: 1.2, slots: ["breakfast", "snack"] },
  { id: "pb-toast", name: "Peanut butter toast", amount: "1 slice whole wheat + 1 tbsp", kcal: 190, protein: 8, carbs: 18, fat: 10, cost: 0.5, slots: ["breakfast", "snack"] },
  { id: "eggs-boiled", name: "Hard-boiled eggs", amount: "2 eggs", kcal: 155, protein: 13, carbs: 1, fat: 11, cost: 0.7, slots: ["breakfast", "snack"], tip: "Boil a dozen on Sunday and they're ready all week." },
  { id: "cottage-fruit", name: "Cottage cheese with fruit", amount: "½ cup + ½ cup berries", kcal: 150, protein: 13, carbs: 15, fat: 3, cost: 1.5, slots: ["breakfast", "snack"] },
  { id: "string-cheese-apple", name: "String cheese and an apple", amount: "1 stick + 1 apple", kcal: 175, protein: 7, carbs: 25, fat: 6, cost: 1.3, slots: ["snack"] },
  { id: "protein-bar", name: "Protein bar", amount: "1 bar (about 60 g)", kcal: 210, protein: 20, carbs: 22, fat: 7, cost: 2, slots: ["breakfast", "snack"] },
  { id: "trail-mix", name: "Trail mix", amount: "¼ cup", kcal: 175, protein: 5, carbs: 16, fat: 11, cost: 0.6, slots: ["snack"], tip: "Easy to overdo. Pour ¼ cup instead of eating from the bag." },
  { id: "hummus-veg", name: "Hummus and cut veggies", amount: "¼ cup hummus + 1 cup veg", kcal: 180, protein: 6, carbs: 18, fat: 10, cost: 1.5, veg: 1, slots: ["snack"] },
  { id: "cereal-milk", name: "Cereal and milk", amount: "1 cup cereal + 1 cup 2% milk", kcal: 250, protein: 10, carbs: 40, fat: 5, cost: 0.9, slots: ["breakfast"] },
  { id: "smoothie", name: "Banana peanut butter protein smoothie", amount: "16 oz: banana, 1 tbsp PB, milk, 1 scoop protein", kcal: 400, protein: 34, carbs: 45, fat: 11, cost: 2.5, slots: ["breakfast", "lunch"] },
  { id: "turkey-wrap", name: "Turkey and cheese wrap", amount: "1 tortilla, 3 oz turkey, 1 slice cheese, lettuce", kcal: 330, protein: 24, carbs: 28, fat: 13, cost: 2.5, veg: 0.5, slots: ["lunch"] },
  { id: "tuna-crackers", name: "Tuna pouch and crackers", amount: "2.5-oz pouch + 10 crackers", kcal: 260, protein: 18, carbs: 22, fat: 10, cost: 2.2, slots: ["lunch", "snack"] },
  { id: "frozen-meal", name: "Frozen bowl meal", amount: "1 bowl (check the label for 20 g+ protein)", kcal: 350, protein: 20, carbs: 40, fat: 10, cost: 4, veg: 1, slots: ["lunch", "dinner"] },
  { id: "rotisserie-salad", name: "Rotisserie chicken and bagged salad", amount: "¼ chicken (no skin) + 2 cups salad kit", kcal: 450, protein: 42, carbs: 14, fat: 24, cost: 6, veg: 2, slots: ["lunch", "dinner"], tip: "A whole rotisserie chicken covers about four of these." },
];

export const EAT_OUT = [
  { id: "breakfast-sandwich", name: "Egg and cheese breakfast sandwich", amount: "on an English muffin", kcal: 300, protein: 17, carbs: 28, fat: 13, cost: 5, slots: ["breakfast"], tip: "Pick an English muffin over a croissant or biscuit (about 150 cal less)." },
  { id: "cafe-latte", name: "Coffee shop latte", amount: "16 oz, 2% milk", kcal: 190, protein: 12, carbs: 18, fat: 7, cost: 5, slots: ["breakfast", "snack"], tip: "Flavored syrups add about 20 cal a pump; whipped cream about 80." },
  { id: "burrito-bowl", name: "Burrito bowl", amount: "chicken, rice, beans, fajita veg, salsa", kcal: 650, protein: 45, carbs: 70, fat: 18, cost: 12, veg: 1, slots: ["lunch", "dinner"], tip: "Skip the sour cream and cheese (about 200 cal), or ask for half rice." },
  { id: "chicken-salad", name: "Salad with grilled chicken", amount: "entrée size", kcal: 500, protein: 40, carbs: 20, fat: 28, cost: 13, veg: 3, slots: ["lunch", "dinner"], tip: "Ask for dressing on the side. Restaurant dressing can add 300 cal." },
  { id: "chicken-sandwich", name: "Grilled chicken sandwich", amount: "with lettuce and tomato", kcal: 450, protein: 35, carbs: 40, fat: 15, cost: 9, veg: 0.5, slots: ["lunch", "dinner"], tip: "Grilled instead of fried saves about 250 cal." },
  { id: "turkey-sub", name: "Turkey sub", amount: "6-inch on wheat, veggies, mustard", kcal: 400, protein: 25, carbs: 48, fat: 10, cost: 8, veg: 0.5, slots: ["lunch"], tip: "Mustard instead of mayo saves about 100 cal." },
  { id: "burger-salad", name: "Burger with a side salad", amount: "single patty, side salad instead of fries", kcal: 700, protein: 35, carbs: 45, fat: 40, cost: 14, veg: 1, slots: ["lunch", "dinner"], tip: "Swapping fries for a side salad saves about 300 cal." },
  { id: "pizza", name: "Pizza and a side salad", amount: "2 slices thin crust + side salad", kcal: 600, protein: 25, carbs: 60, fat: 28, cost: 10, veg: 1, slots: ["lunch", "dinner"], tip: "Thin crust and veggie toppings. Two slices is a portion; box the rest." },
  { id: "noodle-soup", name: "Vietnamese noodle soup", amount: "regular bowl with beef or chicken", kcal: 500, protein: 30, carbs: 65, fat: 10, cost: 13, veg: 1, slots: ["lunch", "dinner"], tip: "The broth is light. Ask for extra meat and herbs." },
  { id: "sushi", name: "Sushi roll and miso soup", amount: "8-piece roll + miso", kcal: 450, protein: 20, carbs: 70, fat: 9, cost: 14, slots: ["lunch", "dinner"], tip: "Sashimi or a plain fish roll beats tempura and spicy-mayo rolls." },
  { id: "teriyaki-plate", name: "Chicken teriyaki plate", amount: "chicken, rice, steamed veg", kcal: 750, protein: 45, carbs: 95, fat: 18, cost: 12, veg: 1, slots: ["lunch", "dinner"], tip: "Ask for sauce on the side and swap half the rice for veg." },
  { id: "thai-curry", name: "Thai curry with rice", amount: "full restaurant plate", kcal: 850, protein: 30, carbs: 90, fat: 40, cost: 15, veg: 1, slots: ["dinner"], tip: "Curries are rich. Box half before you start and it's tomorrow's lunch." },
  { id: "restaurant-pasta", name: "Restaurant pasta", amount: "full plate", kcal: 1000, protein: 35, carbs: 120, fat: 40, cost: 18, slots: ["dinner"], tip: "A restaurant plate of pasta is often two or three portions. Eat half." },
  { id: "steak-dinner", name: "Steak dinner", amount: "6-oz sirloin, baked potato, vegetables", kcal: 750, protein: 50, carbs: 55, fat: 35, cost: 28, veg: 1, slots: ["dinner"], tip: "Get butter and sour cream on the side. Sirloin and filet are leaner cuts." },
  { id: "fried-chicken", name: "Fried chicken meal", amount: "2 pieces + 1 side", kcal: 800, protein: 45, carbs: 45, fat: 48, cost: 11, slots: ["lunch", "dinner"], tip: "Take the skin off one piece (about 150 cal) and pick green beans or corn as the side." },
];

const all = [...GRAB.map(f => ({ ...f, kind: "grab" })), ...EAT_OUT.map(f => ({ ...f, kind: "out" }))];
export const quickById = new Map(all.map(f => [f.id, f]));
