import { formatHour } from "../units";

/**
 * How good each hour of a day is for an activity, as a row of bars.
 * scores: [{ hour, score, tone, label }]. selected: local hours to outline.
 * onPick(localHour) makes the bars buttons.
 */
export default function ScoreStrip({ scores, selected = [], onPick, label = "Hour by hour" }) {
  if (!scores.length) return null;
  const picked = new Set(selected);
  return (
    <div className="cc-strip" role="group" aria-label={label}>
      {scores.map(({ hour, score, tone, label: name }) => {
        const content = (
          <>
            <span className="cc-strip-bar" aria-hidden="true">
              <span style={{ height: `${Math.max(8, score)}%` }} />
            </span>
            <span className="cc-strip-time">{hour.localHour % 3 === 0 ? formatHour(hour.localHour).replace(" ", "") : ""}</span>
          </>
        );
        const key = hour.time.getTime();
        const props = {
          className: `cc-strip-cell is-${tone} ${picked.has(hour.localHour) ? "is-picked" : ""}`,
          title: `${formatHour(hour.localHour)}: ${name} (${score})`,
        };
        return onPick ? (
          <button key={key} {...props} type="button" onClick={() => onPick(hour.localHour)} aria-label={props.title}>
            {content}
          </button>
        ) : (
          <span key={key} {...props}>{content}</span>
        );
      })}
    </div>
  );
}
