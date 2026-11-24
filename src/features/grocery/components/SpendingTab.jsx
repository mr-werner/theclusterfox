import { useState } from "react";
import { PiggyBank, Plus, Receipt, Trash2 } from "lucide-react";
import { parsePrice } from "../../cook/model/stores";
import { monthName, shortMonth, spendingSummary } from "../model/spending";
import TripForm from "./TripForm";
import { money } from "../../cook/model/stores";

export default function SpendingTab({ data, change, today, result }) {
  const [adding, setAdding] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState(data.budget ? String(data.budget) : "");
  const s = spendingSummary(data.trips, today, data.budget);
  const top = Math.max(1, ...s.months.map(m => m.total));
  const used = data.budget ? Math.min(100, (s.thisMonth / data.budget) * 100) : 0;
  const savedThisMonth = data.trips.filter(t => t.date.slice(0, 7) === s.month).reduce((a, t) => a + (t.saved ?? 0), 0);

  const saveBudget = () => {
    const v = parsePrice(budgetDraft);
    if (v === undefined) return;
    change(() => ({ budget: v || null }));
  };

  return (
    <section className="gx-panel" aria-labelledby="gx-spend-title">
      <div className="gx-head">
        <h2 id="gx-spend-title">Spending</h2>
        <span className="gx-muted">{monthName(s.month)}</span>
      </div>

      <div className="gx-stats">
        <div className="gx-stat">
          <span className="gx-muted gx-small">Spent this month</span>
          <strong>{money(s.thisMonth)}</strong>
          <span className="gx-muted gx-small">{s.trips} trip{s.trips === 1 ? "" : "s"}{s.perTrip ? ` · ${money(s.perTrip)} each` : ""}</span>
        </div>
        <div className="gx-stat">
          <span className="gx-muted gx-small">{data.budget ? "Left in budget" : "Monthly budget"}</span>
          {data.budget ? <strong className={s.left < 0 ? "is-over" : ""}>{s.left < 0 ? `−${money(-s.left)}` : money(s.left)}</strong> : <strong className="gx-muted">Not set</strong>}
          {data.budget && s.pace && <span className={`gx-small ${s.overPace ? "is-over" : "gx-muted"}`}>On pace for {money(s.pace)}</span>}
        </div>
        <div className="gx-stat">
          <span className="gx-muted gx-small">Saved with coupons</span>
          <strong className="is-good">{money(savedThisMonth)}</strong>
          {s.average !== null && <span className="gx-muted gx-small">Usual month {money(s.average)}</span>}
        </div>
      </div>

      {data.budget && (
        <div className="gx-meter" role="meter" aria-valuemin={0} aria-valuemax={data.budget} aria-valuenow={s.thisMonth} aria-label="Budget used">
          <span style={{ width: `${used}%` }} className={s.left < 0 ? "is-over" : ""} />
        </div>
      )}

      <form
        className="gx-budget"
        onSubmit={e => {
          e.preventDefault();
          saveBudget();
        }}
      >
        <label className="gx-field">
          <span>Monthly grocery budget</span>
          <input type="text" inputMode="decimal" placeholder="$ a month" value={budgetDraft} onChange={e => setBudgetDraft(e.target.value)} onBlur={saveBudget} />
        </label>
      </form>

      <div className="gx-bars" aria-label="Last six months">
        {s.months.map(m => (
          <div key={m.month} className={`gx-bar${m.month === s.month ? " is-now" : ""}`}>
            <span className="gx-bar-value">{m.total ? money(m.total).replace(/\.\d\d$/, "") : ""}</span>
            <span className="gx-bar-track">
              <span className="gx-bar-fill" style={{ height: `${(m.total / top) * 100}%` }} />
            </span>
            <span className="gx-bar-label">{shortMonth(m.month)}</span>
          </div>
        ))}
      </div>

      {s.stores.length > 0 && (
        <>
          <div className="gx-subhead">
            <h3>Where it went this month</h3>
          </div>
          <ul className="gx-where">
            {s.stores.map(st => (
              <li key={st.name}>
                <span>{st.name}</span>
                <span className="gx-muted gx-small">{st.trips} trip{st.trips === 1 ? "" : "s"}</span>
                <strong>{money(st.total)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="gx-subhead">
        <h3>Trips</h3>
        <button type="button" className="gx-btn gx-btn--small" onClick={() => setAdding(v => !v)} aria-expanded={adding}>
          <Plus size={15} aria-hidden="true" /> Log a trip
        </button>
      </div>
      {adding && (
        <TripForm
          data={data}
          result={result}
          today={today}
          onCancel={() => setAdding(false)}
          onSave={trip => {
            change(d => ({ trips: [trip, ...d.trips] }));
            setAdding(false);
          }}
        />
      )}
      {data.trips.length === 0 && !adding ? (
        <p className="gx-muted">
          <PiggyBank size={16} aria-hidden="true" /> When you finish shopping, tap “Done shopping” on your list (or log a trip here) with the receipt total, and GroceryFox keeps track of the month.
        </p>
      ) : (
        <ul className="gx-trips">
          {data.trips.slice(0, 60).map(t => (
            <li key={t.id}>
              <Receipt size={16} aria-hidden="true" />
              <span>
                <strong>{t.storeName}</strong>
                <span className="gx-muted gx-small">
                  {t.date}
                  {t.items ? ` · ${t.items} item${t.items === 1 ? "" : "s"}` : ""}
                  {t.saved ? ` · saved ${money(t.saved)}` : ""}
                </span>
              </span>
              <strong>{money(t.total)}</strong>
              <button type="button" className="gx-icon-btn" aria-label={`Delete the ${t.storeName} trip on ${t.date}`} onClick={() => change(d => ({ trips: d.trips.filter(x => x.id !== t.id) }))}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
