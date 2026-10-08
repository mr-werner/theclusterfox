
import { useMemo, useState } from "react";
import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  PersonStanding,
  Waves,
  Snowflake,
  Music,
  House,
  Trophy,
  Gamepad2,
  ChevronDown,
  Minus,
  Plus,
  Search,
} from "lucide-react";

import {
  activities,
  activityCategories,
} from "../data/activities";

import {
  calculateDistance,
  formatDuration,
  minutesToBurnCalories,
} from "../../../domain/exercise/energy";

const INITIAL_VISIBLE = 8;
const LOAD_MORE = 8;

const categoryIcons = {
  Bicycling: Bike,
  "Conditioning Exercise": Dumbbell,
  Dancing: Music,
  "Home Activities": House,
  "Lawn & Garden": House,
  Running: PersonStanding,
  Walking: Footprints,
  Sports: Trophy,
  "Water Activities": Waves,
  "Winter Activities": Snowflake,
  "Video Games": Gamepad2,
};

function getSpeed(activity) {
  if (Number.isFinite(activity.speedMph)) {
    return activity.speedMph;
  }

  const min = activity.speedMinMph;
  const max = activity.speedMaxMph;

  if (Number.isFinite(min) && Number.isFinite(max)) {
    return (min + max) / 2;
  }

  // No reliable speed for an open-ended range.
  return null;
}

function getAdjustmentLabel(activity) {
  switch (activity.adjustmentType) {
    case "speed":
      return "Speed";
    case "watts":
      return "Resistance";
    case "intensity":
      return "Intensity";
    default:
      return "Activity";
  }
}

function ExerciseCard({ group, calories, weightLbs }) {
  const [level, setLevel] = useState(0);

  const options = group.options;
  const safeLevel = Math.min(level, options.length - 1);
  const activity = options[safeLevel];

  const Icon =
    categoryIcons[group.category] || Activity;

  const minutes = minutesToBurnCalories(
    calories,
    activity.met,
    weightLbs
  );

  const speed = getSpeed(activity);

  const distance =
    speed !== null && Number.isFinite(minutes)
      ? calculateDistance(minutes, speed)
      : null;

  const adjustable = options.length > 1;

  return (
    <article className="exercise-card">
      <div className="exercise-card-top">
        <Icon size={27} />

        <span className="exercise-category">
          {group.category}
        </span>
      </div>

      <h3>{group.name}</h3>

      <div className="exercise-adjustment">
        <span className="adjustment-label">
          {getAdjustmentLabel(activity)}
        </span>

        {adjustable && (
          <div className="adjustment-controls">
            <button
              type="button"
              aria-label={`Decrease ${group.name} intensity`}
              disabled={safeLevel === 0}
              onClick={() =>
                setLevel((current) =>
                  Math.max(0, current - 1)
                )
              }
            >
              <Minus size={17} />
            </button>

            <span>
              {safeLevel + 1} / {options.length}
            </span>

            <button
              type="button"
              aria-label={`Increase ${group.name} intensity`}
              disabled={safeLevel === options.length - 1}
              onClick={() =>
                setLevel((current) =>
                  Math.min(options.length - 1, current + 1)
                )
              }
            >
              <Plus size={17} />
            </button>
          </div>
        )}
      </div>

      <p className="exercise-description">
        {activity.description}
      </p>

      <strong>
        {Number.isFinite(minutes)
          ? formatDuration(minutes)
          : "Unavailable"}
      </strong>

      {distance !== null &&
        Number.isFinite(distance) && (
          <span>
            ~{distance.toFixed(1)} miles
          </span>
        )}

      <small>{activity.met} MET</small>
    </article>
  );
}

export default function ExerciseResults({
  calories,
  weightLbs,
}) {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] =
    useState(INITIAL_VISIBLE);

  const groupedActivities = useMemo(() => {
    const groups = new Map();

    for (const activity of activities) {
      const key = `${activity.category}::${activity.name}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: activity.name,
          category: activity.category,
          options: [],
        });
      }

      groups.get(key).options.push(activity);
    }

    return Array.from(groups.values()).map((group) => {
      const options = [...group.options];

      // Higher MET generally means greater effort.
      // E-bike assistance is the exception:
      // more support means less effort.
      options.sort((a, b) => a.met - b.met);

      return { ...group, options };
    });
  }, []);

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return groupedActivities.filter((group) => {
      const matchesCategory =
        category === "All" ||
        group.category === category;

      const matchesSearch =
        !query ||
        group.name.toLowerCase().includes(query) ||
        group.category.toLowerCase().includes(query) ||
        group.options.some((option) =>
          option.description
            .toLowerCase()
            .includes(query)
        );

      return matchesCategory && matchesSearch;
    });
  }, [groupedActivities, category, search]);

  const visibleActivities = filteredActivities.slice(
    0,
    visibleCount
  );

  function changeCategory(value) {
    setCategory(value);
    setVisibleCount(INITIAL_VISIBLE);
  }

  function changeSearch(value) {
    setSearch(value);
    setVisibleCount(INITIAL_VISIBLE);
  }

  if (!calories || !weightLbs) {
    return null;
  }

  return (
    <section className="exercise-section">
      <div className="exercise-heading">
        <p className="f4t-section-label">
          MOVEMENT COMPARISON
        </p>

        <h2>
          What does{" "}
          {Math.round(calories).toLocaleString()}{" "}
          calories look like?
        </h2>

        <p>
          Explore exercise equivalents based on your
          body weight. Adjust the intensity or speed
          to see how the results change.
        </p>
      </div>

      <div className="exercise-filters">
        <label className="exercise-search">
          <Search size={18} />

          <input
            type="search"
            placeholder="Search activities..."
            value={search}
            onChange={(event) =>
              changeSearch(event.target.value)
            }
          />
        </label>

        <select
          aria-label="Filter activity category"
          value={category}
          onChange={(event) =>
            changeCategory(event.target.value)
          }
        >
          <option value="All">
            All Categories
          </option>

          {activityCategories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <p className="exercise-results-count">
        Showing {visibleActivities.length} of{" "}
        {filteredActivities.length} activities
      </p>

      <div className="exercise-grid">
        {visibleActivities.map((group) => (
          <ExerciseCard
            key={group.key}
            group={group}
            calories={calories}
            weightLbs={weightLbs}
          />
        ))}
      </div>

      {filteredActivities.length === 0 && (
        <p className="exercise-empty">
          No matching activities found.
        </p>
      )}

      {visibleCount < filteredActivities.length && (
        <button
          type="button"
          className="exercise-show-more"
          onClick={() =>
            setVisibleCount((current) =>
              current + LOAD_MORE
            )
          }
        >
          Show More Activities
          <ChevronDown size={18} />
        </button>
      )}

      <div className="science-note">
        <strong>
          But that's not the whole story.
        </strong>

        <p>
          Your body uses energy continuously — even
          when you're resting. These exercise
          equivalents are provided for context, not
          as a prescription to "burn off" what you
          eat.
        </p>
      </div>
    </section>
  );
}
