import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChefHat, Dumbbell, Minus, Plus, RefreshCw, Shuffle, Undo2, Utensils, X } from "lucide-react";

import { formatDuration, minutesToBurnCalories } from "../../../domain/exercise/energy.js";
import { workoutCalories } from "../model/body.js";
import { fuelNote, PRESETS } from "../model/training.js";
import { dayLabel, entryFacts, plannedFacts, rankForSlot, slotGoal, SLOTS } from "../model/planner.js";

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

function SlotRow({ slot, entry, cook, leftoverFrom, getRecipe, ranked, weightLbs, onEntry, onAteElse }) {
  const [picking, setPicking] = useState(false);
  const recipe = entry?.recipeId ? getRecipe(entry.recipeId) : null;
  const facts = entryFacts(entry, getRecipe);
  const planned = entry?.off ? plannedFacts(entry, getRecipe) : null;

  function swap() {
    const list = ranked();
    const at = list.findIndex(r => r.recipe.id === entry?.recipeId);
    const next = list[(at + 1) % Math.max(1, Math.min(list.length, 8))] ?? list[0];
    if (next) onEntry({ recipeId: next.recipe.id, portions: next.portions });
  }

  function choose(id) {
    setPicking(false);
    if (!id) return;
    const hit = ranked().find(r => r.recipe.id === id);
    onEntry({ recipeId: id, portions: hit?.portions ?? 1 });
  }

  const portions = delta => onEntry(e => (e ? { ...e, portions: Math.min(6, Math.max(0.5, e.portions + delta)) } : e));

  if (picking) {
    const list = ranked();
    return (
      <li className="fp-slot is-picking">
        <span className="fp-slot-name">{slot.name}</span>
        <select autoFocus defaultValue="" onChange={e => choose(e.target.value)} onBlur={() => setPicking(false)} aria-label={`Choose ${slot.name.toLowerCase()}`}>
          <option value="" disabled>Pick a recipe (best fit first)</option>
          {list.map(({ recipe: r, portions: p }) => (
            <option key={r.id} value={r.id}>
              {r.title} · {fmt(entryFacts({ recipeId: r.id, portions: p }, getRecipe).kcal)} cal{p !== 1 ? ` (${p}×)` : ""}
            </option>
          ))}
        </select>
        <button type="button" className="fp-icon" onClick={() => setPicking(false)} aria-label="Cancel">
          <X size={15} />
        </button>
      </li>
    );
  }

  if (!entry) {
    return (
      <li className="fp-slot is-empty">
        <span className="fp-slot-name">{slot.name}</span>
        <button type="button" className="fp-add" onClick={() => setPicking(true)}>
          <Plus size={14} /> Choose
        </button>
        <button type="button" className="fp-icon" onClick={swap} aria-label={`Suggest a ${slot.name.toLowerCase()}`} title="Suggest one">
          <Shuffle size={15} />
        </button>
      </li>
    );
  }

  if (entry.off) {
    const extra = facts.kcal - (planned?.kcal ?? 0);
    const minutes = extra > 0 ? minutesToBurnCalories(extra, WALK_MET, weightLbs || 170) : 0;
    return (
      <li className="fp-slot is-off">
        <span className="fp-slot-name">{slot.name}</span>
        <div className="fp-slot-main">
          <strong>{entry.off.name}</strong>
          <small>
            Off plan{recipe ? ` (was ${recipe.title})` : ""} ·{" "}
            {extra > 0 ? <b className="fp-extra">+{fmt(extra)} cal, about {formatDuration(minutes)} of brisk walking</b> : extra < 0 ? `${fmt(-extra)} cal under plan` : "same as planned"}
          </small>
        </div>
        <span className="fp-slot-cal">{fmt(facts.kcal)}</span>
        <div className="fp-slot-actions">
          {recipe && (
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
        {recipe ? (
          <Link to={`/cook?r=${encodeURIComponent(recipe.id)}${cook ? `&servings=${cook.servings}` : ""}`} className="fp-recipe" title="Open in CookFox">
            {recipe.title}
          </Link>
        ) : (
          <strong>Recipe not found</strong>
        )}
        <small>
          {cook ? (
            <span className="fp-tag is-cook"><ChefHat size={12} /> Cook {cook.servings} serving{cook.servings === 1 ? "" : "s"}</span>
          ) : entry.leftover ? (
            <span className="fp-tag">Leftovers{leftoverFrom ? ` from ${leftoverFrom}` : ""}</span>
          ) : null}
          {facts && <span>{fmt(facts.protein)} g protein · {money(facts.cost)}</span>}
        </small>
      </div>
      <div className="fp-portions" role="group" aria-label={`${slot.name} portions`}>
        <button type="button" onClick={() => portions(-0.5)} disabled={entry.portions <= 0.5} aria-label="Smaller portion">
          <Minus size={13} />
        </button>
        <span>{entry.portions}×</span>
        <button type="button" onClick={() => portions(0.5)} aria-label="Bigger portion">
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
        <button type="button" className="fp-icon" onClick={swap} aria-label="Swap for another recipe" title="Swap">
          <RefreshCw size={15} />
        </button>
        <button type="button" className="fp-icon" onClick={() => setPicking(true)} aria-label="Choose a recipe" title="Choose">
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

export default function DayCard({ day, isToday, dayPlan, target, workouts = [], cooks, leftoverSource, recipes, favorites, getRecipe, weightLbs, onEntry, onAteElse, onAddWorkout, onRemoveWorkout }) {
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
              ranked={() => rankForSlot(recipes, slot.id, { ...slotGoal(target, slot.id), training, favorites })}
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
