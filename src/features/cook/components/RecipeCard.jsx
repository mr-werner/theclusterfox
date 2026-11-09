import { ArrowLeftRight, Clock, Heart, Sparkles, ChefHat, Users } from "lucide-react";
import { Cover } from "./ui";
import { minutesText } from "./format";
import { factsOf } from "../model/discover";
import { roundNutrient, servingWord } from "../model/recipe";
import { DIFFICULTY } from "../data/recipes";

export default function RecipeCard({ recipe, reasons = [], pantry = null, fix = null, favorite, inProgress, onOpen, onToggleFavorite }) {
  const n = factsOf(recipe).nutrition;
  const t = recipe.time;
  return (
    <article className="ck-card">
      <Cover recipe={recipe}>
        {inProgress && <span className="ck-cover-badge">In progress</span>}
        {pantry && (
          <span className={`ck-cover-pantry${pantry.missing.length === 0 ? " is-all" : ""}`}>
            {pantry.missing.length === 0 ? "You have everything" : `Missing ${pantry.missing.length} of ${pantry.total}`}
          </span>
        )}
        {recipe.customized && (
          <span className="ck-cover-swap">
            <ArrowLeftRight size={12} aria-hidden="true" /> {fix ? "With swaps" : "Your version"}
          </span>
        )}
      </Cover>
      <button
        type="button"
        className={`ck-fav${favorite ? " is-on" : ""}`}
        aria-pressed={favorite}
        aria-label={favorite ? `Remove ${recipe.title} from saved` : `Save ${recipe.title}`}
        onClick={() => onToggleFavorite(recipe.id)}
      >
        <Heart size={18} fill={favorite ? "currentColor" : "none"} />
      </button>
      <button type="button" className="ck-card-main" onClick={() => onOpen(recipe.id)}>
        <h3>{recipe.title}</h3>
        <p className="ck-card-desc">{recipe.description}</p>
        <p className="ck-card-meta">
          <span>
            <Clock size={14} aria-hidden="true" /> {t.inactive ? `${minutesText(t.active)} + overnight` : minutesText(t.total)}
            {!t.inactive && t.active < t.total ? ` · ${t.active} active` : ""}
          </span>
          <span>
            <ChefHat size={14} aria-hidden="true" /> {DIFFICULTY[recipe.difficulty]}
          </span>
          <span>
            <Users size={14} aria-hidden="true" /> {recipe.servings} {servingWord(recipe, recipe.servings)}
          </span>
        </p>
        <p className="ck-card-macros" aria-label="Estimated nutrition per serving">
          <span>
            <strong>{roundNutrient("kcal", n.kcal)}</strong> cal
          </span>
          <span>
            <strong>{roundNutrient("protein", n.protein)}g</strong> protein
          </span>
          <span>
            <strong>{roundNutrient("carbs", n.carbs)}g</strong> carbs
          </span>
          <span>
            <strong>{roundNutrient("fat", n.fat)}g</strong> fat
          </span>
        </p>
        {reasons.length > 0 && (
          <ul className="ck-reasons" aria-label="Why it's recommended">
            {reasons.map(r => (
              <li key={r}>
                <Sparkles size={12} aria-hidden="true" /> {r}
              </li>
            ))}
          </ul>
        )}
      </button>
    </article>
  );
}
