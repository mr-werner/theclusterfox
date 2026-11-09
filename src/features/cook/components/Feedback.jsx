import { useState } from "react";
import { PartyPopper } from "lucide-react";
import { Segmented } from "./ui";

// Quick, optional questions after cooking. Every answer can be skipped.
export default function Feedback({ recipe, minutes, onSave }) {
  const [rating, setRating] = useState(null);
  const [again, setAgain] = useState(null);
  const [timing, setTiming] = useState(null);
  const [note, setNote] = useState("");

  return (
    <div className="ck-cook ck-feedback" role="region" aria-labelledby="ck-fb-h">
      <main className="ck-cook-body">
        <div className="ck-feedback-hero">
          <PartyPopper size={40} aria-hidden="true" />
          <h2 id="ck-fb-h">You made {recipe.title}!</h2>
          <p className="ck-lede">
            About {minutes} minutes from start to finish. A few quick questions, all optional, to help pick what you'll love next.
          </p>
        </div>
        <div className="ck-panel">
          <h3>How was it?</h3>
          <Segmented
            label="How was it?"
            value={rating}
            onChange={v => setRating(v === rating ? null : v)}
            options={[
              { value: "loved", label: "Loved it" },
              { value: "good", label: "It was good" },
              { value: "meh", label: "Not for me" },
            ]}
          />
          <h3>Make it again?</h3>
          <Segmented
            label="Make it again?"
            value={again}
            onChange={v => setAgain(v === again ? null : v)}
            options={[
              { value: true, label: "Yes" },
              { value: false, label: "Probably not" },
            ]}
          />
          <h3>
            The recipe says {recipe.time.total} minutes. Did it take...
          </h3>
          <Segmented
            label="Timing"
            value={timing}
            onChange={v => setTiming(v === timing ? null : v)}
            options={[
              { value: "faster", label: "Less" },
              { value: "right", label: "About right" },
              { value: "slower", label: "Longer" },
            ]}
          />
          <label className="ck-field">
            <span>Notes for next time</span>
            <textarea rows={3} maxLength={500} placeholder="More garlic, less salt, try it with rice..." value={note} onChange={e => setNote(e.target.value)} />
          </label>
        </div>
      </main>
      <footer className="ck-cook-nav">
        <button type="button" className="ck-btn ck-btn--big" onClick={() => onSave({})}>
          Skip
        </button>
        <button type="button" className="ck-btn ck-btn--primary ck-btn--big" onClick={() => onSave({ rating, again, timing, note: note.trim() })}>
          Save to my history
        </button>
      </footer>
    </div>
  );
}
