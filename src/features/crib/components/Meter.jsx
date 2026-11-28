// A sound level bar from 0 to 100, with an optional alert line.
export default function Meter({ level, threshold, label, stale }) {
  const value = Math.max(0, Math.min(100, level ?? 0));
  const loud = threshold != null && value >= threshold;
  return (
    <div className={`cf-meter${loud ? " cf-meter--loud" : ""}${stale ? " cf-meter--stale" : ""}`}>
      <div className="cf-meter-top">
        <span className="cf-label">{label}</span>
        <span className="cf-meter-word">{stale ? "no sound yet" : value < 15 ? "quiet" : value < 45 ? "some sound" : value < 70 ? "noisy" : "loud"}</span>
      </div>
      <div className="cf-meter-bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
        <span className="cf-meter-fill" style={{ width: `${value}%` }} />
        {threshold != null && <span className="cf-meter-line" style={{ left: `${threshold}%` }} />}
      </div>
    </div>
  );
}
