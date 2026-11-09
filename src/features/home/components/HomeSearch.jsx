import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, Loader2, Plus, Search, X } from "lucide-react";

import { apps } from "../../../app/apps";
import FreeAppIcon from "../../free/FreeAppIcon";
import { altKey } from "../state/homeStore";
import { normalize, searchAlternatives, searchOriginals } from "../search";
import AppLink from "./AppLink";
import OriginalIcon from "./OriginalIcon";

const ALT_LIMIT = 8;

/**
 * The desktop search bar. Finds ClusterFox originals and 3rd party
 * alternatives in one go, and pins alternatives to the home screen.
 */
export default function HomeSearch({ home, alts, onWantAlts }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onDown = event => {
      if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const q = normalize(query);
  const originals = searchOriginals(apps, q);
  const altResults = searchAlternatives(alts, q);
  const showPanel = open && q;

  return (
    <div className="home-search" ref={boxRef}>
      <label className="home-search-field">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onFocus={() => {
            setOpen(true);
            onWantAlts();
          }}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={event => {
            if (event.key === "Escape") {
              setQuery("");
              setOpen(false);
            }
          }}
          placeholder={`Search ClusterFox apps and ${alts ? alts.count : "hundreds of"} 3rd party alternatives`}
          aria-label="Search apps and 3rd party alternatives"
          aria-expanded={Boolean(showPanel)}
          aria-controls="home-search-results"
        />
        {query && (
          <button type="button" className="home-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </label>

      {showPanel && (
        <div className="home-search-panel" id="home-search-results">
          {originals.length > 0 && (
            <div className="home-search-group">
              <h3>ClusterFox Originals</h3>
              <div className="home-search-originals">
                {originals.map(app => (
                  <AppLink key={app.id} app={app} className="home-search-original">
                    <OriginalIcon app={app} compact size={22} />
                    <span>
                      <strong>{app.fullName ?? app.subtitle}</strong>
                      <small>{app.description}</small>
                    </span>
                  </AppLink>
                ))}
              </div>
            </div>
          )}

          <div className="home-search-group">
            <h3>3rd Party Alternatives</h3>
            {!alts ? (
              <p className="home-search-note">
                <Loader2 size={16} className="spin" aria-hidden="true" /> Loading the directory…
              </p>
            ) : altResults.length === 0 ? (
              <p className="home-search-note">No alternatives match "{query.trim()}".</p>
            ) : (
              <ul className="home-search-alts">
                {altResults.slice(0, ALT_LIMIT).map(app => {
                  const key = altKey(app.name);
                  const added = home.has(key);
                  return (
                    <li key={app.name}>
                      <a href={app.url} target="_blank" rel="noopener noreferrer" className="home-search-alt">
                        <FreeAppIcon app={app} />
                        <span>
                          <strong>
                            {app.name} <ExternalLink size={12} aria-hidden="true" />
                          </strong>
                          <small>
                            Instead of {app.alt} · {app.category}
                          </small>
                        </span>
                      </a>
                      <button
                        type="button"
                        className={`add-sheet-toggle ${added ? "added" : ""}`}
                        aria-pressed={added}
                        onClick={() => (added ? home.remove(key) : home.add(key))}
                      >
                        {added ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                        <span>{added ? "On home" : "Add to home"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {alts && altResults.length > 0 && (
            <Link className="add-sheet-more" to={`/alternatives?q=${encodeURIComponent(query.trim())}`}>
              {altResults.length > ALT_LIMIT
                ? `See all ${altResults.length} matches in 3rd Party Alternatives`
                : "Browse them in 3rd Party Alternatives"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
