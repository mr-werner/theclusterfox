import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  PersonStanding,
} from "lucide-react";

import { activities } from "../data/activities";

import {
  calculateDistance,
  formatDuration,
  minutesToBurnCalories,
} from "../../../domain/exercise/energy";

const icons = {
  walking: Footprints,
  running: PersonStanding,
  cycling: Bike,
  strength: Dumbbell,
};

export default function ExerciseResults({
  calories,
  weightLbs,
}) {
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
          Approximate exercise equivalents based on
          your body weight.
        </p>
      </div>

      <div className="exercise-grid">
        {activities.map((activity) => {
          const Icon = icons[activity.id] || Activity;

          const minutes =
            minutesToBurnCalories(
              calories,
              activity.met,
              weightLbs
            );

          const distance = calculateDistance(
            minutes,
            activity.speedMph
          );

          return (
            <article
              className="exercise-card"
              key={activity.id}
            >
              <Icon size={27} />

              <h3>{activity.name}</h3>

              <strong>
                {formatDuration(minutes)}
              </strong>

              {distance !== null && (
                <span>
                  ~{distance.toFixed(1)} miles
                </span>
              )}

              <small>
                {activity.description}
              </small>
            </article>
          );
        })}
      </div>

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