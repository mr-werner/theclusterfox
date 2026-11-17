import { ExternalLink, ShieldCheck } from "lucide-react";

import { FIRST_RIG, GEAR_TIPS, MAKERS, STORES } from "../data/gear";
import { fmtDay } from "./format";

const addDays = (day, n) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Where to buy gear, what a first rig costs new and used, and a reminder
// for your reserve repack.
export default function GearTab({ j }) {
  const { data, patch } = j;
  const due = data.reserveRepackedOn ? addDays(data.reserveRepackedOn, 180) : null;
  const daysLeft = due ? Math.round((new Date(`${due}T12:00:00`) - new Date()) / 86400000) : null;

  return (
    <div className="jf-stack">
      <section className="jf-card jf-hero">
        <div className="jf-hero-text">
          <p className="jf-kicker">Gear</p>
          <h1>Buying your own rig</h1>
          <p>Where to shop, what each piece costs new and used, and the reserve repack date to keep an eye on.</p>
        </div>
      </section>

      <section className="jf-card">
        <h2><ShieldCheck size={18} aria-hidden="true" /> Reserve repack</h2>
        <p className="jf-muted">US reserves must be repacked by a rigger every 180 days. JumpFox puts the due date on your PlanFox calendar.</p>
        <label className="jf-field is-inline">
          <span>Last packed</span>
          <input type="date" value={data.reserveRepackedOn ?? ""} onChange={e => patch({ reserveRepackedOn: e.target.value || null })} />
        </label>
        {due && (
          <p className={`jf-note${daysLeft < 0 ? " is-warn" : daysLeft < 21 ? " is-amber" : ""}`}>
            {daysLeft < 0 ? `Overdue since ${fmtDay(due)}. Don't jump this rig until it's repacked.` : `Due ${fmtDay(due)}, in ${daysLeft} days.`}
          </p>
        )}
      </section>

      <section className="jf-card">
        <h2>A first rig</h2>
        <div className="jf-table-wrap">
          <table className="jf-table">
            <thead>
              <tr>
                <th>Piece</th>
                <th>Used</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {FIRST_RIG.map(r => (
                <tr key={r.item}>
                  <td>
                    <strong>{r.item}</strong>
                    {r.note && <small>{r.note}</small>}
                  </td>
                  <td>{r.used}</td>
                  <td>{r.fresh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="jf-ticks">{GEAR_TIPS.map(t => <li key={t}>{t}</li>)}</ul>
      </section>

      <section className="jf-card">
        <h2>Stores</h2>
        <ul className="jf-links">
          {STORES.map(s => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.name} <ExternalLink size={13} aria-hidden="true" />
              </a>
              <span className="jf-muted">{s.text}</span>
            </li>
          ))}
        </ul>
        <p className="jf-muted jf-small">Most DZs have a gear shop or a rigger who can order for you, and will often match online prices.</p>
      </section>

      <section className="jf-card">
        <h2>Makers</h2>
        <div className="jf-makers">
          {MAKERS.map(g => (
            <div key={g.group}>
              <h3>{g.group}</h3>
              <ul>
                {g.items.map(m => (
                  <li key={m.name}>
                    <a href={m.url} target="_blank" rel="noreferrer">{m.name}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
