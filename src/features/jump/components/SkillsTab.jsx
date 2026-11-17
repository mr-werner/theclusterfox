import { useState } from "react";
import { AlertTriangle } from "lucide-react";

import { SKILL_GROUPS, SKILLS } from "../data/skills";
import Diagram from "./Diagrams";

// How to do the maneuvers, with a diagram each. All of them on one page so
// you can scroll through everything without picking.
export default function SkillsTab() {
  const [group, setGroup] = useState("all");
  const shown = SKILLS.filter(s => group === "all" || s.group === group);
  return (
    <div className="jf-stack">
      <section className="jf-card jf-hero">
        <div className="jf-hero-text">
          <p className="jf-kicker">Skills</p>
          <h1>How to fly it</h1>
          <p>The body positions, maneuvers and canopy skills from student training, each with a diagram. A refresher next to your training, never instead of it.</p>
        </div>
      </section>

      <div className="jf-chips" role="group" aria-label="Show">
        {[{ id: "all", name: "Everything" }, ...SKILL_GROUPS].map(g => (
          <button key={g.id} type="button" className={`jf-chip-btn${group === g.id ? " is-on" : ""}`} aria-pressed={group === g.id} onClick={() => setGroup(g.id)}>
            {g.name}
          </button>
        ))}
      </div>

      <nav className="jf-skill-index" aria-label="Jump to a skill">
        {shown.map(s => (
          <a key={s.id} href={`#skill-${s.id}`}>{s.name}</a>
        ))}
      </nav>

      <div className="jf-skills">
        {shown.map(s => (
          <article key={s.id} id={`skill-${s.id}`} className="jf-card jf-skill">
            <header>
              <h2>{s.name}</h2>
              <span className="jf-tag">{s.level}</span>
            </header>
            <Diagram id={s.diagram} title={`Diagram: ${s.name}`} />
            <ol className="jf-steps">{s.steps.map(t => <li key={t}>{t}</li>)}</ol>
            {s.mistakes?.length > 0 && (
              <div className="jf-mistakes">
                <strong><AlertTriangle size={14} aria-hidden="true" /> Common mistakes</strong>
                <ul>{s.mistakes.map(t => <li key={t}>{t}</li>)}</ul>
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="jf-note">Learn every skill on the ground with an instructor first. Procedures differ between rigs and DZs: what your instructor taught you wins.</p>
    </div>
  );
}
