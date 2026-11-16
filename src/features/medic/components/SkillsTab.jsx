import { Clock, Footprints, Gauge, Rabbit } from "lucide-react";

import { covers, levelById } from "../data/levels";
import { SKILLS } from "../data/skills";
import { clock, MODES } from "../model/sim";
import { recordFor } from "../state/medicStore";

export const MODE_ICONS = { crawl: Footprints, walk: Gauge, run: Rabbit };

export default function SkillsTab({ level, data, onOpen }) {
  const skills = SKILLS.filter(s => covers(level, s.min));
  return (
    <section className="mx-skills">
      <div className="mx-card mx-paces">
        <h2>Three paces</h2>
        <div className="mx-pace-row">
          {MODES.map(m => {
            const Icon = MODE_ICONS[m.id];
            return (
              <div key={m.id} className={`mx-pace mx-pace--${m.id}`}>
                <Icon size={20} aria-hidden="true" />
                <strong>{m.name}</strong>
                <span>{m.hint}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mx-skill-grid">
        {skills.map(s => (
          <article key={s.id} className="mx-card mx-skill">
            <div className="mx-skill-top">
              <h3>{s.name}</h3>
              <span className="mx-chip">
                <Clock size={13} aria-hidden="true" /> {s.minutes} min
              </span>
            </div>
            <p className="mx-muted">{s.intro}</p>
            <p className="mx-small">
              {s.min === "emr" ? "All levels" : `${levelById.get(s.min).short} and up`} · {s.scenarios.length} patients
            </p>
            <div className="mx-skill-modes">
              {MODES.map(m => {
                const r = recordFor(data, s.id, m.id);
                const Icon = MODE_ICONS[m.id];
                return (
                  <button key={m.id} type="button" className={`mx-mode-btn mx-pace--${m.id}${r.passes ? " is-passed" : ""}`} onClick={() => onOpen(s.id, m.id)}>
                    <Icon size={16} aria-hidden="true" />
                    <span>{m.name}</span>
                    <small>{r.passes ? (m.id === "crawl" ? "Clean ✓" : `${r.passes} passed${r.best ? ` · ${clock(r.best)}` : ""}`) : r.tries ? `${r.tries} tried` : "Start"}</small>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
