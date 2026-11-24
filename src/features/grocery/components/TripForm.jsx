import { useState } from "react";
import { Receipt } from "lucide-react";
import { parsePrice } from "../../cook/model/stores";
import { newId } from "../model/list";

// Logs a shopping trip: where, when and what the receipt came to.
export default function TripForm({ data, today, items = 0, onSave, onCancel }) {
  const first = data.preferred ?? data.stores[0]?.id ?? "other";
  const [form, setForm] = useState({ store: first, other: "", date: today, total: "", saved: "" });
  const [error, setError] = useState("");
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = e => {
    e.preventDefault();
    const total = parsePrice(form.total);
    const saved = parsePrice(form.saved);
    if (total === null || total === undefined) return setError("Type what the receipt came to.");
    if (saved === undefined) return setError("Coupon savings should be a dollar amount.");
    const store = data.stores.find(s => s.id === form.store);
    const storeName = store?.name ?? (form.other.trim() || "Store");
    onSave({ id: newId(), date: form.date || today, storeId: store?.id ?? null, storeName, total, items, saved: saved ?? 0 });
  };

  return (
    <form className="gx-trip" onSubmit={save}>
      <h3>
        <Receipt size={18} aria-hidden="true" /> Log this trip
      </h3>
      <div className="gx-trip-grid">
        <label className="gx-field">
          <span>Store</span>
          <select value={form.store} onChange={set("store")}>
            {data.stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value="other">Another store</option>
          </select>
        </label>
        {form.store === "other" && (
          <label className="gx-field">
            <span>Store name</span>
            <input type="text" value={form.other} onChange={set("other")} maxLength={80} />
          </label>
        )}
        <label className="gx-field">
          <span>Date</span>
          <input type="date" value={form.date} max={today} onChange={set("date")} />
        </label>
        <label className="gx-field">
          <span>Receipt total</span>
          <input type="text" inputMode="decimal" placeholder="$0.00" value={form.total} onChange={set("total")} autoFocus />
        </label>
        <label className="gx-field">
          <span>Saved with coupons</span>
          <input type="text" inputMode="decimal" placeholder="Optional" value={form.saved} onChange={set("saved")} />
        </label>
      </div>
      {error && <p className="gx-error">{error}</p>}
      <div className="gx-edit-actions">
        <button type="submit" className="gx-btn gx-btn--primary">Save trip{items ? " and clear checked items" : ""}</button>
        <button type="button" className="gx-btn gx-btn--quiet" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
