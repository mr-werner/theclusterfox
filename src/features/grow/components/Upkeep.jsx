import { useMemo } from "react";
import { Droplets, Scissors, Sprout, Bug, CalendarCheck2, SunMedium, FlaskConical } from "lucide-react";
import { plantCheck, lawnAdvice } from "../model/upkeep";
import { LIGHT } from "../model/sun";
import { useForecast } from "../state/useForecast";

/** How a plant on the map is doing, and what it needs this week. */
export function PlantCare({ g, plant, entry, hours }) {
  const forecast = useForecast(g.data.place);
  const check = useMemo(
    () => plantCheck({ plant, entry, climate: g.climate, hours, todayNum: g.todayNum, prefs: g.data.prefs, forecast, units: g.data.prefs.units }),
    [plant, entry, g.climate, hours, g.todayNum, g.data.prefs, forecast]
  );
  return (
    <div className="gf-care-panel">
      {check.light && (
        <p className={`gf-care-light${check.light.ok ? "" : " is-bad"}`}>
          <SunMedium size={16} aria-hidden="true" />
          <span>
            <span className={`gf-light gf-light--${check.light.light}`}>{LIGHT[check.light.light].name}</span> {check.light.verdict}
          </span>
        </p>
      )}
      {check.week.length > 0 ? (
        <>
          <h4>
            <CalendarCheck2 size={15} aria-hidden="true" /> This week
          </h4>
          <ul className="gf-care-week">
            {check.week.map(w => (
              <li key={w.kind}>
                <strong>{w.name}</strong>
                <span>{w.days.join(", ")}</span>
                {w.note && <small>{w.note}</small>}
              </li>
            ))}
          </ul>
        </>
      ) : (
        g.climate && <p className="gf-hint">Nothing due this week. Jobs show up on Today and in TaskFox when they come around.</p>
      )}
      {check.cadence.length > 0 && <p className="gf-hint">Usually: {check.cadence.map(c => `${c.name.toLowerCase()} ${c.word.toLowerCase()}`).join(", ")}.</p>}
      {check.watch.length > 0 && (
        <>
          <h4>
            <Bug size={15} aria-hidden="true" /> What to watch for
          </h4>
          <ul className="gf-care-watch">
            {check.watch.map(t => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Watering, mowing, weeds and feeding for a lawn, for this week. */
export function LawnTips({ g, grass, areaSqm = 0, compact = false }) {
  const forecast = useForecast(g.data.place);
  const tips = useMemo(
    () => (g.climate ? lawnAdvice({ grass, climate: g.climate, todayNum: g.todayNum, forecast, areaSqm, units: g.data.prefs.units }) : null),
    [grass, g.climate, g.todayNum, forecast, areaSqm, g.data.prefs.units]
  );
  if (!tips) return <p className="gf-hint">Set your place for lawn tips timed to your weather and frost dates.</p>;
  const rows = [
    { id: "water", name: "Watering", icon: Droplets, text: tips.water },
    { id: "mow", name: "Mowing", icon: Scissors, text: tips.mow },
    { id: "weeds", name: "Weeds", icon: Sprout, text: tips.weeds },
    { id: "feed", name: "Feeding", icon: FlaskConical, text: tips.feed },
  ];
  return (
    <div className={`gf-lawn-tips${compact ? " is-compact" : ""}`}>
      <ul>
        {rows.map(({ id, name, icon: Icon, text }) => (
          <li key={id}>
            <Icon size={16} aria-hidden="true" />
            <div>
              <strong>{name}</strong>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ul>
      {tips.area && <p className="gf-hint">{tips.area}</p>}
    </div>
  );
}
