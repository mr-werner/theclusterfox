import { Link } from "react-router-dom";
import { BellRing, CalendarDays, Check, X } from "lucide-react";

import { REMINDERS } from "../model/reminders";
import { REMINDER_ICONS } from "./reminderIcons";

/**
 * The daily reminders: what they say for the day being looked at, and
 * which ones to send to PlanFox.
 */
export default function RemindersPanel({ list, dayLabel, settings, onChange, onClose }) {
  const toggle = id => {
    const on = settings.on.includes(id) ? settings.on.filter(x => x !== id) : [...settings.on, id];
    onChange({ ...settings, on: REMINDERS.map(r => r.id).filter(x => on.includes(x)) });
  };

  return (
    <section className="cc-panel cc-reminders" id="reminders" aria-labelledby="cc-reminders-title">
      <header className="cc-reminders-head">
        <div>
          <p className="cc-eyebrow">
            <BellRing size={13} aria-hidden="true" /> DAILY REMINDERS
          </p>
          <h2 id="cc-reminders-title">Before you head out {dayLabel}</h2>
          <p className="cc-muted">These show on your PlanFox calendar every day. Pick the ones you want below.</p>
        </div>
        <div className="cc-reminders-actions">
          <Link className="cc-btn" to="/plan?view=today">
            <CalendarDays size={15} aria-hidden="true" /> Open PlanFox
          </Link>
          {onClose && (
            <button type="button" className="cc-icon-btn" onClick={onClose} aria-label="Close reminders">
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {settings.on.length === 0 ? (
        <p className="cc-muted">All reminders are off. Switch some on below.</p>
      ) : list.length === 0 ? (
        <p className="cc-reminders-clear">
          <Check size={16} aria-hidden="true" /> Nothing to remember {dayLabel}: no strong sun, rain, bad air or anything else you asked about.
        </p>
      ) : (
        <ul className="cc-reminder-list">
          {list.map(item => {
            const Icon = REMINDER_ICONS[item.id];
            return (
              <li key={item.id} className={`cc-reminder is-${item.tone}`}>
                <span className="cc-reminder-icon">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <p className="cc-reminder-title">{item.title}</p>
                  <p className="cc-reminder-text">{item.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className="cc-reminder-pick">
        <summary>
          Choose reminders <span className="cc-muted">· {settings.on.length} of {REMINDERS.length} on</span>
        </summary>
        <ul className="cc-reminder-options">
          {REMINDERS.map(r => {
            const Icon = REMINDER_ICONS[r.id];
            const on = settings.on.includes(r.id);
            return (
              <li key={r.id}>
                <button type="button" className="cc-reminder-option" aria-pressed={on} onClick={() => toggle(r.id)}>
                  <Icon size={16} aria-hidden="true" />
                  <span>
                    <strong>{r.name}</strong>
                    <span className="cc-muted">{r.hint}</span>
                  </span>
                  <span className="cc-switch" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        <label className="cc-reminder-sensitive">
          <input type="checkbox" checked={settings.showFirst} onChange={e => onChange({ ...settings, showFirst: e.target.checked })} />
          Show these in full when I open SkyFox, instead of as a notification
        </label>
        {settings.on.includes("air") && (
          <label className="cc-reminder-sensitive">
            <input type="checkbox" checked={settings.airSensitive} onChange={e => onChange({ ...settings, airSensitive: e.target.checked })} />
            I'm sensitive to air pollution (asthma, heart or lung condition): remind me from AQI 51, not 101
          </label>
        )}
      </details>
    </section>
  );
}
