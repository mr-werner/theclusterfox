import { useState } from "react";
import { ExternalLink, LoaderCircle, School, Search } from "lucide-react";

import { fetchSchools } from "../../../services/plan/planApi";
import { feedUrlLooksValid } from "../model/feeds";

const LEVELS = [
  { id: "all", name: "All" },
  { id: "elementary", name: "Elementary" },
  { id: "middle", name: "Middle" },
  { id: "high", name: "High" },
];

const searchLink = school =>
  `https://www.google.com/search?q=${encodeURIComponent(`"${school.name}" ${school.district} ${school.city} calendar ical OR ics OR subscribe`)}`;

// Public schools in a ZIP code. There's no national feed of school
// calendars, so picking a school helps find and link its own calendar.
export default function SchoolFinder({ place, onLink }) {
  const [zip, setZip] = useState(place?.postcode && /^\d{5}/.test(place.postcode) ? place.postcode.slice(0, 5) : "");
  const [state, setState] = useState({ status: "idle", schools: [], error: "" });
  const [level, setLevel] = useState("all");
  const [open, setOpen] = useState(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");

  async function search(event) {
    event.preventDefault();
    if (!/^\d{5}$/.test(zip.trim())) {
      setState({ status: "error", schools: [], error: "Enter a 5-digit US ZIP code." });
      return;
    }
    setState({ status: "loading", schools: [], error: "" });
    try {
      const schools = await fetchSchools(zip.trim());
      setState({ status: "ok", schools, error: schools.length ? "" : "No public schools found in that ZIP code." });
    } catch (error) {
      setState({ status: "error", schools: [], error: error.message });
    }
  }

  function save(school) {
    if (!feedUrlLooksValid(link)) {
      setMessage("Paste the calendar's link. It usually ends in .ics or starts with webcal://.");
      return;
    }
    onLink({ name: school.name, url: link.trim() });
    setOpen(null);
    setLink("");
    setMessage("");
  }

  const shown = state.schools.filter(s => level === "all" || s.level === level);

  return (
    <div className="pf-schools">
      <form className="pf-inline-form" onSubmit={search}>
        <input value={zip} onChange={e => setZip(e.target.value)} placeholder="ZIP code" aria-label="ZIP code" inputMode="numeric" maxLength={5} />
        <button type="submit" className="pf-btn">
          {state.status === "loading" ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Search size={15} aria-hidden="true" />} Find schools
        </button>
      </form>
      {state.error && <p className="pf-note is-warn">{state.error}</p>}
      {state.schools.length > 0 && (
        <>
          <ul className="pf-chips" aria-label="School level">
            {LEVELS.map(l => (
              <li key={l.id}>
                <button type="button" className="pf-chip" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
                  {l.name}
                </button>
              </li>
            ))}
          </ul>
          <ul className="pf-school-list">
            {shown.map(school => (
              <li key={school.id}>
                <button type="button" className="pf-school" aria-expanded={open === school.id} onClick={() => setOpen(open === school.id ? null : school.id)}>
                  <School size={15} aria-hidden="true" />
                  <span>
                    <strong>{school.name}</strong>
                    <span className="pf-muted">
                      {" "}
                      · {school.grades ? `Grades ${school.grades}` : school.level}
                      {school.district && ` · ${school.district}`}
                    </span>
                  </span>
                </button>
                {open === school.id && (
                  <div className="pf-school-link">
                    <p className="pf-note">
                      Most schools and districts post a calendar you can subscribe to.{" "}
                      <a href={searchLink(school)} target="_blank" rel="noreferrer">
                        Search for {school.name}'s calendar <ExternalLink size={12} aria-hidden="true" />
                      </a>
                      , copy its iCal or "subscribe" link, and paste it here.
                    </p>
                    <div className="pf-inline-form">
                      <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://… or webcal://…" aria-label={`${school.name} calendar link`} inputMode="url" />
                      <button type="button" className="pf-btn pf-btn-primary" onClick={() => save(school)}>
                        Link calendar
                      </button>
                    </div>
                    {message && <p className="pf-note is-warn">{message}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="pf-note">School list from the federal NCES directory, via the Urban Institute's Education Data Portal.</p>
        </>
      )}
    </div>
  );
}
