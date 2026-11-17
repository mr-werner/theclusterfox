import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Pause, Play, RotateCcw } from "lucide-react";

import { FLAP_STEPS, SCENARIOS, coachHint, readout, scenarioById, step } from "../model/sim";
import { drawView } from "../model/simView";
import { SixPack } from "./Instruments";

const KEYS = [
  ["↓ / S", "Pull back: nose up"],
  ["↑ / W", "Push forward: nose down"],
  ["← → / A D", "Bank left or right (ailerons)"],
  ["Q / E", "Rudder left or right; steers on the ground"],
  ["+ / −", "More or less power"],
  ["F / R", "Flaps down or up a notch"],
  ["[ / ]", "Trim nose down or nose up"],
  ["B (hold)", "Brakes"],
  ["P", "Pause"],
];

function start(id) {
  const s = scenarioById(id).make();
  return { s, c: { elevator: 0, aileron: 0, rudder: 0, throttle: s.throttle, flaps: s.flaps, brakes: false } };
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, t, r, dt) => v + clamp(t - v, -r * dt, r * dt);

// A small flight simulator: fly a light trainer from the runway, in
// cruise, on final or through a stall, with a real instrument panel.
export default function SimTab() {
  const [scenarioId, setScenarioId] = useState("takeoff");
  const scenario = scenarioById(scenarioId);
  const [ui, setUi] = useState(() => start("takeoff"));
  const canvasRef = useRef(null);
  const simRef = useRef(ui.s);
  const ctlRef = useRef(ui.c);
  const keysRef = useRef(new Set());
  const padRef = useRef(null);
  const btnRef = useRef({ rudder: 0, brakes: false });
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  const reset = id => {
    const next = start(id);
    simRef.current = next.s;
    ctlRef.current = next.c;
    pausedRef.current = false;
    setPaused(false);
    setScenarioId(id);
    setUi(next);
  };

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  // Keyboard.
  useEffect(() => {
    const flightKeys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]);
    const down = e => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
      if (flightKeys.has(e.key)) e.preventDefault();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (e.repeat && ["f", "r", "p"].includes(k)) return;
      keysRef.current.add(k);
      const c = ctlRef.current;
      if (k === "f") c.flaps = FLAP_STEPS[Math.min(3, FLAP_STEPS.indexOf(c.flaps) + 1)] ?? 30;
      if (k === "r") c.flaps = FLAP_STEPS[Math.max(0, FLAP_STEPS.indexOf(c.flaps) - 1)] ?? 0;
      if (k === "p") togglePause();
    };
    const up = e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keysRef.current.delete(k);
    };
    const blur = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [togglePause]);

  // The loop: read controls, step the airplane, draw.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frame = 0;
    const tick = now => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const canvas = canvasRef.current;
      const s0 = simRef.current;
      if (!canvas || !s0) return;
      const keys = keysRef.current;
      const c = ctlRef.current;
      const has = (...ks) => ks.some(k => keys.has(k));
      if (!pausedRef.current && !document.hidden) {
        if (padRef.current) {
          c.elevator = padRef.current.y;
          c.aileron = padRef.current.x;
        } else {
          const pitchT = (has("ArrowDown", "s") ? 1 : 0) - (has("ArrowUp", "w") ? 1 : 0);
          const rollT = (has("ArrowRight", "d") ? 1 : 0) - (has("ArrowLeft", "a") ? 1 : 0);
          c.elevator = approach(c.elevator, pitchT, pitchT ? 1.6 : 4, dt);
          c.aileron = approach(c.aileron, rollT, rollT ? 3 : 5, dt);
        }
        const rudT = (has("e") ? 1 : 0) - (has("q") ? 1 : 0) || btnRef.current.rudder;
        c.rudder = approach(c.rudder, rudT, 4, dt);
        if (has("+", "=", "PageUp")) c.throttle = clamp(c.throttle + 0.5 * dt, 0, 1);
        if (has("-", "_", "PageDown")) c.throttle = clamp(c.throttle - 0.5 * dt, 0, 1);
        c.brakes = has("b") || btnRef.current.brakes;
        let s = s0;
        if (has("]")) s = { ...s, trim: clamp(s.trim + 2.5 * dt, -6, 14) };
        if (has("[")) s = { ...s, trim: clamp(s.trim - 2.5 * dt, -6, 14) };
        const sub = 4;
        for (let i = 0; i < sub; i += 1) s = step(s, c, dt / sub);
        simRef.current = s;
      }
      // Size the canvas to its box at the screen's pixel density.
      const box = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(box.width * ratio);
      const h = Math.round(box.height * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawView(ctx, simRef.current, box.width, box.height);
      frame += 1;
      if (frame % 3 === 0) setUi({ s: simRef.current, c: { ...c } });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { s, c } = ui;
  const r = readout(s);
  const warn = s?.warn;

  return (
    <div className="fy-stack">
      <section className="fy-card fy-sim-head">
        <div className="fy-row-between">
          <div>
            <p className="fy-kicker">Flight simulator</p>
            <h1>Fly a trainer</h1>
          </div>
          <div className="fy-quick">
            <button type="button" className="fy-btn is-small is-ghost" onClick={togglePause}>
              {paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}
            </button>
            <button type="button" className="fy-btn is-small is-ghost" onClick={() => reset(scenarioId)}>
              <RotateCcw size={14} /> Restart
            </button>
            <button type="button" className="fy-btn is-small is-ghost" aria-expanded={showKeys} onClick={() => setShowKeys(v => !v)}>
              <Keyboard size={14} /> Keys
            </button>
          </div>
        </div>
        <div className="fy-seg is-wrap" role="tablist" aria-label="Lesson">
          {SCENARIOS.map(sc => (
            <button key={sc.id} type="button" role="tab" aria-selected={sc.id === scenarioId} className={sc.id === scenarioId ? "is-on" : ""} onClick={() => reset(sc.id)}>
              {sc.name}
            </button>
          ))}
        </div>
        <p className="fy-muted">{scenario.blurb}</p>
        {showKeys && (
          <dl className="fy-keys">
            {KEYS.map(([k, v]) => (
              <div key={k}><dt className="fy-kbd">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}
      </section>

      <section className="fy-sim">
        <div className="fy-sim-view">
          <canvas ref={canvasRef} aria-label="View out of the windshield" role="img" />
          {r && (
            <div className="fy-sim-hud" aria-hidden="true">
              <span>{Math.round(r.kt)} KT</span>
              <span>{Math.round(r.alt).toLocaleString("en-US")} FT</span>
              <span>HDG {String(Math.round(r.heading) % 360 || 360).padStart(3, "0")}</span>
              <span>FLAPS {Math.round(s.flaps)}°</span>
              <span>PWR {Math.round(c.throttle * 100)}%</span>
            </div>
          )}
          {warn && <div className={`fy-sim-warn is-${warn}`} role="alert">{warn === "overspeed" ? "OVERSPEED" : warn === "stall" ? "STALL" : "STALL WARNING"}</div>}
          {paused && <div className="fy-sim-paused">Paused</div>}
          {s && <p className="fy-sim-coach" aria-live="polite">{coachHint(s, scenarioId)}</p>}
        </div>

        <div className="fy-sim-controls">
          <YokePad padRef={padRef} c={c} />
          <div className="fy-sim-side">
            <label className="fy-throttle">
              <span>Power {Math.round(c.throttle * 100)}%</span>
              <input
                type="range"
                className="fy-range"
                min="0"
                max="100"
                value={Math.round(c.throttle * 100)}
                onChange={e => {
                  ctlRef.current.throttle = Number(e.target.value) / 100;
                }}
                aria-label="Throttle"
              />
            </label>
            <div className="fy-sim-row">
              <span className="fy-muted">Flaps</span>
              <div className="fy-seg">
                {FLAP_STEPS.map(f => (
                  <button key={f} type="button" className={c.flaps === f ? "is-on" : ""} onClick={() => (ctlRef.current.flaps = f)}>
                    {f}°
                  </button>
                ))}
              </div>
            </div>
            <div className="fy-sim-row">
              <span className="fy-muted">Trim</span>
              <button type="button" className="fy-btn is-small is-ghost" onClick={() => simRef.current && (simRef.current = { ...simRef.current, trim: clamp(simRef.current.trim - 0.5, -6, 14) })}>Nose down</button>
              <button type="button" className="fy-btn is-small is-ghost" onClick={() => simRef.current && (simRef.current = { ...simRef.current, trim: clamp(simRef.current.trim + 0.5, -6, 14) })}>Nose up</button>
            </div>
            <div className="fy-sim-row">
              <span className="fy-muted">Rudder</span>
              <HoldButton label="Left" onHold={v => (btnRef.current.rudder = v ? -1 : 0)} />
              <HoldButton label="Right" onHold={v => (btnRef.current.rudder = v ? 1 : 0)} />
              <HoldButton label="Brakes" onHold={v => (btnRef.current.brakes = v)} />
            </div>
          </div>
        </div>
      </section>

      {r && (
        <section className="fy-card">
          <div className="fy-row-between">
            <h2>Instrument panel</h2>
            <span className="fy-muted fy-mono">AOA {r.aoa.toFixed(1)}°</span>
          </div>
          <SixPack s={r} compact />
        </section>
      )}

      <p className="fy-disclaimer">A simple simulator for learning how an airplane responds. It doesn't count toward training time and isn't a substitute for flying with an instructor.</p>
    </div>
  );
}

function HoldButton({ label, onHold }) {
  const start = e => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onHold(true);
  };
  const end = () => onHold(false);
  return (
    <button type="button" className="fy-btn is-small is-ghost fy-hold" onPointerDown={start} onPointerUp={end} onPointerCancel={end} onContextMenu={e => e.preventDefault()}>
      {label}
    </button>
  );
}

// Drag the knob like a control yoke: left and right bank, down pulls back
// (nose up), up pushes forward. Let go and it springs back to center.
function YokePad({ padRef, c }) {
  const boxRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const move = e => {
    const box = boxRef.current.getBoundingClientRect();
    const x = clamp(((e.clientX - box.left) / box.width) * 2 - 1, -1, 1);
    const y = clamp(((e.clientY - box.top) / box.height) * 2 - 1, -1, 1);
    padRef.current = { x, y };
  };
  const end = () => {
    padRef.current = null;
    setDragging(false);
  };
  const kx = (c.aileron + 1) * 50;
  const ky = (c.elevator + 1) * 50;
  return (
    <div
      ref={boxRef}
      className={`fy-yoke${dragging ? " is-on" : ""}`}
      role="application"
      aria-label="Control yoke: drag left or right to bank, down to raise the nose, up to lower it"
      onPointerDown={e => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        move(e);
      }}
      onPointerMove={e => dragging && move(e)}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <span className="fy-yoke-label is-top">Nose down</span>
      <span className="fy-yoke-label is-bottom">Nose up</span>
      <span className="fy-yoke-label is-left">Left</span>
      <span className="fy-yoke-label is-right">Right</span>
      <span className="fy-yoke-knob" style={{ left: `${kx}%`, top: `${ky}%` }} />
    </div>
  );
}
