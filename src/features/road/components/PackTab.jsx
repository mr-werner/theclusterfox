import { useEffect, useMemo, useState } from "react";
import { BedDouble, Check, CloudSun, Luggage, Minus, Plus, RotateCcw, X } from "lucide-react";

import { fetchStayWeather } from "../api";
import { feel, MAX_STAYS, packingList, scheduleStays, summarize, tripLength, weatherSource } from "../model/packing";
import { addDays, emptyPack } from "../state/roadStore";
import { Loading, PlaceInput } from "./ui";

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const short = day => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const deg = v => `${Math.round(v)}°`;
const span = (a, b) => (Math.round(a) === Math.round(b) ? deg(a) : `${Math.round(a)}–${deg(b)}`);

/**
 * Where you're staying and for how long, the weather there for those dates,
 * and what to pack for it. pack lives on the plan (or on a saved trip) so
 * checking things off survives a reload.
 */
export default function PackTab({ store, savedTrip, to, driveDays, goPlan }) {
  const { data, patch } = store;
  const pack = (savedTrip ? savedTrip.pack : data.pack) ?? emptyPack();
  const departDate = savedTrip ? savedTrip.departDate : data.departDate;
  const today = localToday();

  function setPack(fn) {
    if (savedTrip) patch(d => ({ trips: d.trips.map(t => (t.id === savedTrip.id ? { ...t, pack: fn(t.pack ?? emptyPack()) } : t)) }));
    else patch(d => ({ pack: fn(d.pack ?? emptyPack()) }));
  }
  function setDepart(day) {
    if (savedTrip) patch(d => ({ trips: d.trips.map(t => (t.id === savedTrip.id ? { ...t, departDate: day } : t)) }));
    else patch({ departDate: day });
  }

  const drive = Math.max(1, driveDays || 1);
  const leave = departDate ?? today;
  const arrive = addDays(leave, drive - 1);
  const stays = useMemo(() => scheduleStays(pack.stays.map(s => ({ ...s, place: s.place ?? to })).filter(s => s.place), arrive), [pack.stays, to, arrive]);
  const sources = stays.map(s => weatherSource(s.dates, today));
  const keyOf = (s, i) => `${s.place.lat.toFixed(2)},${s.place.lon.toFixed(2)}|${s.arrive}|${s.nights}|${sources[i]}`;
  const weatherKey = stays.map(keyOf).join(";");

  const [weather, setWeather] = useState({}); // key -> { days } | { error }
  useEffect(() => {
    const ctl = new AbortController();
    stays.forEach((s, i) => {
      const key = keyOf(s, i);
      if (weather[key]?.days) return;
      fetchStayWeather(s.place, s.dates, sources[i], { signal: ctl.signal })
        .then(days => setWeather(w => ({ ...w, [key]: { days } })))
        .catch(error => {
          if (error.name !== "AbortError") setWeather(w => ({ ...w, [key]: { error: error.message } }));
        });
    });
    return () => ctl.abort();
  }, [weatherKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const withDays = stays.map((s, i) => {
    const w = weather[keyOf(s, i)];
    const days = w?.days ? s.dates.map(d => w.days[d]).filter(Boolean) : [];
    return { ...s, name: s.place.name, days, summary: summarize(days), source: sources[i], loading: !w, error: w?.error };
  });
  const loading = withDays.some(s => s.loading);
  const totalDays = tripLength(drive, stays.map(s => s.nights), pack.roundTrip);
  const list = packingList(withDays, { driveDays: pack.roundTrip ? drive * 2 : drive, totalDays });
  const itemCount = list.groups.reduce((n, g) => n + g.items.length, 0);
  const packed = list.groups.reduce((n, g) => n + g.items.filter(i => pack.checked[i.id]).length, 0);

  if (!to && !savedTrip) {
    return (
      <section className="rf-panel rf-empty">
        <p>Pick where you're headed on the Trip tab, then come back here for a packing list built from the weather where you're staying.</p>
        <button type="button" className="rf-btn" onClick={goPlan}>
          Plan a trip
        </button>
      </section>
    );
  }

  const setNights = (id, nights) => setPack(p => ({ ...p, stays: p.stays.map(s => (s.id === id ? { ...s, nights: Math.max(1, Math.min(30, nights)) } : s)) }));
  const addStay = place => setPack(p => ({ ...p, stays: [...p.stays, { id: newId(), place, nights: 2 }].slice(0, MAX_STAYS) }));
  const removeStay = id => setPack(p => ({ ...p, stays: p.stays.filter(s => s.id !== id) }));
  const toggle = id => setPack(p => {
    const checked = { ...p.checked };
    if (checked[id]) delete checked[id];
    else checked[id] = true;
    return { ...p, checked };
  });
  const lastLeave = stays.at(-1)?.leave;

  return (
    <div className="rf-pack">
      <section className="rf-panel" aria-label="Where you're staying">
        <header className="rf-panel-head">
          <h2>
            Where you're staying <small>{totalDays} days away</small>
          </h2>
        </header>
        <div className="rf-options">
          <label>
            <span>Leaving</span>
            <input type="date" value={departDate ?? ""} min={today} onChange={e => setDepart(e.target.value || null)} />
          </label>
          <label className="rf-check">
            <input type="checkbox" checked={pack.roundTrip} onChange={e => setPack(p => ({ ...p, roundTrip: e.target.checked }))} />
            <span>Driving back home{drive > 1 ? ` (${drive} more days)` : ""}</span>
          </label>
        </div>
        {!departDate && <p className="rf-note">No leaving date yet, so this plans as if you leave today. Pick a date for weather on your real days.</p>}
        <ol className="rf-stays">
          {withDays.map((s, i) => (
            <li key={s.id}>
              <BedDouble size={18} aria-hidden="true" />
              <div className="rf-stop-body">
                <strong>{s.name}</strong>
                <span className="rf-muted">
                  {short(s.arrive)} to {short(s.leave)}
                  {i === 0 ? ` · you arrive on day ${drive} of the drive` : ""}
                </span>
                {s.loading && <span className="rf-muted rf-small">Checking the weather…</span>}
                {s.error && <span className="rf-muted rf-small">{s.error}</span>}
                {s.summary && (
                  <span className="rf-weather rf-small">
                    <CloudSun size={13} aria-hidden="true" /> <b>{feel(s.summary)}.</b> Highs {span(s.summary.hiMin, s.summary.hiMax)}, lows {span(s.summary.loMin, s.summary.loMax)}
                    {s.summary.rainyDays ? `, rain likely ${s.summary.rainyDays} day${s.summary.rainyDays > 1 ? "s" : ""}` : ""}
                    {s.summary.snowDays ? `, snow ${s.summary.snowDays} day${s.summary.snowDays > 1 ? "s" : ""}` : ""}.
                    <em className="rf-muted"> {s.source === "forecast" ? "Forecast" : "Typical for these dates, from the last three years"}</em>
                  </span>
                )}
              </div>
              <div className="rf-nights" role="group" aria-label={`Nights in ${s.name}`}>
                <button type="button" className="rf-icon-btn" onClick={() => setNights(s.id, s.nights - 1)} disabled={s.nights <= 1} aria-label="One night fewer">
                  <Minus size={14} />
                </button>
                <span>
                  {s.nights} night{s.nights > 1 ? "s" : ""}
                </span>
                <button type="button" className="rf-icon-btn" onClick={() => setNights(s.id, s.nights + 1)} disabled={s.nights >= 30} aria-label="One more night">
                  <Plus size={14} />
                </button>
              </div>
              {i > 0 && (
                <button type="button" className="rf-icon-btn" onClick={() => removeStay(s.id)} aria-label={`Remove ${s.name}`} title="Remove">
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
        </ol>
        {pack.stays.length < MAX_STAYS && (
          <div className="rf-addstay">
            <PlaceInput key={pack.stays.length} label={`Then staying in${lastLeave ? ` (from ${short(lastLeave)})` : ""}`} value={null} onPick={addStay} placeholder="Add another place you'll stay" />
          </div>
        )}
      </section>

      <section className="rf-panel" aria-label="What to pack">
        <header className="rf-panel-head">
          <h2>
            <Luggage size={18} aria-hidden="true" /> What to pack <small>{packed} of {itemCount} packed</small>
          </h2>
          {packed > 0 && (
            <button type="button" className="rf-btn is-small is-ghost" onClick={() => setPack(p => ({ ...p, checked: {} }))}>
              <RotateCcw size={14} aria-hidden="true" /> Start over
            </button>
          )}
        </header>
        {loading && <Loading>Building your list from the weather…</Loading>}
        <p className="rf-muted rf-small">
          For {list.days} days{list.laundry ? `, packing for a week and doing laundry once` : ""}. Clothes are counted to wear most bottoms twice.
        </p>
        <div className="rf-packgroups">
          {list.groups.map(g => (
            <div key={g.id} className="rf-packgroup">
              <h3>{g.title}</h3>
              <ul>
                {g.items.map(item => (
                  <li key={item.id} className={pack.checked[item.id] ? "is-packed" : ""}>
                    <label>
                      <input type="checkbox" checked={!!pack.checked[item.id]} onChange={() => toggle(item.id)} />
                      <span className="rf-packbox" aria-hidden="true">
                        <Check size={13} />
                      </span>
                      <span className="rf-stop-body">
                        <strong>
                          {item.qty > 1 && <span className="rf-qty">{item.qty}×</span>} {item.name}
                        </strong>
                        {item.why && <span className="rf-muted rf-small">{item.why}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
