import { ExternalLink, ShieldAlert } from "lucide-react";

import { EVENTS, SOURCES } from "../data/jobs";
import { AFT_TABLES } from "../data/aftTables";
import { aimLabel, ageGroup, standardsFor, fmtStandard } from "../model/scoring";
import { fmtTime } from "../model/units";
import { Empty, EventIcon } from "./ui";

const RECRUITERS = [
  { name: "Navy", url: "https://www.navy.com" },
  { name: "Army", url: "https://www.goarmy.com" },
  { name: "Marine Corps", url: "https://www.marines.com" },
  { name: "Air Force", url: "https://www.airforce.com" },
];

const SAFETY = [
  "Build up over weeks. Most injuries in training come from adding too much running or too many reps too fast.",
  "Never practice breath-hold or underwater swimming alone. Have a lifeguard or trained partner watching, and don't hyperventilate first.",
  "Sleep, eat enough and drink water. Training only works if you recover from it.",
  "Pain that is sharp, in a joint, or that gets worse as you go means stop and get it looked at.",
];

export default function GuideTab({ job, profile, onPickJob }) {
  if (!job) {
    return (
      <Empty title="Pick a job to see its guide" action={<button type="button" className="rf-btn is-primary" onClick={onPickJob}>See the jobs</button>}>
        Each guide explains how the test runs, how every event is scored, and links the official source.
      </Empty>
    );
  }
  const std = standardsFor(job, profile, AFT_TABLES);
  const stdById = Object.fromEntries(std.map(s => [s.id, s]));
  const aim = aimLabel(job);
  const isAft = job.test.scoring === "aft";

  return (
    <section>
      <div className="rf-intro">
        <h2>{job.name}</h2>
        <p>{job.blurb}</p>
      </div>

      <div className="rf-card">
        <h3>{job.test.name}</h3>
        {job.test.note && <p className="rf-note">{job.test.note}</p>}
        {isAft && (
          <p className="rf-fine">
            Numbers below are for age group {ageGroup(profile?.age)}
            {job.test.standard === "general" ? `, ${profile?.sex === "f" ? "female" : "male"} table` : ""}. Set your age on the Test tab to change them.
          </p>
        )}
        <ol className="rf-order">
          {job.test.order.map(o => {
            const ev = EVENTS[o.event];
            const s = stdById[o.event];
            return (
              <li key={o.event}>
                <div className="rf-order-head">
                  <EventIcon id={o.event} />
                  <strong>{ev.name}</strong>
                </div>
                <p>{ev.how}</p>
                <div className="rf-order-std">
                  {ev.kind !== "pass" && s?.min != null && (
                    <span>
                      {isAft ? "60 points" : "Minimum"}: <strong>{fmtStandard(o.event, s.min)}</strong>
                    </span>
                  )}
                  {s?.aim != null && (
                    <span>
                      {aim}: <strong>{fmtStandard(o.event, s.aim)}</strong>
                    </span>
                  )}
                  {isAft && s?.max != null && (
                    <span>
                      100 points: <strong>{fmtStandard(o.event, s.max)}</strong>
                    </span>
                  )}
                </div>
                {o.rest > 0 && <p className="rf-rest">Then rest {fmtTime(o.rest)}</p>}
              </li>
            );
          })}
        </ol>
        {job.test.bySex && <p className="rf-fine">Showing the {profile?.sex === "f" ? "women's" : "men's"} minimums. Change this on the Test tab.</p>}
        {job.extra?.map(x => (
          <p key={x} className="rf-note">
            {x}
          </p>
        ))}
      </div>

      <div className="rf-card">
        <h3>Where these numbers come from</h3>
        <ul className="rf-sources">
          {job.test.sources.map(id => (
            <li key={id}>
              <a href={SOURCES[id].url} target="_blank" rel="noreferrer">
                {SOURCES[id].name} <ExternalLink size={13} aria-hidden="true" />
              </a>
              <small>{SOURCES[id].org}</small>
            </li>
          ))}
        </ul>
        <p className="rf-fine">
          Standards change. Your recruiter has the current numbers for your contract:{" "}
          {RECRUITERS.map((r, i) => (
            <span key={r.name}>
              {i > 0 && ", "}
              <a href={r.url} target="_blank" rel="noreferrer">
                {r.name}
              </a>
            </span>
          ))}
          .
        </p>
      </div>

      <div className="rf-card">
        <h3>
          <ShieldAlert size={18} aria-hidden="true" /> Train safely
        </h3>
        <ul className="rf-list">
          {SAFETY.map(s => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
