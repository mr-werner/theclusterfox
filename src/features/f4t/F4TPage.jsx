import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Cloud, CloudOff, Flame, History, HardDrive, LoaderCircle, Plus, RotateCcw } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import ActivityExplorer from "./components/ActivityExplorer";
import FoodSearch from "./components/FoodSearch";
import MealItem from "./components/MealItem";
import SavedMeals from "./components/SavedMeals";
import { activityGroups } from "./data/activities";
import { formatDuration } from "../../domain/exercise/energy";
import { migratedSelections, minutesFor, resolveFavoriteKeys, selectedOptionIndex, starterSelections } from "./activityHelpers";
import { foodKey, formatCalories, LBS_PER_KG, mealCalories } from "./mealMath";
import { loadDraft, saveDraft } from "./state/f4tStore";
import { useF4TData } from "./state/useF4TData";
import "./f4t.css";

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
  const { data, syncStatus, isSignedIn, setWeight, setFavorites, setSelection, saveMeal, deleteMeal, rememberFood } =
    useF4TData();

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
    document.getElementById("ff-meal")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const quickLook = favoriteKeys.slice(0, 3).map(key => groupsByKey.get(key)).filter(Boolean);
  const recentToShow = data.recentFoods.filter(food => !addedKeys.has(foodKey(food))).slice(0, 8);

  return (
    <main className="f4t-page ff">
      <SiteHeader />

      <div className="ff-shell">
        <header className="ff-hero">
          <div className="ff-logo" aria-hidden="true">
            <Flame size={28} />
          </div>
          <div>
            <p className="ff-eyebrow">FUEL 4 THOUGHT</p>
            <h1>Is it worth it?</h1>
            <p className="ff-hero-sub">See what your food costs in walking, running, dancing, and 1,100 other activities.</p>
            <SyncBadge status={syncStatus} isSignedIn={isSignedIn} />
          </div>
        </header>

        <div className="ff-layout">
          <section className="ff-panel" id="ff-meal" aria-labelledby="ff-meal-title">
            <div className="ff-panel-head">
              <div>
                <p className="ff-eyebrow">STEP 1</p>
                <h2 id="ff-meal-title">What are you eating?</h2>
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
            <p className="ff-eyebrow">STEP 2</p>
            <div className="ff-total">
              <span>Total</span>
              <strong>{formatCalories(totalCalories)}</strong>
              <small>calories</small>
            </div>

            <div className="ff-weight">
              <label htmlFor="ff-weight">Your weight</label>
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
              <small>Remembered for next time.</small>
            </div>

            {quickLook.length > 0 && (
              <div className="ff-quicklook">
                <span className="ff-quick-label">Your favorites</span>
                <ul>
                  {quickLook.map(group => {
                    const option = group.options[selectedOptionIndex(group, selections)];
                    const minutes = minutesFor(totalCalories, option.met, weightLbs);
                    return (
                      <li key={group.key}>
                        <span>
                          {group.title}
                          {group.options.length > 1 && <small>{option.adjustmentValue}</small>}
                        </span>
                        <strong>{minutes == null ? "—" : formatDuration(minutes)}</strong>
                      </li>
                    );
                  })}
                </ul>
                {!(totalCalories > 0 && weightLbs > 0) && (
                  <small>{totalCalories > 0 ? "Add your weight to see times." : "Add food to see times."}</small>
                )}
              </div>
            )}
          </aside>
        </div>

        <ActivityExplorer
          groups={activityGroups}
          favoriteKeys={favoriteKeys}
          selections={selections}
          calories={totalCalories}
          weightLbs={weightLbs}
          onToggleFavorite={toggleFavorite}
          onSelect={setSelection}
        />

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
      </div>
    </main>
  );
}
