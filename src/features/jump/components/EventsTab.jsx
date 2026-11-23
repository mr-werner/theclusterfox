import { useState } from "react";
import { CalendarPlus, ExternalLink, PartyPopper, Trash2 } from "lucide-react";

import { EVENT_LINKS, EVENTS, MONTHS } from "../data/events";
import { newId } from "../state/jumpStore";
import { fmtDay, localDay } from "./format";

// Boogies and events: the yearly ones with when they usually happen, plus
// the ones you've saved with a date, which show on your PlanFox calendar.
export default function EventsTab({ j, openDz }) {
  const { data, patch } = j;
  const thisMonth = new Date().getMonth() + 1;
  // Upcoming first: this month onward, wrapping into next year.
  const sorted = [...EVENTS].sort((a, b) => order(a.month, thisMonth) - order(b.month, thisMonth));
  const mine = [...data.events].sort((a, b) => (a.day < b.day ? -1 : 1));
  const today = localDay();

  return (
    <div className="jf-stack">
      <section className="jf-card jf-hero">
        <div className="jf-hero-text">
          <p className="jf-kicker">Events</p>
          <h1>Boogies and events</h1>
          <p>The big yearly gatherings: organized loads, coaches, visiting aircraft and a party. Dates move every year, so save one with its real date to put it on your calendar.</p>
        </div>
      </section>

      <section className="jf-card">
        <h2><CalendarPlus size={18} aria-hidden="true" /> On your calendar</h2>
        {mine.length ? (
          <ul className="jf-plain-list">
            {mine.map(e => (
              <li key={e.id} className={e.day < today ? "is-past" : ""}>
                <strong>{fmtDay(e.day)}</strong> {e.name} <span className="jf-muted">{e.where}</span>
                <button type="button" className="jf-icon-btn" aria-label={`Remove ${e.name}`} onClick={() => patch(d => ({ events: d.events.filter(x => x.id !== e.id) }))}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="jf-muted">Nothing saved yet. Pick a date on any event below, or add your own.</p>
        )}
        <AddEvent onAdd={e => patch(d => ({ events: [...d.events, e] }))} />
      </section>

      <div className="jf-grid">
        {sorted.map(e => (
          <article key={e.id} className="jf-card jf-event">
            <p className="jf-event-when">
              <PartyPopper size={14} aria-hidden="true" /> {e.month ? `${MONTHS[e.month - 1]} · ` : ""}
              {e.when}
            </p>
            <h2>{e.name}</h2>
            <p className="jf-muted">{e.where}</p>
            <p>{e.text}</p>
            <div className="jf-row">
              <a className="jf-btn is-small is-ghost" href={e.url} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden="true" /> Dates and sign-up
              </a>
              {e.dzId && (
                <button type="button" className="jf-link" onClick={() => openDz(e.dzId)}>
                  Winds there
                </button>
              )}
            </div>
            <SaveDate onSave={day => patch(d => ({ events: [...d.events, { id: newId("e"), day, name: e.name, where: e.where, url: e.url }] }))} />
          </article>
        ))}
      </div>

      <section className="jf-card">
        <h2>Finding more</h2>
        <ul className="jf-plain-list">
          {EVENT_LINKS.map(l => (
            <li key={l.name}>
              {l.url ? <a href={l.url} target="_blank" rel="noreferrer">{l.name}</a> : <strong>{l.name}</strong>} <span className="jf-muted">{l.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

const order = (month, now) => (month == null ? 99 : (month - now + 12) % 12);

function SaveDate({ onSave }) {
  const [day, setDay] = useState("");
  const [saved, setSaved] = useState(false);
  if (saved) return <p className="jf-muted jf-small">Saved to your calendar.</p>;
  return (
    <form
      className="jf-inline-form"
      onSubmit={e => {
        e.preventDefault();
        if (!day) return;
        onSave(day);
        setSaved(true);
      }}
    >
      <input type="date" value={day} onChange={e => setDay(e.target.value)} aria-label="Date you're going" />
      <button type="submit" className="jf-btn is-small" disabled={!day}>I'm going</button>
    </form>
  );
}

function AddEvent({ onAdd }) {
  const [v, setV] = useState({ name: "", where: "", day: "" });
  return (
    <form
      className="jf-add-event"
      onSubmit={e => {
        e.preventDefault();
        if (!v.name.trim() || !v.day) return;
        onAdd({ id: newId("e"), day: v.day, name: v.name.trim().slice(0, 100), where: v.where.trim().slice(0, 100), url: "" });
        setV({ name: "", where: "", day: "" });
      }}
    >
      <input value={v.name} onChange={e => setV({ ...v, name: e.target.value })} placeholder="Event name" aria-label="Event name" />
      <input value={v.where} onChange={e => setV({ ...v, where: e.target.value })} placeholder="Where" aria-label="Where" />
      <input type="date" value={v.day} onChange={e => setV({ ...v, day: e.target.value })} aria-label="Date" />
      <button type="submit" className="jf-btn is-small" disabled={!v.name.trim() || !v.day}>Add</button>
    </form>
  );
}
