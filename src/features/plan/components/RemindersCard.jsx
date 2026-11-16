import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";

import { REMINDER_ICONS } from "../../clocast/components/reminderIcons";

/** The day's reminders from SkyFox: sunscreen, umbrella, air and so on. */
export default function RemindersCard({ reminders, label = "BEFORE YOU HEAD OUT", empty = null }) {
  if (!reminders.length && !empty) return null;
  return (
    <div className="pf-card pf-reminders">
      <BellRing size={20} aria-hidden="true" />
      <div>
        <p className="pf-eyebrow">{label}</p>
        {reminders.length ? (
          <ul className="pf-reminder-list">
            {reminders.map(r => {
              const Icon = REMINDER_ICONS[r.id];
              return (
                <li key={r.id} className={`pf-reminder is-${r.tone}`}>
                  {Icon && <Icon size={15} aria-hidden="true" />}
                  <div>
                    <p className="pf-reminder-title">{r.title}</p>
                    <p className="pf-reminder-text">{r.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="pf-muted">{empty}</p>
        )}
        <Link className="pf-reminder-edit" to="/clocast#reminders">
          Choose reminders in SkyFox
        </Link>
      </div>
    </div>
  );
}
