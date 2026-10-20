import { equipment, GEAR_PRESETS } from "../data/equipment";
import { LEVELS } from "../model/generate";

export function Segment({ label, options, value, onChange, format = o => o.name, wide = false }) {
  return (
    <div className={`lf-segment ${wide ? "lf-segment--wide" : ""}`} role="radiogroup" aria-label={label}>
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}

export function GearPicker({ gear, onChange }) {
  const same = list => list.length === gear.length && list.every(g => gear.includes(g));
  return (
    <div className="lf-gear">
      <div className="lf-chips">
        {GEAR_PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            className="lf-chip lf-chip--preset"
            aria-pressed={same(preset.gear)}
            onClick={() => onChange(preset.gear)}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <div className="lf-chips">
        {equipment.map(item => (
          <button
            key={item.id}
            type="button"
            className="lf-chip"
            aria-pressed={gear.includes(item.id)}
            onClick={() => onChange(gear.includes(item.id) ? gear.filter(g => g !== item.id) : [...gear, item.id])}
          >
            {item.name}
          </button>
        ))}
      </div>
      <p className="lf-note">Bodyweight moves are always included.</p>
    </div>
  );
}

export function LevelPicker({ level, onChange }) {
  return <Segment label="Experience" options={LEVELS} value={level} onChange={onChange} wide />;
}
