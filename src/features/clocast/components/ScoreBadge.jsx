// A weather score for an activity: number plus Great/Good/Fair/Poor.
export default function ScoreBadge({ result, size = "normal" }) {
  if (!result) return null;
  return (
    <span className={`cc-score is-${result.tone} ${size === "small" ? "cc-score-small" : ""}`} title={`Weather score ${result.score} of 100`}>
      <strong>{result.score}</strong>
      <span>{result.label}</span>
    </span>
  );
}
