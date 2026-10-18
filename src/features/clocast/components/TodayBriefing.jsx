import { useMemo } from "react";
import { CalendarDays, Sparkles } from "lucide-react";

import { activitiesById } from "../data/activities";
import { dailyBriefing } from "../model/briefing";
import { notableFactors, rankStarts, scoreHour, scoreWindow } from "../model/score";
import { formatHour, formatTemp } from "../units";
import { dayName, describeWindow } from "../when";
import ScoreBadge from "./ScoreBadge";
import ScoreStrip from "./ScoreStrip";
import TipList from "./TipList";

/**
 * The assistant's read on the day: the best time for your activity, what
 * to watch out for, and anything you've planned.
 */
export default function TodayBriefing({ hours, days, place, activity, options, units, plans, now, onOpenPlanner }) {
  const briefing = useMemo(() => {
    // Late in the evening, look ahead to tomorrow.
    const upcoming = hours.filter(h => h.time.getTime() + 3600000 > now);
    const todayLeft = upcoming.filter(h => h.localDay === days[0] && h.localHour <= 21);
    const index = todayLeft.some(h => h.localHour >= 5) ? 0 : 1;
    const day = days[index];
    const dayHours = upcoming.filter(h => h.localDay === day);
    const ranked = rankStarts(hours, place, activity, { day, duration: 1, earliest: 5, latest: 21, notBefore: now, options });
    const scores = dayHours
      .filter(h => h.localHour >= 5 && h.localHour <= 22)
      .map(hour => ({ hour, ...scoreHour(hour, place, activity, options) }));
    const tips = dailyBriefing(dayHours, { formatTemp: c => formatTemp(c, units) });
    const todaysPlans = plans
      .filter(p => p.day === day)
      .map(plan => {
        const window = dayHours.filter(h => h.localHour >= plan.startHour && h.localHour < plan.startHour + plan.hours);
        const planActivity = activitiesById.get(plan.activityId);
        return { plan, activity: planActivity, result: window.length && planActivity ? scoreWindow(window, place, planActivity, options) : null };
      });
    return { index, day, best: ranked[0], scores, tips, todaysPlans };
  }, [hours, days, place, activity, options, units, plans, now]);

  const { index, day, best, scores, tips, todaysPlans } = briefing;
  const when = index === 0 ? "today" : "tomorrow";

  return (
    <section className="cc-panel cc-briefing" aria-labelledby="cc-briefing-title">
      <p className="cc-eyebrow">
        <Sparkles size={13} aria-hidden="true" /> YOUR DAY · {dayName(day, index).toUpperCase()}
      </p>
      {best ? (
        <div className="cc-best">
          <div>
            <h2 id="cc-briefing-title">
              Best time for {activity.name.toLowerCase()} {when}: {formatHour(best.startHour)}
            </h2>
            <p className="cc-muted">
              {notableFactors(best, 2).length
                ? `Watch for: ${notableFactors(best, 2).map(f => f.text).join(", ")}.`
                : "Nothing in the forecast gets in the way."}{" "}
              {describeWindow(best.window)}
            </p>
          </div>
          <ScoreBadge result={best} />
        </div>
      ) : (
        <h2 id="cc-briefing-title">Your day</h2>
      )}

      <ScoreStrip scores={scores} selected={best ? [best.startHour] : []} label={`How good each hour is for ${activity.name.toLowerCase()}`} />
      <p className="cc-strip-legend">
        <span className="is-great">Great</span>
        <span className="is-good">Good</span>
        <span className="is-fair">Fair</span>
        <span className="is-poor">Poor</span>
        <span className="cc-muted">for {activity.name.toLowerCase()}, based on temperature, rain, air, UV, wind and daylight</span>
      </p>

      <TipList tips={tips} />

      <div className="cc-briefing-plans">
        <h3 className="cc-subhead">Planned {when}</h3>
        {todaysPlans.length ? (
          <ul className="cc-mini-plans">
            {todaysPlans.map(({ plan, activity: planActivity, result }) => (
              <li key={plan.id}>
                <span>
                  <strong>{plan.title || planActivity?.name}</strong>
                  <span className="cc-muted">
                    {" "}
                    {formatHour(plan.startHour)}–{formatHour((plan.startHour + plan.hours) % 24)}
                  </span>
                </span>
                <ScoreBadge result={result} size="small" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="cc-muted cc-small">Nothing yet.</p>
        )}
        <button type="button" className="cc-btn" onClick={onOpenPlanner}>
          <CalendarDays size={15} aria-hidden="true" /> Open planner
        </button>
      </div>
    </section>
  );
}
