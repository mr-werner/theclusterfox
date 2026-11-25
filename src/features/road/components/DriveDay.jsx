import { AlertTriangle, BedDouble, Clock } from "lucide-react";

import { drivingWarning, parseClock, toClock } from "../model/days";
import { STAY_KINDS } from "../model/stays";

const FLEX = [30, 60, 90, 120, 180];
const flexName = m => (m < 60 ? `${m} min` : `${m / 60} h`.replace(".5 h", "½ h"));

/** Your driving day: when you set off, when you want to be done, how long behind the wheel, and where you sleep. */
export default function DriveDay({ data, patch }) {
  const d = data.drive;
  const set = (k, v) => patch(x => ({ drive: { ...x.drive, [k]: v } }));
  const warn = drivingWarning(data.hoursPerDay);
  const window = (d.finish - d.start) / 60;
  return (
    <div className="rf-driveday">
      <div className="rf-options">
        <label>
          <span>
            <Clock size={13} aria-hidden="true" /> Start driving
          </span>
          <input type="time" value={toClock(d.start)} onChange={e => parseClock(e.target.value) != null && set("start", parseClock(e.target.value))} />
        </label>
        <label>
          <span>Done driving by</span>
          <input type="time" value={toClock(d.finish)} onChange={e => {
            const v = parseClock(e.target.value);
            if (v != null) set("finish", v <= d.start ? v + 1440 : v);
          }} />
        </label>
        <label className="rf-hours">
          <span>
            Drive up to {data.hoursPerDay} h a day{window < data.hoursPerDay ? ` (your ${Math.round(window * 10) / 10} h window will end days first)` : ""}
          </span>
          <input type="range" min="1" max="16" step="0.5" value={data.hoursPerDay} onChange={e => patch({ hoursPerDay: Number(e.target.value) })} aria-describedby={warn ? "rf-drive-warn" : undefined} />
        </label>
        <label>
          <span>Wiggle room</span>
          <select value={d.flex} onChange={e => set("flex", Number(e.target.value))}>
            {FLEX.map(m => (
              <option key={m} value={m}>
                ± {flexName(m)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {warn && (
        <p id="rf-drive-warn" className={`rf-note ${warn.level === "danger" ? "is-danger" : "is-warn"}`} role="status">
          <AlertTriangle size={15} aria-hidden="true" /> {warn.text}
        </p>
      )}
      <div className="rf-options">
        <label>
          <span>
            <BedDouble size={13} aria-hidden="true" /> Sleep at
          </span>
          <select value={d.stay} onChange={e => set("stay", e.target.value)}>
            {STAY_KINDS.map(k => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Up to $ a night</span>
          <input type="number" min="0" max="2000" step="5" inputMode="numeric" value={d.budget || ""} placeholder="Any" onChange={e => set("budget", Math.max(0, Math.round(Number(e.target.value) || 0)))} className="rf-money" />
        </label>
        <p className="rf-muted rf-small rf-driveday-note">{STAY_KINDS.find(k => k.id === d.stay)?.blurb}</p>
      </div>
    </div>
  );
}
