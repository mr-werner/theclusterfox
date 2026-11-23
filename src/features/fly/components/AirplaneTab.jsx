import { useEffect, useMemo, useRef, useState } from "react";
import { Gauge, Move3d, RotateCcw, Scale, Wind } from "lucide-react";

import { KT, PLANE, FT, liftCoefficient, stallSpeedKt, step, trimAlphaDeg, readout, levelThrottle } from "../model/sim";
import { SixPack } from "./Instruments";

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const SECTIONS = [
  { id: "controls", name: "Controls", icon: Move3d },
  { id: "lift", name: "Lift & AoA", icon: Wind },
  { id: "forces", name: "Forces & turns", icon: Scale },
  { id: "instruments", name: "Instruments", icon: Gauge },
];

// How an airplane flies, as diagrams you can play with: the controls and
// the three axes, lift and angle of attack, the four forces and turns, and
// the instruments (with the failures the tests ask about).
export default function AirplaneTab({ section, go }) {
  const id = SECTIONS.some(s => s.id === section) ? section : "controls";
  return (
    <div className="fy-stack">
      <section className="fy-card fy-hero">
        <div className="fy-hero-text">
          <p className="fy-kicker">How airplanes fly</p>
          <h1>Play with the airplane</h1>
          <p>Move the controls and watch what they do. Every diagram here runs on the same flight model as the simulator.</p>
        </div>
      </section>
      <div className="fy-seg is-wide" role="tablist" aria-label="Diagram">
        {SECTIONS.map(s => {
          const Icon = s.icon;
          return (
            <button key={s.id} type="button" role="tab" aria-selected={s.id === id} className={s.id === id ? "is-on" : ""} onClick={() => go({ tab: "airplane", section: s.id })}>
              <Icon size={15} aria-hidden="true" /> {s.name}
            </button>
          );
        })}
      </div>
      {id === "controls" && <ControlsDiagram />}
      {id === "lift" && <LiftDiagram />}
      {id === "forces" && <ForcesDiagram />}
      {id === "instruments" && <InstrumentsDiagram />}
    </div>
  );
}

function Slider({ label, value, min, max, step: st = 1, onChange, left, right, format }) {
  return (
    <label className="fy-slider">
      <span className="fy-row-between">
        <span>{label}</span>
        <strong className="fy-mono">{format ? format(value) : value}</strong>
      </span>
      <input type="range" className="fy-range" min={min} max={max} step={st} value={value} onChange={e => onChange(Number(e.target.value))} />
      {(left || right) && (
        <span className="fy-row-between fy-slider-ends">
          <span>{left}</span>
          <span>{right}</span>
        </span>
      )}
    </label>
  );
}

function useAnimation(fn) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ref.current(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/* ───────────── Controls and the three axes ───────────── */

const AIL = "#ffb547";
const ELE = "#d64aa6";
const RUD = "#3cc46e";

function ControlsDiagram() {
  const [roll, setRoll] = useState(0); // yoke left/right, -1..1
  const [pitch, setPitch] = useState(0); // yoke back (+) / forward (-)
  const [yaw, setYaw] = useState(0); // pedals
  const [att, setAtt] = useState({ bank: 0, pitch: 0, heading: 0 });

  useAnimation(
    dt => {
      setAtt(a => {
        const bank = clamp(a.bank + roll * 30 * dt + yaw * 4 * dt, -60, 60);
        const p = a.pitch + clamp(pitch * 15 - a.pitch, -20 * dt, 20 * dt);
        const heading = (a.heading + (yaw * 8 + bank * 0.25 - roll * 3) * dt + 360) % 360;
        if (bank === a.bank && p === a.pitch && heading === a.heading) return a;
        return { bank, pitch: p, heading };
      });
    }
  );

  const reset = () => {
    setRoll(0);
    setPitch(0);
    setYaw(0);
    setAtt({ bank: 0, pitch: 0, heading: 0 });
  };

  const notes = [
    {
      color: AIL,
      title: "Ailerons: roll",
      on: Math.abs(roll) > 0.05,
      text:
        Math.abs(roll) <= 0.05
          ? "Turn the yoke. The ailerons on the outer back edge of each wing move in opposite directions."
          : `Yoke ${roll > 0 ? "right" : "left"}: the ${roll > 0 ? "right" : "left"} aileron goes up and the ${roll > 0 ? "left" : "right"} goes down. The ${roll > 0 ? "left" : "right"} wing makes more lift and rises, so the airplane rolls ${roll > 0 ? "right" : "left"} around its longitudinal axis (nose to tail). The lowered aileron also makes more drag, which pulls the nose the wrong way: that's adverse yaw, and a little ${roll > 0 ? "right" : "left"} rudder fixes it.`,
    },
    {
      color: ELE,
      title: "Elevator: pitch",
      on: Math.abs(pitch) > 0.05,
      text:
        Math.abs(pitch) <= 0.05
          ? "Push or pull the yoke. The elevator on the back of the horizontal tail moves up or down."
          : pitch > 0
            ? "Yoke back: the elevator goes up, the tail is pushed down and the nose comes up. That's pitch around the lateral axis (wingtip to wingtip). More precisely, it raises the angle of attack."
            : "Yoke forward: the elevator goes down, the tail rises and the nose goes down, lowering the angle of attack.",
    },
    {
      color: RUD,
      title: "Rudder: yaw",
      on: Math.abs(yaw) > 0.05,
      text:
        Math.abs(yaw) <= 0.05
          ? "Press a pedal. The rudder on the back of the fin swings left or right."
          : `${yaw > 0 ? "Right" : "Left"} pedal: the rudder swings ${yaw > 0 ? "right" : "left"}, the tail is pushed the other way and the nose yaws ${yaw > 0 ? "right" : "left"} around the vertical axis. In the air the rudder keeps turns coordinated; on the ground the pedals steer.`,
    },
  ];

  return (
    <section className="fy-card">
      <div className="fy-row-between">
        <h2>Controls and the three axes</h2>
        <button type="button" className="fy-btn is-small is-ghost" onClick={reset}><RotateCcw size={14} /> Center and level</button>
      </div>
      <div className="fy-views">
        <figure>
          <RearView roll={roll} pitch={pitch} yaw={yaw} bank={att.bank} />
          <figcaption>From behind: roll · bank {Math.round(Math.abs(att.bank))}° {att.bank > 0.5 ? "right" : att.bank < -0.5 ? "left" : ""}</figcaption>
        </figure>
        <figure>
          <SideView pitch={pitch} attitude={att.pitch} />
          <figcaption>From the side: pitch · nose {Math.round(Math.abs(att.pitch))}° {att.pitch > 0.5 ? "up" : att.pitch < -0.5 ? "down" : ""}</figcaption>
        </figure>
        <figure>
          <TopView roll={roll} yaw={yaw} heading={att.heading} />
          <figcaption>From above: yaw · heading {String(Math.round(att.heading) || 360).padStart(3, "0")}</figcaption>
        </figure>
      </div>
      <div className="fy-two">
        <div className="fy-stack is-tight">
          <Slider label="Yoke: turn" value={roll} min={-1} max={1} step={0.05} onChange={setRoll} left="Left" right="Right" format={v => (v === 0 ? "center" : `${Math.round(Math.abs(v) * 100)}% ${v > 0 ? "right" : "left"}`)} />
          <Slider label="Yoke: push or pull" value={pitch} min={-1} max={1} step={0.05} onChange={setPitch} left="Push (nose down)" right="Pull (nose up)" format={v => (v === 0 ? "center" : `${Math.round(Math.abs(v) * 100)}% ${v > 0 ? "back" : "forward"}`)} />
          <Slider label="Rudder pedals" value={yaw} min={-1} max={1} step={0.05} onChange={setYaw} left="Left pedal" right="Right pedal" format={v => (v === 0 ? "even" : `${Math.round(Math.abs(v) * 100)}% ${v > 0 ? "right" : "left"}`)} />
        </div>
        <ul className="fy-explain">
          {notes.map(n => (
            <li key={n.title} className={n.on ? "is-on" : ""}>
              <strong style={{ color: n.color }}>{n.title}</strong>
              <p>{n.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RearView({ roll, pitch, yaw, bank }) {
  const a = roll * 10; // aileron offset in px
  const e = pitch * 8;
  const r = yaw * 10;
  return (
    <svg viewBox="-170 -110 340 200" className="fy-diagram" role="img" aria-label="Airplane seen from behind">
      <line x1="-170" y1="70" x2="170" y2="70" className="fy-dg-horizon" />
      <g transform={`rotate(${bank})`}>
        {/* Vertical fin and rudder */}
        <path d="M-4 -10 L-3 -78 L3 -78 L4 -10 Z" className="fy-dg-body" />
        <path d={`M-3 -76 L${-2 + r} -76 L${-2 + r * 1.1} -30 L-3 -30 Z`} fill={RUD} opacity={Math.abs(yaw) > 0.05 ? 1 : 0.5} transform={`translate(${r * 0.2} 0)`} />
        {/* Horizontal tail and elevator */}
        <rect x="-58" y="-26" width="116" height="5" rx="2" className="fy-dg-body" />
        <rect x="-56" y={-24 - e} width="46" height="4" rx="1.5" fill={ELE} opacity={Math.abs(pitch) > 0.05 ? 1 : 0.5} />
        <rect x="10" y={-24 - e} width="46" height="4" rx="1.5" fill={ELE} opacity={Math.abs(pitch) > 0.05 ? 1 : 0.5} />
        {/* Wings and ailerons */}
        <path d="M-160 -2 L160 -2 L160 5 L-160 5 Z" className="fy-dg-body" />
        <rect x="-158" y={-1 + a} width="62" height="5" rx="1.5" fill={AIL} opacity={Math.abs(roll) > 0.05 ? 1 : 0.5} />
        <rect x="96" y={-1 - a} width="62" height="5" rx="1.5" fill={AIL} opacity={Math.abs(roll) > 0.05 ? 1 : 0.5} />
        {/* Fuselage */}
        <ellipse cx="0" cy="8" rx="18" ry="20" className="fy-dg-body is-dark" />
        <line x1="-14" y1="26" x2="-30" y2="52" className="fy-dg-gear" />
        <line x1="14" y1="26" x2="30" y2="52" className="fy-dg-gear" />
        <circle cx="-30" cy="55" r="6" className="fy-dg-wheel" />
        <circle cx="30" cy="55" r="6" className="fy-dg-wheel" />
        <line x1="-168" y1="0" x2="168" y2="0" className="fy-dg-axis" />
      </g>
      <text x="-160" y="-92" className="fy-dg-label">Longitudinal axis runs into the page</text>
    </svg>
  );
}

function SideView({ pitch, attitude }) {
  const e = -pitch * 22; // elevator angle, trailing edge up when pulling
  return (
    <svg viewBox="-170 -110 340 200" className="fy-diagram" role="img" aria-label="Airplane seen from the side">
      <line x1="-170" y1="70" x2="170" y2="70" className="fy-dg-horizon" />
      <g transform={`rotate(${-attitude})`}>
        <line x1="-168" y1="0" x2="168" y2="0" className="fy-dg-axis" strokeDasharray="4 5" />
        {/* Fuselage, nose to the right */}
        <path d="M130 -2 C128 -18 110 -22 80 -24 L40 -30 L10 -30 L-120 -10 L-140 -12 L-140 4 L-110 6 L70 14 C110 14 128 10 130 -2 Z" className="fy-dg-body is-dark" />
        <path d="M40 -30 L52 -24 L20 -24 L10 -30 Z" fill="#8fc3ff" opacity="0.7" />
        {/* Fin */}
        <path d="M-110 -12 L-138 -62 L-150 -62 L-140 -12 Z" className="fy-dg-body" />
        {/* Wing (seen edge on) */}
        <path d="M60 -30 C50 -36 0 -36 -10 -31 L60 -27 Z" className="fy-dg-body" />
        {/* Horizontal tail with elevator hinged at -150 */}
        <path d="M-118 -6 L-150 -6 L-150 -1 L-118 -2 Z" className="fy-dg-body" />
        <g transform={`rotate(${e} -150 -3.5)`}>
          <path d="M-150 -6 L-172 -4 L-172 -3 L-150 -1 Z" fill={ELE} opacity={Math.abs(pitch) > 0.05 ? 1 : 0.6} />
        </g>
        {/* Gear and prop */}
        <line x1="40" y1="12" x2="44" y2="40" className="fy-dg-gear" />
        <circle cx="44" cy="44" r="6" className="fy-dg-wheel" />
        <line x1="112" y1="12" x2="112" y2="40" className="fy-dg-gear" />
        <circle cx="112" cy="44" r="5" className="fy-dg-wheel" />
        <line x1="133" y1="-30" x2="133" y2="26" stroke="#c8ced8" strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="-12" r="4" fill="#fff" />
      </g>
      <text x="-160" y="-92" className="fy-dg-label">Lateral axis runs into the page at the dot</text>
    </svg>
  );
}

function TopView({ roll, yaw, heading }) {
  const r = yaw * 22;
  return (
    <svg viewBox="-120 -120 240 240" className="fy-diagram is-square" role="img" aria-label="Airplane seen from above">
      <circle r="112" className="fy-dg-compass" />
      {["N", "E", "S", "W"].map((l, i) => (
        <text key={l} x={Math.sin((i * Math.PI) / 2) * 100} y={-Math.cos((i * Math.PI) / 2) * 100 + 5} className="fy-dg-label is-center">{l}</text>
      ))}
      <g transform={`rotate(${heading})`}>
        <line x1="0" y1="-100" x2="0" y2="100" className="fy-dg-axis" strokeDasharray="4 5" />
        {/* Wing with ailerons shaded by direction */}
        <path d="M-95 -18 L95 -18 L95 2 L-95 2 Z" className="fy-dg-body" />
        <rect x="-93" y="-4" width="38" height="6" fill={AIL} opacity={Math.abs(roll) > 0.05 ? (roll < 0 ? 1 : 0.55) : 0.4} />
        <rect x="55" y="-4" width="38" height="6" fill={AIL} opacity={Math.abs(roll) > 0.05 ? (roll > 0 ? 1 : 0.55) : 0.4} />
        {Math.abs(roll) > 0.05 && (
          <>
            <text x={-74} y={18} className="fy-dg-label is-center">{roll < 0 ? "up" : "down"}</text>
            <text x={74} y={18} className="fy-dg-label is-center">{roll > 0 ? "up" : "down"}</text>
          </>
        )}
        {/* Fuselage */}
        <path d="M0 -62 C8 -60 10 -40 10 -20 L6 60 L-6 60 L-10 -20 C-10 -40 -8 -60 0 -62 Z" className="fy-dg-body is-dark" />
        <path d="M-34 52 L34 52 L34 62 L-34 62 Z" className="fy-dg-body" />
        {/* Rudder at the tail, seen from above */}
        <line x1="0" y1="58" x2={Math.sin(r * D2R) * 18} y2={58 + Math.cos(r * D2R) * 18} stroke={RUD} strokeWidth="5" strokeLinecap="round" opacity={Math.abs(yaw) > 0.05 ? 1 : 0.6} />
        <line x1="-24" y1="-64" x2="24" y2="-64" stroke="#c8ced8" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ───────────── Lift and angle of attack ───────────── */

function LiftDiagram() {
  const [aoa, setAoa] = useState(4);
  const [kt, setKt] = useState(90);
  const [flaps, setFlaps] = useState(0);
  const cl = liftCoefficient(aoa * D2R, flaps);
  const q = 0.5 * 1.225 * (kt * KT) ** 2;
  const lift = q * PLANE.wing * cl;
  const weight = PLANE.mass * 9.81;
  const pct = Math.round((lift / weight) * 100);
  const stalled = aoa * D2R > PLANE.stallAlpha;
  const cd = PLANE.cd0 + flaps * PLANE.flapCd + PLANE.k * cl * cl + (stalled ? 0.25 : 0);
  const drag = q * PLANE.wing * cd;
  const vs = stallSpeedKt(flaps);
  const liftLen = clamp((lift / weight) * 45, 4, 92);
  const dragLen = clamp((drag / weight) * 45 * 3, 3, 110);

  // Streamlines bend around the wing; past the stall they break up on top.
  const lines = [-48, -32, -18, 18, 32, 48];
  const flow = lines.map(y0 => {
    const pts = [];
    for (let x = -170; x <= 170; x += 10) {
      const near = Math.exp(-((x + 10) ** 2) / 9000);
      const bend = y0 < 0 ? -(aoa * 1.4) * near * (1 - Math.abs(y0) / 70) : -(aoa * 0.9) * near * (1 - Math.abs(y0) / 70);
      let y = y0 + bend + (y0 < 0 ? -4 : 3) * near;
      if (stalled && y0 < 0 && x > 0) y += Math.sin(x / 9 + y0) * (aoa - 15) * 0.9 * (x / 170);
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  });

  return (
    <section className="fy-card">
      <h2>Lift and angle of attack</h2>
      <svg viewBox="-180 -110 360 200" className="fy-diagram is-wide" role="img" aria-label={`Wing at ${aoa} degrees angle of attack, ${stalled ? "stalled" : "flying"}`}>
        <g>
          {flow.map((p, i) => (
            <polyline key={i} points={p} className={`fy-dg-flow${stalled && lines[i] < 0 ? " is-broken" : ""}`} />
          ))}
        </g>
        <text x="-172" y="-90" className="fy-dg-label">Relative wind →</text>
        <g transform={`rotate(${aoa} -10 0)`}>
          {/* Airfoil, chord from -70 to 60 */}
          <path d={`M-70 0 C-70 -12 -40 -18 -10 -16 C20 -14 45 -6 60 0 C40 2 0 5 -40 5 C-60 5 -70 3 -70 0 Z`} className="fy-dg-body" />
          {flaps > 0 && <path d="M50 1 L82 7 L80 10 L48 4 Z" className="fy-dg-body" transform={`rotate(${flaps * 0.9} 50 2)`} />}
          <line x1="-100" y1="0" x2="100" y2="0" className="fy-dg-axis" strokeDasharray="4 4" />
          <text x="62" y="16" className="fy-dg-label">chord line</text>
        </g>
        <line x1="-120" y1="0" x2="110" y2="0" className="fy-dg-axis" />
        <path d={`M-90 0 A80 80 0 0 ${aoa >= 0 ? 1 : 0} ${-10 - 80 * Math.cos(aoa * D2R)} ${-80 * Math.sin(aoa * D2R)}`} fill="none" stroke="#ffb547" strokeWidth="2" />
        <text x="-150" y={aoa >= 0 ? -Math.max(14, aoa * 2.2) : 16} className="fy-dg-label" fill="#ffb547">α {aoa}°</text>
        {/* Lift (up) and drag (back) */}
        <line x1="-10" y1="-8" x2="-10" y2={-8 - liftLen} className="fy-dg-force is-lift" markerEnd="url(#fy-arrow-lift)" />
        <text x="-4" y={-14 - liftLen * 0.5} className="fy-dg-label" fill="#3cc46e">Lift</text>
        <line x1="-10" y1="10" x2={-10 + dragLen} y2="10" className="fy-dg-force is-drag" markerEnd="url(#fy-arrow-drag)" />
        <text x={-4 + dragLen} y="24" className="fy-dg-label" fill="#f0524f">Drag</text>
        <defs>
          <marker id="fy-arrow-lift" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#3cc46e" /></marker>
          <marker id="fy-arrow-drag" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#f0524f" /></marker>
        </defs>
        {stalled && <text x="0" y="78" className="fy-dg-label is-center is-alert">STALLED: airflow has separated from the top of the wing</text>}
      </svg>
      <div className="fy-two">
        <div className="fy-stack is-tight">
          <Slider label="Angle of attack" value={aoa} min={-4} max={22} onChange={setAoa} format={v => `${v}°`} left="−4°" right="22°" />
          <Slider label="Airspeed" value={kt} min={35} max={150} onChange={setKt} format={v => `${v} kt`} />
          <div className="fy-sim-row">
            <span className="fy-muted">Flaps</span>
            <div className="fy-seg">
              {[0, 10, 20, 30].map(f => (
                <button key={f} type="button" className={flaps === f ? "is-on" : ""} onClick={() => setFlaps(f)}>{f}°</button>
              ))}
            </div>
          </div>
        </div>
        <div className="fy-stack is-tight">
          <div className="fy-facts">
            <div><span>Lift coefficient</span><strong>{cl.toFixed(2)}</strong></div>
            <div><span>Lift vs weight</span><strong className={pct >= 100 ? "is-good" : "is-low"}>{pct}%</strong></div>
            <div><span>Stall speed</span><strong>{Math.round(vs)} kt</strong></div>
          </div>
          <p className="fy-muted">
            {stalled
              ? "Past about 16° the air can't follow the curved top of the wing anymore. Lift drops and drag jumps. The only fix is to lower the angle of attack: push forward."
              : pct >= 100
                ? "Enough lift to hold the airplane up (or climb). Lift grows with angle of attack and with the square of airspeed: twice the speed gives four times the lift."
                : "Not enough lift for level flight: the airplane will sink. Raise the angle of attack or fly faster, but watch the stall angle."}
          </p>
          <p className="fy-muted">The wing always stalls at the same angle of attack, at any speed. Flaps add lift so you can fly slower: the stall speed drops from {Math.round(stallSpeedKt(0))} to {Math.round(stallSpeedKt(30))} knots with full flaps.</p>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Four forces, power and pitch, and turns ───────────── */

function steadyState(throttle, trimDeg) {
  let s = { x: 0, y: 0, h: 3000 * FT, v: 90 * KT, gamma: 0, psi: 0, phi: 0, alpha: trimDeg * D2R, flaps: 0, throttle, trim: trimDeg, onGround: false, t: 0, turnRate: 0, slip: 0, stalled: false, warn: null, outcome: null, touchdown: null };
  const c = { elevator: 0, aileron: 0, rudder: 0, throttle, flaps: 0, brakes: false };
  for (let i = 0; i < 2400; i += 1) {
    s = step(s, c, 0.05);
    s.h = 3000 * FT; // stay at the same height so the numbers settle
  }
  const r = readout(s);
  return { kt: r.kt, fpm: r.fpm, pitch: r.pitch, stalled: s.stalled };
}

function ForcesDiagram() {
  const [power, setPower] = useState(65);
  const [trim, setTrim] = useState(2);
  const [bank, setBank] = useState(0);
  const ss = useMemo(() => steadyState(power / 100, trim), [power, trim]);
  const n = 1 / Math.cos(bank * D2R);
  const vsBank = stallSpeedKt(0, n);
  const v = ss.kt * KT;
  const radiusFt = bank > 0 ? (v * v) / (9.81 * Math.tan(bank * D2R)) / FT : null;
  const rate = bank > 0 ? ((9.81 * Math.tan(bank * D2R)) / v) * (180 / Math.PI) : 0;
  const climbWord = Math.abs(ss.fpm) < 60 ? "level" : ss.fpm > 0 ? `climbing ${Math.round(ss.fpm / 10) * 10} ft/min` : `descending ${Math.round(-ss.fpm / 10) * 10} ft/min`;
  const liftLen = Math.min(100, 50 * n);

  return (
    <div className="fy-stack">
      <section className="fy-card">
        <h2>Pitch and power</h2>
        <p className="fy-muted">Set the power and the trim (which picks an angle of attack), and see where the airplane settles. Pitch mostly sets your speed; power decides whether you climb or descend at that speed.</p>
        <div className="fy-two">
          <div className="fy-stack is-tight">
            <Slider label="Power" value={power} min={0} max={100} onChange={setPower} format={v => `${v}%`} />
            <Slider label="Trim (angle of attack)" value={trim} min={-1} max={14} step={0.5} onChange={setTrim} format={v => `${v}°`} left="Nose down, fast" right="Nose up, slow" />
          </div>
          <div className="fy-stack is-tight">
            <div className="fy-facts">
              <div><span>Settles at</span><strong>{Math.round(ss.kt)} kt</strong></div>
              <div><span>And is</span><strong>{ss.stalled ? "stalled" : climbWord}</strong></div>
              <div><span>Nose</span><strong>{ss.pitch >= 0 ? "+" : ""}{ss.pitch.toFixed(1)}°</strong></div>
            </div>
            <p className="fy-muted">Try it: leave the trim alone and change only the power. The speed barely moves, but the climb rate does. For level flight at 100 knots, this airplane needs about {Math.round(levelThrottle(100) * 100)}% power and {trimAlphaDeg(100).toFixed(1)}° angle of attack.</p>
          </div>
        </div>
      </section>

      <section className="fy-card">
        <h2>Turns and load factor</h2>
        <svg viewBox="-170 -130 340 255" className="fy-diagram is-wide" role="img" aria-label={`Banked ${bank} degrees, load factor ${n.toFixed(2)}`}>
          <defs>
            {[["lift", "#3cc46e"], ["weight", "#f0524f"], ["horiz", "#ffb547"], ["vert", "#8db8ff"]].map(([k, col]) => (
              <marker key={k} id={`fy-ar-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={col} /></marker>
            ))}
          </defs>
          <line x1="-170" y1="118" x2="170" y2="118" className="fy-dg-horizon" />
          <g transform={`rotate(${bank})`}>
            <path d="M-118 -2 L118 -2 L118 4 L-118 4 Z" className="fy-dg-body" />
            <ellipse cx="0" cy="6" rx="16" ry="18" className="fy-dg-body is-dark" />
            <path d="M-4 -12 L-3 -50 L3 -50 L4 -12 Z" className="fy-dg-body" />
            <line x1="0" y1="-14" x2="0" y2={-14 - liftLen} className="fy-dg-force is-lift" markerEnd="url(#fy-ar-lift)" />
          </g>
          <text x={Math.sin(bank * D2R) * (liftLen + 30)} y={-Math.cos(bank * D2R) * (liftLen + 22)} className="fy-dg-label is-center" fill="#3cc46e">Lift</text>
          {bank > 2 && (
            <>
              <line x1="0" y1="0" x2="0" y2={-50} className="fy-dg-force" stroke="#8db8ff" strokeDasharray="5 4" markerEnd="url(#fy-ar-vert)" />
              <line x1="0" y1="0" x2={Math.sin(bank * D2R) * liftLen} y2="0" className="fy-dg-force" stroke="#ffb547" strokeDasharray="5 4" markerEnd="url(#fy-ar-horiz)" />
              <text x={Math.sin(bank * D2R) * liftLen + 6} y="16" className="fy-dg-label" fill="#ffb547">turns you</text>
            </>
          )}
          <line x1="0" y1="24" x2="0" y2="74" className="fy-dg-force is-weight" markerEnd="url(#fy-ar-weight)" />
          <text x="-8" y="66" className="fy-dg-label" fill="#f0524f" textAnchor="end">Weight</text>
        </svg>
        <Slider label="Bank angle" value={bank} min={0} max={70} onChange={setBank} format={v => `${v}°`} />
        <div className="fy-facts">
          <div><span>Load factor</span><strong>{n.toFixed(2)} G</strong></div>
          <div><span>Stall speed</span><strong>{Math.round(vsBank)} kt</strong></div>
          <div><span>Turn at {Math.round(ss.kt)} kt</span><strong>{bank > 0 ? `${rate.toFixed(1)}°/s · ${Math.round(radiusFt).toLocaleString("en-US")} ft radius` : "straight"}</strong></div>
        </div>
        <p className="fy-muted">
          Banking tips the lift sideways. Part of it now turns the airplane, so less is left to hold it up, and you have to pull back to make more lift. At 60° of bank the wings carry twice your weight (2 G) and the stall speed goes up by about 40%. That's why steep, slow turns near the ground are dangerous.
        </p>
      </section>
    </div>
  );
}

/* ───────────── Instruments and their failures ───────────── */

const INSTRUMENT_NOTES = [
  ["Airspeed", "Pitot-static. Compares ram air pressure from the pitot tube with static pressure. White arc: flap range. Green: normal. Yellow: smooth air only. Red line: never exceed."],
  ["Attitude", "Gyro (vacuum in most trainers). Shows pitch and bank against an artificial horizon. Your main instrument when you can't see outside."],
  ["Altimeter", "Static. An aneroid barometer: as you climb, static pressure drops and the needles turn. Set it to the local altimeter setting."],
  ["Turn coordinator", "Gyro (electric). The little airplane shows rate of turn; on the marks is 2 minutes for a full circle. The ball shows slip or skid: step on the ball."],
  ["Heading", "Gyro (vacuum). A steady compass card that doesn't swing like the magnetic compass, but it drifts: realign it with the compass every 15 minutes."],
  ["Vertical speed", "Static. Measures how fast static pressure changes, shown as feet per minute. It lags a few seconds behind."],
];

const FAILURES = [
  { id: "none", name: "All working" },
  { id: "pitot", name: "Pitot blocked (drain open)" },
  { id: "pitot-drain", name: "Pitot and drain blocked" },
  { id: "static", name: "Static port blocked" },
  { id: "vacuum", name: "Vacuum pump failed" },
];

function InstrumentsDiagram() {
  const [kt, setKt] = useState(100);
  const [fpm, setFpm] = useState(0);
  const [bank, setBank] = useState(0);
  const [fail, setFail] = useState("none");
  const [flight, setFlight] = useState({ alt: 3000, heading: 90, t: 0 });
  const [frozen, setFrozen] = useState({ alt: 3000, kt: 100, heading: 90 });

  useAnimation(
    dt => {
      setFlight(f => {
        const alt = clamp(f.alt + (fpm / 60) * dt * 4, 0, 12000);
        const rate = bank ? ((9.81 * Math.tan(bank * D2R)) / (kt * KT)) * (180 / Math.PI) : 0;
        return { alt, heading: (f.heading + rate * dt + 360) % 360, t: f.t + dt };
      });
    }
  );

  const pickFailure = id => {
    setFrozen({ alt: flight.alt, kt, heading: flight.heading });
    setFail(id);
  };

  const rate = bank ? ((9.81 * Math.tan(bank * D2R)) / (kt * KT)) * (180 / Math.PI) : 0;
  const pitch = clamp(fpm / 200 + (kt < 100 ? (100 - kt) / 12 : -(kt - 100) / 20), -10, 15);
  const f0 = frozen;
  const shown = { kt, alt: flight.alt, fpm, pitch, bank, heading: flight.heading, turnRate: rate, slip: 0 };
  if (fail === "pitot") shown.kt = 0;
  if (fail === "pitot-drain") shown.kt = clamp(f0.kt + (flight.alt - f0.alt) * 0.012, 0, 200);
  if (fail === "static") {
    shown.alt = f0.alt;
    shown.fpm = 0;
    shown.kt = clamp(kt - (flight.alt - f0.alt) * 0.012, 0, 200);
  }
  if (fail === "vacuum") {
    const age = flight.t;
    shown.pitch = 6 + Math.sin(age / 3) * 4;
    shown.bank = 18 + Math.sin(age / 5) * 10;
    shown.heading = f0.heading + age * 7;
  }

  const effect = {
    none: "Everything agrees. Change the speed, climb rate or bank and watch each instrument respond.",
    pitot: "Ice blocked the pitot tube but the drain hole is open: ram pressure leaks away and the airspeed drops to zero. The altimeter and VSI still work. Turn on pitot heat.",
    "pitot-drain": "Pitot tube and drain both blocked: the airspeed indicator now works like an altimeter. Climb and it shows faster, descend and it shows slower, whatever your real speed. Try the climb slider.",
    static: "Static port blocked: the altimeter freezes, the VSI sits at zero, and the airspeed reads low as you climb above where it blocked (high as you descend). Use the alternate static source.",
    vacuum: "The vacuum pump failed: the attitude and heading indicators slowly tip and drift. The turn coordinator is electric and still tells the truth. Cover the failed gyros and fly by the turn coordinator, altimeter and airspeed.",
  }[fail];

  return (
    <section className="fy-card">
      <h2>The six-pack</h2>
      <SixPack s={shown} />
      <div className="fy-two">
        <div className="fy-stack is-tight">
          <Slider label="True airspeed" value={kt} min={40} max={160} onChange={setKt} format={v => `${v} kt`} />
          <Slider label="Climb or descent" value={fpm} min={-1500} max={1500} step={100} onChange={setFpm} format={v => `${v > 0 ? "+" : ""}${v} ft/min`} />
          <Slider label="Bank" value={bank} min={-45} max={45} onChange={setBank} format={v => `${Math.abs(v)}° ${v > 0 ? "right" : v < 0 ? "left" : ""}`} />
          <p className="fy-muted fy-mono">Real altitude {Math.round(flight.alt).toLocaleString("en-US")} ft</p>
        </div>
        <div className="fy-stack is-tight">
          <h3>Break something</h3>
          <div className="fy-quick">
            {FAILURES.map(fl => (
              <button key={fl.id} type="button" className={`fy-chip${fail === fl.id ? " is-on" : ""}`} onClick={() => pickFailure(fl.id)}>{fl.name}</button>
            ))}
          </div>
          <p className={fail === "none" ? "fy-muted" : "fy-note is-warn"}>{effect}</p>
        </div>
      </div>
      <dl className="fy-inst-notes">
        {INSTRUMENT_NOTES.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </section>
  );
}
