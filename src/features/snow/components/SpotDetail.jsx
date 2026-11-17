import { useMemo, useState } from "react";
import { CalendarPlus, Check, ChevronLeft, Mountain, Trash2 } from "lucide-react";

import { fetchMountain } from "../api";
import { useLoad } from "../model/useLoad";
import { dailyFrom, fmtElev, hourAt, localDay, scoreDay, snowTotals } from "../model/snow";
import { DayDetail, DayPicker, NowPanel } from "./Forecast";
import { AlertsCard, AvalancheCard, LiftsCard, SnowpackCard } from "./Cards";
import DriveCard from "./DriveCard";
import TrailMap from "./TrailMap";
import { FavButton, Loading, Problem } from "./ui";

// One mountain or backcountry spot: now, the next ten days, lifts, the trail
// map, snowpack, avalanche danger and the drive.
export default function SpotDetail({ spot, s, day: askedDay, setDay, back }) {
  const { data, patch } = s;
  const units = data.units;
  const wx = useLoad(`${spot.id}-${spot.base}-${spot.summit}`, signal => fetchMountain(spot, { signal }));

  const view = useMemo(() => {
    if (!wx.data) return null;
    const topDays = dailyFrom(wx.data.summit);
    const baseDays = dailyFrom(wx.data.base);
    const now = wx.data.fetchedAt;
    const nowTop = hourAt(wx.data.summit, now);
    const today = nowTop?.localDay ?? localDay(new Date());
    const ahead = topDays.filter(d => d.day >= today && d.hours >= 20).slice(0, 10);
    const baseFor = d => baseDays.find(b => b.day === d.day) ?? null;
    return {
      totals: snowTotals(wx.data.summit, now),
      nowTop,
      nowBase: hourAt(wx.data.base, now),
      today,
      ahead,
      scores: ahead.map(d => scoreDay(d, baseFor(d))),
      baseFor,
    };
  }, [wx.data]);

  const day = view && view.ahead.some(d => d.day === askedDay) ? askedDay : view?.today;
  const top = view?.ahead.find(d => d.day === day) ?? null;
  const fav = data.favorites.includes(spot.id);
  const tripOn = data.trips.find(t => t.spot === spot.id && t.day === day);
  const kind = spot.kind;

  function toggleTrip() {
    if (!day) return;
    if (tripOn) patch(d => ({ trips: d.trips.filter(t => t.id !== tripOn.id) }));
    else patch(d => ({ trips: [...d.trips, { id: `${spot.id}-${day}`, spot: spot.id, name: spot.name, day, time: kind === "backcountry" ? "06:30" : "08:30", note: "" }] }));
  }

  return (
    <div className="sf-detail">
      <button type="button" className="sf-back" onClick={back}>
        <ChevronLeft size={18} aria-hidden="true" /> All mountains
      </button>
      <header className="sf-detail-head">
        <div>
          <p className="sf-kicker">
            <Mountain size={14} aria-hidden="true" /> {spot.state} · {kind === "backcountry" ? "Backcountry" : kind === "custom" ? "Your place" : "Ski area"} · {fmtElev(spot.base, units)} to {fmtElev(spot.summit, units)}
          </p>
          <h1>{spot.name}</h1>
          {spot.note && <p className="sf-detail-note">{spot.note}</p>}
        </div>
        <div className="sf-detail-actions">
          <FavButton on={fav} onToggle={() => patch(d => ({ favorites: fav ? d.favorites.filter(f => f !== spot.id) : [...d.favorites, spot.id] }))} name={spot.name} />
        </div>
      </header>

      {kind === "custom" && <CustomElevations spot={spot} patch={patch} />}

      <AlertsCard spot={spot} />

      {wx.loading && <Loading text="Reading the mountain forecast…" />}
      {wx.error && <Problem text={wx.error} />}
      {view && (
        <>
          <NowPanel spot={spot} totals={view.totals} nowTop={view.nowTop} nowBase={view.nowBase} units={units} />
          <DayPicker days={view.ahead} scores={view.scores} picked={day} onPick={setDay} today={view.today} units={units} />
          <div className="sf-plan-row">
            <button type="button" className={`sf-btn${tripOn ? " is-done" : ""}`} onClick={toggleTrip}>
              {tripOn ? <Check size={16} aria-hidden="true" /> : <CalendarPlus size={16} aria-hidden="true" />}
              {tripOn ? "On your PlanFox calendar" : `Plan ${kind === "backcountry" ? "a tour" : "a ski day"} ${day === view.today ? "today" : "on " + new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })}`}
            </button>
            {tripOn && <small className="sf-muted">PlanFox shows it with a link back here to check conditions.</small>}
          </div>
          <DayDetail spot={spot} top={top} base={top ? view.baseFor(top) : null} topHours={wx.data.summit} baseHours={wx.data.base} units={units} kind={kind} />
        </>
      )}

      <div className="sf-grid">
        {kind === "backcountry" && <AvalancheCard spot={spot} emphasize />}
        {kind === "resort" && <LiftsCard spot={spot} />}
        {view && <SnowpackCard spot={spot} summitHours={wx.data.summit} units={units} />}
        {kind !== "backcountry" && <AvalancheCard spot={spot} />}
        <DriveCard spot={spot} s={s} day={day ?? localDay(new Date())} units={units} />
        {kind === "resort" && <TrailMap spot={spot} />}
      </div>
      <p className="sf-credit">
        Mountain weather from{" "}
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{" "}
        (weather models adjusted to each elevation){spot.country === "US" ? ", alerts from the National Weather Service" : ""}. Forecasts, not the resort's measured report.
      </p>
    </div>
  );
}

function CustomElevations({ spot, patch }) {
  const [base, setBase] = useState(spot.base);
  const [summit, setSummit] = useState(spot.summit);
  const save = () => patch(d => ({ custom: d.custom.map(c => (c.id === spot.id ? { ...c, base: Number(base) || c.base, summit: Number(summit) || c.summit } : c)) }));
  return (
    <form
      className="sf-custom"
      onSubmit={e => {
        e.preventDefault();
        save();
      }}
    >
      <label>
        Low point (ft)
        <input type="number" value={base} min="0" max="20000" onChange={e => setBase(e.target.value)} />
      </label>
      <label>
        High point (ft)
        <input type="number" value={summit} min="0" max="20000" onChange={e => setSummit(e.target.value)} />
      </label>
      <button type="submit" className="sf-btn">
        Update forecast
      </button>
      <button type="button" className="sf-btn is-quiet" onClick={() => patch(d => ({ custom: d.custom.filter(c => c.id !== spot.id), favorites: d.favorites.filter(f => f !== spot.id) }))} aria-label="Remove this place">
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </form>
  );
}
