import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, CalendarPlus, CheckCircle2, CloudOff, CloudSun, Download, ExternalLink, Footprints, Navigation, Share2, Trash2, TriangleAlert } from "lucide-react";

import { fetchHikeForecast } from "../api";
import { cumulative, pointAt } from "../model/geo";
import { gearList } from "../model/gear";
import { SAC_TEXT, SHAPES, summarize } from "../model/profile";
import { defaultLayer, LAYERS } from "../model/tiles";
import { bestStarts, clock, fromHhmm, hhmm, hoursOn, isStorm, scoreStart, turnaround } from "../model/weather";
import { offlineSupported, pruneTiles, saveOffline, tilePlanFor } from "../offline";
import { duration } from "../state/hikeStore";
import { describeWeather } from "../../../services/weather/openMeteo";
import HikeMap from "./HikeMap";
import ProfileChart from "./ProfileChart";
import { Difficulty, ErrorNote, Loading, Stat } from "./ui";

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayLabel = (day, today) => {
  const d = new Date(`${day}T12:00:00`);
  const diff = Math.round((d - new Date(`${today}T12:00:00`)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

// One trail: its effort, map and profile, then a plan for the day you pick:
// the best start times from the forecast at the trailhead and up high, a
// turnaround time, and the gear to bring.
export default function TrailView({ h, f, trail, go }) {
  const { data, patch } = h;
  const update = changes => patch(d => ({ trails: d.trails.map(t => (t.id === trail.id ? { ...t, ...(typeof changes === "function" ? changes(t) : changes) } : t)) }));
  const s = useMemo(() => summarize(trail.profile, trail.shape, data.pace, trail.sac), [trail.profile, trail.shape, data.pace, trail.sac]);
  const [layer, setLayer] = useState(() => trail.offline?.layer || defaultLayer(trail.line[0][0], trail.line[0][1]));

  // Where to check the weather: the trailhead and the high point.
  const spots = useMemo(() => {
    const cum = cumulative(trail.line);
    const top = trail.profile.reduce((b, p) => (p[1] > b[1] ? p : b), trail.profile[0] ?? [0, null]);
    const scale = cum[cum.length - 1] / (trail.profile[trail.profile.length - 1]?.[0] || 1);
    const hp = pointAt(trail.line, cum, top[0] * scale);
    const start = trail.trailhead ? [trail.trailhead.lat, trail.trailhead.lon] : trail.line[0];
    return { start: { lat: start[0], lon: start[1], ele: trail.profile[0]?.[1] }, high: { lat: hp[0], lon: hp[1], ele: top[1] } };
  }, [trail.line, trail.profile, trail.trailhead]);

  const [wx, setWx] = useState({ status: "loading", data: null, error: null });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setWx(w => ({ ...w, status: "loading", error: null }));
    const twoSpots = s.max - (spots.start.ele ?? s.max) > 150;
    fetchHikeForecast(twoSpots ? [spots.start, spots.high] : [spots.start], { signal: c.signal })
      .then(list => setWx({ status: "done", data: { base: list[0], high: list[1] ?? list[0], twoSpots }, error: null }))
      .catch(err => err.name !== "AbortError" && setWx({ status: "error", data: null, error: navigator.onLine === false ? "You're offline. The forecast needs a connection; the map, profile and gear list still work." : err.message }));
    return () => c.abort();
  }, [trail.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayLocal();
  const days = wx.data?.base.days.filter(d => d.day >= today) ?? [];
  const [day, setDay] = useState(() => (trail.plan?.day && trail.plan.day >= today ? trail.plan.day : new Date().getHours() >= 15 ? null : today));
  const chosenDay = day && days.some(d => d.day === day) ? day : days.find(d => d.day > today)?.day ?? days[0]?.day ?? null;
  const sun = days.find(d => d.day === chosenDay) ?? null;
  const exposed = (trail.sac && trail.sac !== "hiking") || s.max > 2400 || trail.pois.some(p => p.kind === "peak");

  const starts = useMemo(() => {
    if (!wx.data || !chosenDay) return null;
    return bestStarts({ base: wx.data.base.hours, high: wx.data.high.hours, sun, day: chosenDay, minutes: s.minutes, exposed, fmtTemp: f.temp, fmtWind: f.wind });
  }, [wx.data, chosenDay, s.minutes, exposed, f]); // eslint-disable-line react-hooks/exhaustive-deps

  const planned = trail.plan?.day === chosenDay ? fromHhmm(trail.plan.start) : null;
  const [pickedStart, setPickedStart] = useState(null);
  const startMin = pickedStart ?? planned ?? starts?.options[0]?.start ?? 8 * 60;
  const chosen = useMemo(() => (wx.data && chosenDay ? scoreStart({ base: wx.data.base.hours, high: wx.data.high.hours, sun, day: chosenDay, start: startMin, minutes: s.minutes, exposed, fmtTemp: f.temp, fmtWind: f.wind }) : null), [wx.data, chosenDay, startMin, s.minutes, exposed, f, sun]);
  const turn = chosen ? turnaround({ start: startMin, minutes: s.minutes, shape: trail.shape, sun, storm: chosen.worst.storm }) : null;

  const dayHours = wx.data && chosenDay ? hoursOn(wx.data.high.hours, chosenDay).filter(x => new Date(x.local).getUTCHours() >= 5 && new Date(x.local).getUTCHours() <= 21) : [];
  const baseDayHours = wx.data && chosenDay ? hoursOn(wx.data.base.hours, chosenDay) : [];
  const gear = useMemo(
    () =>
      gearList(
        { minutes: s.minutes, distanceM: s.distanceM, gain: s.gain, maxEle: s.max, startMin, sun },
        chosen ? { ...chosen.worst, maxApparent: Math.max(...baseDayHours.map(x => x.apparent).filter(Number.isFinite), -50) } : null,
        { fmtTemp: f.temp, fmtVol: f.vol }
      ),
    [s, startMin, sun, chosen, f] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function plan() {
    update({ plan: { day: chosenDay, start: hhmm(startMin) }, saved: true, savedAt: trail.savedAt || new Date().toISOString() });
  }

  const lines = [{ id: "trail", points: trail.line, className: "is-trail" }];
  const markers = [
    ...(trail.trailhead ? [{ id: "th", lat: trail.trailhead.lat, lon: trail.trailhead.lon, kind: "trailhead", title: trail.trailhead.name }] : []),
    ...trail.pois.map(p => ({ id: p.id, lat: p.lat, lon: p.lon, kind: p.kind, label: p.kind === "peak" && p.name ? p.name : undefined, title: p.name || p.kind })),
    ...(trail.shape === "one-way" ? [{ id: "end", lat: trail.line[trail.line.length - 1][0], lon: trail.line[trail.line.length - 1][1], kind: "end", title: "Finish" }] : []),
  ];

  return (
    <div className="hk-trail">
      <header className="hk-trail-head">
        <div>
          <p className="hk-kicker">{trail.source === "gpx" ? "Your GPX route" : "Trail"} · {SHAPES[trail.shape]}</p>
          <h1>{trail.name}</h1>
          <div className="hk-trail-tags">
            <Difficulty value={s.difficulty} />
            {trail.sac && <span className="hk-tag">{SAC_TEXT[trail.sac] ?? trail.sac.replace(/_/g, " ")}</span>}
            {trail.info.surface && <span className="hk-tag">Surface: {trail.info.surface.replace(/_/g, " ")}</span>}
          </div>
        </div>
        <div className="hk-trail-actions">
          <button type="button" className={`hk-btn${trail.saved ? " hk-btn--on" : " hk-btn--ghost"}`} onClick={() => update(t => ({ saved: !t.saved, savedAt: t.saved ? null : new Date().toISOString() }))} aria-pressed={trail.saved}>
            {trail.saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {trail.saved ? "Saved" : "Save"}
          </button>
          <button type="button" className="hk-btn" onClick={() => go({ tab: "go", trail: trail.id })}>
            <Footprints size={16} /> Start hike
          </button>
        </div>
      </header>

      <div className="hk-stats">
        <Stat label="Distance" value={f.dist(s.distanceM)} sub={trail.shape === "out-back" ? "there and back" : SHAPES[trail.shape].toLowerCase()} />
        <Stat label="Time" value={duration(s.minutes)} sub="with short breaks" />
        <Stat label="Climb" value={f.ele(s.gain)} sub={`${f.ele(s.loss)} down`} />
        <Stat label="High point" value={f.ele(s.max)} sub={`starts at ${f.ele(trail.profile[0]?.[1])}`} />
      </div>

      <div className="hk-trail-grid">
        <div className="hk-trail-main">
          <HikeMap layer={layer} onLayer={setLayer} fit={trail.line} fitKey={trail.id} lines={lines} markers={markers} height={380} label={`Map of ${trail.name}`} />
          <ProfileChart trip={s.trip} pois={trail.pois} f={f} turnAt={null} />
          <div className="hk-shape">
            <span>How you'll walk it</span>
            <div className="hk-seg" role="group" aria-label="Trip shape">
              {Object.entries(SHAPES).map(([id, name]) => (
                <button key={id} type="button" className={trail.shape === id ? "is-on" : ""} aria-pressed={trail.shape === id} onClick={() => update({ shape: id })}>
                  {name}
                </button>
              ))}
            </div>
          </div>
          {trail.pois.length > 0 && (
            <section className="hk-card">
              <h2>Along the way</h2>
              <ul className="hk-pois">
                {trail.pois.slice(0, 14).map(p => (
                  <li key={p.id}>
                    <span className={`hk-poi-dot hk-mk--${p.kind}`} aria-hidden="true" />
                    <strong>{p.name || POI_NAMES[p.kind] || p.kind}</strong>
                    <span>{POI_NAMES[p.kind] && p.name ? POI_NAMES[p.kind] : ""}</span>
                    <em>{f.short(p.d)}{Number.isFinite(p.ele) ? ` · ${f.ele(p.ele)}` : ""}</em>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <TrailheadCard trail={trail} />
        </div>

        <aside className="hk-trail-side">
          <section className="hk-card hk-plan">
            <h2><CloudSun size={18} aria-hidden="true" /> Best time to go</h2>
            {wx.status === "loading" && <Loading>Checking the forecast{wx.data?.twoSpots !== false ? " at the trailhead and up high" : ""}…</Loading>}
            <ErrorNote onRetry={() => setReload(r => r + 1)}>{wx.error}</ErrorNote>
            {days.length > 0 && (
              <div className="hk-days" role="group" aria-label="Day">
                {days.slice(0, 10).map(d => (
                  <button key={d.day} type="button" className={d.day === chosenDay ? "is-on" : ""} aria-pressed={d.day === chosenDay} onClick={() => { setDay(d.day); setPickedStart(null); }}>
                    <span>{dayLabel(d.day, today)}</span>
                    <strong>{f.temp(d.high)}</strong>
                    <small className={d.precipProb >= 50 || isStorm(d.code) ? "is-wet" : ""}>{isStorm(d.code) ? "Storms" : d.precipProb >= 30 ? `${d.precipProb}%` : describeWeather(d.code)}</small>
                  </button>
                ))}
              </div>
            )}
            {starts && (
              <>
                <ol className="hk-starts">
                  {starts.options.map((o, i) => (
                    <li key={o.start}>
                      <button type="button" className={o.start === startMin ? "is-on" : ""} onClick={() => setPickedStart(o.start)}>
                        <span className="hk-start-rank">{i === 0 ? "Best" : i === 1 ? "Also good" : "Option"}</span>
                        <strong>{clock(o.start)}</strong>
                        <span className="hk-start-end">back by {clock(o.end)}</span>
                        <span className={`hk-score hk-score--${o.score >= 80 ? "good" : o.score >= 55 ? "ok" : "poor"}`}>{o.score}</span>
                        <small>{o.notes[0].text}</small>
                      </button>
                    </li>
                  ))}
                </ol>
                <label className="hk-start-pick">
                  Or start at
                  <input type="time" value={hhmm(startMin)} onChange={e => fromHhmm(e.target.value) !== null && setPickedStart(fromHhmm(e.target.value))} step="900" />
                </label>
              </>
            )}
            {chosen && (
              <div className="hk-chosen">
                <p>
                  Start <strong>{clock(startMin)}</strong>, back around <strong>{clock(startMin + s.minutes)}</strong>.
                  {sun && <> Sunrise {clock(sun.sunrise)}, sunset {clock(sun.sunset)}.</>}
                </p>
                {turn !== null && (
                  <p className="hk-turn">
                    <TriangleAlert size={15} aria-hidden="true" />
                    <span>
                      Turn around by <strong>{clock(turn)}</strong> wherever you are{chosen.worst.storm ? ", to be down before storms" : ", to finish in daylight"}.
                    </span>
                  </p>
                )}
                <ul className="hk-notes">
                  {chosen.notes.map(n => (
                    <li key={n.text} className={`is-${n.tone}`}>{n.text}</li>
                  ))}
                </ul>
                {dayHours.length > 0 && <HourStrip hours={dayHours} from={startMin} to={startMin + s.minutes} f={f} label={wx.data.twoSpots ? `Up high (${f.ele(spots.high.ele)})` : "At the trailhead"} />}
                <div className="hk-plan-actions">
                  <button type="button" className="hk-btn" onClick={plan}>
                    <CalendarPlus size={16} /> {trail.plan?.day === chosenDay && trail.plan.start === hhmm(startMin) ? "In PlanFox" : "Plan this hike"}
                  </button>
                  <ShareTripPlan trail={trail} s={s} f={f} day={chosenDay} start={startMin} turn={turn} />
                </div>
                {trail.plan && (
                  <p className="hk-fine">
                    On your PlanFox calendar for {dayLabel(trail.plan.day, today).toLowerCase()} at {clock(fromHhmm(trail.plan.start) ?? 0)}.{" "}
                    <button type="button" className="hk-link" onClick={() => update({ plan: null })}>Remove</button>
                  </p>
                )}
              </div>
            )}
          </section>

          <OfflineCard trail={trail} layer={layer} update={update} data={data} />

          <section className="hk-card">
            <h2>What to bring</h2>
            <GearList items={gear} checked={trail.gear} onToggle={id => update(t => ({ gear: { ...t.gear, [id]: !t.gear[id] } }))} />
          </section>
        </aside>
      </div>
      {trail.info.description && <p className="hk-desc">{trail.info.description}</p>}
      <p className="hk-fine">
        Trail data © OpenStreetMap contributors{trail.info.osm && <> · <a href={trail.info.osm} target="_blank" rel="noreferrer">View on OpenStreetMap</a></>}
        {trail.info.website && <> · <a href={trail.info.website} target="_blank" rel="noreferrer">Trail website</a></>} · Elevation and weather from Open-Meteo. Times are estimates; conditions change quickly in the mountains.
      </p>
    </div>
  );
}

export const POI_NAMES = { peak: "Summit", saddle: "Pass", viewpoint: "Viewpoint", waterfall: "Waterfall", water: "Water", hut: "Shelter", camp: "Campsite", toilets: "Toilets", waypoint: "Waypoint" };

function HourStrip({ hours, from, to, f, label }) {
  return (
    <div className="hk-hours">
      <p className="hk-hours-label">{label}</p>
      <div className="hk-hours-row">
        {hours.map(x => {
          const hr = new Date(x.local).getUTCHours();
          const on = hr * 60 + 60 > from && hr * 60 < to;
          return (
            <div key={x.t} className={`hk-hour${on ? " is-on" : ""}${isStorm(x.code) ? " is-storm" : ""}`}>
              <span>{clock(hr * 60).replace(":00", "")}</span>
              <strong>{f.temp(x.temp)}</strong>
              <small>{x.precipProb >= 20 ? `${x.precipProb}%` : "·"}</small>
              <small>{f.wind(x.gust)}</small>
            </div>
          );
        })}
      </div>
      <p className="hk-hours-key">Temperature · chance of rain · gusts</p>
    </div>
  );
}

function GearList({ items, checked, onToggle }) {
  const groups = [...new Set(items.map(i => i.group))];
  const done = items.filter(i => checked[i.id]).length;
  return (
    <div className="hk-gear">
      <p className="hk-gear-count">{done} of {items.length} packed</p>
      {groups.map(g => (
        <div key={g} className="hk-gear-group">
          <h3>{g}</h3>
          <ul>
            {items.filter(i => i.group === g).map(i => (
              <li key={i.id}>
                <label className={checked[i.id] ? "is-done" : ""}>
                  <input type="checkbox" checked={Boolean(checked[i.id])} onChange={() => onToggle(i.id)} />
                  <span>
                    <strong>{i.name}</strong>
                    <small>{i.why}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TrailheadCard({ trail }) {
  const th = trail.trailhead ?? { name: "Start of the trail", lat: trail.line[0][0], lon: trail.line[0][1] };
  const dest = `${th.lat.toFixed(5)},${th.lon.toFixed(5)}`;
  const apple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  return (
    <section className="hk-card hk-th">
      <div>
        <h2>Getting there</h2>
        <p>{th.name}</p>
        <p className="hk-muted hk-mono">{dest}</p>
      </div>
      <div className="hk-th-links">
        <a className="hk-btn hk-btn--ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`} target="_blank" rel="noreferrer">
          <Navigation size={15} /> Google Maps
        </a>
        {apple && (
          <a className="hk-btn hk-btn--ghost" href={`https://maps.apple.com/?daddr=${dest}`} target="_blank" rel="noreferrer">
            <Navigation size={15} /> Apple Maps
          </a>
        )}
      </div>
    </section>
  );
}

function ShareTripPlan({ trail, s, f, day, start, turn }) {
  const [copied, setCopied] = useState(false);
  const back = start + s.minutes;
  const text = [
    `Trip plan: ${trail.name}`,
    `When: ${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, starting ${clock(start)}`,
    `Expected back: ${clock(back)}. If you haven't heard from me by ${clock(back + 120)}, call for help (911 in the U.S.).`,
    turn !== null ? `Turnaround time: ${clock(turn)}` : null,
    `Trail: ${f.dist(s.distanceM)}, ${f.ele(s.gain)} of climb, ${SHAPES[trail.shape].toLowerCase()}`,
    trail.trailhead ? `Trailhead: ${trail.trailhead.name} (${trail.trailhead.lat.toFixed(5)}, ${trail.trailhead.lon.toFixed(5)})` : `Start: ${trail.line[0][0].toFixed(5)}, ${trail.line[0][1].toFixed(5)}`,
    trail.info.osm ? `Map: ${trail.info.osm}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `Trip plan: ${trail.name}`, text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* cancelled */
    }
  }
  return (
    <button type="button" className="hk-btn hk-btn--ghost" onClick={share} title="Send your plan to someone who'll notice if you don't come back">
      <Share2 size={16} /> {copied ? "Copied" : "Share trip plan"}
    </button>
  );
}

function OfflineCard({ trail, layer, update, data }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const ctl = useRef(null);
  useEffect(() => () => ctl.current?.abort(), []);
  const plan = useMemo(() => tilePlanFor(trail, layer), [trail, layer]);
  const supported = offlineSupported();

  async function save() {
    setError(null);
    ctl.current = new AbortController();
    setBusy({ done: 0, total: plan.tiles.length });
    try {
      const r = await saveOffline(trail, layer, (done, total) => setBusy({ done, total }), { signal: ctl.current.signal });
      update({ offline: { layer, tiles: r.tiles, maxZoom: r.maxZoom, at: new Date().toISOString() }, saved: true, savedAt: trail.savedAt || new Date().toISOString() });
      if (r.failed) setError(`${r.failed} map pieces didn't download. Try again on a better connection to fill them in.`);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    update({ offline: null });
    await pruneTiles(data.trails.filter(t => t.id !== trail.id)).catch(() => {});
  }

  return (
    <section className="hk-card hk-offline">
      <h2><CloudOff size={18} aria-hidden="true" /> Offline map</h2>
      {trail.offline ? (
        <>
          <p>
            <CheckCircle2 size={15} className="hk-ok" aria-hidden="true" /> Saved on this device: {LAYERS[trail.offline.layer]?.name ?? "map"} map, {trail.offline.tiles} pieces, zoom to level {trail.offline.maxZoom}. GPS and the compass work without signal.
          </p>
          <div className="hk-row">
            {trail.offline.layer !== layer && <button type="button" className="hk-btn hk-btn--ghost" onClick={save} disabled={Boolean(busy)}><Download size={15} /> Save {LAYERS[layer].name} too</button>}
            <button type="button" className="hk-link" onClick={remove}><Trash2 size={14} /> Remove offline map</button>
          </div>
        </>
      ) : supported ? (
        <>
          <p className="hk-muted">Save the {LAYERS[layer].name.toLowerCase()} map around this trail ({plan.tiles.length} pieces, about {Math.max(1, Math.round(plan.tiles.length * 0.025))} MB) so it works with no reception. Do this before you leave.</p>
          <button type="button" className="hk-btn" onClick={save} disabled={Boolean(busy)}>
            <Download size={16} /> Save for offline
          </button>
        </>
      ) : (
        <p className="hk-muted">This browser can't save maps for offline use. The trail line, profile and gear list are still saved.</p>
      )}
      {busy && (
        <div className="hk-progress" role="progressbar" aria-valuemin={0} aria-valuemax={busy.total} aria-valuenow={busy.done}>
          <span style={{ width: `${(busy.done / Math.max(1, busy.total)) * 100}%` }} />
          <small>{busy.done} of {busy.total}</small>
          <button type="button" className="hk-link" onClick={() => ctl.current?.abort()}>Cancel</button>
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      <p className="hk-fine">Tip: on the trail, airplane mode saves a lot of battery and GPS still works.</p>
      {trail.info.website && (
        <a className="hk-link" href={trail.info.website} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Check closures on the trail's website
        </a>
      )}
    </section>
  );
}
