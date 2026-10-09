import { useEffect, useMemo, useState } from "react";
import { Activity, Search, Minus, Plus, Star } from "lucide-react";
import { activityCategories } from "../data/activities";
import { buildActivityGroups } from "../data/activityGroups";
import { formatDuration, minutesToBurnCalories } from "../../../domain/exercise/energy";

const FAVORITES_KEY = "f4t-favorites-v1";
const SELECTIONS_KEY = "f4t-activity-selections-v2"; // preserve existing choices
const PAGE_SIZE = 12;
const DEFAULT_FAVORITES = [
  { category: "Walking", match: /walking.*(speed|level|pace)/i },
  { category: "Running", match: /running.*(speed|level|pace)/i },
  { category: "Bicycling", match: /bicycling.*(speed|leisure)/i },
  { category: "Conditioning Exercise", match: /resistance|weight training/i },
];

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => readStorage(key, fallback));
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}
function defaultFavoriteKeys(groups) {
  return DEFAULT_FAVORITES.map(rule => groups.find(g =>
    g.category === rule.category && g.options.length > 1 && rule.match.test(g.title)
  )?.key).filter(Boolean);
}
function GroupCard({ group, calories, weightLbs, selections, setSelections, favorite, toggleFavorite }) {
  const selectedIndex = Math.max(0, group.options.findIndex(a => a.id === selections[group.key]));
  const selected = group.options[selectedIndex];
  const minutes = minutesToBurnCalories(calories, selected.met, weightLbs, "net");
  function select(index) {
    if (index < 0 || index >= group.options.length) return;
    setSelections(prev => ({ ...prev, [group.key]: group.options[index].id }));
  }
  return (
    <article className="exercise-card f4t-activity-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <Activity size={24} aria-hidden="true" />
        <button type="button" aria-label={favorite ? `Remove ${group.title} from favorites` : `Add ${group.title} to favorites`}
          title={favorite ? "Remove favorite" : "Add favorite"} aria-pressed={favorite}
          onClick={() => toggleFavorite(group.key)} style={{ background: "transparent", border: 0, cursor: "pointer", padding: 4 }}>
          <Star size={21} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <small>{group.category}</small>
      <h3>{group.title}</h3>
      {group.options.length > 1 && (
        <div style={{ margin: "12px 0" }}>
          <label htmlFor={`activity-${group.key}`} style={{ display: "block", marginBottom: 6 }}>
            {group.adjustmentLabel || "Variation"}
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" aria-label={`Decrease ${group.adjustmentLabel || "variation"}`} disabled={selectedIndex === 0}
              onClick={() => select(selectedIndex - 1)}><Minus size={16} /></button>
            <select id={`activity-${group.key}`} value={selected.id} onChange={e => select(group.options.findIndex(a => a.id === e.target.value))}
              style={{ flex: 1, minWidth: 0 }}>
              {group.options.map(a => <option key={a.id} value={a.id}>{a.adjustmentValue} · {a.met} MET</option>)}
            </select>
            <button type="button" aria-label={`Increase ${group.adjustmentLabel || "variation"}`} disabled={selectedIndex === group.options.length - 1}
              onClick={() => select(selectedIndex + 1)}><Plus size={16} /></button>
          </div>
        </div>
      )}
      <strong style={{ display: "block", fontSize: "1.4rem", marginTop: 12 }}>
        {Number.isFinite(minutes) ? formatDuration(minutes) : "No additional calories burned"}
      </strong>
      <small>{selected.met} MET · Code {selected.id}</small>
      <p className="exercise-description">{selected.description}</p>
    </article>
  );
}

export default function ExerciseResults({ calories, weightLbs }) {
  const groups = useMemo(() => buildActivityGroups(), []);
  const [favorites, setFavorites] = useStoredState(FAVORITES_KEY, null);
  const [selections, setSelections] = useStoredState(SELECTIONS_KEY, {});
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const favoriteKeys = useMemo(() => Array.isArray(favorites) ? favorites : defaultFavoriteKeys(groups), [favorites, groups]);
  const favoriteSet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  function toggleFavorite(key) {
    setFavorites(current => {
      const keys = Array.isArray(current) ? current : defaultFavoriteKeys(groups);
      return keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key];
    });
  }
  const favoriteGroups = useMemo(() => favoriteKeys.map(key => groups.find(g => g.key === key)).filter(Boolean), [groups, favoriteKeys]);
  const browseGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter(g => !favoriteSet.has(g.key) &&
      (category === "All" || g.category === category) &&
      (!query || g.title.toLowerCase().includes(query) || g.options.some(a =>
        a.description.toLowerCase().includes(query) || a.id.includes(query))));
  }, [groups, favoriteSet, category, search]);
  if (!(Number(calories) > 0 && Number(weightLbs) > 0)) return null;
  return (
    <section className="exercise-results f4t-live-results" aria-label="Live activity comparisons">
      <style>{`
        .f4t-live-results, .f4t-live-results * { box-sizing: border-box; }
        .f4t-live-results { width: 100%; max-width: 100%; min-width: 0; }
        .f4t-live-results .f4t-activity-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)) !important;
          gap: 16px; width: 100%; max-width: 100%; min-width: 0;
        }
        .f4t-live-results .f4t-activity-card {
          width: 100% !important; max-width: 100% !important; min-width: 0 !important;
          overflow-wrap: anywhere; overflow: hidden;
        }
        .f4t-live-results .f4t-activity-card select,
        .f4t-live-results .f4t-activity-card input { min-width: 0; max-width: 100%; }
        .f4t-live-results .f4t-browse-controls {
          display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
          gap: 12px; margin: 16px 0; max-width: 100%;
        }
        .f4t-live-results .f4t-browse-controls > * { min-width: 0; width: 100%; }
        .f4t-live-results .f4t-browse-controls input,
        .f4t-live-results .f4t-browse-controls select { min-width: 0; width: 100%; max-width: 100%; }
        .f4t-live-results .f4t-activity-section { margin: 26px 0; min-width: 0; }
        @media (max-width: 620px) {
          .f4t-live-results .f4t-activity-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .f4t-live-results .f4t-browse-controls { grid-template-columns: minmax(0, 1fr); }
        }
      `}</style>
      <h2>What does {Math.round(calories).toLocaleString()} calories look like?</h2>
      <p>Net calories above rest. Results update automatically when your meal, weight, or activity settings change.</p>
      <div className="f4t-activity-section">
        <h3>Favorite activities ({favoriteGroups.length})</h3>
        {favoriteGroups.length === 0 ? (
          <p>No favorites yet. Search below and select a star to add activities here.</p>
        ) : (
          <div className="f4t-activity-grid">
            {favoriteGroups.map(g => <GroupCard key={g.key} group={g} calories={calories} weightLbs={weightLbs}
              selections={selections} setSelections={setSelections} favorite toggleFavorite={toggleFavorite} />)}
          </div>
        )}
      </div>
      <div className="f4t-activity-section">
        <h3>Browse all activities</h3>
        <p>Find more activities and star them to add to your favorites above.</p>
        <div className="f4t-browse-controls">
          <label className="exercise-search" style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
            <Search size={18} style={{ flexShrink: 0 }} />
            <input type="search" value={search} placeholder="Search activities or codes"
              onChange={e => { setSearch(e.target.value); setVisible(PAGE_SIZE); }} />
          </label>
          <select aria-label="Activity category" value={category} onChange={e => { setCategory(e.target.value); setVisible(PAGE_SIZE); }}>
            <option value="All">All categories</option>
            {activityCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {browseGroups.length === 0 && <p>No matching activities outside your favorites.</p>}
        <div className="f4t-activity-grid">
          {browseGroups.slice(0, visible).map(g => <GroupCard key={g.key} group={g} calories={calories} weightLbs={weightLbs}
            selections={selections} setSelections={setSelections} favorite={false} toggleFavorite={toggleFavorite} />)}
        </div>
        {visible < browseGroups.length && <button type="button" className="exercise-show-more"
          onClick={() => setVisible(v => v + PAGE_SIZE)}>Show more activities</button>}
      </div>
      <p className="science-note">MET estimates are approximate. Calculations consistently use energy expenditure above rest. Favorites and selections are stored in this browser.</p>
    </section>
  );
}
