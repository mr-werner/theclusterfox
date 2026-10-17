import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";

import ActivityCard from "./ActivityCard";
import { activityCategories } from "../data/activities";
import { formatCalories } from "../mealMath";

const PAGE_SIZE = 12;

function matches(group, query) {
  if (!query) return true;
  const haystack = [
    group.title,
    group.category,
    ...group.options.flatMap(option => [option.description, option.adjustmentValue, option.id]),
  ].join(" ").toLowerCase();
  return query.split(/\s+/).every(word => haystack.includes(word));
}

export default function ActivityExplorer({
  groups,
  favoriteKeys,
  selections,
  calories,
  weightLbs,
  onToggleFavorite,
  onSelect,
}) {
  const favoriteSet = useMemo(() => new Set(favoriteKeys), [favoriteKeys]);
  const groupsByKey = useMemo(() => new Map(groups.map(group => [group.key, group])), [groups]);
  const favoriteGroups = favoriteKeys.map(key => groupsByKey.get(key)).filter(Boolean);

  const [tab, setTab] = useState(favoriteGroups.length ? "favorites" : "all");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const query = search.trim().toLowerCase();
  const browseGroups = useMemo(
    () => groups.filter(group => (category === "All" || group.category === category) && matches(group, query)),
    [groups, category, query]
  );

  const ready = calories > 0 && weightLbs > 0;
  const cardProps = { calories, weightLbs, selections, onToggleFavorite, onSelect };

  function resetPaging(update) {
    update();
    setVisible(PAGE_SIZE);
  }

  return (
    <section className="ff-section" aria-labelledby="ff-activity-title">
      <div className="ff-section-head">
        <div>
          <p className="ff-eyebrow">BURN IT OFF</p>
          <h2 id="ff-activity-title">
            {ready ? `What ${formatCalories(calories)} calories looks like` : "Activities"}
          </h2>
          <p className="ff-section-sub">
            {ready
              ? "Time to burn it above your resting rate. Slide any card to change speed or effort."
              : "Add food and your weight to see how long each activity takes. Star the ones you do."}
          </p>
        </div>
      </div>

      <div className="ff-tabs" role="tablist" aria-label="Activity lists">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "favorites"}
          className={tab === "favorites" ? "is-active" : ""}
          onClick={() => setTab("favorites")}
        >
          <Star size={15} fill={tab === "favorites" ? "currentColor" : "none"} /> Favorites
          <span className="ff-count">{favoriteGroups.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={tab === "all" ? "is-active" : ""}
          onClick={() => setTab("all")}
        >
          All activities <span className="ff-count">{groups.length}</span>
        </button>
      </div>

      {tab === "favorites" ? (
        favoriteGroups.length ? (
          <div className="ff-grid">
            {favoriteGroups.map(group => (
              <ActivityCard key={group.key} group={group} favorite {...cardProps} />
            ))}
          </div>
        ) : (
          <p className="ff-empty">
            <Star size={18} aria-hidden="true" />
            No favorites yet. Open <strong>All activities</strong> and tap the star on anything you do.
          </p>
        )
      ) : (
        <>
          <div className="ff-filters">
            <label className="ff-search-bar ff-search-bar-small">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder="Search activities, like “swim” or “yoga”"
                aria-label="Search activities"
                onChange={event => resetPaging(() => setSearch(event.target.value))}
              />
            </label>
            <div className="ff-chips" role="group" aria-label="Category">
              {["All", ...activityCategories].map(name => (
                <button
                  key={name}
                  type="button"
                  className={`ff-chip ${category === name ? "is-active" : ""}`}
                  aria-pressed={category === name}
                  onClick={() => resetPaging(() => setCategory(name))}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {browseGroups.length ? (
            <div className="ff-grid">
              {browseGroups.slice(0, visible).map(group => (
                <ActivityCard key={group.key} group={group} favorite={favoriteSet.has(group.key)} {...cardProps} />
              ))}
            </div>
          ) : (
            <p className="ff-empty">No activities match that search.</p>
          )}

          {visible < browseGroups.length && (
            <button type="button" className="ff-btn ff-more" onClick={() => setVisible(count => count + PAGE_SIZE)}>
              Show more ({browseGroups.length - visible} left)
            </button>
          )}
        </>
      )}

      <p className="ff-footnote">
        Estimates use your weight and published MET values from the 2024 Adult Compendium of Physical Activities,
        counting only the calories burned above rest. Similar activities are combined into one card you can adjust.
      </p>
    </section>
  );
}
