import { useEffect, useRef } from "react";
import { Minus, Plus } from "lucide-react";
import { CUSTOM_LIMITS, customPattern } from "../data/breathing";
import { breathAt } from "../model/breath";

const STEPS = [
  { key: "in", name: "Breathe in" },
  { key: "hold", name: "Hold" },
  { key: "out", name: "Breathe out" },
  { key: "rest", name: "Pause" },
];

const PRESETS = [
  { name: "Calm", value: { in: 4, hold: 0, out: 6, rest: 0 } },
  { name: "Box", value: { in: 4, hold: 4, out: 4, rest: 4 } },
  { name: "4-7-8", value: { in: 4, hold: 7, out: 8, rest: 0 } },
  { name: "Even", value: { in: 5, hold: 0, out: 5, rest: 0 } },
];

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Set seconds for each part of the breath and watch the rhythm before starting.
export default function BreathBuilder({ value, onChange }) {
  const orb = useRef(null);
  const label = useRef(null);

  useEffect(() => {
    const pattern = customPattern(value);
    const start = performance.now();
    let frame = 0;
    const tick = () => {
      const b = breathAt(pattern, (performance.now() - start) / 1000);
      if (orb.current) orb.current.style.setProperty("--level", reduceMotion() ? 0.6 : b.level);
      if (label.current) label.current.textContent = b.phase.label;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const set = (key, delta) => {
    const [min, max] = CUSTOM_LIMITS[key];
    onChange({ ...value, [key]: Math.min(max, Math.max(min, value[key] + delta)) });
  };
  const cycle = value.in + value.hold + value.out + value.rest;

  return (
    <section className="cm-builder" aria-labelledby="cm-setup-title">
      <div className="cm-builder-stage" aria-hidden="true">
        <div className="cm-builder-orb" ref={orb} />
        <span className="cm-builder-label" ref={label} />
      </div>

      <div className="cm-builder-panel">
        <h2 id="cm-setup-title">Your breathing rhythm</h2>
        <p className="cm-muted">
          One breath takes {cycle} seconds, about {Math.round((60 / cycle) * 10) / 10} breaths a minute.
        </p>

        <div className="cm-steppers">
          {STEPS.map(s => (
            <div key={s.key} className="cm-stepper">
              <span className="cm-stepper-name">{s.name}</span>
              <div className="cm-stepper-row">
                <button type="button" onClick={() => set(s.key, -1)} disabled={value[s.key] <= CUSTOM_LIMITS[s.key][0]} aria-label={`Shorter ${s.name.toLowerCase()}`}>
                  <Minus size={16} />
                </button>
                <output aria-live="polite" aria-label={`${s.name} seconds`}>
                  {value[s.key]}
                  <small>s</small>
                </output>
                <button type="button" onClick={() => set(s.key, 1)} disabled={value[s.key] >= CUSTOM_LIMITS[s.key][1]} aria-label={`Longer ${s.name.toLowerCase()}`}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cm-chips" role="group" aria-label="Rhythm presets">
          {PRESETS.map(p => {
            const on = STEPS.every(s => p.value[s.key] === value[s.key]);
            return (
              <button key={p.name} type="button" aria-pressed={on} onClick={() => onChange(p.value)}>
                {p.name}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
