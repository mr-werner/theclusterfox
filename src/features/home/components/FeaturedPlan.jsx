import { ArrowRight } from "lucide-react";

import { apps } from "../../../app/apps";
import AppLink from "./AppLink";
import OriginalIcon from "./OriginalIcon";

// The apps that put things on your TaskFox calendar, shown on its tile.
const feeders = apps.filter(app => app.id !== "planfox");

// On a computer the tile has room to say what a few of them send.
const SENDS = [
  ["liftfox", "Your training days"],
  ["cookfox", "Meal prep and cook nights"],
  ["clocast", "What to wear and weather alerts"],
  ["scorefox", "Your teams' games"],
  ["growfox", "Watering and frost warnings"],
  ["watchfox", "Shows and movie nights"],
];
const sends = SENDS.map(([id, what]) => ({ app: apps.find(a => a.id === id), what })).filter(s => s.app);

/**
 * TaskFox's tile is the biggest on the home screen, because the calendar is
 * where every other app sends what you plan in it. On a computer it takes a
 * 2×2 spot in the grid; on a phone it is a full-width widget.
 */
export default function FeaturedPlan({ app, phone = false, ...props }) {
  const label = app.fullName ?? app.subtitle;
  return (
    <AppLink
      app={app}
      className={`plan-feature ${phone ? "plan-feature--phone" : ""}`}
      draggable={false}
      aria-label={`Open ${label}`}
      {...props}
    >
      <span className="plan-feature-head">
        <OriginalIcon app={app} compact size={phone ? 30 : 46} />
        <span className="plan-feature-title">
          <small>Your hub</small>
          <strong>{label}</strong>
          <span>{app.description}</span>
        </span>
      </span>

      {!phone && (
        <>
          <span className="plan-feature-blurb">Everything you plan in the other apps lands on one calendar.</span>
          <span className="plan-feature-sends">
            {sends.map(({ app: from, what }) => {
              const Icon = from.icon;
              return (
                <span key={from.id} className="plan-feature-send">
                  <span className={`plan-feature-dot app-icon--${from.accent}`} aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} />
                  </span>
                  <span>
                    <strong>{from.subtitle}</strong>
                    <small>{what}</small>
                  </span>
                </span>
              );
            })}
          </span>
        </>
      )}

      <span className={`plan-feature-feeds ${phone ? "" : "plan-feature-feeds--more"}`} aria-hidden="true">
        {!phone && <small>Works with every ClusterFox app</small>}
        {feeders.map(feeder => {
          const Icon = feeder.icon;
          return (
            <span key={feeder.id} className={`plan-feature-dot app-icon--${feeder.accent}`} title={feeder.subtitle}>
              <Icon size={phone ? 13 : 16} strokeWidth={2.2} />
            </span>
          );
        })}
      </span>

      <span className="plan-feature-cta">
        Open your calendar <ArrowRight size={phone ? 14 : 16} aria-hidden="true" />
      </span>
    </AppLink>
  );
}
