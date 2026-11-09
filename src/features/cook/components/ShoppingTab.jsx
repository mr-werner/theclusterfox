import { useState } from "react";
import { Check, ClipboardCopy, Minus, PackageCheck, Plus, Trash2, X } from "lucide-react";
import { ingredientsById, AISLES } from "../data/ingredients";
import { recipesById } from "../data/recipes";
import { amountText } from "../model/units";
import * as P from "../model/pantry";

export default function ShoppingTab({ data, today, setShopping, patchData, onOpen }) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const list = data.shopping;
  const mode = data.prefs.measure;
  const groups = P.groupByAisle(list, AISLES);
  const recipeIds = P.listRecipes(list);
  const checked = list.filter(i => i.checked).length;

  const label = i => {
    if (!i.ing) return { amount: "", name: i.name };
    const a = amountText(ingredientsById.get(i.ing), P.shoppingAmount(i), mode);
    return { amount: i.sources.length || i.extra ? a.text : "", name: a.name };
  };

  const add = e => {
    e.preventDefault();
    if (!name.trim()) return;
    setShopping(l => P.addManualItem(l, name));
    setName("");
  };

  const copy = async () => {
    const text = groups
      .map(([aisle, items]) => [AISLES[aisle] ?? "Other", ...items.filter(i => !i.checked).map(i => `- ${[label(i).amount, label(i).name].filter(Boolean).join(" ")}`)].join("\n"))
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(`Shopping list\n\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy your shopping list:", text);
    }
  };

  return (
    <section className="ck-shopping" aria-label="Shopping list">
      <form className="ck-panel ck-shop-add" onSubmit={add}>
        <label className="ck-field">
          <span>Add an item</span>
          <input type="text" list="ck-shop-names" placeholder="e.g. lemons, paper towels" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <button type="submit" className="ck-btn ck-btn--primary" disabled={!name.trim()}>
          <Plus size={16} aria-hidden="true" /> Add
        </button>
        <datalist id="ck-shop-names">
          {[...ingredientsById.values()].map(i => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
      </form>

      {recipeIds.length > 0 && (
        <div className="ck-shop-recipes">
          <span className="ck-muted">For:</span>
          {recipeIds.map(id => {
            const r = recipesById.get(id);
            return (
              <span key={id} className="ck-shop-recipe">
                <button type="button" className="ck-link ck-link--plain" onClick={() => onOpen(id)}>
                  {r.title}
                </button>
                <button type="button" className="ck-icon-btn ck-icon-btn--tiny" aria-label={`Remove ${r.title}'s ingredients`} onClick={() => setShopping(l => P.removeRecipeFromList(l, id))}>
                  <X size={14} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {list.length === 0 ? (
        <div className="ck-empty">
          <p>Your shopping list is empty.</p>
          <p className="ck-muted">Open a recipe and tap "Add to shopping list". Ingredients from different recipes are combined, and anything in your pantry is left off.</p>
        </div>
      ) : (
        <>
          <div className="ck-row">
            <button type="button" className="ck-btn" onClick={copy}>
              <ClipboardCopy size={16} aria-hidden="true" /> {copied ? "Copied!" : "Copy list"}
            </button>
            {checked > 0 && (
              <>
                <button type="button" className="ck-btn" onClick={() => patchData(d => P.checkedToPantry(d.shopping, d.pantry, today))}>
                  <PackageCheck size={16} aria-hidden="true" /> Put {checked} checked in pantry
                </button>
                <button type="button" className="ck-btn ck-btn--quiet" onClick={() => setShopping(P.clearChecked)}>
                  Clear checked
                </button>
              </>
            )}
            <button
              type="button"
              className="ck-btn ck-btn--quiet"
              onClick={() => {
                if (window.confirm("Clear the whole shopping list?")) setShopping(() => []);
              }}
            >
              <Trash2 size={16} aria-hidden="true" /> Clear all
            </button>
          </div>

          {groups.map(([aisle, items]) => (
            <div key={aisle} className="ck-panel ck-shop-group">
              <h3>{AISLES[aisle] ?? "Other"}</h3>
              <ul className="ck-checks ck-checks--compact">
                {items.map(i => {
                  const l = label(i);
                  const recipes = i.sources.map(s => recipesById.get(s.recipeId).title);
                  return (
                    <li key={i.id} className="ck-shop-item">
                      <label className={i.checked ? "is-on" : ""}>
                        <input type="checkbox" checked={i.checked} onChange={() => setShopping(list => P.toggleItem(list, i.id))} />
                        <span className="ck-box" aria-hidden="true">
                          <Check size={16} />
                        </span>
                        <span>
                          {l.amount && <span className="ck-amt">{l.amount} </span>}
                          {l.name}
                          {recipes.length > 1 && <span className="ck-muted ck-shop-for"> · {recipes.length} recipes</span>}
                        </span>
                      </label>
                      <div className="ck-shop-actions">
                        {i.ing && (i.sources.length > 0 || i.extra) ? (
                          <>
                            <button type="button" className="ck-icon-btn" aria-label={`Less ${l.name}`} onClick={() => setShopping(list => P.adjustItem(list, i.id, 0.75))}>
                              <Minus size={16} />
                            </button>
                            <button type="button" className="ck-icon-btn" aria-label={`More ${l.name}`} onClick={() => setShopping(list => P.adjustItem(list, i.id, 1.25))}>
                              <Plus size={16} />
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="ck-icon-btn" aria-label={`Remove ${l.name}`} onClick={() => setShopping(list => P.removeItem(list, i.id))}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
