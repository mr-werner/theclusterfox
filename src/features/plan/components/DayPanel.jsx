import { useState } from "react";
import { Car, CircleAlert, TriangleAlert, CloudRain, Dumbbell, Flower2, MapPin, Plus, Shirt, Star, Sunrise, Sunset, TrafficCone } from "lucide-react";

import WeatherIcon from "../../clocast/components/WeatherIcon";
import { activities } from "../../clocast/data/activities";
import { formatHour, formatTemp, formatWind } from "../../clocast/units";
import { describeWeather } from "../../../services/weather/openMeteo";
import { formatTime, longDate, parseDay, relativeDay } from "../model/dates";
import { GARDEN_MONTHS, trainingAdvice, wearFor } from "../model/insights";

const TIP_ICONS = { alert: TriangleAlert, car: Car, garden: Flower2, traffic: TrafficCone, rain: CloudRain, train: Dumbbell };
const LAYER_LABEL = {
  holidays: "Holiday",
  alerts: "Weather alert",
  events: "Event",
  tasks: "Task",
  bills: "Bill",
  deadlines: "Deadline",
  training: "Training",
  feeds: "Calendar",
  sports: "Game",
  movies: "Movie",
  games: "Game release",
};
const CHECKABLE = new Set(["task", "bill", "deadline"]);
const MINOR_SHOWN = 6;
const placeKey = place => `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
const sunTime = t => (t ? `${t.hour % 12 || 12}:${String(t.minute).padStart(2, "0")} ${t.hour < 12 ? "AM" : "PM"}` : "–");

export function Tip({ tip, showDay, today }) {
  const Icon = TIP_ICONS[tip.kind] ?? CircleAlert;
  return (
    <li className={`pf-tip is-${tip.tone}`}>
      <Icon size={17} aria-hidden="true" />
      <div>
        <p className="pf-tip-title">
          {showDay && <span className="pf-tip-day">{relativeDay(tip.day, today)}</span>}
          {tip.title}
        </p>
        <p className="pf-tip-text">{tip.text}</p>
      </div>
    </li>
  );
}

function WearCard({ wear, label }) {
  if (!wear) return null;
  return (
    <div className="pf-card pf-wear">
      <Shirt size={20} aria-hidden="true" />
      <div>
        <p className="pf-eyebrow">{label}</p>
        <p className="pf-wear-name">{wear.name}</p>
        <p className="pf-muted">{wear.layers.join(", ")}</p>
        {wear.extras.length > 0 && <p className="pf-wear-extras">Bring: {wear.extras.join(" · ")}</p>}
        {wear.warnings.slice(0, 2).map(w => (
          <p key={w} className="pf-wear-warn">
            {w}
          </p>
        ))}
      </div>
    </div>
  );
}

function ItemEntry({ entry, today, now, hours, homePlace, awayForecasts, units, trainingActivityId, onEdit, onToggleDone }) {
  const item = entry.item;
  const away = item.place && placeKey(item.place) !== (homePlace && placeKey(homePlace)) ? awayForecasts.get(placeKey(item.place)) : null;
  const forecastHours = away?.hours ?? hours;
  const where = item.place ?? homePlace;
  const awayDay = away?.days.find(d => d.day === entry.day);
  const wear = (away || item.outdoor) && forecastHours.length ? wearFor(forecastHours, entry.day, where, { time: item.time, durationHours: 3 }) : null;
  const training =
    item.kind === "training" && hours.length
      ? trainingAdvice(forecastHours, entry.day, where, { activityId: item.activityId || trainingActivityId, time: item.time, minutes: item.minutes ?? 60, notBefore: entry.day === today ? now : 0 })
      : null;

  return (
    <li className={`pf-entry pf-l-${entry.layer}${entry.done ? " is-done" : ""}`}>
      {CHECKABLE.has(item.kind) ? (
        <input type="checkbox" checked={entry.done} onChange={() => onToggleDone(item.itemId, entry.day)} aria-label={`Mark ${item.title} done`} />
      ) : (
        <span className="pf-dot" aria-hidden="true" />
      )}
      <button type="button" className="pf-entry-main" onClick={() => onEdit(item)}>
        <span className="pf-entry-title">{item.title}</span>
        <span className="pf-entry-meta">
          {LAYER_LABEL[entry.layer]}
          {item.time && ` · ${formatTime(item.time)}`}
          {item.amount != null && ` · $${item.amount.toFixed(2)}`}
          {item.repeat !== "none" && " · repeats"}
          {item.place && (
            <>
              {" · "}
              <MapPin size={12} aria-hidden="true" /> {item.place.name}
            </>
          )}
        </span>
        {awayDay && (
          <span className="pf-entry-meta">
            <WeatherIcon code={awayDay.code} size={13} /> {describeWeather(awayDay.code)} in {item.place.name}, {formatTemp(awayDay.high, units)} / {formatTemp(awayDay.low, units)}, {awayDay.precipProb}% rain
          </span>
        )}
        {wear && <span className="pf-entry-note">Wear: {wear.name.toLowerCase()}{wear.extras.length ? `. Bring: ${wear.extras.join(", ").toLowerCase()}` : ""}</span>}
        {training && training.chosen && (
          <span className="pf-entry-note">
            {training.chosen.label} for {training.activity.name.toLowerCase()} at {formatTime(item.time)} ({training.chosen.score}/100)
            {training.better && `. ${formatHour(training.better.startHour)} is better (${training.better.score}/100).`}
          </span>
        )}
        {training && !training.chosen && <span className="pf-entry-note">Best time outside: {formatHour(training.best.startHour)} ({training.best.label.toLowerCase()}, {training.best.score}/100)</span>}
        {item.notes && <span className="pf-entry-note pf-muted">{item.notes}</span>}
      </button>
    </li>
  );
}

function SessionEntry({ entry, today, now, hours, place, planWindow, onToggle }) {
  const s = entry.session;
  const [open, setOpen] = useState(false);
  const advice =
    s.outdoor && hours.length && place
      ? trainingAdvice(hours, s.day, place, { activityId: s.activityId, minutes: s.minutes, notBefore: s.day === today ? now : 0, earliest: planWindow.earliest, latest: planWindow.latest })
      : null;
  return (
    <li className={`pf-entry pf-l-training${s.done ? " is-done" : ""}`}>
      <input type="checkbox" checked={s.done} onChange={() => onToggle(s.id)} aria-label={`Mark ${s.title} done`} />
      <div className="pf-entry-main">
        <button type="button" className="pf-entry-main" onClick={() => setOpen(v => !v)} aria-expanded={open}>
          <span className="pf-entry-title">{s.title}</span>
          <span className="pf-entry-meta">
            Training plan · week {s.week}
            {s.deload && " (lighter week)"} · {s.minutes} min{s.outdoor ? " · outside" : " · indoors or gym"}
          </span>
          {advice && (
            <span className="pf-entry-note">
              Best time: {formatHour(advice.best.startHour)} ({advice.best.label.toLowerCase()}, {advice.best.score}/100)
              {advice.reasons.length ? `. Watch for ${advice.reasons.join(", ")}` : ""}
            </span>
          )}
          <span className="pf-entry-note pf-muted">{s.intensity}</span>
        </button>
        {open && (
          <ol className="pf-steps">
            {s.steps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}

function OtherEntry({ entry }) {
  const g = entry.game;
  return (
    <li className={`pf-entry pf-l-${entry.layer}${entry.minor ? " is-minor" : ""}`}>
      {entry.movie?.poster ? <img className="pf-poster" src={entry.movie.poster} alt="" loading="lazy" /> : <span className="pf-dot" aria-hidden="true" />}
      <div className="pf-entry-main">
        <span className="pf-entry-title">
          {g?.favorite && <Star size={13} className="pf-star" aria-label="Your team" />}
          {g ? (
            <>
              {g.away.logo && <img src={g.away.logo} alt="" width="16" height="16" loading="lazy" />} {g.away.short} at {g.home.logo && <img src={g.home.logo} alt="" width="16" height="16" loading="lazy" />} {g.home.short}
            </>
          ) : entry.link ? (
            <a href={entry.link} target="_blank" rel="noreferrer">
              {entry.title}
            </a>
          ) : (
            entry.title
          )}
        </span>
        <span className="pf-entry-meta">
          {LAYER_LABEL[entry.layer]}
          {g && ` · ${g.league.toUpperCase()}`}
          {entry.time && ` · ${formatTime(entry.time)}`}
          {g?.state === "post" && g.home.score != null && ` · Final ${g.away.score}–${g.home.score}`}
          {entry.detail && ` · ${entry.detail}`}
        </span>
      </div>
    </li>
  );
}

export default function DayPanel({ day, today, now, onToggleSession, onOpenPlanner, planWindow, entries, tips, forecast, place, units, layers, awayForecasts, trainingActivityId, onTrainingActivity, onAdd, onEdit, onToggleDone }) {
  const [showAllMinor, setShowAllMinor] = useState(false);
  const hours = forecast?.hours ?? [];
  const weather = forecast?.days.find(d => d.day === day);
  const inForecast = Boolean(weather);
  const wear = layers.wear && inForecast && place ? wearFor(hours, day, place) : null;
  const training = layers.training && inForecast && place ? trainingAdvice(hours, day, place, { activityId: trainingActivityId, notBefore: day === today ? now : 0 }) : null;
  const outdoor = activities.filter(a => a.mets >= 3);

  const plan = entries.filter(e => e.session);
  const mine = entries.filter(e => e.item);
  const others = entries.filter(e => !e.item && !e.session && !e.minor);
  const minor = entries.filter(e => !e.item && !e.session && e.minor);
  const minorShown = showAllMinor ? minor : minor.slice(0, MINOR_SHOWN);

  return (
    <section className="pf-panel pf-day" aria-label={longDate(day)}>
      <header className="pf-day-head">
        <div>
          <p className="pf-eyebrow">{relativeDay(day, today).toUpperCase()}</p>
          <h2>{longDate(day)}</h2>
        </div>
        <button type="button" className="pf-btn pf-btn-primary" onClick={() => onAdd(day)}>
          <Plus size={16} aria-hidden="true" /> Add
        </button>
      </header>

      {layers.weather && weather && (
        <div className="pf-card pf-weather">
          <WeatherIcon code={weather.code} size={34} />
          <div>
            <p className="pf-weather-main">
              {describeWeather(weather.code)}, {formatTemp(weather.high, units)} / {formatTemp(weather.low, units)}
            </p>
            <p className="pf-muted">
              {weather.precipProb}% rain · wind up to {formatWind(weather.wind, units)} · UV {Math.round(weather.uv)}
            </p>
            <p className="pf-muted pf-sun">
              <Sunrise size={13} aria-hidden="true" /> {sunTime(weather.sunrise)} <Sunset size={13} aria-hidden="true" /> {sunTime(weather.sunset)}
            </p>
          </div>
        </div>
      )}
      {layers.weather && !weather && place && day >= today && <p className="pf-note">The forecast covers the next 14 days. Check back closer to the date.</p>}
      {layers.weather && !place && <p className="pf-note">Pick your town above to see weather, what to wear and the best times to be outside.</p>}

      <WearCard wear={wear} label="WHAT TO WEAR, 9 AM TO 7 PM" />

      {training && (
        <div className="pf-card pf-train">
          <Dumbbell size={20} aria-hidden="true" />
          <div>
            <p className="pf-eyebrow">BEST TIME TO TRAIN OUTSIDE</p>
            <p className="pf-wear-name">
              {formatHour(training.best.startHour)} · {training.best.label} ({training.best.score}/100)
            </p>
            {training.reasons.length > 0 && <p className="pf-muted">Watch for: {training.reasons.join(", ")}</p>}
            {!plan.length && onOpenPlanner && (
              <button type="button" className="pf-link-btn" onClick={onOpenPlanner}>
                Get a training plan built for you
              </button>
            )}
            <label className="pf-inline-select">
              <span className="pf-muted">For</span>
              <select value={trainingActivityId} onChange={e => onTrainingActivity(e.target.value)}>
                {outdoor.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <ul className="pf-tips">
          {tips.map((tip, i) => (
            <Tip key={i} tip={tip} today={today} />
          ))}
        </ul>
      )}

      <ul className="pf-entries">
        {plan.map(entry => (
          <SessionEntry key={entry.id} entry={entry} today={today} now={now} hours={hours} place={place} planWindow={planWindow} onToggle={onToggleSession} />
        ))}
        {mine.map(entry => (
          <ItemEntry
            key={entry.id}
            entry={entry}
            today={today}
            now={now}
            hours={hours}
            homePlace={place}
            awayForecasts={awayForecasts}
            units={units}
            trainingActivityId={trainingActivityId}
            onEdit={onEdit}
            onToggleDone={onToggleDone}
          />
        ))}
        {others.map(entry => (
          <OtherEntry key={entry.id} entry={entry} />
        ))}
        {minorShown.map(entry => (
          <OtherEntry key={entry.id} entry={entry} />
        ))}
      </ul>
      {minor.length > MINOR_SHOWN && (
        <button type="button" className="pf-link-btn" onClick={() => setShowAllMinor(v => !v)}>
          {showAllMinor ? "Show fewer" : `Show all ${minor.length}`}
        </button>
      )}
      {!entries.length && <p className="pf-muted">Nothing on this day yet.</p>}

      {layers.garden && (
        <p className="pf-note pf-garden-month">
          <Flower2 size={14} aria-hidden="true" /> {parseDay(day).toLocaleDateString("en-US", { month: "long" })} in the garden: {GARDEN_MONTHS[parseDay(day).getMonth()]}
        </p>
      )}
    </section>
  );
}
