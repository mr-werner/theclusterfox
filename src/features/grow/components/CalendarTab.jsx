import { useMemo, useState } from "react";
import { PLANTS, TYPES, plantsById } from "../data/plants";
import { ACTIONS, yearStrip, windowsBetween } from "../model/calendar";
import { seasonFor } from "../model/climate";
import { MONTH_NAMES, monthOf, shortDate, yearOf } from "../model/dates";
import { PlaceSetup } from "./SettingsSheet";
import { PlantArt } from "./ui";

const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LEGEND = ["indoors", "sow", "plant", "fall", "harvest"];
const DAY = 86400000;

const yearBounds = year => [Math.round(Date.UTC(year, 0, 1) / DAY), Math.round(Date.UTC(year, 11, 31) / DAY)];

export function YearStrip({ plant, climate, year, today, label = false }) {
  const bars = yearStrip(plant, climate, year);
  const [from, to] = yearBounds(year);
  const frac = d => (d - from) / (to - from + 1);
  const todayFrac = today >= from && today <= to ? frac(today) : null;
  const season = seasonFor(climate, year);
  return (
    <div className="gf-strip-year" aria-label={`${plant.name} planting calendar for ${year}`}>
      {label && <div className="gf-strip-months" aria-hidden="true">{MONTH_NAMES.map(m => <span key={m}>{m[0]}</span>)}</div>}
      <div className="gf-strip-track">
        {MONTH_NAMES.map((m, i) => (
          <span key={m} className="gf-strip-month" style={{ left: `${(i / 12) * 100}%` }} />
        ))}
        {!climate.frostless && (
          <>
            <span className="gf-frost-mark" style={{ left: `${frac(season.lf) * 100}%` }} title={`Last frost ≈ ${shortDate(season.lf)}`} />
            {season.ff <= to && <span className="gf-frost-mark" style={{ left: `${frac(season.ff) * 100}%` }} title={`First frost ≈ ${shortDate(season.ff)}`} />}
          </>
        )}
        {bars.map(b => (
          <span
            key={`${b.action}${b.start}`}
            className={`gf-bar gf-bar--${b.action}`}
            style={{ left: `${b.startFrac * 100}%`, width: `${Math.max(1.2, (b.endFrac - b.startFrac) * 100)}%` }}
            title={`${ACTIONS[b.action].name}: ${shortDate(b.start)} – ${shortDate(b.end)}`}
          />
        ))}
        {todayFrac != null && <span className="gf-today-mark" style={{ left: `${todayFrac * 100}%` }} />}
      </div>
    </div>
  );
}

export default function CalendarTab({ g }) {
  const { climate, data, todayNum } = g;
  const mine = useMemo(() => [...new Set(data.garden.map(e => e.plantId))].map(id => plantsById.get(id)), [data.garden]);
  const [show, setShow] = useState(mine.length ? "mine" : "vegetable");
  const [yearOffset, setYearOffset] = useState(0);
  const year = yearOf(todayNum) + yearOffset;

  const plants = useMemo(() => {
    const base = show === "mine" ? mine : PLANTS.filter(p => p.type === show);
    if (!climate) return base;
    return base
      .map(p => ({ p, r: g.ratingFor(p) }))
      .filter(x => show === "mine" || x.r.score < 6)
      .sort((a, b) => firstStart(a.p, climate, year) - firstStart(b.p, climate, year))
      .map(x => x.p);
  }, [show, mine, climate, year, g]);

  if (!climate) {
    return (
      <div className="gf-calendar">
        <h1>Planting calendar</h1>
        <p className="gf-hint">Set your place to get planting dates built from your own frost dates.</p>
        <PlaceSetup g={g} />
      </div>
    );
  }

  const thisMonth = monthOf(todayNum);
  const monthTodo = monthList(climate, todayNum, g);

  return (
    <div className="gf-calendar">
      <div className="gf-plants-head">
        <h1>Planting calendar</h1>
        <div className="gf-seg gf-seg--small" role="group" aria-label="Year">
          {[0, 1].map(o => (
            <button key={o} type="button" className={yearOffset === o ? "on" : ""} onClick={() => setYearOffset(o)}>
              {yearOf(todayNum) + o}
            </button>
          ))}
        </div>
      </div>

      <section className="gf-card">
        <h2>{FULL_MONTHS[thisMonth]}: what to plant</h2>
        {monthTodo.length ? (
          <ul className="gf-month-todo">
            {LEGEND.filter(a => a !== "harvest").map(a => {
              const items = monthTodo.filter(x => x.action === a);
              if (!items.length) return null;
              return (
                <li key={a}>
                  <span className={`gf-dot gf-dot--${a}`} aria-hidden="true" />
                  <strong>{ACTIONS[a].name}</strong>
                  <span>
                    {items.slice(0, 14).map((x, i) => (
                      <span key={x.p.id}>
                        {i > 0 && ", "}
                        <button type="button" className="gf-link" onClick={() => g.openPlant(x.p.id)}>
                          {x.p.name}
                        </button>
                      </span>
                    ))}
                    {items.length > 14 && ` and ${items.length - 14} more`}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="gf-hint">A quiet month for planting. Plan next season and keep up with care.</p>
        )}
      </section>

      <div className="gf-chips" role="group" aria-label="Show">
        {mine.length > 0 && (
          <button type="button" className={show === "mine" ? "on" : ""} onClick={() => setShow("mine")}>
            My garden
          </button>
        )}
        {TYPES.map(t => (
          <button key={t.id} type="button" className={show === t.id ? "on" : ""} onClick={() => setShow(t.id)}>
            {t.name}
          </button>
        ))}
      </div>

      <div className="gf-legend" aria-label="Legend">
        {LEGEND.map(a => (
          <span key={a}>
            <i className={`gf-bar gf-bar--${a}`} aria-hidden="true" /> {ACTIONS[a].name}
          </span>
        ))}
        {!climate.frostless && (
          <span>
            <i className="gf-frost-key" aria-hidden="true" /> Average frost dates
          </span>
        )}
      </div>

      <div className="gf-chart">
        <div className="gf-chart-row gf-chart-head">
          <span />
          <div className="gf-strip-months" aria-hidden="true">
            {MONTH_NAMES.map(m => (
              <span key={m} data-short={m[0]}>
                <b>{m}</b>
              </span>
            ))}
          </div>
        </div>
        {plants.map(p => (
          <div key={p.id} className="gf-chart-row">
            <button type="button" className="gf-chart-name" onClick={() => g.openPlant(p.id)}>
              <PlantArt plant={p} size={26} />
              <span>{p.name}</span>
            </button>
            <YearStrip plant={p} climate={climate} year={year} today={todayNum} />
          </div>
        ))}
      </div>
    </div>
  );
}

function firstStart(plant, climate, year) {
  const [from, to] = yearBounds(year);
  const w = windowsBetween(plant, climate, from, to).filter(x => x.action !== "harvest");
  return w.length ? Math.max(from, w[0].start) : Infinity;
}

// Everything that suits the area with a planting window open this month.
function monthList(climate, today, g) {
  const m = monthOf(today);
  const y = yearOf(today);
  const from = Math.round(Date.UTC(y, m, 1) / DAY);
  const to = Math.round(Date.UTC(y, m + 1, 0) / DAY);
  const out = [];
  for (const p of PLANTS) {
    if (g.ratingFor(p).score > 3) continue;
    for (const w of windowsBetween(p, climate, from, to)) {
      if (w.action === "harvest") continue;
      if (!out.some(x => x.p.id === p.id && x.action === w.action)) out.push({ p, action: w.action });
    }
  }
  return out;
}
