import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, X } from "lucide-react";
import { planBSearches } from "../model/planb";

const REASONS = ["Too tired tonight", "Missing ingredients", "Ran out of time", "Plans changed", "Something went wrong"];

// "Not cooking tonight?" Opens Google Maps searches for similar dishes nearby.
// When it's opened mid-cook, progress is already saved; the cook can keep it
// for later, end the session, or go back to cooking.
export default function PlanB({ recipe, cooking, onClose, onEndSession }) {
  const ref = useRef(null);
  const [place, setPlace] = useState("");
  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState("");
  const searches = planBSearches(recipe, place);

  useEffect(() => {
    // No close() on cleanup: closing fires onClose, which would undo the open
    // when React re-runs effects. Unmounting removes the dialog anyway.
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  return (
    <dialog ref={ref} className="ck-dialog ck-planb" onClose={onClose} aria-labelledby="ck-pb-h">
      <div className="ck-dialog-head">
        <div>
          <p className="ck-eyebrow">Plan B</p>
          <h2 id="ck-pb-h">{cooking ? "Change of plans?" : "Not cooking tonight?"}</h2>
        </div>
        <button type="button" className="ck-icon-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>

      {cooking && (
        <div className="ck-panel ck-panel--soft">
          <p>
            <strong>Your progress is saved.</strong> Every checkmark and timer is kept, so you can come back to {recipe.title} later.
          </p>
          {!ending ? (
            <div className="ck-row">
              <button type="button" className="ck-btn ck-btn--primary" onClick={onClose}>
                Back to cooking
              </button>
              <button type="button" className="ck-btn" onClick={() => onEndSession(null, "keep")}>
                Save for later
              </button>
              <button type="button" className="ck-btn ck-btn--quiet" onClick={() => setEnding(true)}>
                End this session
              </button>
            </div>
          ) : (
            <div className="ck-end">
              <label className="ck-field">
                <span>What happened? (optional)</span>
                <select value={reason} onChange={e => setReason(e.target.value)}>
                  <option value="">Skip</option>
                  {REASONS.map(r => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <p className="ck-note">The recipe stays in your history so you can try it another day.</p>
              <div className="ck-row">
                <button type="button" className="ck-btn ck-btn--primary" onClick={() => onEndSession(reason || null, "end")}>
                  End session
                </button>
                <button type="button" className="ck-btn ck-btn--quiet" onClick={() => setEnding(false)}>
                  Never mind
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <h3>Find something similar nearby</h3>
      <label className="ck-field">
        <span>Where? (optional)</span>
        <div className="ck-input-icon">
          <MapPin size={16} aria-hidden="true" />
          <input type="text" placeholder="City or ZIP. Leave blank to search near you" value={place} onChange={e => setPlace(e.target.value)} autoComplete="postal-code" />
        </div>
      </label>
      <ul className="ck-planb-list">
        {searches.map(s => (
          <li key={s.query}>
            <a href={s.url} target="_blank" rel="noreferrer">
              <span>
                <strong>{s.label}</strong>
                <span className="ck-muted">{s.kind === "dish" ? "Similar dish" : "Similar cuisine"}</span>
              </span>
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      <p className="ck-note">
        These open a Google Maps search, so Maps (not CookFox) picks the results and may ask for your location. We don't know what any restaurant
        serves, so check the menu. If you have allergies, ask the restaurant directly; never assume a dish is allergen-free.
      </p>
    </dialog>
  );
}
