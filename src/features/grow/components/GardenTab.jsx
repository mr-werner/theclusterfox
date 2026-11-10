import { useEffect, useMemo, useState } from "react";
import { Sprout, Trash2, Pencil } from "lucide-react";
import { plantsById } from "../data/plants";
import { entryTasks } from "../model/care";
import { nextWindows, ACTIONS } from "../model/calendar";
import { addDays, niceDate, shortDate, dayNum } from "../model/dates";
import { LIGHT } from "../model/sun";
import { PlantArt, RatingBadge } from "./ui";

function nextJob(entry, plant, g) {
  if (!g.climate) return null;
  for (let i = 0; i < 60; i++) {
    const day = addDays(g.today, i);
    const t = entryTasks(entry, plant, g.climate, day, g.data.prefs).find(x => !g.data.done[x.id]);
    if (t) return { ...t, day };
  }
  return null;
}

export default function GardenTab({ g }) {
  const { data } = g;
  const groups = useMemo(() => {
    const out = data.spots.map(s => ({ spot: s, entries: data.garden.filter(e => e.spotId === s.id) })).filter(x => x.entries.length);
    const loose = data.garden.filter(e => !e.spotId);
    if (loose.length) out.push({ spot: null, entries: loose });
    return out;
  }, [data.spots, data.garden]);

  useEffect(() => {
    if (g.entryParam) document.getElementById(`gf-entry-${g.entryParam}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [g.entryParam]);

  if (!data.garden.length) {
    return (
      <div className="gf-garden">
        <section className="gf-card gf-empty">
          <Sprout size={28} aria-hidden="true" />
          <div>
            <h2>Nothing planted yet</h2>
            <p>Add the trees, shrubs, flowers, vegetables and lawn you already have, and the ones you want to plant. GrowFox schedules their care and planting days.</p>
            <button type="button" className="gf-btn" onClick={() => g.switchTab("plants")}>
              Browse plants
            </button>
          </div>
        </section>
      </div>
    );
  }

  const planned = data.garden.filter(e => e.status === "planned").length;
  return (
    <div className="gf-garden">
      <div className="gf-plants-head">
        <h1>My garden</h1>
        <p className="gf-hint">
          {data.garden.length - planned} growing{planned ? ` · ${planned} planned` : ""}. Every care job here also shows up on your PlanFox calendar.
        </p>
      </div>
      {groups.map(({ spot, entries }) => (
        <section key={spot?.id ?? "none"} className="gf-card">
          <div className="gf-card-head">
            <h2>{spot ? spot.name : "No spot set"}</h2>
            {spot && <span className={`gf-light gf-light--${spot.light}`}>{LIGHT[spot.light].name}</span>}
          </div>
          <ul className="gf-entries">
            {entries.map(e => (
              <Entry key={e.id} g={g} entry={e} spot={spot} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Entry({ g, entry, spot }) {
  const plant = plantsById.get(entry.plantId);
  const [editing, setEditing] = useState(false);
  const r = g.climate ? g.ratingFor(plant, spot?.light ?? null) : null;
  const job = nextJob(entry, plant, g);
  const windows = entry.status === "planned" && g.climate ? nextWindows(plant, g.climate, g.todayNum) : [];
  const focus = g.entryParam === entry.id;
  return (
    <li className={`gf-entry${focus ? " gf-entry--focus" : ""}`} id={`gf-entry-${entry.id}`}>
      <button type="button" className="gf-entry-main" onClick={() => g.openPlant(plant.id)}>
        <PlantArt plant={plant} size={48} />
        <span>
          <strong>
            {entry.name || plant.name}
            {entry.qty > 1 && <small> × {entry.qty}</small>}
          </strong>
          <span className="gf-entry-meta">
            {entry.status === "planned" ? <em className="gf-chip-planned">Planned</em> : entry.planted ? `Planted ${shortDate(dayNum(entry.planted))}` : "Growing"}
            {r && <RatingBadge result={r} />}
          </span>
          {job && (
            <span className="gf-entry-next">
              Next: {job.title.split(" · ")[0]} {job.day === g.today ? "today" : `on ${niceDate(job.day).split(",")[0]}`}
            </span>
          )}
          {entry.status === "planned" && windows[0] && (
            <span className="gf-entry-next">
              {ACTIONS[windows[0].action].name} {windows[0].open ? `now through ${shortDate(windows[0].end)}` : `from ${shortDate(windows[0].start)}`}
            </span>
          )}
        </span>
      </button>
      <div className="gf-entry-actions">
        {entry.status === "planned" && (
          <button type="button" className="gf-btn gf-btn--small" onClick={() => g.updateEntry(entry.id, { status: "growing", planted: g.today })}>
            Planted it
          </button>
        )}
        <button type="button" className="gf-icon-btn" onClick={() => setEditing(e => !e)} aria-label={`Edit ${plant.name}`} aria-expanded={editing}>
          <Pencil size={16} />
        </button>
      </div>
      {editing && <EntryForm g={g} entry={entry} onDone={() => setEditing(false)} />}
    </li>
  );
}

function EntryForm({ g, entry, onDone }) {
  const [name, setName] = useState(entry.name);
  const [spotId, setSpotId] = useState(entry.spotId ?? "");
  const [planted, setPlanted] = useState(entry.planted ?? "");
  const [qty, setQty] = useState(entry.qty);
  const [note, setNote] = useState(entry.note);
  const save = () => {
    g.updateEntry(entry.id, { name: name.trim(), spotId: spotId || null, planted: entry.status === "growing" ? planted || null : null, qty: Number(qty) || 1, note });
    onDone();
  };
  return (
    <div className="gf-form gf-entry-form">
      <label>
        <span>Nickname</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={plantsById.get(entry.plantId).name} maxLength={60} />
      </label>
      <label>
        <span>Spot</span>
        <select value={spotId} onChange={e => setSpotId(e.target.value)}>
          <option value="">No particular spot</option>
          {g.data.spots.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {entry.status === "growing" && (
        <label>
          <span>Planted on</span>
          <input type="date" value={planted} max={g.today} onChange={e => setPlanted(e.target.value)} />
        </label>
      )}
      <label>
        <span>How many</span>
        <input type="number" min="1" max="999" value={qty} onChange={e => setQty(e.target.value)} />
      </label>
      <label className="gf-wide">
        <span>Notes</span>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Variety, where you bought it…" />
      </label>
      <div className="gf-form-actions">
        <button type="button" className="gf-btn" onClick={save}>
          Save
        </button>
        <button type="button" className="gf-btn gf-btn--ghost" onClick={onDone}>
          Cancel
        </button>
        <button type="button" className="gf-btn gf-btn--danger" onClick={() => g.removeEntry(entry.id)}>
          <Trash2 size={16} aria-hidden="true" /> Remove
        </button>
      </div>
    </div>
  );
}
