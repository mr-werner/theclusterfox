import { useState } from "react";
import { AlertCircle, Plus, Search, Trash2, TrendingDown } from "lucide-react";
import { ingredients, AISLES } from "../data/ingredients";
import * as P from "../model/pantry";

const OTHER = "Other";

export default function PantryTab({ pantry, today, setPantry, onShowRecipes }) {
  const [name, setName] = useState("");
  const [expires, setExpires] = useState("");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");

  const add = e => {
    e.preventDefault();
    if (!name.trim()) return;
    const item = P.makePantryItem(name, { expires: expires || null, today });
    setPantry(p => P.addToPantry(p, item));
    setNote(item.ing ? "" : `Added "${item.name}". It isn't in our ingredient list, so it's matched to recipes by name.`);
    setName("");
    setExpires("");
  };

  const addStaples = () => setPantry(p => P.STAPLES.reduce((acc, id) => P.addToPantry(acc, { id: `${id}-${Date.now()}`, ing: id, name: null, expires: null, low: false, added: today }), p));
  const update = (id, patch) => setPantry(p => p.map(i => (i.id === id ? { ...i, ...patch } : i)));

  const filtered = pantry.filter(i => !q || P.pantryItemName(i).toLowerCase().includes(q.toLowerCase()));
  const soon = pantry.filter(i => ["soon", "expired"].includes(P.expiryState(i, today)?.state));
  const groups = new Map();
  for (const i of filtered) {
    const aisle = i.ing ? AISLES[ingredients.find(x => x.id === i.ing).aisle] : OTHER;
    if (!groups.has(aisle)) groups.set(aisle, []);
    groups.get(aisle).push(i);
  }
  const order = [...Object.values(AISLES), OTHER];
  const sorted = [...groups].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));

  return (
    <section className="ck-pantry" aria-label="Pantry">
      <p className="ck-muted">
        Optional. Tell CookFox what's in your kitchen and recipes will show what you already have, what's missing, and what to use up first.
      </p>

      <form className="ck-panel ck-pantry-add" onSubmit={add}>
        <label className="ck-field">
          <span>Add an ingredient</span>
          <input type="text" list="ck-ing-names" placeholder="e.g. spinach" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="ck-field">
          <span>Use by (optional)</span>
          <input type="date" value={expires} min={today} onChange={e => setExpires(e.target.value)} />
        </label>
        <button type="submit" className="ck-btn ck-btn--primary" disabled={!name.trim()}>
          <Plus size={16} aria-hidden="true" /> Add
        </button>
        <datalist id="ck-ing-names">
          {ingredients.map(i => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
        {note && <p className="ck-note ck-pantry-note">{note}</p>}
      </form>

      {soon.length > 0 && (
        <div className="ck-callout" role="note">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <p>
              <strong>Use soon:</strong> {soon.map(P.pantryItemName).join(", ")}.{" "}
              <button type="button" className="ck-link" onClick={onShowRecipes}>
                See recipes that use them
              </button>
            </p>
          </div>
        </div>
      )}

      {pantry.length === 0 ? (
        <div className="ck-empty">
          <p>Your pantry is empty.</p>
          <p className="ck-muted">Start with the basics most kitchens have, then add the rest as you go.</p>
          <button type="button" className="ck-btn" onClick={addStaples}>
            <Plus size={16} aria-hidden="true" /> Add common staples
          </button>
        </div>
      ) : (
        <>
          <div className="ck-pantry-tools">
            <div className="ck-search ck-search--small">
              <Search size={16} aria-hidden="true" />
              <label className="sr-only" htmlFor="ck-pq">
                Search your pantry
              </label>
              <input id="ck-pq" type="search" placeholder={`Search ${pantry.length} items`} value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <button type="button" className="ck-btn ck-btn--quiet" onClick={addStaples}>
              <Plus size={16} aria-hidden="true" /> Add staples
            </button>
          </div>
          {sorted.map(([aisle, items]) => (
            <div key={aisle} className="ck-panel ck-pantry-group">
              <h3>{aisle}</h3>
              <ul className="ck-pantry-list">
                {items.map(i => {
                  const exp = P.expiryState(i, today);
                  return (
                    <li key={i.id} className={exp ? `is-${exp.state}` : ""}>
                      <div className="ck-pantry-name">
                        <strong>{P.pantryItemName(i)}</strong>
                        <span className="ck-muted">
                          {[P.expiryText(i, today), i.low ? "Running low" : null, i.ing ? null : "Custom"].filter(Boolean).join(" · ")}
                        </span>
                      </div>
                      <label className="ck-pantry-date">
                        <span className="sr-only">Use-by date for {P.pantryItemName(i)}</span>
                        <input type="date" value={i.expires ?? ""} onChange={e => update(i.id, { expires: e.target.value || null })} />
                      </label>
                      <button type="button" className="ck-toggle" aria-pressed={i.low} onClick={() => update(i.id, { low: !i.low })}>
                        <TrendingDown size={15} aria-hidden="true" /> Low
                      </button>
                      <button type="button" className="ck-icon-btn" aria-label={`Used up: remove ${P.pantryItemName(i)}`} onClick={() => setPantry(p => p.filter(x => x.id !== i.id))}>
                        <Trash2 size={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {filtered.length === 0 && <p className="ck-muted">Nothing in your pantry matches "{q}".</p>}
        </>
      )}
    </section>
  );
}
