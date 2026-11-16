import { BellRing, ChevronRight } from "lucide-react";

import { REMINDER_ICONS } from "./reminderIcons";

/**
 * The day's reminders folded into one notification. Tapping it opens the
 * full list.
 */
export default function ReminderNotice({ list, dayLabel, onOpen }) {
  if (!list.length) return null;
  const warn = list.some(r => r.tone === "warn") ? "warn" : list.some(r => r.tone === "caution") ? "caution" : "info";
  return (
    <button type="button" className={`cc-notice is-${warn}`} onClick={onOpen} aria-label={`${list.length} reminders for ${dayLabel.replace(/^on /, "")}. Show them`}>
      <span className="cc-notice-bell">
        <BellRing size={18} aria-hidden="true" />
        <span className="cc-notice-count">{list.length}</span>
      </span>
      <span className="cc-notice-body">
        <strong>
          {list.length} reminder{list.length === 1 ? "" : "s"} {dayLabel}
        </strong>
        <span className="cc-notice-items">
          {list.map(r => {
            const Icon = REMINDER_ICONS[r.id];
            return (
              <span key={r.id}>
                {Icon && <Icon size={13} aria-hidden="true" />}
                {r.title}
              </span>
            );
          })}
        </span>
      </span>
      <ChevronRight size={18} className="cc-notice-go" aria-hidden="true" />
    </button>
  );
}
