import { useState } from "react";
import { Hand, Minus, Plus } from "lucide-react";

import { fromHands, HAND_KEYS, HANDS, handsText } from "../model/portions.js";

const ZERO = { palms: 0, handfuls: 0, fists: 0, thumbs: 0 };

/**
 * No label to read? Count the plate in hands. Adds one plate item with the
 * estimated calories.
 */
export default function HandEstimate({ onAdd }) {
  const [hands, setHands] = useState(ZERO);
  const est = fromHands(hands);
  const any = HAND_KEYS.some(k => hands[k] > 0);
  const step = (k, d) => setHands(h => ({ ...h, [k]: Math.max(0, Math.min(10, h[k] + d)) }));

  return (
    <section className="ff-panel fp-handest" aria-labelledby="fp-handest-title">
      <h2 id="fp-handest-title"><Hand size={20} aria-hidden="true" /> Count it in hands</h2>
      <p className="fp-fine">Restaurant plate, a friend's cooking, no label? Count what was on the plate using your own hand.</p>
      <ul>
        {HAND_KEYS.map(k => (
          <li key={k}>
            <span>
              <strong>{HANDS[k].plural[0].toUpperCase() + HANDS[k].plural.slice(1)} of {HANDS[k].what}</strong>
              <small>{HANDS[k].hint}</small>
            </span>
            <div className="fp-portions" role="group" aria-label={`${HANDS[k].plural} of ${HANDS[k].what}`}>
              <button type="button" onClick={() => step(k, -0.5)} disabled={!hands[k]} aria-label="Fewer">
                <Minus size={13} />
              </button>
              <span>{hands[k]}</span>
              <button type="button" onClick={() => step(k, 0.5)} aria-label="More">
                <Plus size={13} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="fp-handest-foot">
        <span>
          About <b>{Math.round(est.kcal / 10) * 10}</b> cal · {Math.round(est.protein)} g protein
        </span>
        <button
          type="button"
          className="ff-btn ff-btn-primary"
          disabled={!any}
          onClick={() => {
            onAdd({ name: `Counted by hand: ${handsText(hands, { short: true })}`, caloriesPerServing: Math.round(est.kcal), servings: 1, protein: Math.round(est.protein) });
            setHands(ZERO);
          }}
        >
          Add to the plate
        </button>
      </div>
    </section>
  );
}
