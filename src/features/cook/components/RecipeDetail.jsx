import { useState } from "react";
import { ArrowLeft, Clock, Flame, Heart, Play, RotateCcw, ShieldCheck, Store, TriangleAlert, Users, ChefHat, Info } from "lucide-react";
import { Cover, Segmented, Stepper, UnitToggles } from "./ui";
import { minutesText } from "./format";
import { ingredientsById, ALLERGENS } from "../data/ingredients";
import { DIFFICULTY, EQUIPMENT, TAGS } from "../data/recipes";
import { safetyNotes, SAFETY_SOURCE } from "../data/safety";
import { allergensOf, dietsOf, DIETS, recipeNutrition, roundNutrient, scaledLines, scaleNotes, servingWord, clampServings, scaleFactor } from "../model/recipe";
import { amountText, renderTemps } from "../model/units";
import { progressPercent } from "../model/session";

const NUTRITION_ROWS = [
  ["kcal", "Calories", ""],
  ["protein", "Protein", "g"],
  ["carbs", "Carbohydrates", "g"],
  ["fat", "Fat", "g"],
  ["fiber", "Fiber", "g"],
  ["sugar", "Sugars", "g"],
  ["sodium", "Sodium", "mg"],
];

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

export default function RecipeDetail({ recipe, data, setPrefs, initialServings, favorite, onToggleFavorite, onBack, onStart, onResume, onDiscardSession, onPlanB }) {
  const session = data.sessions[recipe.id];
  const prefs = data.prefs;
  const [servings, setServings] = useState(() => clampServings(initialServings ?? session?.servings ?? recipe.servings));
  const [whole, setWhole] = useState(false);
  const lines = scaledLines(recipe, servings);
  const nutrition = recipeNutrition(recipe);
  const f = scaleFactor(recipe, servings);
  const allergens = allergensOf(recipe);
  const diets = Object.entries(dietsOf(recipe)).filter(([k, v]) => v && k !== "egg-free" && k !== "pescatarian");
  const notes = scaleNotes(recipe, servings);
  const household = data.profile.household;
  const ingNotes = [...new Set(lines.map(l => l.item.note).filter(Boolean))];
  const t = recipe.time;

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
              <button type="button" className="ck-btn ck-btn--primary ck-btn--big" onClick={() => onStart(servings)}>
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
          <ul className="ck-ing-list">
            {lines.map(l => (
              <li key={l.key}>
                <IngredientLine line={l} amount={l.amount} mode={prefs.measure} showHint={f === 1} />
              </li>
            ))}
          </ul>
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

      <p className="ck-credit">
        <Users size={14} aria-hidden="true" /> {recipe.source}. {recipe.license}
      </p>
    </article>
  );
}
