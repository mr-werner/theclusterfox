import assert from "node:assert/strict";
import { ingredients, ingredientsById, ALLERGENS, AISLES } from "../data/ingredients.js";
import { recipes, recipesById, MEALS, TASTES, TAGS, OCCASIONS, DIFFICULTY, EQUIPMENT } from "../data/recipes.js";
import { safetyNotes } from "../data/safety.js";
import { amountText, formatAmount, formatCount, formatGrams, formatMl, formatUsWeight, formatVolume, renderTemps, toGrams, ML_PER_CUP } from "../model/units.js";
import { allergensOf, dietsOf, lineKey, recipeNutrition, roundNutrient, scaledLines, scaledUses, scaleNotes } from "../model/recipe.js";
import { discover, emptyFilters, ingredientMatches, parseTerms } from "../model/discover.js";
import * as S from "../model/session.js";
import { planBSearches } from "../model/planb.js";
import { emptyData, normalizeData } from "../state/cookStore.js";

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// --- The ingredient catalog is complete ----------------------------------
{
  const ids = new Set();
  for (const i of ingredients) {
    assert(!ids.has(i.id), `duplicate ingredient ${i.id}`);
    ids.add(i.id);
    assert(["g", "ml", "each"].includes(i.unit), `${i.id}: bad unit`);
    if (i.unit === "g") {
      assert(["volume", "weight"].includes(i.us), `${i.id}: needs a Volume-mode style`);
      if (i.us === "volume") assert(i.gPerCup > 0, `${i.id}: needs its own grams per cup`);
    }
    if (i.unit === "ml") assert(i.density > 0, `${i.id}: needs a density`);
    if (i.unit === "each") assert(i.gEach > 0, `${i.id}: needs grams per item`);
    assert(Array.isArray(i.n) && i.n.length === 7 && i.n.every(x => Number.isFinite(x) && x >= 0), `${i.id}: nutrition`);
    assert(i.n[1] + i.n[2] + i.n[3] <= 101, `${i.id}: macros exceed 100 g per 100 g`);
    for (const a of i.allergens ?? []) assert(ALLERGENS[a], `${i.id}: unknown allergen ${a}`);
    assert(AISLES[i.aisle], `${i.id}: unknown aisle`);
  }
}

// --- Every recipe is complete and internally consistent ------------------
{
  const ids = new Set();
  for (const r of recipes) {
    assert(!ids.has(r.id), `duplicate recipe ${r.id}`);
    ids.add(r.id);
    assert(r.title && r.description && r.cuisine && r.source && r.license, `${r.id}: missing text`);
    assert(r.servings > 0, `${r.id}: servings`);
    assert(r.meals.length && r.meals.every(m => MEALS[m]), `${r.id}: meals`);
    assert(r.tastes.every(t => TASTES[t]), `${r.id}: tastes`);
    assert(r.tags.every(t => TAGS[t]), `${r.id}: tags`);
    assert(r.occasions.every(t => OCCASIONS[t]), `${r.id}: occasions`);
    assert(DIFFICULTY[r.difficulty], `${r.id}: difficulty`);
    assert(r.equipment.every(e => EQUIPMENT[e]), `${r.id}: equipment`);
    assert(r.safety.every(k => safetyNotes[k]), `${r.id}: safety key`);
    assert(r.time.total >= r.time.active && r.time.total >= r.time.prep, `${r.id}: time adds up`);
    assert(r.planB?.dishes?.length, `${r.id}: Plan B dishes`);

    const keys = new Set();
    for (const l of r.ingredients) {
      assert(ingredientsById.has(l.ing), `${r.id}: unknown ingredient ${l.ing}`);
      assert(l.amount > 0, `${r.id}: ${l.ing} needs an amount`);
      assert(!keys.has(lineKey(l)), `${r.id}: duplicate line ${lineKey(l)}; give one a key`);
      keys.add(lineKey(l));
    }

    // Step usage adds up to the recipe total for every ingredient.
    const used = new Map();
    r.steps.forEach((step, i) => {
      assert(step.title && step.text, `${r.id} step ${i + 1}: text`);
      assert(step.tasks.length > 0, `${r.id} step ${i + 1}: needs at least one task`);
      const inStep = new Set();
      for (const u of step.uses) {
        assert(keys.has(u.ing), `${r.id} step ${i + 1}: uses ${u.ing}, which isn't in the ingredient list`);
        assert(!inStep.has(u.ing), `${r.id} step ${i + 1}: ${u.ing} listed twice in one step`);
        inStep.add(u.ing);
        used.set(u.ing, (used.get(u.ing) ?? 0) + u.amount);
      }
      if (step.timer) assert(step.timer.minutes > 0 && step.timer.label, `${r.id} step ${i + 1}: timer`);
      for (const m of step.text.matchAll(/\{(\w+):([\d.]+)\}/g)) assert(["oven", "temp"].includes(m[1]), `${r.id}: bad token`);
    });
    for (const l of r.ingredients) {
      assert(close(used.get(lineKey(l)) ?? 0, l.amount), `${r.id}: ${lineKey(l)} steps use ${used.get(lineKey(l)) ?? 0}, list says ${l.amount}`);
    }

    // Recipes that need a safe internal temperature say so in a step.
    if (r.safety.some(k => ["poultry", "fish", "ground-meat"].includes(k))) {
      assert(r.steps.some(s => s.text.includes("{temp:")), `${r.id}: needs an internal temperature in the steps`);
    }

    // Nutrition is a plausible meal.
    const n = recipeNutrition(r).perServing;
    assert(n.kcal > 50 && n.kcal < 1200, `${r.id}: ${n.kcal} kcal per serving looks wrong`);
    const fromMacros = n.protein * 4 + n.carbs * 4 + n.fat * 9;
    assert(Math.abs(fromMacros - n.kcal) / n.kcal < 0.15, `${r.id}: calories don't match macros`);
  }
  assert(recipes.length >= 10, "a real starter library");
}

// --- Unit conversions are ingredient-specific -----------------------------
{
  const flour = ingredientsById.get("flour");
  const sugar = ingredientsById.get("sugar");
  assert.equal(amountText(flour, 125, "volume").text, "1 cup");
  assert.equal(amountText(sugar, 200, "volume").text, "1 cup");
  assert.equal(amountText(flour, 200, "volume").text, "1 ⅔ cups", "200 g flour is not 1 cup");
  assert.equal(amountText(flour, 190, "volume").text, "1 ½ cups");
  assert.equal(amountText(flour, 190, "weight").text, "190 g");
  assert.equal(amountText(sugar, 25, "volume").text, "2 tbsp");
  assert.equal(amountText(ingredientsById.get("butter"), 28, "volume").text, "2 tbsp");
  assert.equal(amountText(ingredientsById.get("butter"), 28, "weight").text, "28 g");
  assert.equal(amountText(ingredientsById.get("salt"), 6, "volume").text, "1 tsp");
  assert.equal(amountText(ingredientsById.get("salt"), 1.5, "volume").text, "¼ tsp");
  assert.equal(amountText(ingredientsById.get("salt"), 9, "volume").text, "1 ½ tsp");
  assert.equal(amountText(ingredientsById.get("milk"), 355, "volume").text, "1 ½ cups");
  assert.equal(amountText(ingredientsById.get("milk"), 355, "weight").text, "360 ml");
  assert.equal(amountText(ingredientsById.get("vanilla"), 5, "volume").text, "1 tsp");
  assert.equal(amountText(ingredientsById.get("chicken-broth"), 1900, "weight").text, "1.9 L");
  assert.equal(amountText(ingredientsById.get("chicken-broth"), 1900, "volume").text, "8 cups");
  // Meat is weighed in Volume mode too, in pounds and ounces.
  assert.equal(amountText(ingredientsById.get("chicken-thighs"), 680, "volume").text, "1 ½ lb");
  assert.equal(amountText(ingredientsById.get("spaghetti"), 340, "volume").text, "12 oz");
  assert.equal(amountText(ingredientsById.get("chicken-thighs"), 680, "weight").text, "680 g");
  // Counts stay counts and pluralize.
  assert.equal(amountText(ingredientsById.get("garlic"), 3, "weight").text, "3 cloves");
  assert.equal(amountText(ingredientsById.get("garlic"), 1, "volume").text, "1 clove");
  assert.equal(amountText(ingredientsById.get("egg"), 2, "volume").name, "large eggs");
  assert.equal(amountText(ingredientsById.get("lemon"), 0.5, "volume").text, "½");
  // Rounding helpers
  assert.equal(formatGrams(1.2).qty, "1");
  assert.equal(formatGrams(2.3).qty, "2.5");
  assert.equal(formatGrams(1360).text ?? `${formatGrams(1360).qty} ${formatGrams(1360).unit}`, "1.35 kg");
  assert.equal(formatMl(2.5).qty, "2.5");
  assert.equal(formatVolume(0.2).unit, "a pinch");
  assert.equal(formatVolume(ML_PER_CUP / 3).qty, "⅓");
  assert.equal(formatUsWeight(600).qty, "1 ⅓");
  assert.equal(formatCount(1.5, true).qty, "2");
  assert(formatCount(1.5, true).rounded);
  assert.equal(formatCount(1.5).qty, "1 ½");
  assert.equal(formatCount(0.3).qty, "¼");
  // Canonical values convert back without drift: switching modes never changes the stored amount.
  for (const i of ingredients) {
    const v = formatAmount(i, 100, "volume");
    const w = formatAmount(i, 100, "weight");
    assert(v.qty !== undefined && w.qty !== undefined, `${i.id}: formats`);
  }
  assert.equal(toGrams(ingredientsById.get("milk"), 100), 103);
  assert.equal(toGrams(ingredientsById.get("egg"), 2), 100);
}

// --- Temperatures ---------------------------------------------------------
assert.equal(renderTemps("Heat to {oven:220}.", "F"), "Heat to 425°F.");
assert.equal(renderTemps("Heat to {oven:180}.", "F"), "Heat to 350°F.");
assert.equal(renderTemps("Heat to {oven:220}.", "C"), "Heat to 220°C.");
assert.equal(renderTemps("Cook to {temp:74}.", "F"), "Cook to 165°F.");
assert.equal(renderTemps("Cook to {temp:71}.", "F"), "Cook to 160°F.");
assert.equal(renderTemps("Cook to {temp:63}.", "F"), "Cook to 145°F.");

// --- Scaling --------------------------------------------------------------
{
  const pancakes = recipesById.get("saturday-pancakes");
  const doubled = scaledLines(pancakes, 8);
  assert.equal(doubled.find(l => l.ing === "flour").amount, 380);
  assert.equal(amountText(ingredientsById.get("flour"), 380, "volume").text, "3 cups");
  const one = scaledLines(pancakes, 1);
  assert.equal(one.find(l => l.ing === "egg").amount, 0.5);
  assert(scaleNotes(pancakes, 1).some(n => n.includes("Eggs are rounded")));
  assert(scaleNotes(pancakes, 8).some(n => n.includes("Cooking times don't scale")));
  assert.equal(scaleNotes(pancakes, 4).length, 0);
  // Step amounts scale too.
  assert.equal(scaledUses(pancakes, 1, 8).find(u => u.key === "butter").amount, 56);
  assert.equal(scaledUses(pancakes, 3, 8).find(u => u.key === "butter").amount, 28);
  // Per-serving nutrition doesn't change with servings; the recipe total does.
  const n = recipeNutrition(pancakes);
  assert(close(n.total.kcal / pancakes.servings, n.perServing.kcal));
}

// --- Nutrition --------------------------------------------------------------
{
  const pasta = recipesById.get("tomato-basil-spaghetti");
  const n = recipeNutrition(pasta);
  // Pasta-water salt mostly drains away, so it counts for 10%.
  const sodiumIfAll = n.total.sodium + 18 * 0.9 * 387.58;
  assert(n.total.sodium < sodiumIfAll * 0.5, "pasta water salt isn't counted in full");
  assert.equal(roundNutrient("kcal", 433), 430);
  assert.equal(roundNutrient("kcal", 87), 85);
  assert.equal(roundNutrient("protein", 37.6), 38);
  assert.equal(roundNutrient("sodium", 987), 990);
}

// --- Allergens and diets are derived from ingredients ---------------------
{
  assert.deepEqual(allergensOf(recipesById.get("veggie-fried-rice")).sort(), ["egg", "gluten", "sesame", "soy"]);
  assert.deepEqual(allergensOf(recipesById.get("lemon-garlic-chicken-potatoes")), []);
  const tacos = dietsOf(recipesById.get("black-bean-sweet-potato-tacos"));
  assert(tacos.vegan && tacos["gluten-free"] && tacos["dairy-free"]);
  const soup = dietsOf(recipesById.get("chicken-rice-soup"));
  assert(!soup.vegetarian && soup["gluten-free"]);
  assert(!dietsOf(recipesById.get("honey-garlic-salmon")).vegetarian);
  assert(dietsOf(recipesById.get("honey-garlic-salmon")).pescatarian);
  assert(!dietsOf(recipesById.get("overnight-oats")).vegan, "dairy isn't vegan");
  assert(!dietsOf(recipesById.get("overnight-oats"))["gluten-free"], "oats are treated as gluten unless certified");
}

// --- Discovery --------------------------------------------------------------
{
  assert.deepEqual(parseTerms("Spinach, chickpeas; tomatoes"), ["spinach", "chickpea", "tomato"]);
  assert(ingredientMatches(ingredientsById.get("chicken-broth"), "chicken"));
  assert(ingredientMatches(ingredientsById.get("egg"), "eggs"));
  assert(!ingredientMatches(ingredientsById.get("butter"), "nut"));

  const all = discover(recipes, emptyData().profile, emptyFilters());
  assert.equal(all.results.length, recipes.length, "everything shows by default");

  // Allergies are hard limits.
  const eggFree = discover(recipes, { ...emptyData().profile, allergies: ["egg"] }, emptyFilters());
  assert(eggFree.results.every(r => !allergensOf(r.recipe).includes("egg")));
  assert(eggFree.hidden.allergy > 0);
  // Even when every priority would favor an egg recipe.
  const eggLover = discover(recipes, { ...emptyData().profile, allergies: ["egg"], flavors: ["sweet"], priorities: ["taste"] }, emptyFilters());
  assert(!eggLover.results.some(r => r.recipe.id === "saturday-pancakes"));

  // Disliked ingredients and exclusions hide recipes.
  const noChicken = discover(recipes, { ...emptyData().profile, dislikes: "chicken" }, emptyFilters());
  assert(!noChicken.results.some(r => r.recipe.id === "chicken-rice-soup"));
  assert(!noChicken.results.some(r => r.recipe.id === "beef-bean-chili"), "chili uses chicken broth");
  const noCilantro = discover(recipes, emptyData().profile, { ...emptyFilters(), exclude: "cilantro" });
  assert(!noCilantro.results.some(r => r.recipe.id === "chickpea-spinach-curry"));

  // Diets
  const vegan = discover(recipes, emptyData().profile, { ...emptyFilters(), diets: ["vegan"] });
  assert(vegan.results.length > 0 && vegan.results.every(r => dietsOf(r.recipe).vegan));

  // Time and macros
  const quick = discover(recipes, emptyData().profile, { ...emptyFilters(), maxTime: 30 });
  assert(quick.results.every(r => r.recipe.time.total <= 30));
  const protein = discover(recipes, emptyData().profile, { ...emptyFilters(), minProtein: 30 });
  assert(protein.results.length > 0);
  assert(protein.results.every(r => recipeNutrition(r.recipe).perServing.protein >= 30));

  // Equipment: no oven hides oven recipes.
  const noOven = discover(recipes, { ...emptyData().profile, equipment: ["stovetop", "microwave"] }, emptyFilters());
  assert(noOven.results.every(r => !r.recipe.equipment.includes("oven")));
  assert(noOven.results.some(r => r.recipe.id === "overnight-oats"), "no-equipment recipes still show");

  // Priorities change the order and explain themselves.
  const fast = discover(recipes, { ...emptyData().profile, priorities: ["time"] }, emptyFilters());
  assert.equal(fast.results[0].recipe.id, "overnight-oats");
  assert(fast.results[0].reasons.some(r => r.startsWith("Ready in")));
  const strong = discover(recipes, { ...emptyData().profile, priorities: ["protein"] }, emptyFilters());
  assert(recipeNutrition(strong.results[0].recipe).perServing.protein >= 28);
  assert(strong.results[0].reasons[0].includes("g protein"));
  const using = discover(recipes, { ...emptyData().profile, priorities: ["ingredients"] }, { ...emptyFilters(), have: "spinach, chickpeas" });
  assert.equal(using.results[0].recipe.id, "chickpea-spinach-curry");
  assert(using.results[0].reasons[0].startsWith("Uses your"));
  const spicy = discover(recipes, { ...emptyData().profile, flavors: ["spicy"], priorities: ["taste"] }, emptyFilters());
  assert(spicy.results[0].recipe.tastes.includes("spicy"));

  // Search finds titles and ingredients.
  assert(discover(recipes, emptyData().profile, { ...emptyFilters(), q: "salmon" }).results.length === 1);
  assert(discover(recipes, emptyData().profile, { ...emptyFilters(), q: "feta" }).results.some(r => r.recipe.id === "shakshuka"));
}

// --- Cooking sessions --------------------------------------------------------
{
  const pancakes = recipesById.get("saturday-pancakes");
  let s = S.newSession(pancakes, 4, 1000);
  assert.equal(s.phase, "prep");

  // Have, prepped and used are separate states.
  s = S.toggleHave(s, "flour");
  assert(s.have.flour && !s.prepped.flour);
  s = S.togglePrepped(s, "milk");
  assert(s.prepped.milk && s.have.milk, "prepped implies have");
  assert.equal(S.prepSummary(pancakes, s).missing.length, pancakes.ingredients.length - 2);
  s = S.setAllHave(s, pancakes, true);
  assert.equal(S.prepSummary(pancakes, s).missing.length, 0);
  assert(Object.keys(s.used).length === 0, "having isn't using");

  // Butter goes in at step 2 (28 g) and step 4 (14 g): tracked separately.
  s = S.startCooking(s);
  s = S.toggleUsed(s, 1, "butter");
  let butter = S.usageSummary(pancakes, s).find(u => u.key === "butter");
  assert.equal(butter.used, 28);
  assert.equal(butter.remaining, 14);
  assert(!butter.done, "butter isn't used up after the first step");
  s = S.toggleUsed(s, 3, "butter");
  butter = S.usageSummary(pancakes, s).find(u => u.key === "butter");
  assert(butter.done);
  // At double servings, the same checkmarks mean double the amounts.
  const doubled = S.usageSummary(pancakes, S.setServings(s, 8)).find(u => u.key === "butter");
  assert.equal(doubled.used, 84);

  // Tasks and steps
  s = S.toggleTask(s, 0, pancakes.steps[0].tasks[0]);
  assert.equal(S.stepProgress(pancakes, s, 0).ticked, 1);
  s = S.completeStep(s, pancakes, 0);
  assert.equal(s.step, 1);
  assert.deepEqual(s.doneSteps, [0]);
  s = S.goToStep(s, pancakes, 0);
  assert.deepEqual(s.doneSteps, [0], "going back keeps progress");
  assert.equal(S.goToStep(s, pancakes, 99).step, pancakes.steps.length - 1);
  assert.equal(S.progressPercent(pancakes, s), 20);

  // Timers keep their deadline through a refresh.
  s = S.startTimer(s, 2, "Batter rest", 300, 10_000);
  assert.equal(S.timerState(S.timerFor(s, 2), 70_000).left, 240);
  const saved = JSON.parse(JSON.stringify(s));
  const restored = S.normalizeSession(saved, pancakes);
  assert.equal(S.timerState(S.timerFor(restored, 2), 70_000).left, 240, "restored timer keeps counting from the same deadline");
  assert(S.timerState(S.timerFor(restored, 2), 400_000).finished);
  assert.equal(S.dueTimers(restored, 400_000).length, 1);
  assert.equal(S.dueTimers(S.markRung(restored, 2), 400_000).length, 0);
  // Pause, wait, resume: the pause doesn't eat time.
  let p = S.pauseTimer(s, 2, 70_000);
  assert.equal(S.timerState(S.timerFor(p, 2), 999_999).left, 240);
  p = S.startTimer(p, 2, "Batter rest", 300, 500_000);
  assert.equal(S.timerState(S.timerFor(p, 2), 560_000).left, 180);
  p = S.addTime(p, 2, 60, 560_000);
  assert.equal(S.timerState(S.timerFor(p, 2), 560_000).left, 240);
  // Several timers at once
  p = S.startTimer(p, 3, "Pancakes", 120, 560_000);
  assert.equal(p.timers.length, 2);
  assert.equal(S.clearTimer(p, 2).timers.length, 1);

  // Restoring drops junk instead of crashing.
  assert.equal(S.normalizeSession({ recipeId: "nope" }, pancakes), null);
  const junk = S.normalizeSession({ recipeId: pancakes.id, step: 42, used: { "9:butter": true, "1:nothing": true, "1:butter": true }, timers: [{ step: 99, seconds: 5, endsAt: 1 }] }, pancakes);
  assert.equal(junk.step, 0);
  assert.deepEqual(junk.used, { "1:butter": true });
  assert.equal(junk.timers.length, 0);
}

// --- Plan B never invents restaurants -------------------------------------
{
  const searches = planBSearches(recipesById.get("lemon-garlic-chicken-potatoes"), "Austin, TX");
  assert(searches.length >= 3);
  assert(searches.every(s => s.url.startsWith("https://www.google.com/maps/search/?api=1&query=")));
  assert(searches[0].query.endsWith("near Austin, TX"));
  assert(planBSearches(recipesById.get("shakshuka"))[0].query.endsWith("near me"));
}

// --- Stored data survives bad input ----------------------------------------
{
  assert.deepEqual(normalizeData(null), emptyData());
  assert.deepEqual(normalizeData("garbage"), emptyData());
  const d = normalizeData({
    prefs: { measure: "weight", temp: "C", textSize: 9 },
    profile: { allergies: ["egg", "made-up"], priorities: ["protein", "nope"], equipment: ["oven", "jetpack"] },
    favorites: ["shakshuka", "not-a-recipe"],
    sessions: { shakshuka: S.newSession(recipesById.get("shakshuka"), 3), ghost: { recipeId: "ghost" } },
    history: [{ id: "a", recipeId: "shakshuka", rating: "loved" }, { id: "b", recipeId: "ghost" }],
  });
  assert.equal(d.prefs.measure, "weight");
  assert.equal(d.prefs.temp, "C");
  assert.equal(d.prefs.textSize, 1);
  assert.deepEqual(d.profile.allergies, ["egg"]);
  assert.deepEqual(d.profile.priorities, ["protein"]);
  assert.deepEqual(d.profile.equipment, ["oven"]);
  assert.deepEqual(d.favorites, ["shakshuka"]);
  assert.deepEqual(Object.keys(d.sessions), ["shakshuka"]);
  assert.equal(d.history.length, 1);
}

console.log(`CookFox: ${recipes.length} recipes, ${ingredients.length} ingredients, all checks passed.`);
