import { useState } from "react";
import { Award, BookOpen, Check, ExternalLink } from "lucide-react";

import { FIRST_STEPS, LICENSE_TIPS, LICENSES, RATINGS, SIM_URL } from "../data/license";
import { fmtFreefall, licenseProgress, totals } from "../model/logbook";

// The USPA path: ways to start, the A to D licenses with what they take and
// let you do, your progress from the logbook, and what an A license costs.
export default function LicenseTab({ j, openLog }) {
  const { data } = j;
  const t = totals(data);
  const progress = licenseProgress(t);
  const next = progress.find(p => !p.met) ?? progress[progress.length - 1];
  const [open, setOpen] = useState(next.id);
  const lic = LICENSES.find(l => l.id === open);
  const prog = progress.find(p => p.id === open);

  return (
    <div className="jf-stack">
      <section className="jf-card jf-hero">
        <div className="jf-hero-text">
          <p className="jf-kicker">USPA licenses</p>
          <h1>From first jump to D license</h1>
          <p>How to start, what each license takes and lets you do, and how far along you are from your logbook.</p>
        </div>
        <div className="jf-hero-tools jf-hero-stats">
          <div><span>Jumps</span><strong>{t.jumps}</strong></div>
          <div><span>Freefall</span><strong>{fmtFreefall(t.freefallSec)}</strong></div>
          <button type="button" className="jf-link" onClick={openLog}><BookOpen size={14} aria-hidden="true" /> Open logbook</button>
        </div>
      </section>

      <section className="jf-card">
        <h2>Ways to start</h2>
        <div className="jf-grid">
          {FIRST_STEPS.map(s => (
            <article key={s.id} className="jf-mini">
              <h3>{s.name}</h3>
              <p className="jf-mini-facts"><span>{s.cost}</span><span>{s.time}</span></p>
              <p>{s.text}</p>
              <p className="jf-muted"><strong>Good for:</strong> {s.good}</p>
            </article>
          ))}
        </div>
      </section>

      <nav className="jf-ladder" aria-label="Licenses">
        {progress.map(p => (
          <button key={p.id} type="button" className={`jf-rung${p.id === open ? " is-on" : ""}${p.met ? " is-met" : ""}`} onClick={() => setOpen(p.id)} aria-pressed={p.id === open}>
            <span className="jf-rung-letter">{p.met ? <Check size={18} aria-label="Done" /> : p.id}</span>
            <strong>{p.name}</strong>
            <span>{p.jumps} jumps</span>
            <span className="jf-bar"><i style={{ width: `${Math.round(Math.min(p.jumpsPct, p.freefallPct) * 100)}%` }} /></span>
          </button>
        ))}
      </nav>

      <section className="jf-card">
        <div className="jf-row-between">
          <h2><Award size={18} aria-hidden="true" /> {lic.name}</h2>
          <a className="jf-link" href={SIM_URL} target="_blank" rel="noreferrer">USPA SIM <ExternalLink size={13} aria-hidden="true" /></a>
        </div>
        <div className="jf-progress-rows">
          <Progress label="Jumps" have={t.jumps} need={lic.jumps} pct={prog.jumpsPct} />
          {lic.freefallMin > 0 && <Progress label="Freefall" have={fmtFreefall(t.freefallSec)} need={fmtFreefall(lic.freefallMin * 60)} pct={prog.freefallPct} />}
        </div>
        <div className="jf-two">
          <div>
            <h3>What it takes</h3>
            <ul className="jf-ticks is-steps">{lic.needs.map(n => <li key={n}>{n}</li>)}</ul>
          </div>
          <div>
            <h3>What it lets you do</h3>
            <ul className="jf-ticks">{lic.lets.map(n => <li key={n}>{n}</li>)}</ul>
          </div>
        </div>
        <p className="jf-muted jf-small">JumpFox counts jumps and freefall time from your logbook. Skills, exams and signatures are checked by your instructor and listed in the SIM, which is the final word.</p>
      </section>

      <CostToA />

      <section className="jf-card">
        <h2>After the licenses</h2>
        <ul className="jf-ratings">
          {RATINGS.map(r => (
            <li key={r.name}>
              <strong>{r.name}</strong>
              <span className="jf-muted">{r.needs}</span>
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="jf-card">
        <h2>Tips from the DZ</h2>
        <ul className="jf-ticks">{LICENSE_TIPS.map(tip => <li key={tip}>{tip}</li>)}</ul>
      </section>
    </div>
  );
}

function Progress({ label, have, need, pct }) {
  return (
    <div className="jf-progress">
      <span>{label}</span>
      <span className="jf-bar is-big"><i style={{ width: `${Math.round(pct * 100)}%` }} /></span>
      <strong>{have} / {need}</strong>
    </div>
  );
}

const money = n => `$${Math.round(n).toLocaleString("en-US")}`;

// A quick, editable estimate of AFF to an A license.
function CostToA() {
  const [v, setV] = useState({ program: 2200, levels: 8, ticket: 35, rental: 35, coach: 5, coachFee: 65, uspa: 80, repeats: 2, perRepeat: 280 });
  const set = k => e => setV(x => ({ ...x, [k]: Math.max(0, Number(e.target.value) || 0) }));
  const solo = Math.max(0, 25 - v.levels - v.coach);
  const total = v.program + v.repeats * v.perRepeat + v.coach * (v.ticket + v.rental + v.coachFee) + solo * (v.ticket + v.rental) + v.uspa;
  const fields = [
    ["program", "AFF package (ground school and levels)", "$"],
    ["levels", "Jumps in the package", "#"],
    ["repeats", "Levels you might repeat", "#"],
    ["perRepeat", "Cost of a repeat level", "$"],
    ["coach", "Coach jumps", "#"],
    ["coachFee", "Coach fee per jump", "$"],
    ["ticket", "Jump ticket", "$"],
    ["rental", "Gear rental per jump", "$"],
    ["uspa", "USPA membership", "$"],
  ];
  return (
    <section className="jf-card">
      <h2>What an A license costs you</h2>
      <p className="jf-muted">Change any number to match your DZ's price list.</p>
      <div className="jf-cost">
        <div className="jf-cost-fields">
          {fields.map(([k, label, unit]) => (
            <label key={k} className="jf-field is-row">
              <span>{label}</span>
              <span className="jf-unit">
                {unit === "$" && <i>$</i>}
                <input type="number" inputMode="numeric" min={0} value={v[k]} onChange={set(k)} />
              </span>
            </label>
          ))}
        </div>
        <div className="jf-cost-total">
          <span>About</span>
          <strong>{money(total)}</strong>
          <span className="jf-muted">for 25 jumps, including {solo} solo jumps at {money(v.ticket + v.rental)} each</span>
        </div>
      </div>
    </section>
  );
}
