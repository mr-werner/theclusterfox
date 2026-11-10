import { useState } from "react";
import { ArrowLeft, Check, ClipboardCopy, Play, ShoppingCart, Store, TriangleAlert } from "lucide-react";
import { Stepper, UnitToggles } from "./ui";
import { IngredientLine, LeftOut, MissingButton, SwapControl } from "./RecipeDetail";
import SwapDialog from "./SwapDialog";
import { swappableKeys } from "../model/swaps";
import { AISLES } from "../data/ingredients";
import { scaledLines, scaleNotes, servingWord } from "../model/recipe";
import { amountText } from "../model/units";
import { buyFor } from "../model/buying";
import * as S from "../model/session";

export default function PrepChecklist({ base, recipe, profile, pantry, onSwap, session, prefs, setPrefs, update, onAddToList, onAddLine, onBack, onCook, onPlanB }) {
  const [confirming, setConfirming] = useState(false);
  const [swapping, setSwapping] = useState(null); // { key, missing }
  const canSwap = swappableKeys(base);
  const [copied, setCopied] = useState(false);
  const [listed, setListed] = useState(false);
  const lines = scaledLines(recipe, session.servings);
  const summary = S.prepSummary(recipe, session);
  const missing = lines.filter(l => !session.have[l.key]);
  const notes = scaleNotes(recipe, session.servings);

  const copyList = async () => {
    const byAisle = new Map();
    for (const l of missing) {
      const a = amountText(l.item, l.amount, prefs.measure);
      const aisle = AISLES[l.item.aisle];
      if (!byAisle.has(aisle)) byAisle.set(aisle, []);
      const buy = buyFor(l.item, l.amount);
      byAisle.get(aisle).push(buy ? `- ${buy.text} ${a.name} (recipe uses ${a.text})` : `- ${a.text} ${a.name}`);
    }
    const text = [`Shopping list: ${recipe.title} (${session.servings} ${servingWord(recipe, session.servings)})`, ...[...byAisle].flatMap(([aisle, items]) => ["", aisle, ...items])].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy your shopping list:", text);
    }
  };

  const start = () => {
    if (missing.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    onCook();
  };

  return (
    <section className="ck-prep" aria-labelledby="ck-prep-h">
      <button type="button" className="ck-back" onClick={onBack}>
        <ArrowLeft size={18} aria-hidden="true" /> Recipe
      </button>
      <header className="ck-prep-head">
        <p className="ck-eyebrow">Before you start</p>
        <h2 id="ck-prep-h">Get everything ready</h2>
        <p className="ck-lede">
          Check off what you have, then what's measured and chopped. Nothing's marked as used until you add it while cooking.
        </p>
      </header>

      <div className="ck-panel">
        <div className="ck-panel-head">
          <Stepper label="Servings" value={session.servings} onChange={n => update(s => S.setServings(s, n))} suffix={servingWord(recipe, session.servings)} />
          <UnitToggles prefs={prefs} setPrefs={setPrefs} />
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

        <div className="ck-prep-tally">
          <span>
            <strong>{summary.have}</strong> of {summary.total} on hand
          </span>
          <span>
            <strong>{summary.prepped}</strong> prepped
          </span>
          <button type="button" className="ck-link" onClick={() => update(s => S.setAllHave(s, recipe, summary.have < summary.total))}>
            {summary.have < summary.total ? "I have everything" : "Uncheck all"}
          </button>
        </div>

        <ul className="ck-prep-list">
          {lines.map(l => {
            const have = Boolean(session.have[l.key]);
            const prepped = Boolean(session.prepped[l.key]);
            return (
              <li key={l.key} className={prepped ? "is-prepped" : have ? "is-have" : ""}>
                <div className="ck-prep-ing">
                  <IngredientLine line={l} amount={l.amount} mode={prefs.measure} />
                  {!have && !l.from && <MissingButton line={l} onOpen={() => setSwapping({ key: l.key, missing: true })} />}
                  {l.from && <SwapControl line={l} canSwap={canSwap.has(l.key)} onOpen={() => setSwapping({ key: l.key, missing: false })} onUndo={() => onSwap(l.key, null)} />}
                </div>
                <div className="ck-prep-toggles">
                  <button type="button" className="ck-toggle" aria-pressed={have} onClick={() => update(s => S.toggleHave(s, l.key))}>
                    <Check size={15} aria-hidden="true" /> Have it
                  </button>
                  <button type="button" className="ck-toggle" aria-pressed={prepped} onClick={() => update(s => S.togglePrepped(s, l.key))}>
                    <Check size={15} aria-hidden="true" /> Prepped
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <LeftOut base={base} recipe={recipe} onUndo={k => onSwap(k, null)} />
      </div>

      {swapping && (
        <SwapDialog
          base={base}
          recipe={recipe}
          lineKey={swapping.key}
          missing={swapping.missing}
          pantry={pantry}
          onAddToList={key => onAddLine(recipe, session.servings, key)}
          profile={profile}
          prefs={prefs}
          servings={session.servings}
          onChoose={id => {
            onSwap(swapping.key, id);
            setSwapping(null);
          }}
          onClose={() => setSwapping(null)}
        />
      )}

      {missing.length > 0 && (
        <div className="ck-panel ck-missing">
          <h3>Still need ({missing.length})</h3>
          <p className="ck-muted ck-small">{missing.map(l => amountText(l.item, l.amount, prefs.measure).name).join(", ")}</p>
          <div className="ck-row">
            <button
              type="button"
              className="ck-btn"
              onClick={() => {
                // Only what's unchecked here, at this session's servings.
                const pantryLike = lines.filter(l => session.have[l.key]).map(l => ({ id: l.key, ing: l.ing, name: null }));
                onAddToList(recipe, session.servings, pantryLike);
                setListed(true);
              }}
            >
              <ShoppingCart size={16} aria-hidden="true" /> {listed ? "On your list" : "Add to shopping list"}
            </button>
            <button type="button" className="ck-btn ck-btn--quiet" onClick={copyList}>
              <ClipboardCopy size={16} aria-hidden="true" /> {copied ? "Copied!" : "Copy shopping list"}
            </button>
            <button type="button" className="ck-btn ck-btn--quiet" onClick={onPlanB}>
              <Store size={16} aria-hidden="true" /> Not cooking tonight?
            </button>
          </div>
        </div>
      )}

      <div className="ck-prep-go">
        {confirming && missing.length > 0 && (
          <p className="ck-warning" role="alert">
            <TriangleAlert size={18} aria-hidden="true" /> {missing.length} {missing.length === 1 ? "ingredient isn't" : "ingredients aren't"} checked yet. You can start anyway and gather them as you go.
          </p>
        )}
        <button type="button" className="ck-btn ck-btn--primary ck-btn--big" onClick={start}>
          <Play size={18} aria-hidden="true" /> {confirming && missing.length > 0 ? "Start anyway" : "Start cooking"}
        </button>
      </div>
    </section>
  );
}
