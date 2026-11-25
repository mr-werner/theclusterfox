import { fmtMoney } from "../model/geo";
import { maxNightly } from "../model/budget";
import { MoneyInput } from "./ui";

/** What the trip costs, line by line, against what you want to spend. */
export default function BudgetTab({ trip, setTrip, budget, context, go }) {
  const over = budget.left != null && budget.left < 0;
  const used = trip.budget ? Math.min(100, Math.round((budget.total / trip.budget) * 100)) : null;
  const travel = budget.lines.find(l => l.id === "travel");
  const fit = maxNightly(trip, context);
  return (
    <div className="tx-stack">
      <section className="tx-card">
        <div className="tx-total">
          <div>
            <p className="tx-label">Estimated total</p>
            <p className="tx-big">{fmtMoney(budget.total)}</p>
            <p className="tx-muted tx-small">
              {fmtMoney(budget.perPerson)} a person · {fmtMoney(budget.perDay)} a day · {budget.days} day{budget.days > 1 ? "s" : ""}, {budget.nights} night{budget.nights === 1 ? "" : "s"}
            </p>
          </div>
          <MoneyInput label="Your budget" value={trip.budget} onChange={value => setTrip({ budget: value || null })} placeholder="No limit" />
        </div>
        {used != null && (
          <>
            <div className={`tx-meter${over ? " is-over" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={used} aria-label="Budget used">
              <span style={{ width: `${used}%` }} />
            </div>
            <p className={over ? "tx-warn" : "tx-good"}>{over ? `${fmtMoney(-budget.left)} over budget.` : `${fmtMoney(budget.left)} to spare.`}</p>
            {over && (
              <ul className="tx-tips">
                {fit != null && fit > 0 && fit < trip.nightly && trip.stayKind !== "free" && (
                  <li>
                    A place under {fmtMoney(fit)} a night would fit.{" "}
                    <button type="button" className="tx-link" onClick={() => go("stay")}>
                      See places to stay
                    </button>
                  </li>
                )}
                {trip.travel === "fly" && <li>Driving is often cheaper for three or more people going under about 500 miles.</li>}
                {budget.nights > 2 && <li>One night fewer saves about {fmtMoney(budget.total / budget.days)}.</li>}
                <li>Picnic lunches and free parks and museum days bring the daily spend down.</li>
              </ul>
            )}
          </>
        )}
      </section>

      <section className="tx-card">
        <h2>Where it goes</h2>
        <ul className="tx-lines">
          {budget.lines.map(l => (
            <li key={l.id}>
              <span>
                <strong>{l.name}</strong>
                <span className="tx-muted tx-small">{l.note}</span>
              </span>
              <span className="tx-line-amount">{fmtMoney(l.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="tx-card">
        <h2>Change the guesses</h2>
        <div className="tx-row">
          <MoneyInput label="Food a day, each adult" value={trip.food} onChange={food => setTrip({ food: food ?? 0 })} hint="About $30 cheap, $45 mixed, $80 eating out" />
          <MoneyInput label="Things to do a day, each" value={trip.fun} onChange={fun => setTrip({ fun: fun ?? 0 })} hint="On top of tickets you add" />
        </div>
        <div className="tx-row">
          <MoneyInput
            label="Getting there and back, everyone"
            value={trip.travelCost}
            onChange={travelCost => setTrip({ travelCost })}
            placeholder={travel.amount != null ? String(travel.basis === "yours" ? "" : travel.amount) : ""}
            hint={trip.travelCost != null ? "Clear it to go back to TripFox's estimate" : "Leave empty to use TripFox's estimate"}
          />
          <button type="button" className="tx-btn is-quiet" onClick={() => go("stay")}>
            Change the nightly price
          </button>
        </div>
      </section>
    </div>
  );
}
