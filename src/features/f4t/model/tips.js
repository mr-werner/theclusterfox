// Suggestions for people just starting out: a few first steps, tips for
// each way of getting food (cooking, meal prep, eating out, grab and go),
// and notes that fit the way you usually eat. Plain, practical advice, not
// medical guidance.

import { MEALS } from "./body.js";

export const FIRST_STEPS = [
  { title: "Start with one meal", text: "Don't overhaul everything. Plan just your biggest meal for a week, and keep the rest as they are." },
  { title: "Use your hand as the measure", text: "A palm of protein, a fist of vegetables, a cupped hand of carbs and a thumb of fats is a sensible plate. No scale needed." },
  { title: "Weigh in a few mornings a week", text: "Same time, before breakfast. Look at the trend line, not single days; water alone can move you 2–3 lb." },
  { title: "Change one thing at a time", text: "Swap fries for a salad, or soda for sparkling water, and give it two weeks before you judge it." },
];

export const STYLE_TIPS = {
  cook: [
    { title: "Cook once, eat twice", text: "Make dinners that keep. Leftovers become tomorrow's lunch, and the planner sets that up for you." },
    { title: "Fill half the plate first", text: "Serve the vegetables first, then the protein, then the starch. It's the easiest way to keep portions in check." },
    { title: "Keep a few staples", text: "Rice, pasta, canned beans, eggs, frozen vegetables and a couple of spices cover most weeknight meals." },
  ],
  prep: [
    { title: "Two short sessions beat one long one", text: "Cook on your prep day and again midweek, so nothing sits in the fridge more than three or four days." },
    { title: "Portion it right away", text: "Split the batch into containers as soon as it cools. Pre-portioned food stops second helpings." },
    { title: "Prep parts, not just meals", text: "A tray of roasted vegetables, a pot of rice and some cooked chicken mix into different meals all week." },
  ],
  out: [
    { title: "Decide before you go", text: "Look at the menu ahead of time and pick something that fits. It's much harder when you're hungry at the table." },
    { title: "Sauces and sides are where the calories hide", text: "Ask for dressings and sauces on the side, and swap fries for a salad or vegetables." },
    { title: "Restaurant portions are big", text: "Most plates are two portions. Ask for a box with the meal and put half away before you start." },
  ],
  grab: [
    { title: "Lead with protein", text: "Greek yogurt, eggs, cottage cheese, a protein shake or a turkey wrap keeps you full longer than a pastry." },
    { title: "Stock it, then grab it", text: "Keep a few go-to options in the fridge so the easy choice is also a good one." },
    { title: "Watch the drinks", text: "Flavored coffee drinks, juice and soda add up fast. A 16-oz flavored latte can be 250+ calories." },
  ],
};

/**
 * Notes for the way you usually eat. profile.day is your usual day,
 * target the day's targets (or null), training true on training days.
 */
export function patternTips(profile, target, training = false) {
  const day = profile.day;
  const tips = [];
  const skipped = MEALS.filter(m => day[m].size === "skip");
  const light = MEALS.filter(m => day[m].size === "light");
  const bigDinner = day.dinner.size === "big";

  if (bigDinner && (skipped.length || light.includes("breakfast") || light.includes("lunch"))) {
    tips.push({
      title: "Most of your eating is in the evening",
      text: "That's fine: the day's total matters most. The plan puts most of your calories at dinner. If you're starving by then, a protein snack mid-afternoon (yogurt, a shake) makes dinner easier to keep to a sensible size.",
    });
  }
  if (day.breakfast.size === "light" || day.breakfast.size === "skip") {
    tips.push({
      title: "Coffee counts",
      text: "Black coffee is about 5 calories; milk and sugar add 40 or so; a coffee-shop latte about 190. Pick the one you really drink so the plan is honest.",
    });
  }
  if (skipped.includes("lunch") && training) {
    tips.push({ title: "Skipping lunch on a training day", text: "Have something small 1–2 hours before you train, like a banana or a yogurt, so the session doesn't feel flat." });
  }
  if (target && skipped.length >= 2) {
    tips.push({ title: "Getting protein into fewer meals", text: `With fewer meals, aim for 40 g or more of protein at the ones you eat to reach about ${target.protein} g a day.` });
  }
  if (MEALS.filter(m => day[m].how === "out" && day[m].size !== "skip").length >= 2) {
    tips.push({ title: "Eating out often", text: "Eating out most days gets expensive and hard to keep track of. Swapping even one meal for meal prep can save $40 or more a week." });
  }
  return tips;
}

/** The hows your usual day uses, so the tips shown match how you eat. */
export const usedHows = profile => [...new Set(MEALS.filter(m => profile.day[m].size !== "skip").map(m => profile.day[m].how))];
