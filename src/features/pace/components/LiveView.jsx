import { useState } from "react";
import { BatteryLow, Check, Pause, Play, SkipForward, Square, Sun, Trash2, Volume2, VolumeX } from "lucide-react";

import { fmtClock, fmtDistance, fmtRate, M_PER_MI } from "../model/units";
import { routePath } from "../model/geo";
import { gapNote } from "../model/live";
import { ZONES } from "../model/zones";
import Sensors from "./Sensors";
import { SessionShape, ZoneChip } from "./ui";

function Route({ points }) {
  const r = routePath(points, 320, 180);
  if (!r) return <div className="pc-route is-empty">Your route draws here once GPS has a fix.</div>;
  return (
    <svg className="pc-route" viewBox="0 0 320 180" role="img" aria-label="Your route so far">
      <path d={r.d} />
      <circle cx={r.start[0]} cy={r.start[1]} r="5" className="is-start" />
      <circle cx={r.end[0]} cy={r.end[1]} r="6" className="is-end" />
    </svg>
  );
}

const VERDICT = { ok: "On target", fast: "Ease off", slow: "Pick it up" };

/** The big number for the current step: time left, meters left, or time so far. */
const stepClock = (at, metersLeft) => (at.done ? "Done!" : at.step.meters ? (metersLeft != null ? `${Math.ceil(metersLeft)} m` : `${at.step.meters} m`) : at.left != null ? fmtClock(Math.ceil(at.left)) : fmtClock(at.into));
const stepLen = s => (s.open ? "" : s.meters ? `· ${s.meters} m` : `· ${fmtClock(s.sec)}`);

function FinishSheet({ live, recorder, store, onSaved, onClose }) {
  const { data, addActivity } = store;
  const [title, setTitle] = useState(live.title);
  const [rpe, setRpe] = useState(null);
  const [notes, setNotes] = useState("");
  const indoorNoDistance = live.mode === "indoor" && !live.meters;
  const [manual, setManual] = useState("");
  const unit = data.prefs.unit;
  const sec = recorder.sec;

  function save() {
    let manualMeters = null;
    if (indoorNoDistance && manual) {
      const n = parseFloat(manual);
      if (n > 0) manualMeters = live.sport === "row" ? n : n * (unit === "km" ? 1000 : M_PER_MI);
    }
    const out = recorder.finish({ title, rpe, notes, manualMeters });
    if (!out) return;
    const saved = addActivity(out.activity, out.track);
    recorder.clear();
    onSaved(saved);
  }

  return (
    <div className="pc-sheet" role="dialog" aria-modal="true" aria-label="Finish workout">
      <div className="pc-sheet-body">
        <h2>Nice work</h2>
        <div className="pc-summary">
          <div>
            <strong>{fmtClock(sec)}</strong>
            <span>time</span>
          </div>
          <div>
            <strong>{live.meters ? fmtDistance(live.meters, live.sport === "row" ? "m" : unit) : "–"}</strong>
            <span>distance</span>
          </div>
          {live.hr.n > 0 && (
            <div>
              <strong>{Math.round(live.hr.sum / live.hr.n)}</strong>
              <span>avg bpm</span>
            </div>
          )}
          {live.power.n > 0 && (
            <div>
              <strong>{Math.round(live.power.sum / live.power.n)} W</strong>
              <span>avg power</span>
            </div>
          )}
        </div>
        {gapNote(live.gapSec) && <p className="pc-hint">{gapNote(live.gapSec)}</p>}
        <label className="pc-field">
          Title
          <input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} />
        </label>
        {indoorNoDistance && (
          <label className="pc-field">
            Distance from the machine ({live.sport === "row" ? "meters" : unit})
            <input type="number" inputMode="decimal" min={0} step="any" value={manual} onChange={e => setManual(e.target.value)} placeholder="optional" />
          </label>
        )}
        <p className="pc-label">How hard was it? (1 easy … 10 all out)</p>
        <div className="pc-rpe" role="radiogroup" aria-label="Effort">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button key={n} type="button" role="radio" aria-checked={rpe === n} className={`${rpe === n ? "is-on" : ""} r${n}`} onClick={() => setRpe(n)}>
              {n}
            </button>
          ))}
        </div>
        <label className="pc-field">
          Notes
          <textarea rows={2} maxLength={600} value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it feel? Weather, shoes, route…" />
        </label>
        <div className="pc-actions">
          <button type="button" className="pc-btn" onClick={save}>
            <Check size={17} /> Save workout
          </button>
          <button type="button" className="pc-btn pc-btn-quiet" onClick={onClose}>
            Keep going
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-quiet pc-danger"
            onClick={() => {
              if (window.confirm("Throw this workout away?")) recorder.clear();
            }}
          >
            <Trash2 size={16} /> Discard
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Battery saver: a true black screen with a few dim numbers. On OLED phones
 * black pixels are switched off, so this draws far less power than the
 * normal live view. No gradients, colors, route or animation.
 */
function SaverView({ live, sec, at, metersLeft, speed, unit, hr, paused, onPause, onResume, onFinish, onExit }) {
  return (
    <div className="pc-saver" role="region" aria-label="Battery saver screen">
      <p className="pc-saver-state">{paused ? "Paused" : live.title}</p>
      <strong className="pc-saver-clock">{fmtClock(sec)}</strong>
      <div className="pc-saver-row">
        <div>
          <strong>{live.meters ? fmtDistance(live.meters, live.sport === "row" ? "m" : unit) : "0"}</strong>
          <span>distance</span>
        </div>
        <div>
          <strong>{speed ? fmtRate(live.sport, speed, unit) : "–"}</strong>
          <span>{live.sport === "row" ? "split" : live.sport === "ride" ? "speed" : "pace"}</span>
        </div>
        {hr != null && (
          <div>
            <strong>{hr}</strong>
            <span>bpm</span>
          </div>
        )}
      </div>
      {at && (
        <p className="pc-saver-step">
          {at.done ? "Session done" : `${at.step.label}${at.step.rep && at.step.kind === "work" ? ` ${at.step.rep[0]}/${at.step.rep[1]}` : ""} · ${stepClock(at, metersLeft)}`}
        </p>
      )}
      <div className="pc-saver-controls">
        {paused ? (
          <button type="button" onClick={onResume}>
            <Play size={18} /> Resume
          </button>
        ) : (
          <button type="button" onClick={onPause}>
            <Pause size={18} /> Pause
          </button>
        )}
        <button type="button" onClick={onFinish}>
          <Square size={16} /> Finish
        </button>
        <button type="button" onClick={onExit} aria-pressed="true">
          <BatteryLow size={16} /> Saver off
        </button>
      </div>
    </div>
  );
}

/** The screen you look at while training. Big numbers, big buttons. */
export default function LiveView({ store, recorder, sensors, onSaved }) {
  const { data, setPrefs } = store;
  const { live, sec, at, metersLeft, speed, target, verdict, gps, awake } = recorder;
  const [finishing, setFinishing] = useState(false);
  const unit = data.prefs.unit;
  const v = sensors.values;
  const paused = live.status === "paused";
  const avg = sec > 0 && live.meters > 0 ? live.meters / sec : null;
  const total = live.steps?.reduce((n, s) => n + s.sec, 0) ?? 0;
  const saver = data.prefs.batterySaver;
  const finish = () => {
    if (!paused) recorder.pause();
    setFinishing(true);
  };
  const finishSheet = finishing && (
    <FinishSheet
      live={live}
      recorder={recorder}
      store={store}
      onSaved={a => {
        setFinishing(false);
        onSaved(a);
      }}
      onClose={() => {
        setFinishing(false);
        recorder.resume();
      }}
    />
  );

  if (saver) {
    return (
      <>
        <SaverView
          live={live}
          sec={sec}
          at={at}
          metersLeft={metersLeft}
          speed={speed}
          unit={unit}
          hr={v.hr}
          paused={paused}
          onPause={recorder.pause}
          onResume={recorder.resume}
          onFinish={finish}
          onExit={() => setPrefs({ batterySaver: false })}
        />
        {finishSheet}
      </>
    );
  }

  const metric = (label, value, sub) => (
    <div className="pc-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );

  return (
    <div className={`pc-live${paused ? " is-paused" : ""}`}>
      <div className="pc-live-status">
        {live.mode === "gps" && (
          <span className={`pc-pill is-${gps.status}`}>
            GPS {gps.status === "ok" ? `±${gps.acc} m` : gps.status === "weak" ? `weak (±${gps.acc} m)` : gps.status === "denied" ? "blocked" : "searching…"}
          </span>
        )}
        {live.mode === "indoor" && <span className="pc-pill">Indoors</span>}
        <span className={`pc-pill${awake ? " is-ok" : ""}`}>
          <Sun size={13} aria-hidden="true" /> {awake ? "Screen stays on" : "Keep screen on"}
        </span>
        <button type="button" className="pc-pill is-button" onClick={() => setPrefs({ voice: !data.prefs.voice })} aria-pressed={data.prefs.voice}>
          {data.prefs.voice ? <Volume2 size={13} /> : <VolumeX size={13} />} Voice {data.prefs.voice ? "on" : "off"}
        </button>
        <button type="button" className="pc-pill is-button" onClick={() => setPrefs({ batterySaver: true })} aria-pressed="false">
          <BatteryLow size={13} aria-hidden="true" /> Battery saver
        </button>
      </div>
      {gps.error && gps.status !== "ok" && <p className="pc-warn">{gps.error}</p>}

      <div className="pc-clock" aria-live="off">
        <span>{paused ? "Paused" : live.title}</span>
        <strong>{fmtClock(sec)}</strong>
      </div>

      <div className="pc-metrics">
        {metric("Distance", live.meters ? fmtDistance(live.meters, live.sport === "row" ? "m" : unit) : "0", live.mode === "indoor" && !live.meters ? "connect a machine, or enter it at the end" : null)}
        {metric(live.sport === "row" ? "Split" : live.sport === "ride" ? "Speed" : "Pace", speed ? fmtRate(live.sport, speed, unit) : v.split ? fmtRate("row", 500 / v.split, unit) : "–", avg ? `avg ${fmtRate(live.sport, avg, unit)}` : null)}
        {v.hr != null && metric("Heart rate", `${v.hr}`, live.hr.n ? `avg ${Math.round(live.hr.sum / live.hr.n)} bpm` : "bpm")}
        {v.power != null && metric("Power", `${v.power} W`, live.power.n ? `avg ${Math.round(live.power.sum / live.power.n)} W` : null)}
        {v.cadence != null && metric("Cadence", `${Math.round(v.cadence)}`, "rpm")}
        {v.strokeRate != null && metric("Stroke rate", `${Math.round(v.strokeRate)}`, "spm")}
      </div>

      {at && (
        <section className={`pc-now is-${at.step.kind} pc-z${at.step.zone}-edge`}>
          <div className="pc-now-head">
            <ZoneChip zone={at.step.zone} />
            <strong>
              {at.step.label}
              {at.step.rep && at.step.kind === "work" ? ` ${at.step.rep[0]} of ${at.step.rep[1]}` : ""}
            </strong>
            {verdict && <span className={`pc-verdict is-${verdict}`}>{VERDICT[verdict]}</span>}
          </div>
          <div className="pc-now-time">{stepClock(at, metersLeft)}</div>
          {at.step.meters && !at.done && <p className="pc-now-sub">to go · {fmtClock(at.into)} in</p>}
          {at.step.estimated && <p className="pc-now-sub">Timed from your usual split, since nothing is measuring distance</p>}
          <p className="pc-now-target">{target?.target ?? target?.hr ?? ZONES[at.step.zone]?.feel}{target?.rate ? ` · ${target.rate}` : ""}</p>
          {at.step.cue && <p className="pc-now-cue">{at.step.cue}</p>}
          {at.next && (
            <p className="pc-now-next">
              Next: {at.next.label} {stepLen(at.next)}
            </p>
          )}
          <SessionShape steps={live.steps} activeIndex={at.index} progress={total ? sec / total : null} />
        </section>
      )}

      {live.mode === "gps" && <Route points={live.points} />}

      <div className="pc-controls">
        {paused ? (
          <button type="button" className="pc-btn pc-btn-go" onClick={recorder.resume}>
            <Play size={22} /> Resume
          </button>
        ) : (
          <button type="button" className="pc-btn pc-btn-pause" onClick={recorder.pause}>
            <Pause size={22} /> Pause
          </button>
        )}
        {at && !at.done && (at.left != null || at.step.meters) && (
          <button type="button" className="pc-btn pc-btn-quiet" onClick={recorder.skipStep}>
            <SkipForward size={18} /> Skip step
          </button>
        )}
        <button
          type="button"
          className="pc-btn pc-btn-stop"
          onClick={finish}
        >
          <Square size={18} /> Finish
        </button>
      </div>

      <details className="pc-notes">
        <summary>Sensors</summary>
        <Sensors sensors={sensors} sport={live.sport} compact />
      </details>

      {finishSheet}
    </div>
  );
}

