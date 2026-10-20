import { useState } from "react";
import { CalendarPlus, Check, X } from "lucide-react";

import { feedUrlLooksValid } from "../model/feeds";
import SchoolFinder from "./SchoolFinder";

// Where to find the subscribe link in the calendars people already use.
const SOURCES = [
  {
    id: "google",
    name: "Google Calendar",
    steps: [
      "On a computer, open calendar.google.com and click the gear, then Settings.",
      "Under “Settings for my calendars” on the left, pick the calendar.",
      "Scroll to “Integrate calendar” and copy “Secret address in iCal format”.",
    ],
  },
  {
    id: "apple",
    name: "Apple / iCloud",
    steps: [
      "On iPhone, open Calendar and tap Calendars at the bottom.",
      "Tap the ⓘ next to the calendar and turn on Public Calendar.",
      "Tap Share Link, then Copy. On a Mac: right-click the calendar, Share Calendar, Public Calendar.",
    ],
  },
  {
    id: "outlook",
    name: "Outlook",
    steps: [
      "On outlook.com, open Settings, then Calendar, then Shared calendars.",
      "Under “Publish a calendar”, pick the calendar and “Can view all details”, then Publish.",
      "Copy the ICS link.",
    ],
  },
  { id: "school", name: "School", steps: [] },
  {
    id: "other",
    name: "Team, work or city",
    steps: [
      "Look for “Subscribe”, “Add to calendar”, “iCal” or “Export” on the team, league, venue or city calendar page.",
      "Copy that link. It usually starts with webcal:// or ends in .ics.",
    ],
  },
];

/**
 * Step-by-step linking for Google, Apple, Outlook, schools and anything
 * else with a subscribe link. Linked calendars stay in sync on their own.
 */
export default function CalendarLinker({ place, feeds, onLink, onClose }) {
  const [sourceId, setSourceId] = useState("google");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [linked, setLinked] = useState(null);
  const source = SOURCES.find(s => s.id === sourceId);

  function link(feed) {
    onLink(feed);
    setLinked(feed.name);
    setName("");
    setUrl("");
    setMessage("");
  }

  function submit(event) {
    event.preventDefault();
    if (!feedUrlLooksValid(url)) {
      setMessage("That doesn't look like a calendar link. It should start with https:// or webcal://.");
      return;
    }
    link({ name: name.trim() || source.name, url: url.trim() });
  }

  return (
    <section className="pf-panel pf-linker" aria-label="Link a calendar">
      <header className="pf-day-head">
        <div>
          <p className="pf-eyebrow">
            <CalendarPlus size={12} aria-hidden="true" /> LINK A CALENDAR
          </p>
          <h2>Bring in a calendar you already use</h2>
          <p className="pf-muted">Pick where it lives. Linked calendars update on their own, and their events show in your days with everything else.</p>
        </div>
        <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </header>

      <div className="pf-segment pf-linker-tabs" role="tablist" aria-label="Calendar source">
        {SOURCES.map(s => (
          <button key={s.id} type="button" role="tab" aria-selected={sourceId === s.id} aria-pressed={sourceId === s.id} onClick={() => setSourceId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      {sourceId === "school" ? (
        <>
          <p className="pf-note">Find your school, then paste the link from its calendar page. Most schools have a Subscribe or iCal button.</p>
          <SchoolFinder place={place} onLink={link} />
        </>
      ) : (
        <>
          <ol className="pf-steps pf-linker-steps">
            {source.steps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <form className="pf-linker-form" onSubmit={submit}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={`Name, e.g. ${sourceId === "other" ? "Bears schedule" : "Family"}`} aria-label="Calendar name" maxLength={60} />
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste the link here" aria-label="Calendar link" inputMode="url" />
            <button type="submit" className="pf-btn pf-btn-primary">
              Link calendar
            </button>
          </form>
          {message && <p className="pf-note is-warn">{message}</p>}
        </>
      )}

      {linked && (
        <p className="pf-note is-good">
          <Check size={14} aria-hidden="true" /> {linked} is linked. Its events show on your calendar.
        </p>
      )}
      {feeds.length > 0 && <p className="pf-muted pf-linker-count">Linked so far: {feeds.map(f => f.name).join(", ")}. Manage them in Settings.</p>}
    </section>
  );
}
