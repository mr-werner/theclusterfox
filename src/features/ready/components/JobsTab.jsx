import { Check, ChevronRight } from "lucide-react";

import { BRANCHES, JOBS } from "../data/jobs";
import { aimLabel, standardsFor, fmtStandard } from "../model/scoring";
import { AFT_TABLES } from "../data/aftTables";
import { EventIcon } from "./ui";

function JobCard({ job, selected, onPick }) {
  const isAft = job.test.scoring === "aft";
  const std = isAft ? [] : standardsFor(job, { sex: "m" }, AFT_TABLES);
  const aim = aimLabel(job);
  return (
    <article className={`rf-job${selected ? " is-selected" : ""}`}>
      <header>
        <span className="rf-job-branch">{BRANCHES.find(b => b.id === job.branch)?.name}</span>
        <span className="rf-job-code">{job.code}</span>
      </header>
      <h3>{job.name}</h3>
      <p>{job.blurb}</p>
      {isAft ? (
        <p className="rf-job-aft">
          <strong>{job.test.name}</strong>: deadlift, hand-release push-ups, sprint-drag-carry, plank and a 2-mile run. Pass with 60+ in every event and {job.test.passTotal}+ in total.
        </p>
      ) : (
        <ul className="rf-job-std">
          {std.map(s => (
            <li key={s.id}>
              <EventIcon id={s.id} size={15} />
              <span>{s.event.short}</span>
              <strong>{s.event.kind === "pass" ? "Pass" : fmtStandard(s.id, s.min) ?? "–"}</strong>
              {s.aim != null && <em title={aim}>{fmtStandard(s.id, s.aim)}</em>}
            </li>
          ))}
        </ul>
      )}
      {!isAft && job.test.bySex && <p className="rf-fine">Men's minimums shown; women's are on the Test tab.</p>}
      {!isAft && aim && <p className="rf-fine">Second column: {aim.toLowerCase()} score.</p>}
      <button type="button" className={selected ? "rf-btn" : "rf-btn is-primary"} onClick={() => onPick(job.id)}>
        {selected ? <Check size={16} aria-hidden="true" /> : null}
        {selected ? "Your goal: open your test" : "Train for this"}
        {!selected && <ChevronRight size={16} aria-hidden="true" />}
      </button>
    </article>
  );
}

export default function JobsTab({ selectedId, branch, onBranch, onPick }) {
  const shown = JOBS.filter(j => !branch || j.branch === branch);
  return (
    <section>
      <div className="rf-intro">
        <h2>Pick the job you're training for</h2>
        <p>Each job has its own fitness test with published minimums. Pick one, see where you stand, and get a plan to your test day.</p>
      </div>
      <div className="rf-filters" role="group" aria-label="Branch">
        <button type="button" aria-pressed={!branch} onClick={() => onBranch(null)}>
          All
        </button>
        {BRANCHES.map(b => (
          <button key={b.id} type="button" aria-pressed={branch === b.id} onClick={() => onBranch(b.id)}>
            {b.name}
          </button>
        ))}
      </div>
      <div className="rf-jobs">
        {shown.map(j => (
          <JobCard key={j.id} job={j} selected={j.id === selectedId} onPick={onPick} />
        ))}
      </div>
    </section>
  );
}
