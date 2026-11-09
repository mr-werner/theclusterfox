import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, Loader2, Plus, Search, X } from "lucide-react";

import { apps } from "../../../app/apps";
import FreeAppIcon from "../../free/FreeAppIcon";
import { altKey, originalKey } from "../state/homeStore";
import { normalize, searchAlternatives, searchOriginals } from "../search";
import OriginalIcon from "./OriginalIcon";

const RESULT_LIMIT = 60;

function AddButton({ added, label, onToggle }) {
  return (
    <button
      type="button"
      className={`add-sheet-toggle ${added ? "added" : ""}`}
      aria-pressed={added}
      aria-label={added ? `Remove ${label} from your home screen` : `Add ${label} to your home screen`}
      onClick={onToggle}
    >
      {added ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
      <span>{added ? "Added" : "Add"}</span>
    </button>
  );
}

function AltRow({ app, home }) {
  const key = altKey(app.name);
  const added = home.has(key);
  return (
    <li className="add-sheet-row">
      <a href={app.url} target="_blank" rel="noopener noreferrer" className="add-sheet-row-main">
        <FreeAppIcon app={app} />
        <span className="add-sheet-row-text">
          <strong>
            {app.name}
            <ExternalLink size={12} aria-hidden="true" />
          </strong>
          <span>Instead of {app.alt}</span>
        </span>
      </a>
      <AddButton added={added} label={app.name} onToggle={() => (added ? home.remove(key) : home.add(key))} />
    </li>
  );
}

function OriginalRow({ app, home }) {
  const key = originalKey(app.id);
  const added = home.has(key);
  return (
    <li className="add-sheet-row add-sheet-row--original">
      <Link to={app.path} className="add-sheet-row-main">
        <OriginalIcon app={app} compact size={24} />
        <span className="add-sheet-row-text">
          <strong>{app.fullName ?? app.subtitle}</strong>
          <span>{app.description}</span>
        </span>
      </Link>
      <AddButton added={added} label={app.subtitle} onToggle={() => (added ? home.remove(key) : home.add(key))} />
    </li>
  );
}

/**
 * Add apps to the home screen. A bottom sheet on phones and a dialog on
 * computers: search everything, or browse the 3rd party alternatives by
 * category. ClusterFox originals that were removed are listed first.
 */
export default function AddAppSheet({ open, onClose, home, alts, autoFocus = false }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const onKey = event => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("sheet-open");
    // Phones would pop the keyboard over the list, so only focus on computers.
    if (window.matchMedia("(pointer: fine)").matches || autoFocus) inputRef.current?.focus();
    else dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("sheet-open");
      previous?.focus?.();
    };
  }, [open, onClose, autoFocus]);

  const q = normalize(query);
  const missingOriginals = apps.filter(app => !home.has(originalKey(app.id)));
  const originalResults = useMemo(() => searchOriginals(apps, q), [q]);
  const altResults = useMemo(() => searchAlternatives(alts, q), [alts, q]);

  const browse = useMemo(() => {
    if (!alts) return [];
    return category === "all" ? alts.categories : alts.categories.filter(c => c.id === category);
  }, [alts, category]);

  if (!open) return null;

  return (
    <div className="add-sheet-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="add-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-sheet-title"
        tabIndex={-1}
        onClick={event => event.stopPropagation()}
      >
        <div className="add-sheet-grabber" aria-hidden="true" />

        <header className="add-sheet-header">
          <div>
            <p className="section-label">HOME SCREEN</p>
            <h2 id="add-sheet-title">Add apps</h2>
          </div>
          <button type="button" className="add-sheet-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <label className="add-sheet-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={`Search ${alts ? alts.count : "hundreds of"} alternatives, or try "Photoshop"`}
            aria-label="Search apps"
            enterKeyHint="search"
          />
        </label>

        <div className="add-sheet-body">
          {q ? (
            <>
              {originalResults.length > 0 && (
                <section className="add-sheet-group">
                  <h3>ClusterFox Originals</h3>
                  <ul className="add-sheet-list">
                    {originalResults.map(app => (
                      <OriginalRow key={app.id} app={app} home={home} />
                    ))}
                  </ul>
                </section>
              )}

              <section className="add-sheet-group">
                <h3>3rd Party Alternatives</h3>
                {!alts ? (
                  <p className="add-sheet-note">
                    <Loader2 size={16} className="spin" aria-hidden="true" /> Loading the directory…
                  </p>
                ) : altResults.length === 0 ? (
                  <p className="add-sheet-note">Nothing matches "{query.trim()}". Try the name of a paid app, like "Office".</p>
                ) : (
                  <ul className="add-sheet-list">
                    {altResults.slice(0, RESULT_LIMIT).map(app => (
                      <AltRow key={app.name} app={app} home={home} />
                    ))}
                  </ul>
                )}
                {altResults.length > RESULT_LIMIT && (
                  <Link className="add-sheet-more" to={`/alternatives?q=${encodeURIComponent(query.trim())}`}>
                    See all {altResults.length} results <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </section>
            </>
          ) : (
            <>
              {missingOriginals.length > 0 && (
                <section className="add-sheet-group">
                  <h3>ClusterFox Originals</h3>
                  <ul className="add-sheet-list">
                    {missingOriginals.map(app => (
                      <OriginalRow key={app.id} app={app} home={home} />
                    ))}
                  </ul>
                </section>
              )}

              <section className="add-sheet-group">
                <h3>3rd Party Alternatives</h3>
                {!alts ? (
                  <p className="add-sheet-note">
                    <Loader2 size={16} className="spin" aria-hidden="true" /> Loading the directory…
                  </p>
                ) : (
                  <>
                    <div className="add-sheet-chips" role="group" aria-label="Category">
                      <button
                        type="button"
                        className={`free-chip ${category === "all" ? "active" : ""}`}
                        onClick={() => setCategory("all")}
                      >
                        All
                      </button>
                      {alts.categories.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className={`free-chip ${category === c.id ? "active" : ""}`}
                          onClick={() => setCategory(c.id)}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>

                    {browse.map(c => (
                      <div key={c.id} className="add-sheet-category">
                        <h4>{c.name}</h4>
                        <ul className="add-sheet-list">
                          {c.apps.map(app => (
                            <AltRow key={app.name} app={app} home={home} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </>
                )}
              </section>
            </>
          )}

          <Link className="add-sheet-more" to="/alternatives">
            Open the full 3rd Party Alternatives directory <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
