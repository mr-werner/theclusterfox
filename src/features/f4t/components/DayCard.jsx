import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChefHat, Dumbbell, Hand, Minus, Plus, RefreshCw, ShoppingBag, Shuffle, Store, Undo2, Utensils, X } from "lucide-react";

import { formatDuration, minutesToBurnCalories } from "../../../domain/exercise/energy.js";
import { workoutCalories } from "../model/body.js";
import { fuelNote, PRESETS } from "../model/training.js";
import { dayLabel, entryFacts, entryHands, plannedFacts, rankForSlot, rankQuick, slotGoal, SLOTS } from "../model/planner.js";
import { handsText } from "../model/portions.js";
import { quickById } from "../data/quickFoods.js";

// Brisk walking (Compendium 17200, 3.5 mph): the yardstick for an off-plan meal.
export const WALK_MET = 4.3;

const fmt = n => Math.round(n).toLocaleString();
const money = n => `$${n.toFixed(2)}`;

function Meter({ value, target }) {
  if (!target) return null;
  const pct = Math.min(130, (value / target) * 100);
  const state = pct < 85 ? "under" : pct > 110 ? "over" : "ok";
  return (
    <span className={`fp-meter is-${state}`} aria-hidden="true">
      <span style={{ width: `${Math.min(100, pct)}%` }} />
    </span>
  );
}

const encodeChoice = (kind, id) => `${kind}:${id}`;

function SlotRow({ slot, entry, usual, cook, leftoverFrom, getRecipe, ranked, weightLbs, onEntry, onAteElse }) {
  const [picking, setPicking] = useState(false);
  const recipe = entry?.recipeId ? getRecipe(entry.recipeId) : null;
  const quick = entry?.quickId ? quickById.get(entry.quickId) : null;
  const facts = entryFacts(entry, getRecipe);
  const planned = entry?.off ? plannedFacts(entry, getRecipe) : null;
  const hands = entryHands(entry, getRecipe);
  const skipped = usual?.size === "skip";

  // Swap stays the same kind of meal: another recipe, another grab-and-go, another restaurant.
  function swap() {
    const kind = quick ? quick.kind : !entry && (usual?.how === "grab" || usual?.how === "out") ? usual.how : "recipe";
    const lists = ranked();
    if (kind === "recipe") {
      const list = lists.recipes;
      const at = list.findIndex(r => r.recipe.id === entry?.recipeId);
      const next = list[(at + 1) % Math.max(1, Math.min(list.length, 8))] ?? list[0];
      if (next) onEntry({ recipeId: next.recipe.id, portions: next.portions });
    } else {
      const list = lists[kind];
      const at = list.findIndex(r => r.food.id === entry?.quickId);
      const next = list[(at + 1) % Math.max(1, Math.min(list.length, 6))] ?? list[0];
      if (next) onEntry({ quickId: next.food.id, portions: next.portions });
    }
  }

  function choose(value) {
    setPicking(false);
    if (!value) return;
    const [kind, id] = value.split(":");
    const lists = ranked();
    if (kind === "recipe") {
      const hit = lists.recipes.find(r => r.recipe.id === id);
      onEntry({ recipeId: id, portions: hit?.portions ?? 1 });
    } else {
      const hit = lists[kind].find(r => r.food.id === id);
      onEntry({ quickId: id, portions: hit?.portions ?? 1 });
    }
  }

  const step = quick ? 1 : 0.5;
  const portions = delta => onEntry(e => (e ? { ...e, portions: Math.min(6, Math.max(step === 1 ? 1 : 0.5, e.portions + delta)) } : e));

  if (picking) {
    const lists = ranked();
    const order = usual?.how === "out" ? ["out", "grab", "recipes"] : usual?.how === "grab" ? ["grab", "out", "recipes"] : ["recipes", "grab", "out"];
    const groups = {
      recipes: (
        <optgroup key="r" label="Cook it (CookFox recipes, best fit first)">
          {lists.recipes.map(({ recipe: r, portions: p }) => (
            <option key={r.id} value={encodeChoice("recipe", r.id)}>
              {r.title} · {fmt(entryFacts({ recipeId: r.id, portions: p }, getRecipe).kcal)} cal{p !== 1 ? ` (${p}×)` : ""}
            </option>
          ))}
        </optgroup>
      ),
      grab: (
        <optgroup key="g" label="Grab & go (no cooking)">
          {lists.grab.map(({ food: f, portions: p }) => (
            <option key={f.id} value={encodeChoice("grab", f.id)}>
              {f.name}{p > 1 ? ` ×${p}` : ""} · {fmt(f.kcal * p)} cal
            </option>
          ))}
        </optgroup>
      ),
      out: (
        <optgroup key="o" label="Eat out">
          {lists.out.map(({ food: f }) => (
            <option key={f.id} value={encodeChoice("out", f.id)}>
              {f.name} · {fmt(f.kcal)} cal · about ${f.cost}
            </option>
          ))}
        </optgroup>
      ),
    };
    return (
      <li className="fp-slot is-picking">
        <span className="fp-slot-name">{slot.name}</span>
        <select autoFocus defaultValue="" onChange={e => choose(e.target.value)} onBlur={() => setPicking(false)} aria-label={`Choose ${slot.name.toLowerCase()}`}>
          <option value="" disabled>Pick something</option>
          {order.map(k => groups[k])}
        </select>
        <button type="button" className="fp-icon" onClick={() => setPicking(false)} aria-label="Cancel">
          <X size={15} />
        </button>
      </li>
    );
  }

  if (!entry) {
    return (
      <li className={`fp-slot is-empty${skipped ? " is-skipped" : ""}`}>
        <span className="fp-slot-name">{slot.name}</span>
        {skipped ? (
          <span className="fp-skipped">
            You usually skip this.{" "}
            <button type="button" className="ff-link" onClick={() => setPicking(true)}>Add one</button>
          </span>
        ) : (
          <button type="button" className="fp-add" onClick={() => setPicking(true)}>
            <Plus size={14} /> Choose
          </button>
        )}
        {!skipped && (
          <button type="button" className="fp-icon" onClick={swap} aria-label={`Suggest a ${slot.name.toLowerCase()}`} title="Suggest one">
            <Shuffle size={15} />
          </button>
        )}
      </li>
    );
  }

  if (entry.off) {
    const extra = facts.kcal - (planned?.kcal ?? 0);
    const minutes = extra > 0 ? minutesToBurnCalories(extra, WALK_MET, weightLbs || 170) : 0;
    const was = recipe?.title ?? (entry.quickId ? quickById.get(entry.quickId)?.name : null);
    return (
      <li className="fp-slot is-off">
        <span className="fp-slot-name">{slot.name}</span>
        <div className="fp-slot-main">
          <strong>{entry.off.name}</strong>
          <small>
            Off plan{was ? ` (was ${was})` : ""} ·{" "}
            {extra > 0 ? <b className="fp-extra">+{fmt(extra)} cal, about {formatDuration(minutes)} of brisk walking</b> : extra < 0 ? `${fmt(-extra)} cal under plan` : "same as planned"}
          </small>
        </div>
        <span className="fp-slot-cal">{fmt(facts.kcal)}</span>
        <div className="fp-slot-actions">
          {was && (
            <button type="button" className="fp-icon" onClick={() => onEntry(e => ({ ...e, off: undefined }))} aria-label="Back to the planned meal" title="Back to the plan">
              <Undo2 size={15} />
            </button>
          )}
          <button type="button" className="fp-icon" onClick={() => onEntry(null)} aria-label={`Clear ${slot.name.toLowerCase()}`} title="Clear">
            <X size={15} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className={`fp-slot${entry.eaten ? " is-eaten" : ""}`}>
      <span className="fp-slot-name">{slot.name}</span>
      <div className="fp-slot-main">
        {quick ? (
          <strong className="fp-recipe">{quick.name}</strong>
        ) : recipe ? (
          <Link to={`/cook?r=${encodeURIComponent(recipe.id)}${cook ? `&servings=${cook.servings}` : ""}`} className="fp-recipe" title="Open in CookFox">
            {recipe.title}
          </Link>
        ) : (
          <strong>Recipe not found</strong>
        )}
        <small>
          {quick ? (
            <span className={`fp-tag${quick.kind === "out" ? " is-out" : " is-grab"}`}>
              {quick.kind === "out" ? <Store size={12} /> : <ShoppingBag size={12} />} {quick.kind === "out" ? "Eat out" : "Grab & go"}
            </span>
          ) : cook ? (
            <span className="fp-tag is-cook"><ChefHat size={12} /> Cook {cook.servings} serving{cook.servings === 1 ? "" : "s"}</span>
          ) : entry.leftover ? (
            <span className="fp-tag">Leftovers{leftoverFrom ? ` from ${leftoverFrom}` : ""}</span>
          ) : null}
          {quick && <span>{quick.amount}</span>}
          {facts && <span>{fmt(facts.protein)} g protein · {money(facts.cost)}</span>}
        </small>
        {hands && handsText(hands) && (
          <small className="fp-hands" title="Hand-size portions: palm of protein, cupped hand of carbs, fist of veg, thumb of fats">
            <Hand size={12} aria-hidden="true" /><span>{handsText(hands)}</span>
          </small>
        )}
        {quick?.tip && <small className="fp-tip">{quick.tip}</small>}
      </div>
      <div className="fp-portions" role="group" aria-label={`${slot.name} portions`}>
        <button type="button" onClick={() => portions(-step)} disabled={entry.portions <= step} aria-label="Smaller portion">
          <Minus size={13} />
        </button>
        <span>{entry.portions}×</span>
        <button type="button" onClick={() => portions(step)} aria-label="Bigger portion">
          <Plus size={13} />
        </button>
      </div>
      <span className="fp-slot-cal">{facts ? fmt(facts.kcal) : "–"}</span>
      <div className="fp-slot-actions">
        <button type="button" className={`fp-icon${entry.eaten ? " is-on" : ""}`} onClick={() => onEntry(e => ({ ...e, eaten: !e.eaten }))} aria-pressed={Boolean(entry.eaten)} aria-label="Ate it" title="Ate it">
          <Check size={15} />
        </button>
        <button type="button" className="fp-icon" onClick={() => onAteElse(slot.id)} aria-label="I ate something else" title="Ate something else">
          <Utensils size={15} />
        </button>
        <button type="button" className="fp-icon" onClick={swap} aria-label="Swap for something similar" title="Swap">
          <RefreshCw size={15} />
        </button>
        <button type="button" className="fp-icon" onClick={() => setPicking(true)} aria-label="Choose something else" title="Choose">
          <Plus size={15} />
        </button>
        <button type="button" className="fp-icon" onClick={() => onEntry(null)} aria-label={`Clear ${slot.name.toLowerCase()}`} title="Clear">
          <X size={15} />
        </button>
      </div>
    </li>
  );
}

function WorkoutForm({ onAdd, onClose }) {
  const [preset, setPreset] = useState("walk");
  const [minutes, setMinutes] = useState("30");
  return (
    <form
      className="fp-workout-form"
      onSubmit={e => {
        e.preventDefault();
        const m = Number(minutes);
        if (m > 0) onAdd({ preset, minutes: m });
        onClose();
      }}
    >
      <select value={preset} onChange={e => setPreset(e.target.value)} aria-label="Workout">
        {PRESETS.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <input type="number" min="5" max="600" inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} aria-label="Minutes" />
      <span>min</span>
      <button type="submit" className="ff-btn ff-btn-small ff-btn-primary">Add</button>
      <button type="button" className="ff-btn ff-btn-small ff-btn-ghost" onClick={onClose}>Cancel</button>
    </form>
  );
}

export default function DayCard({ day, isToday, dayPlan, target, workouts = [], cooks, leftoverSource, recipes, favorites, getRecipe, weightLbs, profile, onEntry, onAteElse, onAddWorkout, onRemoveWorkout }) {
  const [adding, setAdding] = useState(false);
  const totals = SLOTS.reduce(
    (t, s) => {
      const f = entryFacts(dayPlan?.slots?.[s.id], getRecipe);
      return f ? { kcal: t.kcal + f.kcal, protein: t.protein + f.protein, cost: t.cost + f.cost } : t;
    },
    { kcal: 0, protein: 0, cost: 0 }
  );
  const note = fuelNote(workouts);
  const training = workouts.length > 0;

  return (
    <article className={`fp-day${isToday ? " is-today" : ""}${training ? " is-training" : ""}`} id={`fp-day-${day}`}>
      <header className="fp-day-head">
        <div>
          <h3>
            {dayLabel(day, { weekday: "long" })} <span>{dayLabel(day, { month: "short", day: "numeric" })}</span>
            {isToday && <em className="fp-today">Today</em>}
          </h3>
          <p className="fp-day-sum">
            <b>{fmt(totals.kcal)}</b>
            {target ? ` of ${fmt(target.kcal)} cal` : " cal"} · {fmt(totals.protein)}
            {target ? ` of ${target.protein}` : ""} g protein
          </p>
        </div>
        <Meter value={totals.kcal} target={target?.kcal} />
      </header>

      {(training || adding) && (
        <div className="fp-train">
          {workouts.map(w => (
            <span key={w.id} className={`fp-workout${w.done ? " is-done" : ""}`}>
              <Dumbbell size={13} aria-hidden="true" />
              {w.href ? <Link to={w.href}>{w.title}</Link> : w.title} · {w.minutes} min
              <b>+{fmt(workoutCalories(w, weightLbs))} cal</b>
              {w.ownId && (
                <button type="button" onClick={() => onRemoveWorkout(w.ownId)} aria-label={`Remove ${w.title}`}>
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          {note && <p className="fp-fuel">{note}</p>}
        </div>
      )}

      <ul className="fp-slots">
        {SLOTS.map(slot => {
          const entry = dayPlan?.slots?.[slot.id] ?? null;
          const cook = entry?.recipeId && !entry.leftover ? cooks.find(c => c.day === day && c.recipeId === entry.recipeId) : null;
          return (
            <SlotRow
              key={slot.id}
              slot={slot}
              entry={entry}
              cook={cook}
              leftoverFrom={entry?.leftover ? leftoverSource(day, slot.id, entry.recipeId) : null}
              getRecipe={getRecipe}
              weightLbs={weightLbs}
              usual={profile?.day?.[slot.id]}
              ranked={() => {
                const g = { ...slotGoal(target, slot.id, 2000, profile), training, favorites, size: profile?.day?.[slot.id]?.size };
                return { recipes: rankForSlot(recipes, slot.id, g), grab: rankQuick("grab", slot.id, g), out: rankQuick("out", slot.id, g) };
              }}
              onEntry={value => onEntry(day, slot.id, value)}
              onAteElse={slotId => onAteElse(day, slotId)}
            />
          );
        })}
      </ul>

      <footer className="fp-day-foot">
        {adding ? (
          <WorkoutForm onAdd={w => onAddWorkout({ day, ...w })} onClose={() => setAdding(false)} />
        ) : (
          <button type="button" className="fp-add" onClick={() => setAdding(true)}>
            <Plus size={14} /> Add a workout
          </button>
        )}
        <span className="fp-day-cost">{money(totals.cost)} of food</span>
      </footer>
    </article>
  );
}
