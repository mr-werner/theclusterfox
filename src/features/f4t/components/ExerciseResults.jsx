import { useMemo, useState } from "react";
import { Activity, Minus, Plus, Search } from "lucide-react";
import { activities, activityCategories } from "../data/activities";
import { formatDuration, minutesToBurnCalories } from "../../../domain/exercise/energy";

const PER_PAGE = 12;

// Only group known equivalent activity families; keep all other Compendium rows searchable.
const FAMILIES = [
  { title: "Running — speed", category: "Running", test: (a) => /^Running[, ]+\d/.test(a.description) && /mph/i.test(a.description) },
  { title: "Walking — speed", category: "Walking", test: (a) => /^Walking[, ]+\d/.test(a.description) && /mph/i.test(a.description) },
  { title: "Bicycling — speed", category: "Bicycling", test: (a) => /^Bicycling,\s*(?:[<>]\s*)?\d/.test(a.description) && /mph/i.test(a.description) },
  { title: "Stationary bike — watts", category: "Bicycling", test: (a) => /^Bicycling, stationary,\s*[<>≥]?\s*\d/.test(a.description) && /watts/i.test(a.description) },
  { title: "Elliptical", category: "Conditioning Exercise", test: (a) => /^Elliptical trainer,/i.test(a.description) },
  { title: "Calisthenics", category: "Conditioning Exercise", test: (a) => /^Calisthenics \(/i.test(a.description) },
  { title: "Circuit training — effort", category: "Conditioning Exercise", test: (a) => /^Circuit training, (?:light|moderate|including kettlebells)/i.test(a.description) },
  { title: "Weight training", category: "Conditioning Exercise", test: (a) => /^Resistance \(weight\)/i.test(a.description) },
  { title: "Mountain biking", category: "Bicycling", test: (a) => /^Bicycling, mountain,/i.test(a.description) },
  { title: "E-bike — assistance", category: "Bicycling", test: (a) => /^E-bike \(/i.test(a.description) },
];

function speedFromDescription(description) {
  // Only show a speed when the source states mph explicitly.
  const match = description.match(/(?:[<>]\s*)?(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*mph|(?:[<>]\s*)?(\d+(?:\.\d+)?)\s*mph/i);
  if (!match) return null;
  return match[1] && match[2] ? (Number(match[1]) + Number(match[2])) / 2 : Number(match[3]);
}

function measurement(item) {
  const d = item.description;
  const watts = d.match(/([<>≥]?\s*\d+(?:\s*(?:-|–|to)\s*\d+)?)\s*(?:watts|W)\b/i);
  if (watts) return `${watts[1].trim()} watts`;
  const mph = d.match(/([<>]?\s*\d+(?:\.\d+)?(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?)\s*mph/i);
  if (mph) return `${mph[1].trim()} mph`;
  return d;
}

function Card({ group, calories, weightLbs }) {
  const [index, setIndex] = useState(0);
  const selected = group.options[Math.min(index, group.options.length - 1)];
  const minutes = minutesToBurnCalories(calories, selected.met, weightLbs);
  const speed = speedFromDescription(selected.description);
  const distance = speed !== null && Number.isFinite(minutes) ? (speed * minutes / 60) : null;
  const pace = speed && (group.category === "Running" || group.category === "Walking") ? 60 / speed : null;
  return (
    <article className="exercise-card">
      <Activity size={26} />
      <small>{group.category}</small>
      <h3>{group.title}</h3>
      {group.options.length > 1 && (
        <div className="adjustment-controls" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, margin: "12px 0" }}>
          <button type="button" aria-label="Lower intensity" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}><Minus size={18} /></button>
          <span>{index + 1} / {group.options.length}</span>
          <button type="button" aria-label="Higher intensity" disabled={index === group.options.length - 1} onClick={() => setIndex((i) => Math.min(group.options.length - 1, i + 1))}><Plus size={18} /></button>
        </div>
      )}
      <p className="exercise-description">{measurement(selected)}</p>
      <strong>{Number.isFinite(minutes) ? formatDuration(minutes) : "Unavailable"}</strong>
      {pace !== null && <span>~{Math.floor(pace)}:{String(Math.round((pace % 1) * 60)).padStart(2, "0")} min/mile (estimated)</span>}
      {distance !== null && <span>~{distance.toFixed(1)} miles (estimated)</span>}
      <small>{selected.met} MET · Code {selected.id}</small>
      <small>{selected.description}</small>
    </article>
  );
}

export default function ExerciseResults({ calories, weightLbs }) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PER_PAGE);
  const groups = useMemo(() => {
    const claimed = new Set();
    const result = [];
    for (const family of FAMILIES) {
      const options = activities.filter((a) => a.category === family.category && family.test(a));
      if (options.length < 2) continue;
      options.forEach((a) => claimed.add(a.id));
      result.push({ key: family.title, title: family.title, category: family.category, options: [...options].sort((a, b) => a.met - b.met) });
    }
    for (const a of activities) {
      if (!claimed.has(a.id)) result.push({ key: a.id, title: a.name, category: a.category, options: [a] });
    }
    return result;
  }, []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => (category === "All" || g.category === category) && (!q || g.title.toLowerCase().includes(q) || g.options.some((a) => a.description.toLowerCase().includes(q) || a.id.includes(q))));
  }, [groups, category, search]);
  if (!(calories > 0 && weightLbs > 0)) return null;
  return (
    <section className="exercise-section">
      <div className="exercise-heading">
        <p className="f4t-section-label">MOVEMENT COMPARISON</p>
        <h2>What does {Math.round(calories).toLocaleString()} calories look like?</h2>
        <p>Search the 2024 Adult Compendium. Adjust documented levels where comparable options exist.</p>
      </div>
      <div className="exercise-filters" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
        <label className="exercise-search"><Search size={18} /><input type="search" placeholder="Search activities or codes" value={search} onChange={(e) => { setSearch(e.target.value); setVisible(PER_PAGE); }} /></label>
        <select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setVisible(PER_PAGE); }}>
          <option value="All">All categories</option>
          {activityCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p>Showing {Math.min(visible, filtered.length)} of {filtered.length} activity groups and individual entries</p>
      <div className="exercise-grid">
        {filtered.slice(0, visible).map((g) => <Card key={g.key} group={g} calories={calories} weightLbs={weightLbs} />)}
      </div>
      {visible < filtered.length && <button type="button" className="exercise-show-more" onClick={() => setVisible((n) => n + PER_PAGE)}>Show more activities</button>}
      <div className="science-note"><strong>But that's not the whole story.</strong><p>Your body uses energy even at rest. These estimates provide context, not a prescription to burn off food. MET values are from the Compendium; distances derived from speed ranges are approximate.</p></div>
    </section>
  );
}
