import { useState } from "react";
import { Hand, Lightbulb, X } from "lucide-react";

import UsualDay from "./UsualDay";
import { HOWS } from "../model/body.js";
import { dailyHands, HAND_KEYS, HANDS } from "../model/portions.js";
import { FIRST_STEPS, patternTips, STYLE_TIPS, usedHows } from "../model/tips.js";

/** The day's targets as hand portions: what a day looks like without a scale. */
export function HandGuide({ target }) {
  const hands = dailyHands(target) ?? { palms: 5, handfuls: 6, fists: 5, thumbs: 5 };
  return (
    <div className="fp-handguide">
      <ul>
        {HAND_KEYS.map(k => (
          <li key={k}>
            <b>{hands[k]}</b>
            <span>
              {hands[k] === 1 ? HANDS[k].name : HANDS[k].plural} of {HANDS[k].what}
              <small>{HANDS[k].hint}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="fp-fine">
        {target ? "Your day, spread over the meals you eat." : "A typical day; add your profile for yours."} Use your own hand: a palm is its size and thickness, a cupped hand is what it holds, a fist is about a cup, a thumb is about a tablespoon.
      </p>
    </div>
  );
}

/**
 * Starting out: tell us how you usually eat, the first few steps, tips for
 * the ways you get food, and portions by hand.
 */
export default function StartPanel({ profile, targets, days, training, actions }) {
  const hows = usedHows(profile);
  const [tab, setTab] = useState("start");
  if (!profile.tips) {
    return (
      <p className="fp-hint fp-tips-off">
        <button type="button" className="ff-link" onClick={() => actions.setProfile({ tips: true })}>
          <Lightbulb size={14} aria-hidden="true" /> Show tips and the portion guide
        </button>
      </p>
    );
  }
  const target = targets[days.find(d => targets[d]) ?? days[0]];
  const anyTraining = days.some(d => training[d]?.length);
  const yours = patternTips(profile, target, anyTraining);
  const tabs = [
    ["start", "Start here"],
    ...(yours.length ? [["you", "Your day"]] : []),
    ...hows.map(h => [h, HOWS[h].name]),
    ["hands", "Portions"],
  ];
  const current = tabs.some(([k]) => k === tab) ? tab : "start";
  const list = current === "start" ? FIRST_STEPS : current === "you" ? yours : STYLE_TIPS[current] ?? [];

  return (
    <section className="ff-panel fp-start" aria-labelledby="fp-start-title">
      <div className="fp-start-head">
        <h2 id="fp-start-title"><Lightbulb size={20} aria-hidden="true" /> {profile.daySet ? "Tips" : "Starting out"}</h2>
        <button type="button" className="fp-icon" onClick={() => actions.setProfile({ tips: false })} aria-label="Hide tips" title="Hide tips">
          <X size={16} />
        </button>
      </div>

      {!profile.daySet && (
        <div className="fp-start-day">
          <p>
            <strong>How do you usually eat?</strong> The plan fits around your day instead of three textbook meals. Pick the closest pattern, then adjust any meal.
          </p>
          <UsualDay day={profile.day} onChange={day => actions.setProfile({ day })} />
          <button type="button" className="ff-btn ff-btn-primary" onClick={() => actions.setProfile({ daySet: true })}>
            That's my usual day
          </button>
        </div>
      )}

      <div className="fp-start-tabs" role="tablist" aria-label="Tips">
        {tabs.map(([k, name]) => (
          <button key={k} type="button" role="tab" aria-selected={current === k} className={current === k ? "is-active" : ""} onClick={() => setTab(k)}>
            {k === "hands" && <Hand size={14} aria-hidden="true" />}
            {name}
          </button>
        ))}
      </div>
      {current === "hands" ? (
        <HandGuide target={target} />
      ) : (
        <ul className="fp-tiplist">
          {list.map(t => (
            <li key={t.title}>
              <strong>{t.title}</strong>
              <p>{t.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
