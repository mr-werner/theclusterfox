import { Activity, Dumbbell, Footprints, Timer, Waves, Zap } from "lucide-react";

import { EVENTS } from "../data/jobs";

const SPORT_ICONS = { swim: Waves, run: Footprints, push: Dumbbell, pull: Dumbbell, core: Timer, strength: Dumbbell, sprint: Zap };

export function EventIcon({ id, size = 18 }) {
  const Icon = SPORT_ICONS[EVENTS[id]?.sport] ?? Activity;
  return <Icon size={size} aria-hidden="true" />;
}

const STATUS = {
  none: ["Not entered", "rf-chip"],
  below: ["Below minimum", "rf-chip is-below"],
  min: ["Passes", "rf-chip is-min"],
  aim: ["Strong", "rf-chip is-aim"],
};

export function StatusChip({ status, label }) {
  const [text, cls] = STATUS[status] ?? STATUS.none;
  return <span className={cls}>{label ?? text}</span>;
}

export function Empty({ title, children, action }) {
  return (
    <section className="rf-card rf-empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </section>
  );
}
