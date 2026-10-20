import WeatherIcon from "../../clocast/components/WeatherIcon";
import { dayFlags } from "../model/insights";
import { TIP_ICONS } from "./DayPanel";
import { formatTemp } from "../../clocast/units";
import { formatTime, monthGrid, parseDay, relativeDay } from "../model/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PILLS = 3;

// Minor entries (every game, every movie) are counted rather than listed.
function summarize(entries) {
  const major = entries.filter(e => !e.minor);
  const counts = {};
  for (const e of entries) if (e.minor && e.layer !== "holidays") counts[e.layer] = (counts[e.layer] ?? 0) + 1;
  const minorHolidays = entries.filter(e => e.minor && e.layer === "holidays");
  return { major: [...major, ...minorHolidays], counts };
}

const COUNT_LABEL = { sports: ["game", "games"], movies: ["movie", "movies"], games: ["game release", "game releases"] };

function Pill({ entry }) {
  return (
    <li className={`pf-pill pf-l-${entry.layer}${entry.done ? " is-done" : ""}${entry.closed ? " is-closed" : ""}`}>
      {entry.time && <span className="pf-pill-time">{formatTime(entry.time).replace(" ", "").toLowerCase()}</span>}
      {entry.title}
    </li>
  );
}

export function MonthView({ year, month, today, selected, entriesByDay, forecastByDay, tipsByDay, units, showWeather, onSelect }) {
  const weeks = monthGrid(year, month);
  return (
    <div className="pf-month" role="grid" aria-label="Month">
      <div className="pf-weekdays" role="row">
        {WEEKDAYS.map(d => (
          <span key={d} role="columnheader">
            {d}
          </span>
        ))}
      </div>
      {weeks.map(week => (
        <div key={week[0]} className="pf-week" role="row">
          {week.map(day => {
            const date = parseDay(day);
            const entries = entriesByDay.get(day) ?? [];
            const { major, counts } = summarize(entries);
            const weather = showWeather ? forecastByDay.get(day) : null;
            const flags = dayFlags(tipsByDay.get(day));
            const classes = [
              "pf-cell",
              date.getMonth() !== month && "is-other",
              day === today && "is-today",
              day === selected && "is-selected",
              day < today && "is-past",
              flags && `has-flag is-flag-${flags.tone}`,
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button key={day} type="button" role="gridcell" className={classes} onClick={() => onSelect(day)} aria-label={relativeDay(day, today) + `, ${entries.length} entries` + (flags ? `, heads-up: ${flags.titles.join("; ")}` : "")} aria-pressed={day === selected}>
                <span className="pf-cell-head">
                  <span className="pf-cell-date">{date.getDate()}</span>
                  {weather && (
                    <span className="pf-cell-weather" title={`${formatTemp(weather.high, units)} / ${formatTemp(weather.low, units)}`}>
                      <WeatherIcon code={weather.code} size={15} />
                      <span>
                        {formatTemp(weather.high, units, { unit: false })}
                        <span className="pf-muted">/{formatTemp(weather.low, units, { unit: false })}</span>
                      </span>
                      {weather.precipProb >= 40 && <span className="pf-cell-rain">{weather.precipProb}%</span>}
                    </span>
                  )}
                </span>
                {flags && (
                  <span className={`pf-cell-flags is-${flags.tone}`} title={flags.titles.join("\n")}>
                    {flags.kinds.slice(0, 3).map(kind => {
                      const Icon = TIP_ICONS[kind];
                      return <Icon key={kind} size={12} aria-hidden="true" />;
                    })}
                    <span>{flags.titles.length === 1 ? flags.titles[0] : `${flags.titles.length} heads-ups`}</span>
                  </span>
                )}
                <ul className="pf-pills">
                  {major.slice(0, MAX_PILLS).map(entry => (
                    <Pill key={entry.id} entry={entry} />
                  ))}
                  {major.length > MAX_PILLS && <li className="pf-more">+{major.length - MAX_PILLS} more</li>}
                  {Object.entries(counts).map(([layer, count]) => (
                    <li key={layer} className={`pf-count pf-l-${layer}`}>
                      {count} {COUNT_LABEL[layer]?.[count === 1 ? 0 : 1] ?? layer}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function AgendaView({ days, today, entriesByDay, forecastByDay, tipsByDay, units, showWeather, onSelect }) {
  const withContent = days.filter(day => (entriesByDay.get(day) ?? []).some(e => !e.minor) || tipsByDay.get(day)?.length || day === today);
  return (
    <ol className="pf-agenda">
      {withContent.map(day => {
        const entries = (entriesByDay.get(day) ?? []).filter(e => !e.minor);
        const minor = (entriesByDay.get(day) ?? []).filter(e => e.minor);
        const weather = showWeather ? forecastByDay.get(day) : null;
        const tips = tipsByDay.get(day) ?? [];
        return (
          <li key={day} className={day === today ? "is-today" : undefined}>
            <button type="button" className="pf-agenda-day" onClick={() => onSelect(day)}>
              <span className="pf-agenda-date">
                <strong>{relativeDay(day, today)}</strong>
                <span className="pf-muted">{parseDay(day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </span>
              {weather && (
                <span className="pf-cell-weather">
                  <WeatherIcon code={weather.code} size={16} />
                  {formatTemp(weather.high, units)} / {formatTemp(weather.low, units)}
                </span>
              )}
            </button>
            <ul className="pf-agenda-list">
              {entries.map(entry => (
                <li key={entry.id} className={`pf-agenda-entry pf-l-${entry.layer}${entry.done ? " is-done" : ""}`}>
                  <span className="pf-dot" aria-hidden="true" />
                  <span className="pf-agenda-time">{entry.time ? formatTime(entry.time) : "All day"}</span>
                  <span>{entry.title}</span>
                </li>
              ))}
              {tips.map((tip, i) => (
                <li key={`tip${i}`} className={`pf-agenda-entry pf-tip-line is-${tip.tone}`}>
                  <span className="pf-dot" aria-hidden="true" />
                  <span className="pf-agenda-time">Heads up</span>
                  <span>{tip.title}</span>
                </li>
              ))}
              {minor.length > 0 && <li className="pf-agenda-minor pf-muted">+ {minor.length} games and releases</li>}
              {!entries.length && !tips.length && !minor.length && <li className="pf-muted">Nothing planned.</li>}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

export function YearView({ year, today, entriesByDay, onPickMonth }) {
  return (
    <div className="pf-year">
      {Array.from({ length: 12 }, (_, month) => {
        const weeks = monthGrid(year, month);
        const visible = day => (entriesByDay.get(day) ?? []).filter(e => !e.minor || e.layer === "holidays");
        const count = weeks.flat().filter(day => parseDay(day).getMonth() === month && visible(day).some(e => e.layer !== "holidays")).length;
        return (
          <button key={month} type="button" className="pf-mini" onClick={() => onPickMonth(month)}>
            <strong>{new Date(year, month, 1).toLocaleDateString("en-US", { month: "long" })}</strong>
            <span className="pf-mini-grid">
              {weeks.flat().map(day => {
                const date = parseDay(day);
                if (date.getMonth() !== month) return <span key={day} />;
                const entries = visible(day);
                const holiday = entries.find(e => e.layer === "holidays" && e.closed);
                const mine = entries.find(e => e.layer !== "holidays");
                return (
                  <span
                    key={day}
                    className={[day === today && "is-today", holiday && "has-holiday", mine && `has-mine pf-l-${mine.layer}`].filter(Boolean).join(" ")}
                    title={entries.map(e => e.title).join(", ") || undefined}
                  >
                    {date.getDate()}
                  </span>
                );
              })}
            </span>
            <span className="pf-muted pf-mini-count">{count ? `${count} busy day${count === 1 ? "" : "s"}` : "Nothing planned"}</span>
          </button>
        );
      })}
    </div>
  );
}
