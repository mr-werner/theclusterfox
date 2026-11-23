import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";

import { STUDY_LINKS } from "../../../app/studyLinks";
import { hasDeck } from "../state/studyStore";
import { loadCatalog } from "../state/useStudyData";
import { AppMark } from "./ui";
import { appInfo } from "../model/stats";

// Everything the learning apps offer to study, grouped by app.
export default function LibraryView({ store }) {
  const [only, setOnly] = useState("all");
  return (
    <div className="sy-library">
      <header className="sy-page-head">
        <p className="sy-kicker">Library</p>
        <h1>Add something to study</h1>
        <p className="sy-lede">Pick the topics you're working on. They stay linked to their app, so StudyFox always has the latest version.</p>
      </header>
      <div className="sy-filter" role="radiogroup" aria-label="Show material from">
        {[{ app: "all" }, ...STUDY_LINKS].map(l => (
          <button key={l.app} type="button" role="radio" aria-checked={only === l.app} className={only === l.app ? "is-on" : ""} onClick={() => setOnly(l.app)}>
            {l.app === "all" ? "All apps" : <><AppMark app={l.app} size={14} /> {appInfo(l.app).subtitle}</>}
          </button>
        ))}
      </div>
      {STUDY_LINKS.filter(l => only === "all" || l.app === only).map(l => (
        <AppCatalog key={l.app} app={l.app} store={store} />
      ))}
    </div>
  );
}

function AppCatalog({ app, store }) {
  const [state, setState] = useState({ status: "loading", decks: [] });
  useEffect(() => {
    let live = true;
    Promise.resolve(loadCatalog(app))
      .then(decks => live && setState({ status: "ready", decks }))
      .catch(() => live && setState({ status: "error", decks: [] }));
    return () => {
      live = false;
    };
  }, [app]);

  const groups = [];
  for (const d of state.decks) {
    const g = d.group ?? "";
    let entry = groups.find(x => x.name === g);
    if (!entry) groups.push((entry = { name: g, decks: [] }));
    entry.decks.push(d);
  }
  const info = appInfo(app);

  return (
    <section className="sy-catalog" style={{ "--app": `var(--${info.accent ?? app}, #ffd84a)` }}>
      <h2>
        <AppMark app={app} size={18} /> {info.fullName ?? info.subtitle}
        <small>{info.description}</small>
      </h2>
      {state.status === "loading" && <p className="sy-loading">Loading…</p>}
      {state.status === "error" && <p className="sy-muted">Couldn't load this app's material. Check your connection and try again.</p>}
      {groups.map(g => (
        <div key={g.name} className="sy-catalog-group">
          {groups.length > 1 && g.name && <h3>{g.name}</h3>}
          <ul className="sy-offer-list">
            {g.decks.map(d => {
              const on = hasDeck(store.data, app, d.id);
              return (
                <li key={d.id} className={`sy-offer${on ? " is-on" : ""}`}>
                  <Link to={`/study?deck=${encodeURIComponent(`${app}:${d.id}`)}`} className="sy-offer-text">
                    <strong>{d.title}</strong>
                    {d.blurb && <span>{d.blurb}</span>}
                  </Link>
                  <button
                    type="button"
                    className={`sy-add${on ? " is-on" : ""}`}
                    onClick={() => (on ? store.remove(app, d.id) : store.add({ app, id: d.id, title: d.title }))}
                    aria-pressed={on}
                    aria-label={on ? `Remove ${d.title} from your shelf` : `Add ${d.title} to your shelf`}
                  >
                    {on ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                    <span>{on ? "Added" : "Add"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
