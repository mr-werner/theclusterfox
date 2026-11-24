import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Dumbbell, ExternalLink } from "lucide-react";

import { KINDS, drills } from "../data/drills";
import { LIFT_IDS } from "../model/program";
import { exercisesById } from "../../lift/data/exercises";
import { muscleName } from "../../lift/data/muscles";

const LEGS = { two: "Two feet", one: "One foot", split: "Alternating", either: "Any" };
const LEVEL = ["", "Beginner", "Intermediate", "Advanced"];

const GUIDE = [
  {
    title: "Why you jump higher",
    text: "Height comes from how much force you push into the ground and how fast. Strength raises the first, jumps and sprints sharpen the second, and springy tendons give some of it back for free. The plan trains all three, in that order.",
  },
  {
    title: "One foot or two?",
    text: "Two-foot jumpers win with strong hips and quads and a deep, fast dip. One-foot jumpers turn run-up speed into height with a stiff, quick plant, so they need speed, single-leg strength and reactive ankles. Most court and field players need both.",
  },
  {
    title: "Count your contacts",
    text: "Every time a foot hits the ground in a jump drill is one contact. Beginners do well with 60 or so a session, experienced jumpers around 100. More isn't better: tired jumps teach slow jumps.",
  },
  {
    title: "Rest like you mean it",
    text: "Jump training is not cardio. Take a full minute or two between sets so every rep is your best. If you're out of breath, you're resting too little.",
  },
  {
    title: "Land first",
    text: "Quiet landings, knees over toes, hips back. If you can't stick a landing from a jump, you're not ready to rebound out of it. That's why the plan opens with landing drills.",
  },
  {
    title: "When to stop",
    text: "Ache below the kneecap, in your shins or at the back of your heel that gets worse as you go is a sign to stop for the day. Swap the jumps for the tendon holds in your plan and check with a doctor or physio if it lingers.",
  },
];

function Drill({ drill, open, onToggle, refEl }) {
  return (
    <li className={`lp-drill${open ? " is-open" : ""}`} ref={refEl}>
      <button type="button" className="lp-drill-head" aria-expanded={open} onClick={onToggle}>
        <span>
          <strong>{drill.name}</strong>
          <small>
            {LEGS[drill.legs]} · {LEVEL[drill.level]}
          </small>
        </span>
        <ChevronDown size={18} className="lp-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="lp-how">
          <ol>
            {drill.steps.map(s => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="lp-tip">{drill.tip}</p>
        </div>
      )}
    </li>
  );
}

export default function DrillsTab({ openId, onOpen }) {
  const [kind, setKind] = useState(() => drills.find(d => d.id === openId)?.kind ?? "all");
  const openRef = useRef(null);

  useEffect(() => {
    if (openId) openRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [openId]);

  const shown = KINDS.filter(k => kind === "all" || k.id === kind);
  const lifts = LIFT_IDS.map(id => exercisesById.get(id)).filter(Boolean);

  return (
    <section className="lp-drills">
      <details className="lp-guide" open={!openId}>
        <summary>How jump training works</summary>
        <div className="lp-guide-grid">
          {GUIDE.map(g => (
            <div key={g.title} className="lp-guide-card">
              <h3>{g.title}</h3>
              <p>{g.text}</p>
            </div>
          ))}
        </div>
      </details>

      <div className="lp-filter" role="group" aria-label="Drill type">
        <button type="button" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
          All
        </button>
        {KINDS.map(k => (
          <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
            {k.name}
          </button>
        ))}
        <button type="button" aria-pressed={kind === "lift"} onClick={() => setKind("lift")}>
          Strength
        </button>
      </div>

      {kind !== "lift" &&
        shown.map(k => {
          const list = drills.filter(d => d.kind === k.id);
          if (!list.length) return null;
          return (
            <div key={k.id} className="lp-drill-group">
              <h2>{k.name}</h2>
              <ul>
                {list.map(d => (
                  <Drill key={d.id} drill={d} open={openId === d.id} onToggle={() => onOpen(openId === d.id ? null : d.id)} refEl={openId === d.id ? openRef : null} />
                ))}
              </ul>
            </div>
          );
        })}

      {(kind === "all" || kind === "lift") && (
        <div className="lp-drill-group">
          <h2>
            Strength <span className="lp-from is-big"><Dumbbell size={13} aria-hidden="true" /> from LiftFox</span>
          </h2>
          <p className="lp-muted">These come from LiftFox's library, with its moving demos. Your plan picks the ones your gear allows.</p>
          <ul className="lp-lifts">
            {lifts.map(ex => (
              <li key={ex.id}>
                <Link to={`/lift?tab=library&ex=${encodeURIComponent(ex.id)}`} className="lp-lift">
                  <span>
                    <strong>{ex.name}</strong>
                    <small>{ex.primary.map(muscleName).join(", ")}</small>
                  </span>
                  <ExternalLink size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
