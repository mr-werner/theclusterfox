import { DAY_PRESETS, HOWS, MEAL_NAMES, MEALS, SIZES } from "../model/body.js";

const same = (a, b) => MEALS.every(m => a[m].size === b[m].size && a[m].how === b[m].how);

/**
 * How you usually eat: a few common patterns to start from, then each meal's
 * size and how you get it. onChange(day) gets the whole day.
 */
export default function UsualDay({ day, onChange }) {
  const set = (meal, patch) => onChange({ ...day, [meal]: { ...day[meal], ...patch } });

  return (
    <div className="fp-usual">
      <div className="fp-presets" role="group" aria-label="Common patterns">
        {Object.entries(DAY_PRESETS).map(([key, p]) => (
          <button key={key} type="button" className={`ff-chip${same(p.day, day) ? " is-active" : ""}`} aria-pressed={same(p.day, day)} onClick={() => onChange(p.day)}>
            {p.name}
          </button>
        ))}
      </div>
      <ul className="fp-usual-rows">
        {MEALS.map(m => (
          <li key={m} className={day[m].size === "skip" ? "is-skip" : ""}>
            <span className="fp-usual-name">{MEAL_NAMES[m]}</span>
            <div className="fp-choice" role="group" aria-label={`${MEAL_NAMES[m]} size`}>
              {Object.entries(SIZES).map(([key, s]) => (
                <button key={key} type="button" aria-pressed={day[m].size === key} className={day[m].size === key ? "is-active" : ""} onClick={() => set(m, { size: key })}>
                  {s.name}
                </button>
              ))}
            </div>
            {day[m].size !== "skip" && (
              <select value={day[m].how} onChange={e => set(m, { how: e.target.value })} aria-label={`How you get ${MEAL_NAMES[m].toLowerCase()}`} title={HOWS[day[m].how].blurb}>
                {Object.entries(HOWS).map(([key, h]) => (
                  <option key={key} value={key}>{h.name}</option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
