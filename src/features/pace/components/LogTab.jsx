import { useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileUp, Plus, Trash2, X } from "lucide-react";

import { SPORTS } from "../data/events";
import { guessSport, movingSeconds, parseGpx, routePath, splits as splitList, toGpx, trackDistance, downsample, compact } from "../model/geo";
import { addDays, fmtClock, fmtDay, fmtDistance, fmtMinutes, fmtRate, mondayOf, parseClock, toIsoDay, M_PER_MI } from "../model/units";
import { loadTracks } from "../state/paceStore";
import { gapNote } from "../model/live";
import { SportIcon } from "./ui";

const distUnit = (sport, unit) => (sport === "row" ? "m" : unit);

function WeekChart({ activities, today }) {
  const weeks = useMemo(() => {
    const first = addDays(mondayOf(today), -7 * 7);
    return Array.from({ length: 8 }, (_, i) => {
      const start = addDays(first, i * 7);
      const end = addDays(start, 6);
      const list = activities.filter(a => a.day >= start && a.day <= end);
      const by = { run: 0, ride: 0, row: 0 };
      for (const a of list) by[a.sport] += a.sec / 60;
      return { start, by, total: by.run + by.ride + by.row, count: list.length };
    });
  }, [activities, today]);
  const max = Math.max(60, ...weeks.map(w => w.total));
  const thisWeek = weeks.at(-1);
  return (
    <section className="pc-card">
      <div className="pc-section-head">
        <h2>Last 8 weeks</h2>
        <span className="pc-hint">
          This week: {fmtMinutes(thisWeek.total)}, {thisWeek.count} workout{thisWeek.count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="pc-chart" role="img" aria-label="Minutes trained each week">
        {weeks.map(w => (
          <div key={w.start} className="pc-chart-col" title={`Week of ${fmtDay(w.start, { month: "short", day: "numeric" })}: ${fmtMinutes(w.total)}`}>
            <div className="pc-chart-bar">
              {["row", "ride", "run"].map(s => (w.by[s] ? <span key={s} className={`is-${s}`} style={{ height: `${(w.by[s] / max) * 100}%` }} /> : null))}
            </div>
            <small>{fmtDay(w.start, { month: "numeric", day: "numeric" })}</small>
          </div>
        ))}
      </div>
      <div className="pc-legend">
        {Object.values(SPORTS).map(s => (
          <span key={s.id} className={`is-${s.id}`}>
            <i /> {s.name}
          </span>
        ))}
      </div>
    </section>
  );
}

function AddForm({ unit, sport: defaultSport, today, onAdd, onClose }) {
  const [sport, setSport] = useState(defaultSport);
  const [day, setDay] = useState(today);
  const [time, setTime] = useState("");
  const [dist, setDist] = useState("");
  const [title, setTitle] = useState("");
  const sec = parseClock(time);
  return (
    <form
      className="pc-card pc-add"
      onSubmit={e => {
        e.preventDefault();
        if (!sec) return;
        const n = parseFloat(dist);
        const meters = n > 0 ? (sport === "row" ? n : n * (unit === "km" ? 1000 : M_PER_MI)) : 0;
        onAdd({ id: `m${Date.now().toString(36)}`, sport, title: title || `${SPORTS[sport].name}`, start: new Date(`${day}T12:00:00`).toISOString(), day, sec, meters, source: "manual" });
      }}
    >
      <div className="pc-card-head">
        <h2>Add a workout</h2>
        <button type="button" className="pc-icon-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="pc-form">
        <label>
          Sport
          <select value={sport} onChange={e => setSport(e.target.value)}>
            {Object.values(SPORTS).map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={day} max={today} onChange={e => setDay(e.target.value)} />
        </label>
        <label>
          Time (h:mm:ss or mm:ss)
          <input value={time} onChange={e => setTime(e.target.value)} placeholder="45:00" inputMode="numeric" />
        </label>
        <label>
          Distance ({sport === "row" ? "meters" : unit})
          <input type="number" step="any" min={0} value={dist} onChange={e => setDist(e.target.value)} placeholder="optional" />
        </label>
        <label className="pc-wide">
          Title
          <input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder={`${SPORTS[sport].name}`} />
        </label>
      </div>
      <button type="submit" className="pc-btn" disabled={!sec}>
        <Plus size={16} /> Add
      </button>
    </form>
  );
}

function Detail({ a, unit, onDelete, onPatch }) {
  const track = useMemo(() => (a.hasTrack ? loadTracks()[a.id] ?? null : null), [a]);
  const route = track ? routePath(track, 320, 180) : null;
  const splitUnit = a.splitUnit ?? (a.sport === "row" ? "500m" : unit);
  const best = a.splits.length ? Math.min(...a.splits) : null;
  function download() {
    const blob = new Blob([toGpx(a, track)], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement("a"), { href: url, download: `${a.day}-${a.title.replace(/[^\w-]+/g, "-").toLowerCase()}.gpx` });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="pc-act-detail">
      {route && (
        <svg className="pc-route" viewBox="0 0 320 180" role="img" aria-label="Route">
          <path d={route.d} />
          <circle cx={route.start[0]} cy={route.start[1]} r="5" className="is-start" />
          <circle cx={route.end[0]} cy={route.end[1]} r="6" className="is-end" />
        </svg>
      )}
      {a.splits.length > 0 && (
        <div className="pc-splits">
          <p className="pc-label">Splits (per {splitUnit === "500m" ? "500 m" : splitUnit})</p>
          <ol>
            {a.splits.map((s, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <i style={{ width: `${(best / s) * 100}%` }} className={s === best ? "is-best" : ""} />
                <strong>{fmtClock(s)}</strong>
              </li>
            ))}
          </ol>
        </div>
      )}
      {gapNote(a.gapSec) && <p className="pc-hint">{gapNote(a.gapSec)}</p>}
      <label className="pc-field">
        Notes
        <textarea rows={2} maxLength={600} defaultValue={a.notes} onBlur={e => e.target.value !== a.notes && onPatch({ notes: e.target.value })} />
      </label>
      <div className="pc-actions">
        {track && (
          <button type="button" className="pc-btn pc-btn-quiet" onClick={download}>
            <Download size={16} /> GPX file
          </button>
        )}
        <button
          type="button"
          className="pc-btn pc-btn-quiet pc-danger"
          onClick={() => {
            if (window.confirm(`Delete “${a.title}”?`)) onDelete();
          }}
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>
      {a.source === "gps" && !track && <p className="pc-hint">The route for this workout is on the device that recorded it.</p>}
    </div>
  );
}

export default function LogTab({ store, today, openId, onOpen }) {
  const { data, addActivity, deleteActivity, updateActivity } = store;
  const { unit } = data.prefs;
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState(null);
  const file = useRef(null);

  async function importFiles(files) {
    let ok = 0;
    for (const f of files) {
      try {
        const g = parseGpx(await f.text());
        const pts = g.points.map(compact);
        const meters = trackDistance(pts);
        const sec = movingSeconds(pts) || (pts.at(-1).t - pts[0].t) / 1000;
        const sport = guessSport(g.type, meters / Math.max(1, sec));
        const hrs = pts.map(p => p.hr).filter(Boolean);
        const unitM = sport === "row" ? 500 : unit === "km" ? 1000 : M_PER_MI;
        addActivity(
          {
            id: `g${pts[0].t.toString(36)}`,
            sport,
            title: g.name || SPORTS[sport].name,
            start: new Date(pts[0].t).toISOString(),
            day: toIsoDay(pts[0].t),
            sec,
            meters,
            hrAvg: hrs.length ? Math.round(hrs.reduce((n, h) => n + h, 0) / hrs.length) : null,
            hrMax: hrs.length ? Math.max(...hrs) : null,
            source: "gpx",
            splits: splitList(pts, unitM).map(s => s.sec),
            splitUnit: sport === "row" ? "500m" : unit,
          },
          downsample(pts, 600)
        );
        ok += 1;
      } catch (e) {
        setMsg(`${f.name}: ${e.message}`);
      }
    }
    if (ok) setMsg(`Imported ${ok} workout${ok === 1 ? "" : "s"}.`);
  }

  const byDay = useMemo(() => {
    const map = new Map();
    for (const a of data.activities) map.set(a.day, [...(map.get(a.day) ?? []), a]);
    return [...map.entries()];
  }, [data.activities]);

  return (
    <div className="pc-log">
      <WeekChart activities={data.activities} today={today} />

      <div className="pc-log-tools">
        <button type="button" className="pc-btn pc-btn-quiet" onClick={() => setAdding(a => !a)}>
          <Plus size={16} /> Add by hand
        </button>
        <button type="button" className="pc-btn pc-btn-quiet" onClick={() => file.current?.click()}>
          <FileUp size={16} /> Import GPX
        </button>
        <input
          ref={file}
          type="file"
          accept=".gpx,application/gpx+xml,application/xml,text/xml"
          multiple
          hidden
          onChange={e => {
            importFiles([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>
      {msg && <p className="pc-hint" role="status">{msg}</p>}
      {adding && (
        <AddForm
          unit={unit}
          sport={data.prefs.sport}
          today={today}
          onClose={() => setAdding(false)}
          onAdd={a => {
            addActivity(a);
            setAdding(false);
          }}
        />
      )}

      {!data.activities.length && (
        <section className="pc-card pc-empty">
          <h3>No workouts yet</h3>
          <p>Record one on the Go tab, add one by hand, or import GPX files from your watch, Strava or Garmin Connect.</p>
        </section>
      )}

      {byDay.map(([day, list]) => (
        <section key={day} className="pc-day">
          <h3>{day === today ? "Today" : fmtDay(day, { weekday: "long", month: "short", day: "numeric" })}</h3>
          {list.map(a => {
            const open = openId === a.id;
            const speed = a.meters && a.sec ? a.meters / a.sec : null;
            return (
              <article key={a.id} className={`pc-act${open ? " is-open" : ""}`}>
                <button type="button" className="pc-act-head" aria-expanded={open} onClick={() => onOpen(open ? null : a.id)}>
                  <span className={`pc-act-icon is-${a.sport}`}>
                    <SportIcon sport={a.sport} />
                  </span>
                  <span className="pc-act-what">
                    <strong>{a.title}</strong>
                    <small>
                      {[a.meters ? fmtDistance(a.meters, distUnit(a.sport, unit)) : null, fmtClock(a.sec), speed ? fmtRate(a.sport, speed, unit) : null, a.hrAvg ? `${a.hrAvg} bpm` : null, a.rpe ? `effort ${a.rpe}/10` : null].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                  <ChevronDown size={18} className="pc-chev" aria-hidden="true" />
                </button>
                {open && <Detail a={a} unit={unit} onDelete={() => deleteActivity(a.id)} onPatch={p => updateActivity(a.id, p)} />}
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
