import { useMemo, useState } from "react";
import { CalendarClock, Check, ExternalLink, Newspaper, Plus, Tag, Ticket, Trash2, Undo2 } from "lucide-react";
import { chainFor, parsePrice } from "../../cook/model/stores";
import { EVERYWHERE, savingsFor } from "../data/savings";
import { couponFitsItem, couponFitsStore, couponLive } from "../model/compare";
import { newId } from "../model/list";
import { money } from "../../cook/model/stores";

export default function CouponsTab({ data, change, today, items, live }) {
  const { stores, coupons } = data;
  const [adding, setAdding] = useState(false);
  const active = coupons.filter(c => couponLive(c, today));
  const old = coupons.filter(c => !couponLive(c, today));

  // Items on the list that are on sale today at a Kroger-family store.
  const sales = useMemo(() => {
    const out = [];
    for (const s of stores) {
      for (const item of items) {
        const p = live[s.id]?.[item.term]?.find(x => x.sale);
        if (p) out.push({ store: s, item, product: p });
      }
    }
    return out;
  }, [stores, items, live]);

  const storeLabel = c => (c.store === "any" ? "Any store" : c.storeName || "One store");
  const fitsList = c => items.some(i => couponFitsItem(c, i)) && (c.store === "any" || stores.some(s => couponFitsStore(c, s)));
  const set = (id, patch) => change(d => ({ coupons: d.coupons.map(c => (c.id === id ? { ...c, ...patch } : c)) }));
  const remove = id => change(d => ({ coupons: d.coupons.filter(c => c.id !== id) }));

  return (
    <section className="gx-panel" aria-labelledby="gx-coupons-title">
      <div className="gx-head">
        <h2 id="gx-coupons-title">Coupons &amp; deals</h2>
      </div>

      {stores.length > 0 && (
        <div className="gx-subhead">
          <h3>At your stores</h3>
        </div>
      )}
      {stores.length > 0 && (
        <ul className="gx-deal-stores">
          {stores.map(s => {
            const sv = savingsFor(s);
            return (
              <li key={s.id}>
                <strong>{s.name}</strong>
                {sv.card && <span className="gx-muted gx-small">Clip to your {sv.card}, then add the ones you'll use below.</span>}
                {sv.note && <span className="gx-muted gx-small">{sv.note}</span>}
                <span className="gx-deal-links">
                  {sv.coupons && (
                    <a className="gx-btn gx-btn--small" href={sv.coupons} target="_blank" rel="noopener noreferrer">
                      <Ticket size={15} aria-hidden="true" /> {sv.known ? "Digital coupons" : "Find coupons"}
                    </a>
                  )}
                  {sv.weeklyAd && (
                    <a className="gx-btn gx-btn--small" href={sv.weeklyAd} target="_blank" rel="noopener noreferrer">
                      <Newspaper size={15} aria-hidden="true" /> Weekly ad
                    </a>
                  )}
                  {sv.deals && (
                    <a className="gx-btn gx-btn--small" href={sv.deals} target="_blank" rel="noopener noreferrer">
                      <Tag size={15} aria-hidden="true" /> Deals
                    </a>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {sales.length > 0 && (
        <>
          <div className="gx-subhead">
            <h3>On sale now from your list</h3>
          </div>
          <ul className="gx-sales">
            {sales.map(({ store, item, product }) => (
              <li key={`${store.id}|${item.key}`}>
                <span>
                  <strong>{item.term}</strong> at {store.name}
                  <span className="gx-muted gx-small">{product.name}{product.size ? ` (${product.size})` : ""}</span>
                </span>
                <span className="gx-sale-price">
                  <strong>{money(product.price)}</strong> <s className="gx-muted">{money(product.regular)}</s>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="gx-subhead">
        <h3>Your coupons</h3>
        <button type="button" className="gx-btn gx-btn--primary gx-btn--small" onClick={() => setAdding(v => !v)} aria-expanded={adding}>
          <Plus size={15} aria-hidden="true" /> Add a coupon
        </button>
      </div>
      {adding && (
        <CouponForm
          stores={stores}
          today={today}
          onCancel={() => setAdding(false)}
          onSave={c => {
            change(d => ({ coupons: [c, ...d.coupons] }));
            setAdding(false);
          }}
        />
      )}
      {active.length === 0 && !adding && (
        <p className="gx-muted">Add a coupon you clipped or have on paper (“$1 off Cheerios at Kroger”) and the Prices tab takes it off that item.</p>
      )}
      <ul className="gx-coupons">
        {active.map(c => (
          <li key={c.id} className="gx-coupon">
            <span className="gx-coupon-value">{c.kind === "percent" ? `${c.value}%` : money(c.value)}<small>off</small></span>
            <span className="gx-coupon-text">
              <strong>{c.item}</strong>
              <span className="gx-muted gx-small">
                {storeLabel(c)}
                {c.minQty > 1 ? ` · buy ${c.minQty}` : ""}
                {c.expires ? ` · until ${c.expires}` : ""}
                {c.note ? ` · ${c.note}` : ""}
              </span>
              {fitsList(c) && <span className="gx-tag gx-tag--coupon">On your list</span>}
            </span>
            <span className="gx-coupon-actions">
              <button type="button" className="gx-icon-btn" aria-label={`Mark ${c.item} coupon used`} title="Used it" onClick={() => set(c.id, { used: true })}>
                <Check size={16} />
              </button>
              <button type="button" className="gx-icon-btn" aria-label={`Delete ${c.item} coupon`} title="Delete" onClick={() => remove(c.id)}>
                <Trash2 size={16} />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {old.length > 0 && (
        <details className="gx-old">
          <summary>Used or expired ({old.length})</summary>
          <ul className="gx-coupons">
            {old.map(c => (
              <li key={c.id} className="gx-coupon is-old">
                <span className="gx-coupon-value">{c.kind === "percent" ? `${c.value}%` : money(c.value)}<small>off</small></span>
                <span className="gx-coupon-text">
                  <strong>{c.item}</strong>
                  <span className="gx-muted gx-small">{c.used ? "Used" : `Expired ${c.expires}`} · {storeLabel(c)}</span>
                </span>
                <span className="gx-coupon-actions">
                  {c.used && (
                    <button type="button" className="gx-icon-btn" aria-label={`Put back the ${c.item} coupon`} title="Not used" onClick={() => set(c.id, { used: false })}>
                      <Undo2 size={16} />
                    </button>
                  )}
                  <button type="button" className="gx-icon-btn" aria-label={`Delete ${c.item} coupon`} onClick={() => remove(c.id)}>
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="gx-subhead">
        <h3>Works at almost any store</h3>
      </div>
      <ul className="gx-everywhere">
        {EVERYWHERE.map(e => (
          <li key={e.name}>
            <a href={e.url} target="_blank" rel="noopener noreferrer">
              {e.name} <ExternalLink size={13} aria-hidden="true" />
            </a>
            <span className="gx-muted gx-small">{e.what}</span>
          </li>
        ))}
      </ul>
      <p className="gx-muted gx-small gx-help">
        <CalendarClock size={14} aria-hidden="true" /> Stores don't share their coupons with other apps, so GroceryFox opens their pages for you to clip, and counts the ones you add here.
      </p>
    </section>
  );
}

function CouponForm({ stores, today, onSave, onCancel }) {
  const chains = [...new Map(stores.map(s => chainFor(s)).filter(Boolean).map(c => [c.key, c])).values()];
  const [form, setForm] = useState({ item: "", store: stores[0]?.id ?? "any", kind: "off", value: "", minQty: "1", expires: "", note: "" });
  const [error, setError] = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = e => {
    e.preventDefault();
    const value = form.kind === "percent" ? Number(form.value) : parsePrice(form.value);
    if (!form.item.trim()) return setError("What is the coupon for?");
    if (!Number.isFinite(value) || value <= 0 || (form.kind === "percent" && value > 100)) return setError(form.kind === "percent" ? "Type a percent from 1 to 100." : "Type how much it takes off, like 1.00.");
    const store = stores.find(s => s.id === form.store);
    const chain = form.store.startsWith("chain:") ? chains.find(c => `chain:${c.key}` === form.store) : null;
    onSave({
      id: newId(),
      item: form.item.trim().slice(0, 60),
      store: form.store,
      storeName: store?.name ?? (chain ? `Any ${chain.name}` : ""),
      kind: form.kind,
      value,
      minQty: Math.max(1, Math.min(20, Math.round(Number(form.minQty) || 1))),
      expires: form.expires || null,
      note: form.note.trim().slice(0, 120),
      used: false,
    });
  };
  return (
    <form className="gx-trip" onSubmit={save}>
      <div className="gx-trip-grid">
        <label className="gx-field gx-field--wide">
          <span>For</span>
          <input type="text" placeholder="Item, like “Cheerios” or “eggs”" value={form.item} onChange={set("item")} maxLength={60} autoFocus />
        </label>
        <label className="gx-field">
          <span>At</span>
          <select value={form.store} onChange={set("store")}>
            {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            {chains.map(c => <option key={c.key} value={`chain:${c.key}`}>Any {c.name}</option>)}
            <option value="any">Any store (manufacturer coupon)</option>
          </select>
        </label>
        <label className="gx-field gx-field--small">
          <span>Type</span>
          <select value={form.kind} onChange={set("kind")}>
            <option value="off">$ off</option>
            <option value="percent">% off</option>
          </select>
        </label>
        <label className="gx-field gx-field--small">
          <span>{form.kind === "percent" ? "Percent" : "Amount"}</span>
          <input type="text" inputMode="decimal" placeholder={form.kind === "percent" ? "20" : "1.00"} value={form.value} onChange={set("value")} />
        </label>
        <label className="gx-field gx-field--small">
          <span>When you buy</span>
          <input type="number" min="1" max="20" value={form.minQty} onChange={set("minQty")} />
        </label>
        <label className="gx-field">
          <span>Expires</span>
          <input type="date" min={today} value={form.expires} onChange={set("expires")} />
        </label>
        <label className="gx-field gx-field--wide">
          <span>Note</span>
          <input type="text" placeholder="Optional, like “digital, on my card”" value={form.note} onChange={set("note")} maxLength={120} />
        </label>
      </div>
      {error && <p className="gx-error">{error}</p>}
      <div className="gx-edit-actions">
        <button type="submit" className="gx-btn gx-btn--primary">Save coupon</button>
        <button type="button" className="gx-btn gx-btn--quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
