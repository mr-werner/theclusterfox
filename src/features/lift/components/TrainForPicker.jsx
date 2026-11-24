import { muscleName } from "../data/muscles";
import { priorityMuscles, TRAIN_FOR_KINDS, trainFor, trainForById } from "../data/trainFor";

/**
 * "Training for something?": pick a sport, activity or lifestyle goal and
 * LiftFox steers the workout toward it. Picking the same one again clears it.
 */
export default function TrainForPicker({ value, onChange }) {
  const picked = value ? trainForById.get(value) : null;
  return (
    <div className="lf-trainfor">
      {TRAIN_FOR_KINDS.map(kind => (
        <div key={kind.id} className="lf-trainfor-group">
          <h3>{kind.name}</h3>
          <div className="lf-chips">
            {trainFor.filter(t => t.kind === kind.id).map(t => (
              <button key={t.id} type="button" className="lf-chip" aria-pressed={value === t.id} onClick={() => onChange(value === t.id ? null : t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {picked && (
        <div className="lf-trainfor-why" aria-live="polite">
          <p>
            <strong>{picked.name}:</strong> {picked.why}
          </p>
          <p className="lf-muted lf-small">
            Top muscles: {priorityMuscles(picked).slice(0, 4).map(muscleName).join(", ")}. We'll favour moves that carry over, add a{" "}
            {picked.name.toLowerCase()} warm-up drill, and list extra work to do outside the weights room.
          </p>
        </div>
      )}
    </div>
  );
}
