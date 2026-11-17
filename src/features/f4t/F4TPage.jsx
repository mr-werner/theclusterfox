import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bookmark, CalendarDays, Cloud, CloudOff, History, HardDrive, LoaderCircle, NotebookPen, Plus, RotateCcw, ShoppingCart, UserRound, Utensils } from "lucide-react";

import AppBar from "../../components/AppBar";
import ActivityExplorer from "./components/ActivityExplorer";
import CompareStrip from "./components/CompareStrip";
import FoodSearch from "./components/FoodSearch";
import MealBar from "./components/MealBar";
import MealItem from "./components/MealItem";
import SavedMeals from "./components/SavedMeals";
import PlanTab from "./components/PlanTab";
import GroceriesTab from "./components/GroceriesTab";
import MeTab from "./components/MeTab";
import OffPlanBar from "./components/OffPlanBar";
import { activityGroups } from "./data/activities";
import { migratedSelections, resolveFavoriteKeys, starterSelections } from "./activityHelpers";
import { useCountUp } from "./hooks/useCountUp";
import { foodKey, formatCalories, LBS_PER_KG, mealCalories } from "./mealMath";
import { loadDraft, saveDraft } from "./state/f4tStore";
import { useF4TData } from "./state/useF4TData";
import { useLinkedApps } from "./state/useLinkedApps";
import { usePlanner } from "./state/usePlanner";
import { fillWithinBudget, isDay, plannedFacts, toDay, weekStart } from "./model/planner.js";
import "./f4t.css";
import "./identity.css";
import "./planner.css";

const TABS = [
  { id: "plan", name: "Plan", icon: CalendarDays },
  { id: "shop", name: "Groceries", icon: ShoppingCart },
  { id: "off", name: "Off plan", icon: NotebookPen },
  { id: "me", name: "Me", icon: UserRound },
];

// The meal you'd be eating about now.
function slotForNow() {
  const hour = new Date().getHours();
  return hour < 11 ? "breakfast" : hour < 15 ? "lunch" : hour < 17 ? "snack" : "dinner";
}

const groupsByKey = new Map(activityGroups.map(group => [group.key, group]));
const starterPicks = starterSelections(activityGroups);

function withIds(items) {
  return items.map(item => ({ ...item, id: crypto.randomUUID() }));
}

function defaultMealName() {
  const hour = new Date().getHours();
  const part = hour < 11 ? "Breakfast" : hour < 15 ? "Lunch" : hour < 21 ? "Dinner" : "Late snack";
  return `${part}, ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function SyncBadge({ status, isSignedIn }) {
  if (!isSignedIn) {
    return (
      <p className="ff-sync">
        <HardDrive size={15} aria-hidden="true" />
        Saved on this device.{" "}
        <Link to="/login?next=/f4t">Log in</Link> or <Link to="/signup?next=/f4t">sign up</Link> to keep it everywhere.
      </p>
    );
  }
  const states = {
    syncing: [<LoaderCircle key="i" size={15} className="spin" />, "Syncing…"],
    synced: [<Cloud key="i" size={15} />, "Synced to your account"],
    unavailable: [<HardDrive key="i" size={15} />, "Saved on this device. Account sync isn’t switched on yet."],
    error: [<CloudOff key="i" size={15} />, "Couldn’t sync right now. Your changes are saved on this device."],
    local: [<HardDrive key="i" size={15} />, "Saved on this device"],
  };
  const [icon, text] = states[status] || states.local;
  return (
    <p className={`ff-sync is-${status}`} aria-live="polite">
      {icon}
      {text}
    </p>
  );
}

export default function F4TPage() {
  const store = useF4TData();
  const { data, syncStatus, isSignedIn, setWeight, setFavorites, setSelection, saveMeal, deleteMeal, rememberFood } = store;
  const linked = useLinkedApps();
  const [today] = useState(() => toDay(new Date()));

  const [meal, setMeal] = useState(() => withIds(loadDraft()));
  const [activeMealId, setActiveMealId] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [mealName, setMealName] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [weightText, setWeightText] = useState(() => {
    if (!data.weightLbs) return "";
    const value = data.weightUnit === "kg" ? data.weightLbs / LBS_PER_KG : data.weightLbs;
    return String(Math.round(value * 10) / 10);
  });

  useEffect(() => {
    saveDraft(meal);
  }, [meal]);

  // Pick up a weight that arrives from the account after the page opened.
  const [seenWeight, setSeenWeight] = useState(data.weightLbs);
  if (data.weightLbs !== seenWeight) {
    setSeenWeight(data.weightLbs);
    if (data.weightLbs && !weightText) {
      const value = data.weightUnit === "kg" ? data.weightLbs / LBS_PER_KG : data.weightLbs;
      setWeightText(String(Math.round(value * 10) / 10));
    }
  }

  const unit = data.weightUnit;
  const weightLbs = data.weightLbs ?? 0;
  const totalCalories = useMemo(() => mealCalories(meal), [meal]);
  const shownCalories = useCountUp(totalCalories);
  const addedKeys = useMemo(() => new Set(meal.map(foodKey)), [meal]);
  const favoriteKeys = useMemo(() => resolveFavoriteKeys(data.favorites, activityGroups, groupsByKey), [data.favorites]);
  const selections = useMemo(
    () => ({ ...starterPicks, ...migratedSelections(data.favorites, activityGroups), ...data.selections }),
    [data.selections, data.favorites]
  );

  const activeMeal = data.meals.find(m => m.id === activeMealId) ?? null;

  function addFood(item) {
    setMeal(current => [...current, { ...item, id: crypto.randomUUID() }]);
    rememberFood(item);
  }

  function changeServings(id, servings) {
    setMeal(current => current.map(item => (item.id === id ? { ...item, servings } : item)));
  }

  function removeFood(id) {
    setMeal(current => current.filter(item => item.id !== id));
  }

  function clearMeal() {
    setMeal([]);
    setActiveMealId(null);
    setSaveOpen(false);
  }

  function openSave() {
    setMealName(activeMeal?.name ?? defaultMealName());
    setSaveOpen(true);
    setSavedNote("");
  }

  function handleSave(event, asNew) {
    event.preventDefault();
    const name = mealName.trim();
    if (!name || !meal.length) return;
    const id = saveMeal({ id: asNew ? undefined : activeMeal?.id, name, items: meal });
    setActiveMealId(id);
    setSaveOpen(false);
    setSavedNote(`Saved “${name}”.`);
  }

  function loadMeal(saved) {
    setMeal(withIds(saved.items));
    setActiveMealId(saved.id);
    setSaveOpen(false);
    setSavedNote("");
    if (tab !== "off") go({ tab: "off" });
    document.getElementById("ff-meal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Where you are: ?tab=plan|shop|off|me, ?week=<first day>, ?day=<day> (from
  // PlanFox), and for the off-plan screen ?day=&slot= to compare against.
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : params.get("meal") ? "off" : "plan";
  const focusDay = isDay(params.get("day")) ? params.get("day") : null;
  const start = isDay(params.get("week")) ? params.get("week") : weekStart(focusDay ?? today, data.profile);
  const week = usePlanner(data, linked, start);
  const offDay = focusDay ?? today;
  const offSlot = ["breakfast", "lunch", "dinner", "snack"].includes(params.get("slot")) ? params.get("slot") : slotForNow();

  const go = useCallback(
    (next, { replace = false } = {}) => {
      setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== "")), { replace });
    },
    [setParams]
  );
  const goTab = id => {
    go({ tab: id === "plan" ? undefined : id, week: params.get("week") ?? undefined });
    window.scrollTo({ top: 0 });
  };

  // Opened from PlanFox on a day: bring that day into view.
  useEffect(() => {
    if (tab !== "plan" || !focusDay) return;
    const t = setTimeout(() => document.getElementById(`fp-day-${focusDay}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => clearTimeout(t);
  }, [tab, focusDay]);

  // Opened from PlanFox with ?meal=<id>: load that saved meal once.
  const linkedMeal = data.meals.find(m => m.id === params.get("meal")) ?? null;
  const [handledMealId, setHandledMealId] = useState(null);
  if (linkedMeal && linkedMeal.id !== handledMealId) {
    setHandledMealId(linkedMeal.id);
    setMeal(withIds(linkedMeal.items));
    setActiveMealId(linkedMeal.id);
  }
  useEffect(() => {
    if (handledMealId && params.get("meal")) setParams({ tab: "off" }, { replace: true });
  }, [handledMealId, params, setParams]);

  // What the plate is compared with on the off-plan screen.
  const plannedEntry = data.plan[offDay]?.slots?.[offSlot] ?? null;
  const planned = plannedFacts(plannedEntry, linked.getRecipe);
  const [burnMode, setBurnMode] = useState("extra");
  const burnCalories = planned && burnMode === "extra" ? Math.max(0, totalCalories - planned.kcal) : totalCalories;

  function logOffPlan() {
    if (!meal.length) return;
    const name = activeMeal?.name ?? (meal.length === 1 ? meal[0].name : `${meal[0].name} and ${meal.length - 1} more`);
    const kcal = Math.round(totalCalories);
    store.setEntry(offDay, offSlot, e => ({ recipeId: e?.recipeId ?? null, portions: e?.portions ?? 1, ...(e?.leftover ? { leftover: true } : {}), eaten: true, off: { name: name.slice(0, 80), kcal, protein: 0, items: meal.map(item => ({ ...item, id: undefined })) } }));
    setSavedNote(`Logged as ${offSlot} on ${offDay === today ? "today" : new Date(`${offDay}T12:00`).toLocaleDateString(undefined, { weekday: "long" })}.`);
  }

  function ateElse(day, slot) {
    go({ tab: "off", day, slot });
    window.scrollTo({ top: 0 });
  }

  function replanCheaper() {
    const result = fillWithinBudget(
      { days: week.days.filter(d => d >= today), targets: week.targets, training: week.training, recipes: linked.allowed, plan: data.plan, profile: data.profile, favorites: linked.cook.favorites, seed: data.planSeed * 17 + 3, replace: true },
      { budget: data.profile.budget, people: data.profile.people, getRecipe: linked.getRecipe, pantry: linked.cook.pantry }
    );
    store.setPlanDays(result.week);
    store.nextSeed();
  }

  function appendMeal(saved) {
    setMeal(current => [...current, ...withIds(saved.items)]);
    setSavedNote(`Added “${saved.name}”.`);
  }

  function handleWeight(text) {
    setWeightText(text);
    const value = Number(text);
    setWeight(value > 0 ? (unit === "kg" ? value * LBS_PER_KG : value) : null, unit);
  }

  function switchUnit(next) {
    if (next === unit) return;
    const value = Number(weightText);
    if (value > 0) setWeightText(String(Math.round((next === "kg" ? value / LBS_PER_KG : value * LBS_PER_KG) * 10) / 10));
    setWeight(data.weightLbs, next);
  }

  function toggleFavorite(key) {
    setFavorites(favoriteKeys.includes(key) ? favoriteKeys.filter(k => k !== key) : [...favoriteKeys, key]);
  }

  const compareGroups = favoriteKeys.map(key => groupsByKey.get(key)).filter(Boolean).slice(0, 6);
  const recentToShow = data.recentFoods.filter(food => !addedKeys.has(foodKey(food))).slice(0, 8);

  return (
    <main className="f4t-page ff">
      <AppBar appId="f4t" />

      <div className="ff-shell">
        <header className="ff-hero">
          <div className="ff-logo" aria-hidden="true">
            <Utensils size={26} />
          </div>
          <div>
            <p className="ff-eyebrow">FUEL 4 THOUGHT · DIET PLANNER</p>
            <h1>Eat for your goal, your training and your budget.</h1>
            <p className="ff-hero-sub">
              Plan the week’s meals from CookFox recipes, sized to your body and your LiftFox and PaceFox training days. Get the grocery list and what it costs.
              Ate something else? See how far off plan it was, and what it takes to walk it off.
            </p>
            <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />
          </div>
        </header>

        <nav className="fp-tabs" aria-label="Fuel 4 Thought">
          {TABS.map(t => (
            <button key={t.id} type="button" className={tab === t.id ? "is-active" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => goTab(t.id)}>
              <t.icon size={17} aria-hidden="true" />
              {t.name}
            </button>
          ))}
        </nav>

        {tab === "plan" && (
          <PlanTab
            data={data}
            linked={linked}
            week={week}
            start={start}
            today={today}
            onWeek={next => go({ week: next })}
            actions={store}
            onAteElse={ateElse}
            goTab={goTab}
          />
        )}
        {tab === "shop" && <GroceriesTab data={data} week={week} linked={linked} onReplanCheaper={replanCheaper} goTab={goTab} />}
        {tab === "me" && <MeTab data={data} today={today} actions={store} />}

        {tab === "off" && (
        <>
        <OffPlanBar
          day={offDay}
          slot={offSlot}
          entry={plannedEntry}
          planned={planned}
          getRecipe={linked.getRecipe}
          total={totalCalories}
          weightLbs={weightLbs}
          mode={burnMode}
          onMode={setBurnMode}
          onPick={(day, slot) => go({ tab: "off", day, slot }, { replace: true })}
          onLog={logOffPlan}
          canLog={meal.length > 0}
        />
        <div className="ff-layout">
          <section className="ff-panel" id="ff-meal" aria-labelledby="ff-meal-title">
            <div className="ff-panel-head">
              <div>
                <h2 id="ff-meal-title">On the plate</h2>
              </div>
              {activeMeal && <span className="ff-tag"><Bookmark size={13} /> {activeMeal.name}</span>}
            </div>

            <FoodSearch onAdd={addFood} addedKeys={addedKeys} />

            {(recentToShow.length > 0 || data.meals.length > 0) && (
              <div className="ff-quick">
                {data.meals.length > 0 && (
                  <div className="ff-quick-row">
                    <span className="ff-quick-label"><Bookmark size={14} aria-hidden="true" /> Saved</span>
                    {data.meals.slice(0, 6).map(saved => (
                      <button key={saved.id} type="button" className="ff-chip" onClick={() => loadMeal(saved)}>
                        {saved.name}
                      </button>
                    ))}
                  </div>
                )}
                {recentToShow.length > 0 && (
                  <div className="ff-quick-row">
                    <span className="ff-quick-label"><History size={14} aria-hidden="true" /> Recent</span>
                    {recentToShow.map(food => (
                      <button
                        key={foodKey(food)}
                        type="button"
                        className="ff-chip"
                        onClick={() => addFood(food)}
                        title={`${food.name} · ${Math.round(food.caloriesPerServing)} cal`}
                      >
                        <Plus size={13} aria-hidden="true" /> {food.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {meal.length > 0 ? (
              <div className="ff-meal">
                <ul className="ff-items">
                  {meal.map(item => (
                    <MealItem key={item.id} item={item} onChangeServings={changeServings} onRemove={removeFood} />
                  ))}
                </ul>

                {saveOpen ? (
                  <form className="ff-save" onSubmit={event => handleSave(event, false)}>
                    <label htmlFor="ff-meal-name">Name this meal</label>
                    <div className="ff-save-row">
                      <input
                        id="ff-meal-name"
                        type="text"
                        value={mealName}
                        maxLength={60}
                        autoFocus
                        onChange={event => setMealName(event.target.value)}
                      />
                      <button type="submit" className="ff-btn ff-btn-primary" disabled={!mealName.trim()}>
                        {activeMeal ? "Update" : "Save"}
                      </button>
                      {activeMeal && (
                        <button type="button" className="ff-btn" onClick={event => handleSave(event, true)} disabled={!mealName.trim()}>
                          Save as new
                        </button>
                      )}
                      <button type="button" className="ff-btn ff-btn-ghost" onClick={() => setSaveOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="ff-meal-actions">
                    <button type="button" className="ff-btn" onClick={openSave}>
                      <Bookmark size={16} /> {activeMeal ? "Update saved meal" : "Save meal"}
                    </button>
                    <button type="button" className="ff-btn ff-btn-ghost" onClick={clearMeal}>
                      <RotateCcw size={15} /> Start over
                    </button>
                    {savedNote && <span className="ff-note" role="status">{savedNote}</span>}
                  </div>
                )}
              </div>
            ) : (
              <p className="ff-empty ff-empty-meal">
                Search for a food, tap a recent one, or load a saved meal. Add as many items as you like.
              </p>
            )}
          </section>

          <aside className="ff-panel ff-summary" aria-label="Meal summary">
            <div className="ff-total" aria-live="polite">
              <span>Total</span>
              <strong>{formatCalories(shownCalories)}</strong>
              <small>calories</small>
            </div>
            <MealBar meal={meal} total={totalCalories} />

            <div className="ff-weight">
              <label htmlFor="ff-weight">Your weight</label>
              {data.weights.length ? (
                <p className="fp-weight-read">
                  <b>{Math.round((unit === "kg" ? weightLbs / LBS_PER_KG : weightLbs) * 10) / 10} {unit}</b>
                  <button type="button" className="ff-link" onClick={() => goTab("me")}>Weigh in</button>
                </p>
              ) : (
                <div className="ff-weight-row">
                  <input
                    id="ff-weight"
                    type="number"
                    min="1"
                    inputMode="decimal"
                    placeholder={unit === "kg" ? "80" : "175"}
                    value={weightText}
                    onChange={event => handleWeight(event.target.value)}
                  />
                  <div className="ff-unit" role="group" aria-label="Weight unit">
                    {["lbs", "kg"].map(option => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={unit === option}
                        className={unit === option ? "is-active" : ""}
                        onClick={() => switchUnit(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <small>Used for how long activities take. Track it over time in Me.</small>
            </div>

          </aside>
        </div>

        {compareGroups.length > 0 && (
          <CompareStrip
            groups={compareGroups}
            selections={selections}
            calories={burnCalories}
            weightLbs={weightLbs}
            onSelect={setSelection}
            onBrowse={() => document.getElementById("ff-activities")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        )}

        <div id="ff-activities" className="ff-anchor">
          <ActivityExplorer
            groups={activityGroups}
            favoriteKeys={favoriteKeys}
            selections={selections}
            calories={burnCalories}
            weightLbs={weightLbs}
            onToggleFavorite={toggleFavorite}
            onSelect={setSelection}
          />
        </div>

        <SavedMeals
          meals={data.meals}
          activeMealId={activeMealId}
          onLoad={loadMeal}
          onAppend={appendMeal}
          onDelete={id => {
            deleteMeal(id);
            if (id === activeMealId) setActiveMealId(null);
          }}
        />
        </>
        )}
      </div>
    </main>
  );
}
