import { useEffect, useState } from "react";
import { BookOpen, Check, ExternalLink, GraduationCap, MapPin, Target } from "lucide-react";

import { fetchFlightSchools } from "../api";
import { FREE_RESOURCES, LICENSES, SCHOOL_TIPS } from "../data/licenses";
import { examsById } from "../data/exams";
import FlyMap from "./FlyMap";
import { AirportSearch, ErrorNote, Loading } from "./ui";

// Getting a license: what each certificate lets you do and takes, how to
// pick a school, schools near you, and free study material.
export default function LearnTab({ f, openExam }) {
  const { data, patch } = f;
  const [open, setOpen] = useState(data.goal ?? "private");
  const lic = LICENSES.find(l => l.id === open) ?? LICENSES[2];

  return (
    <div className="fy-stack">
      <section className="fy-card fy-hero">
        <div className="fy-hero-text">
          <p className="fy-kicker">Learn to fly</p>
          <h1>Your path to a pilot's license</h1>
          <p>Every US certificate from drones to the airlines: what it lets you do, the hours and tests it takes, what it costs, and how to pick a school.</p>
        </div>
      </section>

      <nav className="fy-ladder" aria-label="Certificates">
        {LICENSES.map((l, i) => (
          <button key={l.id} type="button" className={`fy-rung${l.id === open ? " is-on" : ""}${data.goal === l.id ? " is-goal" : ""}`} onClick={() => setOpen(l.id)}>
            <span className="fy-rung-n">{i + 1}</span>
            <strong>{l.short}</strong>
            <span>{l.name}</span>
          </button>
        ))}
      </nav>

      <section className="fy-card fy-license">
        <div className="fy-row-between">
          <div>
            <h2>{lic.name}</h2>
            <p className="fy-muted">From age {lic.age} · Medical: {lic.medical}</p>
          </div>
          <button type="button" className={`fy-btn is-small${data.goal === lic.id ? " is-ghost" : ""}`} onClick={() => patch({ goal: data.goal === lic.id ? null : lic.id })}>
            {data.goal === lic.id ? <><Check size={14} /> My goal</> : <><Target size={14} /> Make this my goal</>}
          </button>
        </div>
        <div className="fy-facts">
          <div><span>Flight time</span><strong>{lic.hours}</strong></div>
          <div><span>Typical time</span><strong>{lic.weeks}</strong></div>
          <div><span>Typical cost</span><strong>{lic.cost}</strong></div>
        </div>
        <div className="fy-two is-plain">
          <div>
            <h3>What it lets you do</h3>
            <ul className="fy-ticks">{lic.lets.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h3>What it takes</h3>
            <ul className="fy-ticks is-steps">{lic.needs.map(t => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
        {lic.exam && (
          <button type="button" className="fy-btn" onClick={() => openExam(lic.exam)}>
            <BookOpen size={16} /> Study for the {examsById.get(lic.exam).code} knowledge test
          </button>
        )}
      </section>

      <SchoolFinder f={f} />

      <section className="fy-card">
        <h2><GraduationCap size={18} aria-hidden="true" /> Choosing a flight school</h2>
        <div className="fy-tips">
          {SCHOOL_TIPS.map(t => (
            <article key={t.title}>
              <h3>{t.title}</h3>
              {t.body && <p>{t.body}</p>}
              {t.list && <ul className="fy-ticks">{t.list.map(x => <li key={x}>{x}</li>)}</ul>}
            </article>
          ))}
        </div>
      </section>

      <section className="fy-card">
        <h2>Free study material</h2>
        <ul className="fy-resources">
          {FREE_RESOURCES.map(r => (
            <li key={r.href}>
              <a href={r.href} target="_blank" rel="noreferrer">
                <strong>{r.name} <ExternalLink size={12} aria-hidden="true" /></strong>
                <span>{r.by} · {r.note}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SchoolFinder({ f }) {
  const { data } = f;
  const [place, setPlace] = useState(data.home && data.home.id !== "HERE" ? data.home : null);
  const [state, setState] = useState({ status: "idle", list: [] });

  useEffect(() => {
    if (!place) return undefined;
    const ctl = new AbortController();
    setState({ status: "loading", list: [] });
    fetchFlightSchools(place, 80, { signal: ctl.signal })
      .then(list => {
        const k = Math.cos((place.lat * Math.PI) / 180);
        const withDist = list.map(s => ({ ...s, distKm: Math.hypot(s.lat - place.lat, (s.lon - place.lon) * k) * 111 })).sort((a, b) => a.distKm - b.distKm);
        setState({ status: "ready", list: withDist });
      })
      .catch(e => e.name !== "AbortError" && setState({ status: "ready", list: [], error: e.message }));
    return () => ctl.abort();
  }, [place]);

  const searchName = place ? place.name : "";
  return (
    <section className="fy-card">
      <h2><MapPin size={18} aria-hidden="true" /> Flight schools near you</h2>
      <AirportSearch placeholder="Your city or nearest airport" onPick={setPlace} />
      {state.status === "loading" && <Loading>Looking up schools and flying clubs…</Loading>}
      {state.status === "ready" && (
        <>
          {state.error ? (
            <ErrorNote>{state.error}</ErrorNote>
          ) : state.list.length ? (
            <div className="fy-two">
              <FlyMap
                fit={[place, ...state.list.slice(0, 12)].map(p => ({ lat: p.lat, lon: p.lon }))}
                fitKey={`${place.id}-${state.list.length}`}
                height={320}
                label="Flight schools map"
                markers={[{ id: "you", lat: place.lat, lon: place.lon, waypoint: true, label: place.id === "HERE" ? "You" : place.id, title: place.name }, ...state.list.map(s => ({ id: s.id, lat: s.lat, lon: s.lon, category: "school", title: s.name }))]}
              />
              <ul className="fy-list fy-schools">
                {state.list.slice(0, 20).map(s => (
                  <li key={s.id}>
                    <div>
                      <strong>{s.name}</strong>
                      <span className="fy-muted"> · {s.kind} · {Math.round(s.distKm * 0.621)} mi</span>
                      {s.phone && <div className="fy-muted">{s.phone}</div>}
                    </div>
                    {s.website && <a className="fy-link" href={s.website.startsWith("http") ? s.website : `https://${s.website}`} target="_blank" rel="noreferrer">Website <ExternalLink size={12} aria-hidden="true" /></a>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="fy-muted">None are mapped in OpenStreetMap within 50 miles yet — most schools sit at the local airport, so the links below are a good next step.</p>
          )}
          <p className="fy-note">
            OpenStreetMap only knows the schools local mappers have added. For a fuller list try{" "}
            <a className="fy-link" href="https://www.aopa.org/learntofly/school/" target="_blank" rel="noreferrer">AOPA's flight school finder</a> or{" "}
            <a className="fy-link" href={`https://www.google.com/maps/search/${encodeURIComponent(`flight school near ${searchName}`)}`} target="_blank" rel="noreferrer">a map search</a>.
          </p>
        </>
      )}
    </section>
  );
}
