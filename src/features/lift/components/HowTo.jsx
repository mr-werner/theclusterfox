import { ExternalLink, PlayCircle } from "lucide-react";

import ExerciseDemo from "./ExerciseDemo";
import { videoSearchUrl } from "../data/exercises";
import { equipmentById } from "../data/equipment";
import { muscleName } from "../data/muscles";

/** The animated demo, step-by-step instructions and a link to videos. */
export default function HowTo({ exercise }) {
  return (
    <div className="lf-howto">
      <ExerciseDemo exercise={exercise} />
      <div>
        <ol className="lf-steps">
          {exercise.steps.map(step => <li key={step}>{step}</li>)}
        </ol>
        <p className="lf-tip"><strong>Tip:</strong> {exercise.tip}</p>
        <p className="lf-muted lf-small">
          Works {exercise.primary.map(muscleName).join(", ").toLowerCase()}
          {exercise.secondary.length > 0 && <> and helps {exercise.secondary.map(muscleName).join(", ").toLowerCase()}</>}.
          {exercise.gear.length > 0 && <> Needs: {exercise.gear.map(g => equipmentById.get(g)?.name.toLowerCase()).join(", ")}.</>}
        </p>
        <a className="lf-video" href={videoSearchUrl(exercise)} target="_blank" rel="noreferrer">
          <PlayCircle size={16} aria-hidden="true" />
          Watch video demos
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
