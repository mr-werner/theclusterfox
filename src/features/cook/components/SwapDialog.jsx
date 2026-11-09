import { useEffect, useRef } from "react";
import { ArrowLeftRight, Check, TriangleAlert, Undo2, X } from "lucide-react";
import { ALLERGENS, ingredientsById } from "../data/ingredients";
import { SWAP_REASONS } from "../data/swaps";
import { DIETS, lineKey, roundNutrient, scaleFactor } from "../model/recipe";
import { swapsForLine } from "../model/swaps";
import { amountText, renderTemps } from "../model/units";

function deltaText(key, value, unit) {
  const r = roundNutrient(key, Math.abs(value));
  if (!r) return null;
  return `${value > 0 ? "+" : "−"}${r}${unit}`;
}

// Choose a swap for one ingredient line. Shows what changes before anything
// is applied: amount, flavor, texture, cooking, nutrition and allergens.
export default function SwapDialog({ base, recipe, lineKey: key, profile, prefs, servings, onChoose, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    // See PlanB: no close() on cleanup.
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  const original = base.ingredients.find(l => lineKey(l) === key);
  const current = recipe.swaps?.[key] ?? null;
  const options = swapsForLine(base, key, profile, recipe.swaps ?? {});
  const f = scaleFactor(base, servings);
  const fromItem = ingredientsById.get(original.ing);
  const fromAmount = amountText(fromItem, original.amount * f, prefs.measure);

  return (
    <dialog ref={ref} className="ck-dialog ck-swap" onClose={onClose} aria-labelledby="ck-swap-h">
      <div className="ck-dialog-head">
        <div>
          <p className="ck-eyebrow">Swap an ingredient</p>
          <h2 id="ck-swap-h">
            Instead of {fromAmount.text} {fromAmount.name}
          </h2>
        </div>
        <button type="button" className="ck-icon-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {current && (
        <button type="button" className="ck-btn ck-swap-undo" onClick={() => onChoose(null)}>
          <Undo2 size={16} aria-hidden="true" /> Go back to {fromItem.name}
        </button>
      )}

      {options.length === 0 ? (
        <p className="ck-muted">No swaps for this one that fit your allergies and diet.</p>
      ) : (
        <ul className="ck-swap-list">
          {options.map(o => {
            const on = current === o.swap.id;
            const a = o.to && amountText(o.to, o.amount * f, prefs.measure);
            const kcal = deltaText("kcal", o.delta.kcal, " cal");
            const protein = deltaText("protein", o.delta.protein, " g protein");
            const fat = deltaText("fat", o.delta.fat, " g fat");
            const fiber = deltaText("fiber", o.delta.fiber, " g fiber");
            const nutrition = [kcal, protein, fat, fiber].filter(Boolean);
            const tags = [
              ...o.becomes.map(d => DIETS[d]),
              ...o.removes.filter(x => !["milk", "gluten", "egg"].includes(x)).map(x => `No ${ALLERGENS[x].toLowerCase()}`),
              ...o.swap.reasons.map(r => SWAP_REASONS[r]),
            ];
            return (
              <li key={o.swap.id} className={on ? "is-on" : ""}>
                <div className="ck-swap-title">
                  <strong>{o.to ? `${a.text} ${a.name}` : "Leave it out"}</strong>
                  {tags.length > 0 && (
                    <ul className="ck-badges ck-badges--small">
                      {tags.map(t => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <dl className="ck-swap-notes">
                  <div>
                    <dt>Flavor</dt>
                    <dd>{o.swap.flavor}</dd>
                  </div>
                  <div>
                    <dt>Texture</dt>
                    <dd>{o.swap.texture}</dd>
                  </div>
                  <div>
                    <dt>Cooking</dt>
                    <dd>{renderTemps(o.swap.cooking, prefs.temp)}</dd>
                  </div>
                  {nutrition.length > 0 && (
                    <div>
                      <dt>Per serving</dt>
                      <dd>{nutrition.join(" · ")}</dd>
                    </div>
                  )}
                </dl>
                {(o.adds.length > 0 || o.swap.caution || o.to?.note) && (
                  <p className="ck-swap-caution">
                    <TriangleAlert size={15} aria-hidden="true" />
                    <span>
                      {o.adds.length > 0 && <strong>Adds {o.adds.map(x => ALLERGENS[x].toLowerCase()).join(" and ")}. </strong>}
                      {o.swap.caution ?? o.to?.note}
                    </span>
                  </p>
                )}
                {o.loses.length > 0 && <p className="ck-muted ck-small">No longer {o.loses.map(d => DIETS[d].toLowerCase()).join(" or ")}.</p>}
                <button type="button" className={`ck-btn${on ? "" : " ck-btn--primary"}`} disabled={on} onClick={() => onChoose(o.swap.id)}>
                  {on ? (
                    <>
                      <Check size={16} aria-hidden="true" /> Using this
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight size={16} aria-hidden="true" /> Use this swap
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="ck-note">Swaps are saved for this recipe only, in this browser. Nutrition updates to match. With allergies, always check labels.</p>
    </dialog>
  );
}
