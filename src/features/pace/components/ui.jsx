import { Bike, Footprints, Waves } from "lucide-react";

import { groupSteps } from "../model/sessions";
import { zoneTarget, ZONES } from "../model/zones";
import { fmtClock } from "../model/units";

export const SPORT_ICONS = { run: Footprints, ride: Bike, row: Waves };

export function SportIcon({ sport, size = 18 }) {
  const Icon = SPORT_ICONS[sport] ?? Footprints;
  return <Icon size={size} aria-hidden="true" />;
}

export function ZoneChip({ zone }) {
  const z = ZONES[zone];
  if (!z) return null;
  return (
    <span className={`pc-zone pc-z${zone}`} title={`${z.name}: ${z.feel}`}>
      {z.short}
    </span>
  );
}

const dur = sec => (sec < 90 ? `${Math.round(sec)} s` : sec % 60 ? fmtClock(sec) : `${Math.round(sec / 60)} min`);
const len = step => (step.meters ? `${step.meters} m` : dur(step.sec));

function StepLine({ step, sport, profile, unit, label }) {
  const t = zoneTarget(step.zone, sport, profile, unit);
  return (
    <div className="pc-step-main">
      <ZoneChip zone={step.zone} />
      <div>
        <strong>{label ?? step.label}</strong>
        <small>
          {[t.target, t.hr, t.rate].filter(Boolean).join(" · ") || ZONES[step.zone]?.feel}
        </small>
      </div>
    </div>
  );
}

/** The steps of a session, with repeats folded into "6 × 3 min". */
export function StepList({ steps, sport, profile, unit, activeIndex = null }) {
  const groups = groupSteps(steps);
  // Where each group starts and ends in the flat list of steps.
  const spans = [];
  groups.reduce((at, g) => {
    const len = g.set ? (g.rest ? g.n * 2 - 1 : g.n) : 1;
    spans.push([at, at + len]);
    return at + len;
  }, 0);
  return (
    <ol className="pc-steps">
      {groups.map((g, gi) => {
        const [start, i] = spans[gi];
        if (g.set) {
          const on = activeIndex != null && activeIndex >= start && activeIndex < i;
          return (
            <li key={gi} className={`pc-step is-set${on ? " is-on" : ""}`}>
              <span className="pc-step-len">
                {g.n} × {len(g.work)}
              </span>
              <div>
                <StepLine step={g.work} sport={sport} profile={profile} unit={unit} />
                {g.rest && (
                  <p className="pc-step-rest">
                    with {dur(g.rest.sec)} {g.rest.label.toLowerCase()} between
                  </p>
                )}
              </div>
            </li>
          );
        }
        const on = activeIndex === start;
        return (
          <li key={gi} className={`pc-step is-${g.step.kind}${on ? " is-on" : ""}`}>
            <span className="pc-step-len">{g.step.open ? "race" : len(g.step)}</span>
            <StepLine step={g.step} sport={sport} profile={profile} unit={unit} />
          </li>
        );
      })}
    </ol>
  );
}

/** A bar showing the shape of a session: one block per step, height by zone. */
export function SessionShape({ steps, activeIndex = null, progress = null }) {
  const total = steps.reduce((n, s) => n + s.sec, 0) || 1;
  return (
    <div className="pc-shape" aria-hidden="true">
      {steps.map((s, i) => (
        <span key={i} className={`pc-z${s.zone}${activeIndex === i ? " is-on" : ""}`} style={{ flexGrow: s.sec / total, height: `${18 + s.zone * 13}%` }} />
      ))}
      {progress != null && <i className="pc-shape-now" style={{ left: `${Math.min(100, progress * 100)}%` }} />}
    </div>
  );
}
