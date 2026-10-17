import { Clock } from "lucide-react";

import { dayName, DURATIONS, PARTS, partAvailable } from "../when";

export default function WhenPicker({ hours, days, when, onChange }) {
  return (
    <div className="cc-when" aria-label="When you're going out">
      <div className="cc-when-row" role="group" aria-label="Day">
        {days.map((day, index) => (
          <button
            key={day}
            type="button"
            className={`cc-pill ${when.day === index ? "is-active" : ""}`}
            aria-pressed={when.day === index}
            onClick={() => {
              const part = when.part === "now" && index > 0 ? "morning" : when.part;
              onChange({ ...when, day: index, part: partAvailable(hours, days, index, part) ? part : "morning" });
            }}
          >
            {dayName(day, index)}
          </button>
        ))}
      </div>

      <div className="cc-when-row" role="group" aria-label="Time of day">
        <Clock size={16} className="cc-when-icon" aria-hidden="true" />
        {PARTS.map(part => {
          const available = partAvailable(hours, days, when.day, part.id);
          if (part.id === "now" && when.day !== 0) return null;
          return (
            <button
              key={part.id}
              type="button"
              className={`cc-pill ${when.part === part.id ? "is-active" : ""}`}
              aria-pressed={when.part === part.id}
              disabled={!available}
              onClick={() => onChange({ ...when, part: part.id })}
            >
              {part.name}
            </button>
          );
        })}
      </div>

      {when.part === "now" && (
        <div className="cc-when-row" role="group" aria-label="How long">
          <span className="cc-when-label">For</span>
          {DURATIONS.map(value => (
            <button
              key={value}
              type="button"
              className={`cc-pill cc-pill-small ${when.duration === value ? "is-active" : ""}`}
              aria-pressed={when.duration === value}
              onClick={() => onChange({ ...when, duration: value })}
            >
              {value} hr
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
