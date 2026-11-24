import { useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";

import { GEAR, GOALS, GROUPS, LEVELS, TAKEOFFS, goalById } from "../data/goals";
import { DAY_OPTIONS, WEEK_OPTIONS, allSessions, buildPlan, cleanOptions, defaultOptions, fmtDay } from "../model/program";

function Choice({ name, value, options, onChange, wide = false }) {
  return (
    <div className={`lp-choices${wide ? " is-wide" : ""}`} role="radiogroup" aria-label={name}>
      {options.map(o => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={value === o.id} className="lp-choice" onClick={() => onChange(o.id)}>
          <strong>{o.name}</strong>
          {o.blurb && <small>{o.blurb}</small>}
        </button>
      ))}
    </div>
  );
}

export default function PlanBuilder({ today, initial, onBuild, onCancel }) {
  const [opts, setOpts] = useState(() => cleanOptions(initial ?? defaultOptions(today), today));
  const set = patch => setOpts(o => cleanOptions({ ...o, ...patch }, today));
  const goal = goalById.get(opts.goal);
  const preview = useMemo(() => buildPlan(opts), [opts]);
  const sessions = allSessions(preview);
  const perWeek = preview.weeks[1]?.sessions ?? preview.weeks[0].sessions;
  const avgMin = Math.round(perWeek.reduce((n, s) => n + s.minutes, 0) / perWeek.length / 5) * 5;

  return (
    <section className="lp-builder" aria-labelledby="lp-build-title">
      <div className="lp-section-head">
        <h2 id="lp-build-title">Make your jump plan</h2>
        {onCancel && (
          <button type="button" className="lp-icon-btn" onClick={onCancel} aria-label="Cancel">
            <X size={18} />
          </button>
        )}
      </div>

      <fieldset className="lp-field">
        <legend>What are you jumping for?</legend>
        {GROUPS.map(group => (
          <div key={group.id} className="lp-goal-group">
            <h3>{group.name}</h3>
            <div className="lp-goal-grid">
              {GOALS.filter(g => g.group === group.id).map(g => (
                <button key={g.id} type="button" className="lp-goal" aria-pressed={opts.goal === g.id} onClick={() => set({ goal: g.id, takeoff: g.takeoff })}>
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="lp-hint">{goal.blurb}</p>
      </fieldset>

      <fieldset className="lp-field">
        <legend>Takeoff</legend>
        {goal.fixed ? (
          <p className="lp-hint">{goal.name} is always a one-foot takeoff, so the plan leans on one-leg jumps and landings, with two-foot work for strength.</p>
        ) : (
          <Choice name="Takeoff" value={opts.takeoff} options={TAKEOFFS} onChange={takeoff => set({ takeoff })} />
        )}
        {opts.takeoff !== "two" && (
          <div className="lp-inline">
            <span>Which foot do you take off from?</span>
            <div className="lp-seg">
              {[["left", "Left"], ["right", "Right"], [null, "Not sure"]].map(([id, label]) => (
                <button key={label} type="button" aria-pressed={opts.leg === id} onClick={() => set({ leg: id })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {opts.takeoff !== "two" && opts.leg === null && (
          <p className="lp-hint">Not sure? Run at a wall and jump to touch it high with one hand. The foot you leave from is your takeoff foot.</p>
        )}
      </fieldset>

      <fieldset className="lp-field">
        <legend>Experience</legend>
        <Choice name="Experience" value={opts.level} options={LEVELS} onChange={level => set({ level })} />
      </fieldset>

      <fieldset className="lp-field">
        <legend>Gear</legend>
        <Choice name="Gear" value={opts.gear} options={GEAR} onChange={gear => set({ gear })} />
      </fieldset>

      <fieldset className="lp-field">
        <legend>Season</legend>
        <Choice
          name="Season"
          value={opts.inSeason}
          onChange={inSeason => set({ inSeason })}
          options={[
            { id: false, name: "Off-season", blurb: "Time to build. Up to 4 days a week." },
            { id: true, name: "In season", blurb: "Games every week. 2 short days to keep your bounce." },
          ]}
        />
      </fieldset>

      <div className="lp-field-row">
        <fieldset className="lp-field">
          <legend>Days a week</legend>
          <div className="lp-seg">
            {DAY_OPTIONS.map(n => (
              <button key={n} type="button" aria-pressed={opts.days === n} disabled={opts.inSeason && n > 2} onClick={() => set({ days: n })}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="lp-field">
          <legend>Weeks</legend>
          <div className="lp-seg">
            {WEEK_OPTIONS.map(n => (
              <button key={n} type="button" aria-pressed={opts.weeks === n} onClick={() => set({ weeks: n })}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="lp-field">
          <legend>
            <label htmlFor="lp-start">First day</label>
          </legend>
          <input id="lp-start" className="lp-input" type="date" value={opts.start} min={today} onChange={e => e.target.value && set({ start: e.target.value })} />
        </fieldset>
      </div>

      <div className="lp-build-summary">
        <p>
          <strong>
            {opts.weeks} weeks · {opts.days} days a week · about {avgMin} min
          </strong>
          <span>
            {sessions.length} sessions, {fmtDay(sessions[0].day)} to {fmtDay(sessions[sessions.length - 1].day)}. Test on day one and again at the end.
          </span>
        </p>
        <button type="button" className="lp-btn is-primary" onClick={() => onBuild(opts)}>
          Start this plan <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
