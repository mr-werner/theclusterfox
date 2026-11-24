import { useState } from "react";
import { BadgeDollarSign, LoaderCircle, Star, Store, Ticket, Trophy } from "lucide-react";
import { lookupUrl, parsePrice } from "../../cook/model/stores";
import { couponTotal, versusPreferred } from "../model/compare";
import { Empty } from "./ui";
import { money } from "../../cook/model/stores";

export default function PricesTab({ data, change, result, items, live, features, waitingFor, go }) {
  const { stores, typed, chosen, preferred } = data;

  if (!items.length)
    return (
      <section className="gx-panel">
        <Empty icon={BadgeDollarSign} title="Nothing to price yet">
          <p className="gx-muted">Add items to your list and GroceryFox will compare them here.</p>
          <button type="button" className="gx-btn gx-btn--primary" onClick={() => go("list")}>Go to the list</button>
        </Empty>
      </section>
    );
  if (!stores.length)
    return (
      <section className="gx-panel">
        <Empty icon={Store} title="Pick your stores first">
          <p className="gx-muted">Choose up to four stores near you to see what your list costs at each.</p>
          <button type="button" className="gx-btn gx-btn--primary" onClick={() => go("stores")}>Find stores</button>
        </Empty>
      </section>
    );

  const setTyped = (storeId, key, value) =>
    change(d => {
      const forStore = { ...(d.typed[storeId] ?? {}) };
      if (value === null) delete forStore[key];
      else forStore[key] = value;
      return { typed: { ...d.typed, [storeId]: forStore } };
    });
  const setChosen = (storeId, key, id) => change(d => ({ chosen: { ...d.chosen, [storeId]: { ...(d.chosen[storeId] ?? {}), [key]: id } } }));
  const nameOf = id => stores.find(s => s.id === id)?.name ?? "";

  return (
    <section className="gx-panel" aria-labelledby="gx-prices-title">
      <div className="gx-head">
        <h2 id="gx-prices-title">What your list costs</h2>
      </div>
      <Verdict result={result} stores={stores} preferred={preferred} nameOf={nameOf} items={items} />

      <div className="gx-table-scroll">
        <table className="gx-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              {stores.map(s => (
                <th key={s.id} scope="col" className={s.id === preferred ? "is-preferred" : ""}>
                  <span className="gx-th-store">
                    {s.id === preferred && <Star size={13} aria-label="Preferred" />} {s.name}
                  </span>
                  {waitingFor(s) && <LoaderCircle className="gx-spin" size={13} aria-label="Getting prices" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map(r => (
              <tr key={r.item.key}>
                <th scope="row">
                  {r.item.term}
                  {r.item.label !== r.item.term && <span className="gx-muted gx-row-amount">{r.item.label.slice(0, -r.item.term.length).trim()}</span>}
                </th>
                {stores.map((s, si) => (
                  <PriceCell
                    key={`${s.id}-${typed[s.id]?.[r.item.key] ?? ""}`}
                    store={s}
                    item={r.item}
                    cell={r.cells[si]}
                    cheapest={stores.length > 1 && r.cheapest === s.id}
                    products={live[s.id]?.[r.item.term]}
                    chosenId={chosen[s.id]?.[r.item.key]}
                    typedValue={typed[s.id]?.[r.item.key]}
                    onType={v => setTyped(s.id, r.item.key, v)}
                    onChoose={id => setChosen(s.id, r.item.key, id)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {result.totals.map((t, si) => {
                const coupons = couponTotal(result, si);
                return (
                  <td key={t.storeId}>
                    <strong>{t.priced ? money(t.total) : "—"}</strong>
                    {coupons > 0 && <span className="gx-coupon-note">coupons −{money(coupons)}</span>}
                    {t.missing > 0 && <span className="gx-muted gx-small">{t.missing} not priced</span>}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="gx-muted gx-small gx-help">
        Type the price of one as you see it on the shelf or the store's site; “Look up” opens that item at the store.{" "}
        {features.livePrices ? "Kroger-family stores fill in today's shelf and sale prices on their own. " : ""}
        Coupons you add on the Coupons tab come off automatically.
      </p>
      <button type="button" className="gx-btn" onClick={() => go("coupons")}>
        <Ticket size={16} aria-hidden="true" /> Find coupons for these stores
      </button>
    </section>
  );
}

function Verdict({ result, stores, preferred, nameOf, items }) {
  if (stores.length < 2) return <p className="gx-verdict">Add another store to see which is cheaper.</p>;
  if (!result.best) return <p className="gx-verdict">Add prices for the same items at each store to see which is cheaper.</p>;
  const vs = versusPreferred(result, stores, preferred);
  const everything = result.common === items.length;
  const split = result.split;
  return (
    <div className="gx-verdict">
      {preferred && (
        <p className={vs ? "is-warn" : "is-good"}>
          {vs ? (
            <>
              <strong>{nameOf(vs.storeId)}</strong> would save you <strong>{money(vs.savings)}</strong> over {nameOf(preferred)} on the {vs.items} item{vs.items === 1 ? "" : "s"} priced at both.
            </>
          ) : (
            <>
              <Star size={15} aria-hidden="true" /> Your preferred store, <strong>{nameOf(preferred)}</strong>, is the best deal for what's priced.
            </>
          )}
        </p>
      )}
      <p>
        <Trophy size={15} aria-hidden="true" /> <strong>{nameOf(result.best.storeId)}</strong> is cheapest{everything ? "" : ` for the ${result.common} item${result.common === 1 ? "" : "s"} priced everywhere`}: {money(result.best.total)}
        {result.best.savings > 0 ? `, ${money(result.best.savings)} less than the priciest.` : "."}
      </p>
      {split && split.stops.length > 1 && split.savings > 0.5 && (
        <p>
          Splitting the trip saves {money(split.savings)} more: {split.stops.map(s => `${s.count} at ${nameOf(s.storeId)}`).join(", ")}. The cheapest price in each row is highlighted.
        </p>
      )}
    </div>
  );
}

function PriceCell({ store, item, cell, cheapest, products, chosenId, typedValue, onType, onChoose }) {
  const [draft, setDraft] = useState(typedValue === undefined ? "" : typedValue.toFixed(2));
  const [bad, setBad] = useState(false);
  const commit = () => {
    const v = parsePrice(draft);
    setBad(v === undefined);
    if (v !== undefined && v !== (typedValue ?? null)) onType(v);
  };
  const per = item.unit === "each" ? "each" : `per ${item.unit}`;
  return (
    <td className={cheapest ? "is-cheapest" : ""}>
      {cell ? (
        <span className="gx-cell-cost">
          <strong>{money(cell.cost)}</strong>
          {item.count !== 1 && <span className="gx-muted"> ({money(cell.price)} {per})</span>}
          {cell.sale && <span className="gx-tag gx-tag--sale">Sale</span>}
          {cell.coupon && <span className="gx-tag gx-tag--coupon" title={cell.coupon.note || cell.coupon.item}>−{money(cell.couponSaves)} coupon</span>}
        </span>
      ) : (
        <span className="gx-muted gx-cell-cost">—</span>
      )}
      {products?.length > 0 && typedValue === undefined && (
        <select className="gx-cell-product" aria-label={`Product at ${store.name} for ${item.term}`} value={chosenId ?? products[0].id} onChange={e => onChoose(e.target.value)}>
          {products.map(p => (
            <option key={p.id} value={p.id}>
              {money(p.price)} · {p.name}
              {p.size ? ` (${p.size})` : ""}
            </option>
          ))}
        </select>
      )}
      <span className="gx-cell-entry">
        <input
          type="text"
          inputMode="decimal"
          className={bad ? "is-bad" : ""}
          placeholder={products?.length ? "Yours" : `$ ${per}`}
          aria-label={`Price ${per} at ${store.name}: ${item.term}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()}
        />
        <a href={lookupUrl(store, item.term)} target="_blank" rel="noopener noreferrer">
          Look up
        </a>
      </span>
    </td>
  );
}
