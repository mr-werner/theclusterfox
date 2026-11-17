import { useMemo, useState } from "react";
import { BatteryMedium, Compass, Flag, LocateFixed, MapPin, Pause, Play, Square, Sun, TriangleAlert } from "lucide-react";

import { bearing, cardinal, cumulative, dist, locateOnLine } from "../model/geo";
import { minutesLeft, summarize } from "../model/profile";
import { defaultLayer } from "../model/tiles";
import { MODES, modeById, trackStats } from "../model/track";
import { duration } from "../state/hikeStore";
import { useCompass, useWakeLock } from "../state/useTracker";
import HikeMap from "./HikeMap";
import ProfileChart from "./ProfileChart";
import { ErrorNote, Stat } from "./ui";

const fmtClock = sec => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${String(m).padStart(2, "0")} h` : `${m} min`;
};

// On the trail: your position on the map and the profile, a compass that
// points back to the car (or anywhere you tap), and a battery-friendly
// track of where you've been.
export default function GoTab({ h, f, tracker, trailId }) {
  const { data } = h;
  const { active, me, gpsError } = tracker;
  const trail = data.trails.find(t => t.id === (active ? active.trailId : trailId)) ?? null;
  const [layer, setLayer] = useState(() => {
    const p = trail?.line[0] ?? (me ? [me.lat, me.lon] : null);
    return trail?.offline?.layer || (p ? defaultLayer(p[0], p[1]) : "otm");
  });
  const [follow, setFollow] = useState(true);
  const [target, setTarget] = useState("start");
  const [picked, setPicked] = useState(null);
  const [awake, setAwake] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const screenOn = useWakeLock(awake);

  if (!active) return <StartPanel h={h} f={f} tracker={tracker} trail={trail} />;

  const pts = active.points;
  const st = trackStats(pts);
  const elapsed = (active.pausedAt ?? Date.now() / 1000) - active.startedAt;
  const pos = me ? [me.lat, me.lon] : pts.length ? [pts[pts.length - 1][0], pts[pts.length - 1][1]] : null;

  return (
    <div className="hk-go">
      <div className="hk-go-grid">
        <div className="hk-go-map">
          <OnTrail trail={trail} pos={pos} f={f} pace={data.pace}>
            {({ lines: extra, here }) => (
              <>
                <HikeMap
                  layer={layer}
                  onLayer={setLayer}
                  fit={trail ? trail.line : pos ? [pos] : []}
                  fitKey={trail?.id ?? "free"}
                  lines={[...(trail ? [{ id: "plan", points: trail.line, className: "is-trail" }] : []), ...extra, { id: "track", points: pts, className: "is-track" }]}
                  markers={[
                    ...(trail?.trailhead ? [{ id: "th", lat: trail.trailhead.lat, lon: trail.trailhead.lon, kind: "trailhead", title: trail.trailhead.name }] : []),
                    ...(picked ? [{ id: "picked", lat: picked.lat, lon: picked.lon, kind: "target", title: "Your target" }] : []),
                  ]}
                  me={me ? { lat: me.lat, lon: me.lon, accuracy: me.accuracy, heading: me.heading } : null}
                  follow={follow}
                  onFollow={setFollow}
                  onPick={p => {
                    setPicked(p);
                    setTarget("picked");
                  }}
                  height={420}
                  label="Live map"
                />
                {trail && trail.profile.length > 1 && <ProfileChart trip={summarize(trail.profile, trail.shape, data.pace, trail.sac).trip} pois={trail.pois} f={f} here={here} height={130} />}
              </>
            )}
          </OnTrail>
        </div>

        <aside className="hk-go-side">
          <section className="hk-card hk-live">
            <div className="hk-live-head">
              <h2>{active.name}</h2>
              <span className={`hk-rec${active.pausedAt ? " is-paused" : ""}`}>{active.pausedAt ? "Paused" : modeById(active.mode).id === "manual" ? "Check-ins" : "Recording"}</span>
            </div>
            <div className="hk-stats hk-stats--live">
              <Stat label="Distance" value={f.dist(st.distance)} />
              <Stat label="Time" value={fmtClock(elapsed)} sub={`${fmtClock(st.moving)} moving`} />
              <Stat label="Climbed" value={f.ele(st.gain)} />
              <Stat label="Elevation" value={me && Number.isFinite(me.alt) ? f.ele(me.alt) : "—"} sub={me ? `±${Math.round(me.accuracy)} m GPS` : "no fix yet"} />
            </div>
            <ErrorNote>{gpsError}</ErrorNote>
            <OnTrail trail={trail} pos={pos} f={f} pace={data.pace}>
              {({ status }) => status}
            </OnTrail>
            <div className="hk-live-actions">
              <button type="button" className="hk-btn hk-btn--ghost" onClick={tracker.locate}>
                <LocateFixed size={16} /> Locate me
              </button>
              {active.pausedAt ? (
                <button type="button" className="hk-btn" onClick={tracker.resume}><Play size={16} /> Resume</button>
              ) : (
                <button type="button" className="hk-btn hk-btn--ghost" onClick={tracker.pause}><Pause size={16} /> Pause</button>
              )}
              {confirmEnd ? (
                <span className="hk-confirm">
                  <button type="button" className="hk-btn hk-btn--danger" onClick={() => { tracker.finish(); setConfirmEnd(false); }}><Flag size={16} /> Save hike</button>
                  <button type="button" className="hk-link" onClick={() => { tracker.discard(); setConfirmEnd(false); }}>Discard</button>
                  <button type="button" className="hk-link" onClick={() => setConfirmEnd(false)}>Keep going</button>
                </span>
              ) : (
                <button type="button" className="hk-btn hk-btn--ghost" onClick={() => setConfirmEnd(true)}><Square size={15} /> Finish</button>
              )}
            </div>
          </section>

          <CompassCard pos={pos} trail={trail} target={target} setTarget={setTarget} picked={picked} f={f} gpsHeading={me?.heading} />

          <section className="hk-card hk-battery">
            <h2><BatteryMedium size={18} aria-hidden="true" /> Battery</h2>
            <div className="hk-modes" role="radiogroup" aria-label="Tracking mode">
              {MODES.map(m => (
                <label key={m.id} className={active.mode === m.id ? "is-on" : ""}>
                  <input type="radio" name="hk-mode" checked={active.mode === m.id} onChange={() => tracker.setMode(m.id)} />
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.detail}</small>
                  </span>
                </label>
              ))}
            </div>
            <label className="hk-toggle">
              <input type="checkbox" checked={awake} onChange={e => setAwake(e.target.checked)} />
              <span>
                <Sun size={15} aria-hidden="true" /> Keep screen on{screenOn ? " (on)" : ""}
                <small>Uses more battery. Leave it off and glance when you need to.</small>
              </span>
            </label>
            <p className="hk-fine">Phones pause websites when the screen locks, so tracking fills in when you look again. Your track is saved on this device as you go.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** Where you are relative to the planned trail: off-route warnings, distance and time left. */
function OnTrail({ trail, pos, f, pace, children }) {
  const info = useMemo(() => {
    if (!trail || !pos) return null;
    const cum = cumulative(trail.line);
    const at = locateOnLine(trail.line, pos, cum);
    const s = summarize(trail.profile, trail.shape, pace, trail.sac);
    const oneWay = cum[cum.length - 1];
    const scale = (trail.profile[trail.profile.length - 1]?.[0] || oneWay) / oneWay;
    const along = at.along * scale;
    // Out and back: assume you're on the way out until you pass the far end.
    const tripAlong = along;
    const left = Math.max(0, s.distanceM - tripAlong);
    return { at, along, tripAlong, left, minutes: minutesLeft(s.trip, tripAlong, pace), total: s.distanceM };
  }, [trail, pos?.[0], pos?.[1], pace]); // eslint-disable-line react-hooks/exhaustive-deps

  let status = null;
  const lines = [];
  if (info) {
    if (info.at.off > 60) {
      lines.push({ id: "back", points: [pos, info.at.point], className: "is-back" });
      status = (
        <p className="hk-offroute" role="status">
          <TriangleAlert size={16} aria-hidden="true" /> You're {f.short(info.at.off)} off the trail. It's {cardinal(bearing(pos, info.at.point))} of you ({Math.round(bearing(pos, info.at.point))}°).
        </p>
      );
    } else {
      status = (
        <p className="hk-ontrail">
          On the trail · {f.dist(info.tripAlong)} done · {f.dist(info.left)} and about {duration(info.minutes)} to go
        </p>
      );
    }
  } else if (!trail) {
    status = <p className="hk-muted">Recording without a planned trail. Open a trail and tap Start hike to follow it.</p>;
  }
  return children({ lines, status, here: info ? info.tripAlong : null });
}

function CompassCard({ pos, trail, target, setTarget, picked, f, gpsHeading }) {
  const compass = useCompass(true);
  const start = trail ? (trail.trailhead ? [trail.trailhead.lat, trail.trailhead.lon] : trail.line[0]) : null;
  const end = trail ? trail.line[trail.line.length - 1] : null;
  const targets = [
    start && { id: "start", name: trail.trailhead ? "Trailhead" : "Start", p: start },
    end && trail.shape !== "loop" && { id: "end", name: trail.shape === "out-back" ? "Far end" : "Finish", p: end },
    picked && { id: "picked", name: "Map pin", p: [picked.lat, picked.lon] },
  ].filter(Boolean);
  const t = targets.find(x => x.id === target) ?? targets[0] ?? null;
  const heading = compass.heading ?? (Number.isFinite(gpsHeading) ? gpsHeading : null);
  const brg = t && pos ? bearing(pos, t.p) : null;
  const d = t && pos ? dist(pos, t.p) : null;
  const rose = heading ?? 0;

  return (
    <section className="hk-card hk-compass">
      <h2><Compass size={18} aria-hidden="true" /> Compass</h2>
      <div className="hk-compass-body">
        <svg viewBox="-110 -110 220 220" className="hk-rose" role="img" aria-label={heading === null ? "Compass (no heading sensor)" : `Heading ${Math.round(heading)} degrees`}>
          <g transform={`rotate(${-rose})`}>
            <circle r="100" className="hk-rose-ring" />
            {Array.from({ length: 72 }, (_, i) => (
              <line key={i} x1="0" y1={-100} x2="0" y2={i % 18 === 0 ? -84 : i % 2 === 0 ? -90 : -95} transform={`rotate(${i * 5})`} className="hk-rose-tick" />
            ))}
            {["N", "E", "S", "W"].map((c, i) => (
              <text key={c} x="0" y="-66" transform={`rotate(${i * 90})`} textAnchor="middle" dy="0.35em" className={`hk-rose-c${c === "N" ? " is-n" : ""}`}>{c}</text>
            ))}
            {brg !== null && (
              <g transform={`rotate(${brg})`}>
                <path d="M0 -98 L9 -78 L-9 -78 Z" className="hk-rose-target" />
              </g>
            )}
          </g>
          <path d="M0 -52 L12 18 L0 8 L-12 18 Z" className="hk-rose-needle" />
        </svg>
        <div className="hk-compass-read">
          <strong>{heading === null ? "—" : `${Math.round(heading)}° ${cardinal(heading)}`}</strong>
          <span>{compass.heading !== null ? "Your heading" : Number.isFinite(gpsHeading) ? "Heading from GPS (while moving)" : "No compass sensor: the ring is fixed with north up"}</span>
          {t && pos && (
            <p>
              <MapPin size={14} aria-hidden="true" /> {t.name}: <strong>{f.short(d)}</strong> at {Math.round(brg)}° {cardinal(brg)}
            </p>
          )}
          {!pos && <p className="hk-muted">Tap Locate me to point the way.</p>}
          {compass.state === "ask" && (
            <button type="button" className="hk-btn hk-btn--ghost" onClick={compass.request}>Turn on compass</button>
          )}
          {compass.state === "denied" && <p className="hk-muted">Compass access was declined. Reload the page to ask again.</p>}
        </div>
      </div>
      {targets.length > 1 && (
        <div className="hk-seg" role="group" aria-label="Point to">
          {targets.map(x => (
            <button key={x.id} type="button" className={t?.id === x.id ? "is-on" : ""} aria-pressed={t?.id === x.id} onClick={() => setTarget(x.id)}>{x.name}</button>
          ))}
        </div>
      )}
      <p className="hk-fine">Tap the map to point the compass anywhere. Phone compasses drift near metal and cars; hold it flat and away from your pack frame.</p>
    </section>
  );
}

function StartPanel({ h, f, tracker, trail }) {
  const { data } = h;
  const options = data.trails.filter(t => t.saved || t.plan || t.offline).concat(data.trails.filter(t => !(t.saved || t.plan || t.offline)));
  const [pick, setPick] = useState(trail?.id ?? options[0]?.id ?? "");
  const [mode, setMode] = useState(data.trackMode);
  const chosen = data.trails.find(t => t.id === pick) ?? null;
  return (
    <div className="hk-start">
      <section className="hk-card">
        <p className="hk-kicker">Start a hike</p>
        <h1>Track your hike</h1>
        <label className="hk-field">
          <span>Trail to follow</span>
          <select value={pick} onChange={e => setPick(e.target.value)}>
            <option value="">No trail, just record</option>
            {options.map(t => (
              <option key={t.id} value={t.id}>{t.name}{t.offline ? " (offline map)" : ""}</option>
            ))}
          </select>
        </label>
        {chosen && !chosen.offline && <p className="hk-warn"><TriangleAlert size={15} aria-hidden="true" /> This trail's map isn't saved for offline use. Open the trail and tap Save for offline before you lose signal.</p>}
        <div className="hk-modes" role="radiogroup" aria-label="Tracking mode">
          {MODES.map(m => (
            <label key={m.id} className={mode === m.id ? "is-on" : ""}>
              <input type="radio" name="hk-start-mode" checked={mode === m.id} onChange={() => setMode(m.id)} />
              <span>
                <strong>{m.name}</strong>
                <small>{m.detail}</small>
              </span>
            </label>
          ))}
        </div>
        <button type="button" className="hk-btn hk-btn--big" onClick={() => tracker.start(chosen, mode)}>
          <Play size={18} /> Start
        </button>
        <p className="hk-fine">Your location stays on this device. GPS works without cell signal; only the map pictures need saving ahead of time.</p>
      </section>
      {data.hikes.length > 0 && (
        <p className="hk-muted">
          Last hike: {data.hikes[0].name}, {f.dist(data.hikes[0].distance)} on {new Date(data.hikes[0].startedAt * 1000).toLocaleDateString()}.
        </p>
      )}
    </div>
  );
}
