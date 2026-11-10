import { useEffect, useMemo, useState } from "react";
import { Snowflake, Check, ChevronRight, Sprout, CalendarCheck2, ThermometerSun } from "lucide-react";
import { PLANTS, plantsById } from "../data/plants";
import { dayTasks, isFrostHardy } from "../model/care";
import { isPlantableNow, nextWindows, ACTIONS } from "../model/calendar";
import { seasonsAround, zoneLabel, zoneRangeF, describeClimate } from "../model/climate";
import { addDays, doyLabel, niceDate, shortDate, weekdayShort, yearOf } from "../model/dates";
import { fetchLowForecast } from "../../../services/garden/climateApi";
import { PlaceSetup, ClimateStatus } from "./SettingsSheet";
import { PlantArt, RatingBadge } from "./ui";
import { tempText } from "./format";

export default function TodayTab({ g }) {
  const { data, climate, today } = g;
  if (!climate) return <Welcome g={g} />;
  return (
    <div className="gf-today">
      {g.taskParam && <FocusTask g={g} />}
      <ClimateCard g={g} />
      <FrostWatch g={g} />
      <Week g={g} />
      <PlantNow g={g} />
      {!data.garden.length && (
        <section className="gf-card gf-empty">
          <Sprout size={28} aria-hidden="true" />
          <div>
            <h3>Start your garden</h3>
            <p>Add what you grow (or want to grow) and GrowFox builds a care schedule for {today.slice(0, 4)}: watering, trimming, feeding and planting days, all timed to your frost dates. Every job also shows up in PlanFox.</p>
            <button type="button" className="gf-btn" onClick={() => g.switchTab("plants")}>
              Browse plants
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Welcome({ g }) {
  return (
    <div className="gf-welcome">
      <div className="gf-welcome-art" aria-hidden="true">
        {["tomato", "sunflower", "redmaple", "lavender", "tulip"].map(id => (
          <PlantArt key={id} plant={plantsById.get(id)} size={56} />
        ))}
      </div>
      <h1>Grow what thrives where you live</h1>
      <p>Tell GrowFox where your garden is. It reads ten years of local weather to find your hardiness zone, frost dates and growing season, then rates every plant for your yard and tells you when to plant and how often to care for it.</p>
      <ClimateStatus g={g} />
      <PlaceSetup g={g} />
    </div>
  );
}

function seasonNow(climate, d) {
  const seasons = seasonsAround(climate, yearOf(d));
  if (climate.frostless) return { line: "No regular frost here: something can be planted almost every month.", phase: "frostless" };
  for (let i = 0; i < seasons.length; i++) {
    const s = seasons[i];
    if (d < s.lf && (i === 0 || d > seasons[i - 1].ff)) {
      const weeks = Math.round((s.lf - d) / 7);
      return { line: weeks <= 1 ? "Your last frost is about now. Planting season is here." : `About ${weeks} weeks until your average last frost.`, phase: weeks <= 8 ? "early" : "winter" };
    }
    if (d >= s.lf && d <= s.ff) {
      const weeks = Math.round((s.ff - d) / 7);
      return { line: weeks <= 2 ? "First frost is close: harvest tender crops and plant bulbs." : `Growing season: about ${weeks} frost-free weeks left.`, phase: "growing" };
    }
  }
  return { line: "", phase: "winter" };
}

function ClimateCard({ g }) {
  const { climate, data, todayNum } = g;
  const units = data.prefs.units;
  const [lo, hi] = zoneRangeF(climate.zone);
  const now = seasonNow(climate, todayNum);
  const winter = units === "metric" ? `${Math.round(((lo - 32) * 5) / 9)} to ${Math.round(((hi - 32) * 5) / 9)}°C` : `${lo} to ${hi}°F`;
  return (
    <section className={`gf-card gf-climate gf-climate--${now.phase}`}>
      <div className="gf-zone">
        <small>Zone</small>
        <strong>{zoneLabel(climate.zone)}</strong>
      </div>
      <div className="gf-climate-body">
        <p className="gf-climate-now">{now.line}</p>
        <dl className="gf-facts">
          <div>
            <dt>Coldest nights</dt>
            <dd>{winter}</dd>
          </div>
          {!climate.frostless && (
            <>
              <div>
                <dt>Last spring frost</dt>
                <dd>≈ {doyLabel(climate.lastFrost)}</dd>
              </div>
              <div>
                <dt>First fall frost</dt>
                <dd>≈ {doyLabel(climate.firstFrost)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Growing season</dt>
            <dd>{climate.frostless ? "All year" : `${climate.frostFree} days`}</dd>
          </div>
          <div>
            <dt>Hemisphere</dt>
            <dd>{climate.hemisphere === "S" ? "Southern" : "Northern"}</dd>
          </div>
        </dl>
        <p className="gf-hint">
          {climate.source === "data" ? `From ${climate.years} years of daily weather${describeClimate(climate) ? `: ${describeClimate(climate, units)}` : ""}.` : "Estimated from your zone. Add your town for local frost dates."}{" "}
          {climate.shifted && "Adjusted for your yard. "}
          <button type="button" className="gf-link" onClick={g.openSettings}>
            Change
          </button>
        </p>
      </div>
    </section>
  );
}

function FrostWatch({ g }) {
  const { data, climate } = g;
  const [days, setDays] = useState(null);
  const place = data.place;
  useEffect(() => {
    if (!place) return undefined;
    const controller = new AbortController();
    fetchLowForecast(place, { signal: controller.signal })
      .then(setDays)
      .catch(() => setDays(null));
    return () => controller.abort();
  }, [place]);
  const tender = useMemo(
    () => [...new Set(data.garden.filter(e => e.status === "growing").map(e => plantsById.get(e.plantId)).filter(p => (!p.zones && !isFrostHardy(p)) || (p.zones && p.zones[0] > Math.floor(climate.zone))).map(p => p.name))],
    [data.garden, climate.zone]
  );
  if (!days) return null;
  const cold = days.filter(d => Number.isFinite(d.low) && d.low <= 1.5);
  const hot = days.filter(d => Number.isFinite(d.high) && d.high >= 35);
  if (!cold.length && !hot.length) return null;
  const units = data.prefs.units;
  const label = d => weekdayShort(d.day);
  return (
    <section className="gf-card gf-alert">
      {cold.length > 0 && (
        <p>
          <Snowflake size={18} aria-hidden="true" />
          <span>
            <strong>Frost risk {cold.map(label).join(", ")}</strong> (low {tempText(Math.min(...cold.map(d => d.low)), units)}).{" "}
            {tender.length ? `Cover or bring in: ${tender.slice(0, 5).join(", ")}.` : "Cover tender plants overnight with a sheet or bucket."}
          </span>
        </p>
      )}
      {hot.length > 0 && (
        <p>
          <ThermometerSun size={18} aria-hidden="true" />
          <span>
            <strong>Heat {hot.map(label).join(", ")}</strong> (high {tempText(Math.max(...hot.map(d => d.high)), units)}). Water deeply in the early morning and shade new plantings.
          </span>
        </p>
      )}
    </section>
  );
}

function TaskRow({ g, task, day, highlight = false }) {
  const entry = g.data.garden.find(e => e.id === task.entryId);
  const plant = entry && plantsById.get(entry.plantId);
  const done = Boolean(g.data.done[task.id]);
  return (
    <li className={`gf-task${done ? " done" : ""}${highlight ? " gf-task--focus" : ""}`} id={highlight ? "gf-focus" : undefined}>
      <button type="button" className="gf-check" onClick={() => g.toggleDone(task.id)} aria-pressed={done} aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}>
        {done && <Check size={16} strokeWidth={3} />}
      </button>
      {plant && <PlantArt plant={plant} size={34} />}
      <button type="button" className="gf-task-body" onClick={() => plant && g.openPlant(plant.id)}>
        <strong>{task.title}</strong>
        {task.note && <span>{task.note}</span>}
        {day && <em>{day}</em>}
      </button>
    </li>
  );
}

function FocusTask({ g }) {
  const day = g.taskDay && /^\d{4}-\d{2}-\d{2}$/.test(g.taskDay) ? g.taskDay : g.today;
  const tasks = dayTasks(g.data.garden, plantsById, g.climate, day, g.data.prefs);
  const task = tasks.find(t => t.id === g.taskParam);
  useEffect(() => {
    document.getElementById("gf-focus")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);
  return (
    <section className="gf-card gf-focus">
      <h3>
        <CalendarCheck2 size={18} aria-hidden="true" /> From your planner · {niceDate(day)}
      </h3>
      {task ? (
        <ul className="gf-tasks">
          <TaskRow g={g} task={task} highlight />
        </ul>
      ) : (
        <p className="gf-hint">That job isn't on the schedule anymore. The plant may have been removed or its dates changed.</p>
      )}
      <button type="button" className="gf-link" onClick={() => g.go({}, { replace: true })}>
        Dismiss
      </button>
    </section>
  );
}

function Week({ g }) {
  const { data, climate, today } = g;
  const days = useMemo(() => {
    if (!data.garden.length) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i);
      return { day, tasks: dayTasks(data.garden, plantsById, climate, day, data.prefs) };
    });
  }, [data.garden, data.prefs, climate, today]);
  if (!data.garden.length) return null;
  const todays = days[0].tasks;
  const later = days.slice(1).filter(d => d.tasks.length);
  const left = todays.filter(t => !data.done[t.id]).length;
  return (
    <section className="gf-card">
      <div className="gf-card-head">
        <h2>Today</h2>
        <span className="gf-count">{todays.length ? (left ? `${left} to do` : "All done") : "Nothing due"}</span>
      </div>
      {todays.length ? (
        <ul className="gf-tasks">
          {todays.map(t => (
            <TaskRow key={t.id} g={g} task={t} />
          ))}
        </ul>
      ) : (
        <p className="gf-hint">Your garden doesn't need you today. Enjoy it.</p>
      )}
      {later.length > 0 && (
        <details className="gf-later">
          <summary>
            This week <span>{later.reduce((a, d) => a + d.tasks.length, 0)} more jobs</span>
          </summary>
          {later.map(d => (
            <div key={d.day} className="gf-later-day">
              <h4>{niceDate(d.day)}</h4>
              <ul className="gf-tasks">
                {d.tasks.map(t => (
                  <TaskRow key={t.id} g={g} task={t} />
                ))}
              </ul>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function PlantNow({ g }) {
  const { climate, todayNum, ratingFor } = g;
  const picks = useMemo(
    () =>
      PLANTS.filter(p => isPlantableNow(p, climate, todayNum))
        .map(p => ({ p, r: ratingFor(p) }))
        .filter(x => x.r.score <= 3)
        .sort((a, b) => a.r.score - b.r.score || a.p.name.localeCompare(b.p.name)),
    [climate, todayNum, ratingFor]
  );
  return (
    <section className="gf-card">
      <div className="gf-card-head">
        <h2>Plant now</h2>
        <button type="button" className="gf-link" onClick={() => g.go({ tab: "plants", now: "1" })}>
          See all {picks.length} <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      {picks.length ? (
        <div className="gf-strip">
          {picks.slice(0, 12).map(({ p, r }) => {
            const w = nextWindows(p, climate, todayNum).find(x => x.open);
            return (
              <button key={p.id} type="button" className="gf-mini" onClick={() => g.openPlant(p.id)} style={{ "--tint": p.color }}>
                <PlantArt plant={p} size={44} />
                <strong>{p.name}</strong>
                <small>
                  {ACTIONS[w.action].short} until {shortDate(w.end)}
                </small>
                <RatingBadge result={r} compact />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="gf-hint">Nothing that suits your area is in its planting window right now. Check the calendar for what's coming up.</p>
      )}
    </section>
  );
}

