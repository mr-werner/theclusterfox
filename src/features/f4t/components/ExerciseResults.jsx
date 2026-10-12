import { useEffect, useMemo, useState } from "react";
import { Activity, Search, Minus, Plus, Star } from "lucide-react";
import { activityCategories } from "../data/activities";
import { buildActivityGroups } from "../data/activityGroups";
import { formatDuration, minutesToBurnCalories } from "../../../domain/exercise/energy";
import "./f4tDashboard.css";

const FAVORITES_KEY = "f4t-favorites-v1";
const SELECTIONS_KEY = "f4t-activity-selections-v2";
const PAGE_SIZE = 12;
const DEFAULT_FAVORITES = [
  { category: "Walking", match: /walking.*(speed|level|pace)/i },
  { category: "Running", match: /running.*(speed|level|pace)/i },
  { category: "Bicycling", match: /bicycling.*(speed|leisure)/i },
  { category: "Conditioning Exercise", match: /resistance|weight training/i },
];

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => readStorage(key, fallback));
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }, [key, value]);
  return [value, setValue];
}

function defaultFavoriteKeys(groups) {
  return DEFAULT_FAVORITES.map(rule => groups.find(group =>
    group.category === rule.category && group.options.length > 1 && rule.match.test(group.title)
  )?.key).filter(Boolean);
}

function ActivityCard({ group, calories, weightLbs, selections, setSelections, favorite, toggleFavorite }) {
  const selectedIndex = Math.max(0, group.options.findIndex(option => option.id === selections[group.key]));
  const selected = group.options[selectedIndex];
  const minutes = minutesToBurnCalories(calories, selected.met, weightLbs, "net");
  const hasOptions = group.options.length > 1;

  function select(index) {
    if (index < 0 || index >= group.options.length) return;
    setSelections(current => ({ ...current, [group.key]: group.options[index].id }));
  }

  return (
    <article className="f4t-dash-card">
      <div className="f4t-dash-card-top">
        <span className="f4t-dash-card-icon"><Activity size={22} aria-hidden="true" /></span>
        <button className={`f4t-dash-star ${favorite ? "is-favorite" : ""}`} type="button"
          aria-label={favorite ? `Remove ${group.title} from favorites` : `Add ${group.title} to favorites`}
          aria-pressed={favorite} title={favorite ? "Remove favorite" : "Add favorite"}
          onClick={() => toggleFavorite(group.key)}>
          <Star size={21} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="f4t-dash-card-title">
        <span className="f4t-dash-category">{group.category}</span>
        <h4>{group.title}</h4>
      </div>
      {hasOptions && (
        <div className="f4t-dash-variation">
          <label htmlFor={`f4t-dash-option-${group.key}`}>{group.adjustmentLabel || "Variation"}</label>
          <div className="f4t-dash-adjuster">
            <button type="button" disabled={selectedIndex === 0}
              aria-label={`Decrease ${group.adjustmentLabel || "variation"}`}
              onClick={() => select(selectedIndex - 1)}><Minus size={16} /></button>
            <select id={`f4t-dash-option-${group.key}`} value={selected.id}
              onChange={event => select(group.options.findIndex(option => option.id === event.target.value))}>
              {group.options.map(option => (
                <option key={option.id} value={option.id}>{option.adjustmentValue} · {option.met} MET</option>
              ))}
            </select>
            <button type="button" disabled={selectedIndex === group.options.length - 1}
              aria-label={`Increase ${group.adjustmentLabel || "variation"}`}
              onClick={() => select(selectedIndex + 1)}><Plus size={16} /></button>
          </div>
        </div>
      )}
      <div className="f4t-dash-result">
        <strong>{Number.isFinite(minutes) ? formatDuration(minutes) : "No additional calories burned"}</strong>
        <span>{selected.met} MET <span aria-hidden="true">·</span> Code {selected.id}</span>
      </div>
      <p className="f4t-dash-description">{selected.description}</p>
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
  const favoriteGroups = useMemo(() => favoriteKeys.map(key => groups.find(group => group.key === key)).filter(Boolean), [favoriteKeys, groups]);
  const browseGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return groups.filter(group => !favoriteSet.has(group.key)
      && (category === "All" || group.category === category)
      && (!query || group.title.toLowerCase().includes(query)
        || group.options.some(option => option.description.toLowerCase().includes(query) || option.id.includes(query))));
  }, [groups, favoriteSet, category, search]);

  function toggleFavorite(key) {
    setFavorites(current => {
      const keys = Array.isArray(current) ? current : defaultFavoriteKeys(groups);
      return keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key];
    });
  }

  if (!(Number(calories) > 0 && Number(weightLbs) > 0)) return null;
  const cardProps = { calories, weightLbs, selections, setSelections, toggleFavorite };

  return (
    <section className="f4t-dash" aria-label="Live activity comparisons">
      <header className="f4t-dash-header">
        <span className="f4t-dash-eyebrow">ACTIVITY COMPARISON</span>
        <h2>What does {Math.round(calories).toLocaleString()} calories look like?</h2>
        <p>Additional calories burned above rest. Your results update as you edit your meal.</p>
      </header>

      <section className="f4t-dash-section" aria-labelledby="f4t-favorites-title">
        <div className="f4t-dash-section-heading">
          <h3 id="f4t-favorites-title">Your favorites <span>{favoriteGroups.length}</span></h3>
          <p>Adjust your usual activities instantly.</p>
        </div>
        {favoriteGroups.length ? (
          <div className="f4t-dash-grid">
            {favoriteGroups.map(group => <ActivityCard key={group.key} group={group} favorite {...cardProps} />)}
          </div>
        ) : <p className="f4t-dash-empty">No favorites yet. Find an activity below and select its star.</p>}
      </section>

      <section className="f4t-dash-section f4t-dash-browse" aria-labelledby="f4t-browse-title">
        <div className="f4t-dash-section-heading">
          <h3 id="f4t-browse-title">Browse all activities</h3>
          <p>Search the Compendium and star activities to add them above.</p>
        </div>
        <div className="f4t-dash-filters">
          <label className="f4t-dash-search">
            <Search size={18} aria-hidden="true" />
            <input type="search" aria-label="Search activities or codes" value={search}
              placeholder="Search activities or codes" onChange={event => { setSearch(event.target.value); setVisible(PAGE_SIZE); }} />
          </label>
          <select aria-label="Activity category" value={category}
            onChange={event => { setCategory(event.target.value); setVisible(PAGE_SIZE); }}>
            <option value="All">All categories</option>
            {activityCategories.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        {browseGroups.length ? (
          <div className="f4t-dash-grid">
            {browseGroups.slice(0, visible).map(group => <ActivityCard key={group.key} group={group} favorite={false} {...cardProps} />)}
          </div>
        ) : <p className="f4t-dash-empty">No matching activities outside your favorites.</p>}
        {visible < browseGroups.length && (
          <button className="f4t-dash-more" type="button" onClick={() => setVisible(count => count + PAGE_SIZE)}>
            Show more activities ({browseGroups.length - visible} remaining)
          </button>
        )}
      </section>
      <p className="f4t-dash-footnote">Calorie estimates use net energy above rest and published MET values. Favorites and settings are saved in this browser.</p>
    </section>
  );
}
