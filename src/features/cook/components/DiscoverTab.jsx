import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import RecipeCard from "./RecipeCard";
import { Chips } from "./ui";
import { toggleIn } from "./format";
import { recipes, MEALS, TASTES, TAGS, DIFFICULTY } from "../data/recipes";
import { DIETS } from "../model/recipe";
import { discover, emptyFilters } from "../model/discover";

const TIMES = [
  { value: 0, label: "Any time" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
];

const QUICK_DIETS = ["vegetarian", "vegan", "gluten-free", "dairy-free"];

export default function DiscoverTab({ data, today, filters, setFilters, onOpen, onToggleFavorite, onEditProfile }) {
  const [more, setMore] = useState(false);
  const { results, hidden } = useMemo(() => discover(recipes, data.profile, filters, { pantry: data.pantry, today }), [data.profile, data.pantry, filters, today]);
  const hasPantry = data.pantry.length > 0;
  const set = patch => setFilters(f => ({ ...f, ...patch }));
  const active = JSON.stringify(filters) !== JSON.stringify(emptyFilters());
  const advancedCount = [filters.tastes.length, filters.tags.length, filters.maxDifficulty, filters.minProtein, filters.maxCalories, filters.have, filters.exclude].filter(Boolean).length;
  const hiddenTotal = hidden.allergy + hidden.diet + hidden.excluded;

  return (
    <section className="ck-discover" aria-label="Discover recipes">
      <div className="ck-search">
        <Search size={18} aria-hidden="true" />
        <label className="sr-only" htmlFor="ck-q">
          Search recipes or ingredients
        </label>
        <input id="ck-q" type="search" placeholder="Search recipes or ingredients" value={filters.q} onChange={e => set({ q: e.target.value })} />
      </div>

      <div className="ck-filter-rows">
        <div className="ck-chips" role="group" aria-label="Ready in">
          {TIMES.map(t => (
            <button key={t.value} type="button" className="ck-chip" aria-pressed={filters.maxTime === t.value} onClick={() => set({ maxTime: t.value })}>
              {t.value ? `Under ${t.label}` : t.label}
            </button>
          ))}
        </div>
        <div className="ck-chips" role="group" aria-label="Meal">
          <button type="button" className="ck-chip" aria-pressed={!filters.meal} onClick={() => set({ meal: "" })}>
            Any meal
          </button>
          {Object.entries(MEALS).map(([k, v]) => (
            <button key={k} type="button" className="ck-chip" aria-pressed={filters.meal === k} onClick={() => set({ meal: filters.meal === k ? "" : k })}>
              {v}
            </button>
          ))}
        </div>
        {hasPantry && (
          <div className="ck-chips" role="group" aria-label="From my pantry">
            <button type="button" className="ck-chip" aria-pressed={filters.maxMissing === 0} onClick={() => set({ maxMissing: filters.maxMissing === 0 ? -1 : 0 })}>
              I have everything
            </button>
            <button type="button" className="ck-chip" aria-pressed={filters.maxMissing === 2} onClick={() => set({ maxMissing: filters.maxMissing === 2 ? -1 : 2 })}>
              Missing 2 or fewer
            </button>
            <button type="button" className="ck-chip" aria-pressed={filters.useSoon} onClick={() => set({ useSoon: !filters.useSoon })}>
              Uses food expiring soon
            </button>
          </div>
        )}
        <div className="ck-filter-line">
          <Chips
            label="Diet"
            options={Object.fromEntries(QUICK_DIETS.map(d => [d, DIETS[d]]))}
            selected={filters.diets}
            onToggle={d => set({ diets: toggleIn(filters.diets, d) })}
          />
          <button type="button" className="ck-btn ck-btn--quiet" aria-expanded={more} onClick={() => setMore(m => !m)}>
            <SlidersHorizontal size={16} aria-hidden="true" /> More filters{advancedCount ? ` (${advancedCount})` : ""}
          </button>
          {active && (
            <button type="button" className="ck-btn ck-btn--quiet" onClick={() => setFilters(emptyFilters())}>
              <X size={16} aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      {more && (
        <div className="ck-panel ck-more">
          <div>
            <h3>Flavor</h3>
            <Chips label="Flavor" options={TASTES} selected={filters.tastes} onToggle={t => set({ tastes: toggleIn(filters.tastes, t) })} />
          </div>
          <div>
            <h3>Style</h3>
            <Chips label="Style" options={TAGS} selected={filters.tags} onToggle={t => set({ tags: toggleIn(filters.tags, t) })} />
          </div>
          <div>
            <h3>Skill level</h3>
            <div className="ck-chips" role="group" aria-label="Skill level">
              <button type="button" className="ck-chip" aria-pressed={!filters.maxDifficulty} onClick={() => set({ maxDifficulty: "" })}>
                Any
              </button>
              {Object.entries(DIFFICULTY).map(([k, v]) => (
                <button key={k} type="button" className="ck-chip" aria-pressed={filters.maxDifficulty === k} onClick={() => set({ maxDifficulty: k })}>
                  {k === "advanced" ? v : `${v} or easier`}
                </button>
              ))}
            </div>
          </div>
          <div className="ck-field-grid">
            <label className="ck-field">
              <span>At least this much protein (g per serving)</span>
              <input type="number" inputMode="numeric" min="0" max="150" placeholder="Any" value={filters.minProtein || ""} onChange={e => set({ minProtein: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label className="ck-field">
              <span>Calories per serving, at most</span>
              <input type="number" inputMode="numeric" min="0" max="3000" step="50" placeholder="Any" value={filters.maxCalories || ""} onChange={e => set({ maxCalories: Math.max(0, Number(e.target.value) || 0) })} />
            </label>
            <label className="ck-field">
              <span>Ingredients I have and want to use</span>
              <input type="text" placeholder="e.g. spinach, chickpeas" value={filters.have} onChange={e => set({ have: e.target.value })} />
            </label>
            <label className="ck-field">
              <span>Leave out</span>
              <input type="text" placeholder="e.g. cilantro, mushrooms" value={filters.exclude} onChange={e => set({ exclude: e.target.value })} />
            </label>
          </div>
        </div>
      )}

      <div className="ck-results-head">
        <p className="ck-muted">
          {results.length} {results.length === 1 ? "recipe" : "recipes"}
          {hiddenTotal > 0 && (
            <>
              {" "}
              · {hiddenTotal} hidden by your{" "}
              {[hidden.allergy && "allergies", hidden.diet && "diet", hidden.excluded && "ingredients to avoid"].filter(Boolean).join(", ")}{" "}
              <button type="button" className="ck-link" onClick={onEditProfile}>
                Edit
              </button>
            </>
          )}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="ck-empty">
          <p>Nothing matches all of that yet.</p>
          <p className="ck-muted">Try loosening a filter or two.</p>
          {active && (
            <button type="button" className="ck-btn" onClick={() => setFilters(emptyFilters())}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="ck-grid">
          {results.map(({ recipe, reasons, pantry }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              reasons={reasons}
              pantry={pantry}
              favorite={data.favorites.includes(recipe.id)}
              inProgress={Boolean(data.sessions[recipe.id])}
              onOpen={onOpen}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </section>
  );
}
