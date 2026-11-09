import { useEffect, useState } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";

import { fetchAlerts, inUnitedStates } from "../../../services/plan/alerts";

/** Active National Weather Service alerts for US places, most severe first. */
export default function AlertBanner({ place }) {
  const key = place && inUnitedStates(place) ? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}` : null;
  const [state, setState] = useState({ key: null, alerts: [] });
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    fetchAlerts(place, { signal: controller.signal })
      .then(alerts => setState({ key, alerts }))
      .catch(() => setState({ key, alerts: [] })); // alerts are a bonus; the forecast still shows
    return () => controller.abort();
    // place is read through key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const order = { warn: 0, caution: 1, info: 2 };
  const alerts = state.key === key ? [...state.alerts].sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 4) : [];
  if (!alerts.length) return null;

  return (
    <section className="cc-alerts" aria-label="Weather alerts">
      {alerts.map(a => (
        <article key={a.id} className={`cc-alert is-${a.tone}`}>
          <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id}>
            <TriangleAlert size={18} aria-hidden="true" />
            <span>
              <strong>{a.event}</strong>
              <small>{a.headline}</small>
            </span>
            <ChevronDown size={16} className={open === a.id ? "is-flipped" : ""} aria-hidden="true" />
          </button>
          {open === a.id && (
            <div className="cc-alert-body">
              <p>{a.text}</p>
              {a.instruction && <p><strong>What to do:</strong> {a.instruction}</p>}
              <p className="cc-muted">From the US National Weather Service.</p>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
