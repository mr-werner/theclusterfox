import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, PlayCircle } from "lucide-react";

import ExerciseDemo from "../../lift/components/ExerciseDemo";
import { exercises, videoSearchUrl } from "../../lift/data/exercises";
import { equipment, equipmentById } from "../../lift/data/equipment";
import { muscleName, muscles } from "../../lift/data/muscles";
import "../../lift/lift.css";

const LEVELS = { 1: "Beginner", 2: "Intermediate", 3: "Advanced" };

// Only animate the demos on screen: a hundred looping figures at once would
// bog down a phone.
function LazyDemo({ exercise }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="dev-lift-demo">
      {visible ? <ExerciseDemo exercise={exercise} /> : <div className="ld-demo dev-lift-demo-placeholder" />}
    </div>
  );
}

/** Every LiftFox exercise at once: demo, muscles, gear, level, steps and tip. */
export default function LiftCatalog({ query }) {
  const [muscle, setMuscle] = useState("");
  const [gear, setGear] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      ex =>
        (!muscle || ex.primary.includes(muscle) || ex.secondary.includes(muscle)) &&
        (!gear || (gear === "none" ? ex.gear.length === 0 : ex.gear.includes(gear))) &&
        (!q || `${ex.name} ${ex.id} ${ex.demo} ${ex.steps.join(" ")}`.toLowerCase().includes(q))
    );
  }, [query, muscle, gear]);

  const demosUsed = new Set(exercises.map(ex => ex.demo)).size;

  return (
    <div className="lf dev-lift">
      <div className="dev-filters">
        <select value={muscle} onChange={e => setMuscle(e.target.value)} aria-label="Muscle">
          <option value="">All muscles</option>
          {muscles.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select value={gear} onChange={e => setGear(e.target.value)} aria-label="Equipment">
          <option value="">Any gear</option>
          <option value="none">Bodyweight only</option>
          {equipment.map(g => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <span className="dev-muted">
          {shown.length} of {exercises.length} exercises · {demosUsed} demo motions
        </span>
      </div>

      <div className="dev-lift-grid">
        {shown.map(ex => (
          <article key={ex.id} className="dev-lift-card">
            <LazyDemo exercise={ex} />
            <div className="dev-lift-body">
              <h3>{ex.name}</h3>
              <p className="dev-muted dev-small">
                {LEVELS[ex.level]} · {ex.kind} · demo <code>{ex.demo}</code>
                {ex.timed ? " · timed hold" : ""}
                {ex.perSide ? " · per side" : ""}
              </p>
              <p className="dev-chips">
                {ex.primary.map(m => (
                  <span key={m} className="dev-chip dev-chip--strong">
                    {muscleName(m)}
                  </span>
                ))}
                {ex.secondary.map(m => (
                  <span key={m} className="dev-chip">
                    {muscleName(m)}
                  </span>
                ))}
              </p>
              <p className="dev-small">
                <strong>Gear:</strong>{" "}
                {ex.gear.length ? ex.gear.map(g => equipmentById.get(g)?.name ?? g).join(", ") : "Bodyweight"}
              </p>
              <ol className="dev-steps">
                {ex.steps.map(step => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p className="dev-small">
                <strong>Tip:</strong> {ex.tip}
              </p>
              <a className="dev-link" href={videoSearchUrl(ex)} target="_blank" rel="noreferrer">
                <PlayCircle size={14} aria-hidden="true" /> Video demos <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
