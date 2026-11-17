import { Link } from "react-router-dom";
import { ExternalLink, Info, PiggyBank, ShoppingCart, Store } from "lucide-react";

import { AISLES } from "../../cook/data/ingredients.js";
import { cookShopHref } from "../model/planner.js";

const money = n => `$${n.toFixed(2)}`;
const round = n => `$${Math.round(n).toLocaleString()}`;

function amountText(item, amount) {
  if (item.unit === "each") return `${Math.ceil(amount - 0.05)}`;
  if (item.unit === "ml") return amount >= 1000 ? `${(amount / 1000).toFixed(1)} L` : `${Math.round(amount)} ml`;
  const oz = amount / 28.35;
  return oz >= 16 ? `${(oz / 16).toFixed(1)} lb` : `${Math.max(1, Math.round(oz))} oz`;
}

export default function GroceriesTab({ data, week, linked, onReplanCheaper, goTab }) {
  const { shop, cooks, quick } = week;
  const budget = data.profile.budget;
  const over = budget ? week.spend - budget : 0;

  if (!cooks.length && !quick.grab.length && !quick.out.length) {
    return (
      <div className="ff-panel fp-empty">
        <ShoppingCart size={28} aria-hidden="true" />
        <p>
          <strong>Nothing to shop for yet.</strong> Plan this week’s meals and the grocery list builds itself, sized for {data.profile.people}{" "}
          {data.profile.people === 1 ? "person" : "people"}.
        </p>
        <button type="button" className="ff-btn ff-btn-primary" onClick={() => goTab("plan")}>Plan meals</button>
      </div>
    );
  }

  const groups = new Map();
  for (const i of shop.items) groups.set(i.aisle, [...(groups.get(i.aisle) ?? []), i]);

  return (
    <div className="fp-shop">
      <section className="ff-panel fp-shop-sum" aria-label="Grocery cost">
        <div className="fp-shop-total">
          <span>This week’s food, about</span>
          <strong>{money(week.spend)}</strong>
          <small className="fp-split">
            {money(shop.total)} groceries{quick.grabCost > 0 ? ` · ${money(quick.grabCost)} grab & go` : ""}{quick.outCost > 0 ? ` · ${money(quick.outCost)} eating out` : ""}
          </small>
          {budget ? (
            <small className={over > 0 ? "is-over" : "is-ok"}>
              {over > 0 ? `${round(over)} over your ${round(budget)} budget` : `${round(budget - week.spend)} under your ${round(budget)} budget`}
            </small>
          ) : (
            <small>
              <button type="button" className="ff-link" onClick={() => goTab("me")}>Set a weekly budget</button>
            </small>
          )}
          {budget > 0 && (
            <span className={`fp-meter${over > 0 ? " is-over" : ""}`} aria-hidden="true">
              <span style={{ width: `${Math.min(100, (week.spend / budget) * 100)}%` }} />
            </span>
          )}
        </div>
        <ul className="fp-shop-facts">
          <li>
            <PiggyBank size={16} aria-hidden="true" />
            <span>The food you’ll actually eat is about <b>{money(shop.eatCost)}</b>. The rest is what’s left in the packages for next week.</span>
          </li>
          {shop.stapleCount > 0 && (
            <li>
              <Info size={16} aria-hidden="true" />
              <span>Not counted: {shop.stapleCount} staples like spices and oil (about {money(shop.staples)} if you need them all).</span>
            </li>
          )}
          {linked.cook.pantry.length > 0 && (
            <li>
              <Info size={16} aria-hidden="true" />
              <span>Things in your <Link to="/cook?tab=pantry">CookFox pantry</Link> are left off.</span>
            </li>
          )}
        </ul>
        <div className="fp-shop-actions">
          {cooks.length > 0 && <Link className="ff-btn ff-btn-primary" to={cookShopHref(cooks)}>
            <ShoppingCart size={16} /> Put it on my CookFox list
          </Link>}
          <Link className="ff-btn" to="/cook?tab=shopping">
            <Store size={16} /> Compare store prices
          </Link>
          {over > 0 && (
            <button type="button" className="ff-btn" onClick={onReplanCheaper}>
              <PiggyBank size={16} /> Re-plan to fit my budget
            </button>
          )}
        </div>
        <p className="fp-fine">Prices are typical US grocery prices, not a store’s. CookFox can check live prices at stores near you.</p>
      </section>

      {(quick.grab.length > 0 || quick.out.length > 0) && (
        <div className="fp-aisles fp-quicklists">
          {quick.grab.length > 0 && (
            <section className="fp-aisle">
              <h3>Grab & go</h3>
              <ul>
                {quick.grab.map(g => (
                  <li key={g.food.id}>
                    <span className="fp-item-name">{g.food.name}</span>
                    <span className="fp-item-buy">{g.count} × {g.food.amount}</span>
                    <span className="fp-item-cost">{money(g.cost)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {quick.out.length > 0 && (
            <section className="fp-aisle">
              <h3>Eating out</h3>
              <ul>
                {quick.out.map(o => (
                  <li key={`${o.day}-${o.slot}`}>
                    <span className="fp-item-name">{o.food.name}</span>
                    <span className="fp-item-buy">{new Date(`${o.day}T12:00`).toLocaleDateString(undefined, { weekday: "short" })} {o.slot} · {o.food.tip}</span>
                    <span className="fp-item-cost">{money(o.cost)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="fp-aisles">
        {[...groups].map(([aisle, items]) => (
          <section key={aisle} className="fp-aisle">
            <h3>{AISLES[aisle] ?? aisle}</h3>
            <ul>
              {items.map(i => (
                <li key={i.id} className={i.staple ? "is-staple" : ""}>
                  <span className="fp-item-name">
                    {i.item.name}
                    {i.staple && <em>staple</em>}
                  </span>
                  <span className="fp-item-buy">{i.buy?.text ?? amountText(i.item, i.amount)}</span>
                  <span className="fp-item-cost">{money(i.cost)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="fp-hint">
        <ExternalLink size={14} aria-hidden="true" /> Each recipe opens in CookFox at the right number of servings from the Plan tab.
      </p>
    </div>
  );
}
