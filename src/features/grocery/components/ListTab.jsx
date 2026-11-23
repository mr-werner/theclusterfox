import { useState } from "react";
import { Check, ChefHat, ClipboardCopy, Minus, Pencil, Plus, ShoppingCart, Star, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { SECTIONS, sectionName } from "../data/sections";
import { addItem, amountText, bySection, clearChecked, listText, removeItem, toggleItem, UNITS, updateItem } from "../model/list";
import { addCookItems } from "../model/cookLink";
import { Empty } from "./ui";
import { money } from "../../cook/model/stores";
import { estimateStore } from "../model/compare";
import TripForm from "./TripForm";

export default function ListTab({ data, setList, change, today, result, cookPending, fromCook, go }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(null);
  const [copied, setCopied] = useState(false);
  const [logging, setLogging] = useState(false);
  const list = data.list;
  const groups = bySection(list);
  const checked = list.filter(i => i.checked);
  const open = list.length - checked.length;
  const estimate = estimateStore(data, result);

  const add = e => {
    e.preventDefault();
    if (!text.trim()) return;
    setList(l => addItem(l, text));
    setText("");
  };

  const copy = async () => {
    const body = `Grocery list\n${listText(list)}`;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy your grocery list:", body);
    }
  };

  return (
    <section className="gx-panel" aria-labelledby="gx-list-title">
      <div className="gx-head">
        <h2 id="gx-list-title">Grocery list</h2>
        {open > 0 && <span className="gx-muted">{open} to get</span>}
      </div>

      <form className="gx-add" onSubmit={add}>
        <label className="gx-sr" htmlFor="gx-add-input">Add an item</label>
        <input id="gx-add-input" type="text" autoComplete="off" placeholder="Add an item, like “2 lb chicken” or “eggs x2”" value={text} onChange={e => setText(e.target.value)} maxLength={80} />
        <button type="submit" className="gx-btn gx-btn--primary" disabled={!text.trim()}>
          <Plus size={17} aria-hidden="true" /> Add
        </button>
      </form>

      {cookPending.length > 0 && (
        <div className={`gx-cook${fromCook ? " is-lit" : ""}`}>
          <ChefHat size={20} aria-hidden="true" />
          <p>
            <strong>{cookPending.length} item{cookPending.length === 1 ? "" : "s"} from your CookFox recipes</strong>
            <span className="gx-muted">{cookPending.slice(0, 4).map(c => c.name).join(", ")}{cookPending.length > 4 ? "…" : ""}</span>
          </p>
          <button type="button" className="gx-btn gx-btn--primary" onClick={() => setList(l => addCookItems(l, cookPending))}>
            Add to list
          </button>
        </div>
      )}

      {estimate && open > 0 && (
        <button type="button" className="gx-estimate" onClick={() => go("prices")}>
          <span>
            About <strong>{money(estimate.total)}</strong> at {estimate.store.name}
            {estimate.missing > 0 ? ` for the ${estimate.priced} item${estimate.priced === 1 ? "" : "s"} priced` : ""}
          </span>
          {result.best && result.best.storeId !== estimate.store.id ? <span className="gx-save-tag">Cheaper elsewhere</span> : <span className="gx-muted">See prices</span>}
        </button>
      )}

      {list.length === 0 ? (
        <Empty icon={ShoppingCart} title="Your list is empty">
          <p className="gx-muted">Add what you need above. GroceryFox sorts it by store section, then shows what it costs at the stores near you.</p>
        </Empty>
      ) : (
        <div className="gx-sections">
          {groups.map(([id, items]) => (
            <div key={id} className="gx-section">
              <h3>{sectionName(id)}</h3>
              <ul className="gx-items">
                {items.map(i =>
                  editing === i.id ? (
                    <EditRow key={i.id} item={i} onSave={patch => { setList(l => updateItem(l, i.id, patch)); setEditing(null); }} onCancel={() => setEditing(null)} />
                  ) : (
                    <li key={i.id} className={i.checked ? "is-done" : ""}>
                      <button type="button" className="gx-check" aria-pressed={i.checked} aria-label={`${i.checked ? "Uncheck" : "Check off"} ${i.name}`} onClick={() => setList(l => toggleItem(l, i.id))}>
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button type="button" className="gx-item-text" onClick={() => setEditing(i.id)} aria-label={`Edit ${i.name}`}>
                        <span className="gx-item-name">
                          {amountText(i) && <span className="gx-qty">{amountText(i)}</span>} {i.name}
                        </span>
                        {(i.note || i.from) && (
                          <span className="gx-muted gx-item-note">
                            {i.from === "cookfox" && <span className="gx-from">CookFox</span>} {i.note}
                          </span>
                        )}
                      </button>
                      {!i.checked && (
                        <span className="gx-stepper">
                          <button type="button" aria-label={`One less ${i.name}`} onClick={() => setList(l => (i.qty <= 1 ? removeItem(l, i.id) : updateItem(l, i.id, { qty: Math.max(1, i.qty - 1) })))}>
                            {i.qty <= 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                          </button>
                          <button type="button" aria-label={`One more ${i.name}`} onClick={() => setList(l => updateItem(l, i.id, { qty: Math.min(99, i.qty + 1) }))}>
                            <Plus size={14} />
                          </button>
                        </span>
                      )}
                      {i.checked && (
                        <button type="button" className="gx-icon-btn" aria-label={`Remove ${i.name}`} onClick={() => setList(l => removeItem(l, i.id))}>
                          <X size={15} />
                        </button>
                      )}
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      {list.length > 0 && (
        <div className="gx-actions">
          {checked.length > 0 && (
            <button type="button" className="gx-btn gx-btn--primary" onClick={() => setLogging(v => !v)} aria-expanded={logging}>
              <ShoppingCart size={16} aria-hidden="true" /> Done shopping
            </button>
          )}
          {checked.length > 0 && (
            <button type="button" className="gx-btn" onClick={() => setList(clearChecked)}>
              Clear {checked.length} checked
            </button>
          )}
          <button type="button" className="gx-btn gx-btn--quiet" onClick={copy}>
            <ClipboardCopy size={16} aria-hidden="true" /> {copied ? "Copied" : "Copy list"}
          </button>
        </div>
      )}

      {logging && checked.length > 0 && (
        <TripForm
          data={data}
          result={result}
          today={today}
          items={checked.length}
          onCancel={() => setLogging(false)}
          onSave={trip => {
            change(d => ({ trips: [trip, ...d.trips], list: clearChecked(d.list) }));
            setLogging(false);
          }}
        />
      )}

      {data.stores.length === 0 && list.length > 0 && (
        <p className="gx-hint">
          <Star size={15} aria-hidden="true" /> Next: <button type="button" className="gx-link" onClick={() => go("stores")}>pick your stores</button> to see what this list costs at each.
        </p>
      )}
      {list.some(i => i.from === "cookfox") && (
        <p className="gx-hint gx-muted">
          Items marked CookFox came from your recipes. <Link to="/cook?tab=shopping">Open CookFox's list</Link>
        </p>
      )}
    </section>
  );
}

function EditRow({ item, onSave, onCancel }) {
  const [form, setForm] = useState({ name: item.name, qty: String(item.qty), unit: item.unit, section: item.section, note: item.note });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = e => {
    e.preventDefault();
    const qty = Number(form.qty);
    if (!form.name.trim()) return;
    onSave({ name: form.name.trim().slice(0, 80), qty: Number.isFinite(qty) && qty > 0 ? Math.min(99, qty) : 1, unit: form.unit, section: form.section, note: form.note.slice(0, 140) });
  };
  return (
    <li className="gx-edit">
      <form onSubmit={save}>
        <label className="gx-field gx-field--wide">
          <span>Item</span>
          <input type="text" value={form.name} onChange={set("name")} maxLength={80} autoFocus />
        </label>
        <label className="gx-field gx-field--small">
          <span>How many</span>
          <input type="text" inputMode="decimal" value={form.qty} onChange={set("qty")} />
        </label>
        <label className="gx-field gx-field--small">
          <span>Unit</span>
          <select value={form.unit} onChange={set("unit")}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="gx-field">
          <span>Section</span>
          <select value={form.section} onChange={set("section")}>
            {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="gx-field gx-field--wide">
          <span>Note</span>
          <input type="text" value={form.note} onChange={set("note")} maxLength={140} placeholder="Brand, size, anything" />
        </label>
        <div className="gx-edit-actions">
          <button type="submit" className="gx-btn gx-btn--primary"><Pencil size={15} aria-hidden="true" /> Save</button>
          <button type="button" className="gx-btn gx-btn--quiet" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </li>
  );
}
