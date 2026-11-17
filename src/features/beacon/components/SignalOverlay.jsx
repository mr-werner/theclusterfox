import { useEffect } from "react";
import { Square } from "lucide-react";

// The whole screen becomes the light. A dark bar at the bottom keeps the
// Stop button easy to find whether the light is on or off.
export default function SignalOverlay({ job, lit, color, onStop }) {
  useEffect(() => {
    const onKey = event => {
      if (event.key === "Escape") onStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStop]);

  const letters = job.letters?.filter(l => l.code) ?? null;
  return (
    <div className="bx-overlay" style={{ background: lit.on ? color : "#000" }} role="dialog" aria-modal="true" aria-label={`Sending ${job.name}`}>
      <div className="bx-overlay-bar">
        <div className="bx-overlay-info">
          <small>Sending</small>
          <strong>{job.name}</strong>
          {letters && letters.length > 1 && (
            <span className="bx-overlay-letters" aria-hidden="true">
              {job.letters.map((l, i) =>
                l.code ? (
                  <span key={i} className={i === lit.at ? "is-now" : ""}>
                    {l.char === " " ? " " : l.char}
                  </span>
                ) : null
              )}
            </span>
          )}
          {lit.at != null && job.letters?.[lit.at]?.code && job.letters[lit.at].code !== " " && (
            <span className="bx-overlay-code">{job.letters[lit.at].code.replaceAll(".", "·").replaceAll("-", "─")}</span>
          )}
        </div>
        <button type="button" className="bx-stop" onClick={onStop} autoFocus>
          <Square size={16} aria-hidden="true" /> Stop
        </button>
      </div>
    </div>
  );
}
