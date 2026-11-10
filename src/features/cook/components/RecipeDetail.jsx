import { useState } from "react";
import { ArrowLeft, ArrowLeftRight, Check, CircleHelp, Clock, Flame, Heart, Play, RotateCcw, ShieldCheck, ShoppingCart, Sparkles, Store, TriangleAlert, Undo2, Users, ChefHat, Info } from "lucide-react";
import { Cover, Segmented, Stepper, UnitToggles } from "./ui";
import { minutesText } from "./format";
import { ingredientsById, ALLERGENS } from "../data/ingredients";
import { DIFFICULTY, EQUIPMENT, TAGS } from "../data/recipes";
import { safetyNotes, SAFETY_SOURCE } from "../data/safety";
import { allergensOf, dietsOf, DIETS, recipeNutrition, roundNutrient, scaledLines, scaleNotes, servingWord, clampServings, scaleFactor } from "../model/recipe";
import { amountText, renderTemps } from "../model/units";
import { progressPercent } from "../model/session";
import { pantryMatch, recipePantry } from "../model/pantry";
import { itemConflicts, suggestFixes, swappableKeys } from "../model/swaps";
import { swapsById } from "../data/swaps";
import SwapDialog from "./SwapDialog";

const NUTRITION_ROWS = [
  ["kcal", "Calories", ""],
  ["protein", "Protein", "g"],
  ["carbs", "Carbohydrates", "g"],
  ["fat", "Fat", "g"],
  ["fiber", "Fiber", "g"],
  ["sugar", "Sugars", "g"],
  ["sodium", "Sodium", "mg"],
];

// "Don't have it?" on a line the cook hasn't checked off: opens the swap
// dialog in its don't-have mode, which also offers the shopping list.
export function MissingButton({ line, onOpen }) {
  return (
    <button type="button" className="ck-swap-btn ck-missing-btn" onClick={onOpen} aria-label={`Don't have ${ingredientsById.get(line.ing).name}?`}>
      <CircleHelp size={13} aria-hidden="true" /> Don't have it?
    </button>
  );
}

// "Swapped from butter · Undo" under a swapped line, or a Swap button.
export function SwapControl({ line, canSwap, onOpen, onUndo }) {
  if (line.from) {
    return (
      <span className="ck-swapped">
        <ArrowLeftRight size={12} aria-hidden="true" /> Swapped from {ingredientsById.get(line.from).name}
        <button type="button" className="ck-link" onClick={onUndo}>
          Undo
        </button>
      </span>
    );
  }
  if (!canSwap) return null;
  return (
    <button type="button" className="ck-swap-btn" onClick={onOpen} aria-label={`Swap ${ingredientsById.get(line.ing).name}`}>
      <ArrowLeftRight size={13} aria-hidden="true" /> Swap
    </button>
  );
}

// Lines the cook chose to leave out, so they can bring them back.
export function LeftOut({ base, recipe, onUndo }) {
  const kept = new Set(recipe.ingredients.map(l => l.key ?? l.ing));
  const gone = base.ingredients.filter(l => !kept.has(l.key ?? l.ing));
  if (!gone.length) return null;
  return (
    <ul className="ck-left-out">
      {gone.map(l => (
        <li key={l.key ?? l.ing}>
          <span>Leaving out the {ingredientsById.get(l.ing).name}</span>
          <button type="button" className="ck-link" onClick={() => onUndo(l.key ?? l.ing)}>
            <Undo2 size={13} aria-hidden="true" /> Put it back
          </button>
        </li>
      ))}
    </ul>
  );
}

export function IngredientLine({ line, amount, mode, showHint }) {
  const item = line.item ?? ingredientsById.get(line.ing);
  const a = amountText(item, amount, mode);
  return (
    <>
      <span className="ck-amt">{a.text}</span>{" "}
      <span className="ck-ing-name">
        {a.name}
        {line.prep ? <span className="ck-muted">, {line.prep}</span> : null}
        {showHint && line.hint ? <span className="ck-muted"> ({line.hint})</span> : null}
      </span>
    </>
  );
}

export default function RecipeDetail({ base, recipe, onSwap, onSetSwaps, data, today, setPrefs, onAddToList, onAddLine, update, initialServings, favorite, onToggleFavorite, onBack, onStart, onResume, onDiscardSession, onPlanB }) {
  const session = data.sessions[recipe.id];
  const prefs = data.prefs;
  const [servings, setServings] = useState(() => clampServings(initialServings ?? session?.servings ?? recipe.servings));
  const [whole, setWhole] = useState(false);
  const [added, setAdded] = useState(null);
  const hasPantry = data.pantry.length > 0;
  const pantryInfo = hasPantry ? recipePantry(recipe, data.pantry, today) : null;
  const lines = scaledLines(recipe, servings);
  const nutrition = recipeNutrition(recipe);
  const f = scaleFactor(recipe, servings);
  const allergens = allergensOf(recipe);
  const diets = Object.entries(dietsOf(recipe)).filter(([k, v]) => v && k !== "egg-free" && k !== "pescatarian");
  const notes = scaleNotes(recipe, servings);
  const household = data.profile.household;
  const ingNotes = [...new Set(lines.map(l => l.item.note).filter(Boolean))];
  const t = recipe.time;
  const [swapping, setSwapping] = useState(null); // { key, missing }
  const canSwap = swappableKeys(base);
  // The ingredient checklist. Before you start it's a draft, prefilled from the
  // pantry and carried into the cooking session; once a session exists it's
  // the session's own "have" list, shared with the prep screen.
  const [draft, setDraft] = useState(() => Object.fromEntries((pantryInfo?.have ?? []).map(k => [k, true])));
  const have = session ? session.have : draft;
  const toggleHave = key => {
    if (session) update(s => ({ ...s, have: { ...s.have, [key]: !s.have[key] }, prepped: s.have[key] ? { ...s.prepped, [key]: false } : s.prepped }));
    else setDraft(d => ({ ...d, [key]: !d[key] }));
  };
  const haveCount = lines.filter(l => have[l.key]).length;
  const setAllHave = on => {
    const next = on ? Object.fromEntries(lines.map(l => [l.key, true])) : {};
    if (session) update(s => ({ ...s, have: next, prepped: on ? s.prepped : {} }));
    else setDraft(next);
  };
  const limits = { allergies: data.profile.allergies, diets: data.profile.diets };
  const conflicts = [...new Set(recipe.ingredients.flatMap(l => itemConflicts(ingredientsById.get(l.ing), limits).map(c => (c.kind === "allergy" ? `contains ${c.label.toLowerCase()}` : `not ${c.label.toLowerCase()}`))))];
  const fix = conflicts.length ? suggestFixes(base, limits, recipe.swaps) : null;
  const swapCount = Object.keys(recipe.swaps ?? {}).length;

  return (
    <article className="ck-detail">
      <button type="button" className="ck-back" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" /> All recipes
      </button>

      <header className="ck-detail-hero">
        <Cover recipe={recipe} size="hero" />
        <div className="ck-detail-intro">
          <p className="ck-eyebrow">{recipe.cuisine}</p>
          <h2>{recipe.title}</h2>
          <p className="ck-lede">{recipe.description}</p>
          <ul className="ck-facts">
            <li>
              <Clock size={16} aria-hidden="true" />
              <span>
                <strong>{t.inactive ? `${minutesText(t.active)} + overnight` : minutesText(t.total)}</strong> total
              </span>
            </li>
            <li>
              <Flame size={16} aria-hidden="true" />
              <span>
                {minutesText(t.prep)} prep{t.cook ? ` · ${minutesText(t.cook)} cook` : ""} · {minutesText(t.active)} hands-on
              </span>
            </li>
            <li>
              <ChefHat size={16} aria-hidden="true" />
              <span>{DIFFICULTY[recipe.difficulty]}</span>
            </li>
          </ul>
          <div className="ck-detail-actions">
            {session ? (
              <>
                <button type="button" className="ck-btn ck-btn--primary ck-btn--big" onClick={onResume}>
                  <Play size={18} aria-hidden="true" /> Resume cooking · {progressPercent(recipe, session)}%
                </button>
                <button
                  type="button"
                  className="ck-btn"
                  onClick={() => {
                    if (window.confirm("Start over? Your checkmarks and timers for this recipe will be cleared.")) onDiscardSession();
                  }}
                >
                  <RotateCcw size={16} aria-hidden="true" /> Start over
                </button>
              </>
            ) : (
              <button type="button" className="ck-btn ck-btn--primary ck-btn--big" onClick={() => onStart(servings, lines.filter(l => draft[l.key]).map(l => l.key))}>
                <Play size={18} aria-hidden="true" /> Start cooking
              </button>
            )}
            <button type="button" className={`ck-btn${favorite ? " is-on" : ""}`} aria-pressed={favorite} onClick={() => onToggleFavorite(recipe.id)}>
              <Heart size={16} fill={favorite ? "currentColor" : "none"} aria-hidden="true" /> {favorite ? "Saved" : "Save"}
            </button>
            <button type="button" className="ck-btn ck-btn--quiet" onClick={onPlanB}>
              <Store size={16} aria-hidden="true" /> Not cooking tonight?
            </button>
          </div>
        </div>
      </header>

      {conflicts.length > 0 && (
        <div className="ck-callout ck-callout--warn" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <p>
              <strong>Heads up:</strong> this {swapCount ? "version" : "recipe"} doesn't fit your profile ({conflicts.join("; ")}).
            </p>
            {fix ? (
              <>
                <p>
                  {Object.keys(fix).length === 1 ? "One swap makes" : `${Object.keys(fix).length} swaps make`} it fit:{" "}
                  {Object.entries(fix)
                    .map(([k, id]) => {
                      const sw = swapsById.get(id);
                      const from = ingredientsById.get(base.ingredients.find(l => (l.key ?? l.ing) === k).ing).name;
                      return sw.to ? `${ingredientsById.get(sw.to).name} for the ${from}` : `leave out the ${from}`;
                    })
                    .join("; ")}
                  .
                </p>
                <button type="button" className="ck-btn ck-btn--primary" onClick={() => onSetSwaps({ ...recipe.swaps, ...fix })}>
                  <Sparkles size={16} aria-hidden="true" /> Apply {Object.keys(fix).length === 1 ? "this swap" : "these swaps"}
                </button>
              </>
            ) : (
              <p>There isn't a swap for everything here, so this one may be best skipped.</p>
            )}
          </div>
        </div>
      )}

      {swapCount > 0 && (
        <div className="ck-custom-banner" role="status">
          <ArrowLeftRight size={16} aria-hidden="true" />
          <span>
            <strong>Your version</strong> with {swapCount} {swapCount === 1 ? "swap" : "swaps"}. Amounts, steps and nutrition are updated.
          </span>
          <button type="button" className="ck-link" onClick={() => onSetSwaps({})}>
            Restore original
          </button>
        </div>
      )}

      <div className="ck-detail-grid">
        <section className="ck-panel" aria-labelledby="ck-ing-h">
          <div className="ck-panel-head">
            <h3 id="ck-ing-h">Ingredients</h3>
            <UnitToggles prefs={prefs} setPrefs={setPrefs} />
          </div>
          <div className="ck-servings-row">
            <Stepper label="Servings" value={servings} onChange={setServings} suffix={servingWord(recipe, servings)} />
            {household && household !== servings && !recipe.servingName && (
              <button type="button" className="ck-link" onClick={() => setServings(household)}>
                Scale to my household ({household})
              </button>
            )}
            {servings !== recipe.servings && (
              <button type="button" className="ck-link" onClick={() => setServings(recipe.servings)}>
                Back to original ({recipe.servings})
              </button>
            )}
          </div>
          {session && session.servings !== servings && (
            <p className="ck-note">Your cooking session is set to {session.servings}. Change servings from the prep checklist while cooking.</p>
          )}
          <div className="ck-prep-tally ck-ing-tally">
            <span>
              <strong>{haveCount}</strong> of {lines.length} ready. Check off what you have before you start.
            </span>
            <button type="button" className="ck-link" onClick={() => setAllHave(haveCount < lines.length)}>
              {haveCount < lines.length ? "I have everything" : "Uncheck all"}
            </button>
          </div>
          <ul className="ck-ing-list ck-ing-checklist">
            {lines.map(l => {
              const inPantry = hasPantry && pantryMatch(data.pantry, l.ing);
              const on = Boolean(have[l.key]);
              const name = ingredientsById.get(l.ing).name;
              return (
                <li key={l.key} className={on ? "is-on" : ""}>
                  <button type="button" className="ck-ing-check" aria-pressed={on} aria-label={`Have ${name}`} onClick={() => toggleHave(l.key)}>
                    <span className="ck-box" aria-hidden="true">
                      <Check size={16} />
                    </span>
                  </button>
                  <span className="ck-ing-main">
                    <span>
                      <IngredientLine line={l} amount={l.amount} mode={prefs.measure} showHint={f === 1} />
                    </span>
                    {!on && !l.from && <MissingButton line={l} onOpen={() => setSwapping({ key: l.key, missing: true })} />}
                    <SwapControl line={l} canSwap={canSwap.has(l.key)} onOpen={() => setSwapping({ key: l.key, missing: false })} onUndo={() => onSwap(l.key, null)} />
                  </span>
                  {inPantry && (
                    <span className="ck-have-tag">
                      <Check size={13} aria-hidden="true" /> In pantry
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <LeftOut base={base} recipe={recipe} onUndo={k => onSwap(k, null)} />
          <div className="ck-list-row">
            {pantryInfo && (
              <span className="ck-muted ck-small-inline">
                {pantryInfo.missing.length === 0 ? "You have everything." : `You need ${pantryInfo.missing.length} of ${pantryInfo.total} ingredients.`}
              </span>
            )}
            {!(pantryInfo && pantryInfo.missing.length === 0) && (
              <button
                type="button"
                className="ck-btn"
                onClick={() => {
                  const n = onAddToList(recipe, servings);
                  setAdded(n);
                }}
              >
                <ShoppingCart size={16} aria-hidden="true" /> {hasPantry ? "Add what I need to my list" : "Add to shopping list"}
              </button>
            )}
            {added !== null && (
              <span className="ck-added" role="status">
                <Check size={14} aria-hidden="true" /> {added} {added === 1 ? "item" : "items"} on your list for {servings} {servingWord(recipe, servings)}
              </span>
            )}
          </div>
          {notes.length > 0 && (
            <div className="ck-callout" role="note">
              <TriangleAlert size={18} aria-hidden="true" />
              <div>
                {notes.map(n => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            </div>
          )}
          {ingNotes.length > 0 && (
            <ul className="ck-small-notes">
              {ingNotes.map(n => (
                <li key={n}>
                  <Info size={14} aria-hidden="true" /> {n}
                </li>
              ))}
            </ul>
          )}

          <h3 className="ck-subhead">You'll need</h3>
          <p className="ck-muted ck-small">
            {[...recipe.equipment.map(e => EQUIPMENT[e]), ...recipe.tools].join(" · ") || "Nothing special"}
          </p>
        </section>

        <section className="ck-panel" aria-labelledby="ck-steps-h">
          <h3 id="ck-steps-h">Method</h3>
          <ol className="ck-step-preview">
            {recipe.steps.map((s, i) => (
              <li key={i}>
                <strong>{s.title}.</strong> {renderTemps(s.text, prefs.temp)}
                {s.timer && <span className="ck-timer-tag"> {s.timer.minutes} min</span>}
                {s.swapNotes?.map(n => (
                  <span key={n} className="ck-swap-note">
                    <ArrowLeftRight size={12} aria-hidden="true" /> {renderTemps(n, prefs.temp)}
                  </span>
                ))}
              </li>
            ))}
          </ol>
        </section>

        <section className="ck-panel" aria-labelledby="ck-nut-h">
          <div className="ck-panel-head">
            <h3 id="ck-nut-h">Nutrition</h3>
            <Segmented
              small
              label="Nutrition amounts"
              value={whole ? "whole" : "serving"}
              onChange={v => setWhole(v === "whole")}
              options={[
                { value: "serving", label: `Per ${servingWord(recipe, 1)}` },
                { value: "whole", label: "Whole recipe" },
              ]}
            />
          </div>
          <table className="ck-nutrition">
            <tbody>
              {NUTRITION_ROWS.map(([k, name, unit]) => (
                <tr key={k}>
                  <th scope="row">{name}</th>
                  <td>
                    {roundNutrient(k, whole ? nutrition.perServing[k] * servings : nutrition.perServing[k]).toLocaleString()}
                    {unit && ` ${unit}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ck-note">
            Estimated from USDA FoodData Central values for each ingredient{whole ? `, for ${servings} ${servingWord(recipe, servings)}` : ""}. Brands and portions vary, so treat these as a guide, not medical advice.
          </p>
        </section>

        <section className="ck-panel" aria-labelledby="ck-allergy-h">
          <h3 id="ck-allergy-h">Allergens & diet</h3>
          {allergens.length ? (
            <p className="ck-allergens">
              <strong>Contains:</strong> {allergens.map(a => ALLERGENS[a]).join(", ")}
            </p>
          ) : (
            <p className="ck-allergens">No major allergens in these ingredients.</p>
          )}
          <p className="ck-note">Always check labels: packaged foods can contain or be processed with allergens.</p>
          {diets.length > 0 && (
            <ul className="ck-badges">
              {diets.map(([k]) => (
                <li key={k}>{DIETS[k]}</li>
              ))}
            </ul>
          )}
          {recipe.tags.length > 0 && (
            <ul className="ck-badges ck-badges--quiet">
              {recipe.tags.map(k => (
                <li key={k}>{TAGS[k]}</li>
              ))}
            </ul>
          )}
        </section>

        {recipe.safety.length > 0 && (
          <section className="ck-panel ck-safety" aria-labelledby="ck-safety-h">
            <h3 id="ck-safety-h">
              <ShieldCheck size={18} aria-hidden="true" /> Food safety
            </h3>
            <ul>
              {recipe.safety.map(k => (
                <li key={k}>
                  <strong>{safetyNotes[k].title}.</strong> {renderTemps(safetyNotes[k].text, prefs.temp)}
                </li>
              ))}
            </ul>
            <p className="ck-note">
              Based on{" "}
              <a href={SAFETY_SOURCE.url} target="_blank" rel="noreferrer">
                {SAFETY_SOURCE.name}
              </a>{" "}
              guidance.
            </p>
          </section>
        )}
      </div>

      {swapping && (
        <SwapDialog
          base={base}
          recipe={recipe}
          lineKey={swapping.key}
          missing={swapping.missing}
          pantry={data.pantry}
          onAddToList={key => onAddLine(recipe, servings, key)}
          profile={limits}
          prefs={prefs}
          servings={servings}
          onChoose={id => {
            onSwap(swapping.key, id);
            setSwapping(null);
          }}
          onClose={() => setSwapping(null)}
        />
      )}

      <p className="ck-credit">
        <Users size={14} aria-hidden="true" /> {recipe.source}. {recipe.license}
      </p>
    </article>
  );
}
