import { Dumbbell, HeartPulse, Sparkles, Zap } from "lucide-react";

import MuscleMap from "./MuscleMap";
import { GearPicker, LevelPicker, Segment } from "./Pickers";
import { DURATIONS, GOALS } from "../model/generate";
import { muscleName } from "../data/muscles";

const GOAL_ICONS = { strength: Zap, size: Dumbbell, stamina: HeartPulse };

/** The inputs for a single workout: muscles, goal, time, gear and level. */
export default function WorkoutBuilder({ prefs, onPrefs, onGenerate }) {
  const { muscles, goal, minutes, gear, level } = prefs;
  const toggle = id => onPrefs({ muscles: muscles.includes(id) ? muscles.filter(m => m !== id) : [...muscles, id] });

  return (
    <div className="lf-builder">
      <section className="lf-panel" aria-labelledby="lf-muscles-title">
        <div className="lf-panel-head">
          <div>
            <p className="lf-step">1</p>
            <h2 id="lf-muscles-title">Which muscles do you want to work?</h2>
          </div>
          {muscles.length > 0 && (
            <button type="button" className="lf-link" onClick={() => onPrefs({ muscles: [] })}>
              Clear
            </button>
          )}
        </div>
        <p className="lf-muted">
          Tap them on the body or pick from the list. {muscles.length ? `${muscles.length} picked: ${muscles.map(muscleName).join(", ")}.` : "Pick none for a full-body workout."}
        </p>
        <MuscleMap selected={muscles} onToggle={toggle} onSet={list => onPrefs({ muscles: list })} />
      </section>

      <section className="lf-panel" aria-labelledby="lf-goal-title">
        <p className="lf-step">2</p>
        <h2 id="lf-goal-title">How do you want to improve them?</h2>
        <div className="lf-goals" role="radiogroup" aria-label="Goal">
          {Object.entries(GOALS).map(([id, g]) => {
            const Icon = GOAL_ICONS[id];
            return (
              <button key={id} type="button" role="radio" aria-checked={goal === id} className="lf-goal" onClick={() => onPrefs({ goal: id })}>
                <Icon size={22} aria-hidden="true" />
                <strong>{g.name}</strong>
                <span>{g.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="lf-panel lf-row-panel" aria-label="Time and experience">
        <div>
          <p className="lf-step">3</p>
          <h2>How much time do you have?</h2>
          <Segment
            label="Minutes"
            options={DURATIONS.map(d => ({ id: d, name: `${d}` }))}
            value={minutes}
            onChange={value => onPrefs({ minutes: value })}
            format={o => `${o.name} min`}
          />
        </div>
        <div>
          <h3>Your experience</h3>
          <LevelPicker level={level} onChange={value => onPrefs({ level: value })} />
        </div>
      </section>

      <section className="lf-panel" aria-labelledby="lf-gear-title">
        <p className="lf-step">4</p>
        <h2 id="lf-gear-title">What gear do you have?</h2>
        <GearPicker gear={gear} onChange={list => onPrefs({ gear: list })} />
      </section>

      <button type="button" className="lf-btn lf-btn--big" onClick={onGenerate}>
        <Sparkles size={18} aria-hidden="true" />
        Build my workout
      </button>
    </div>
  );
}
