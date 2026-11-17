import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, NavLink, useParams, useSearchParams } from "react-router-dom";
import { BookOpen, Inbox, Lightbulb, RefreshCw, Search, StickyNote } from "lucide-react";

import SiteHeader from "../../components/SiteHeader";
import { apps } from "../../app/apps";
import { useAuth } from "../../context/AuthContext";
import { withNext } from "../../lib/redirect";
import { donateUrl } from "../site/donate";
import { CATALOGS, catalogFor } from "./catalog/registry";
import GenericCatalog from "./catalog/GenericCatalog";
import { addNote, deleteNote, listFeedback, listNotes, updateFeedback, updateNote } from "./devApi";
import { useDeveloper } from "./useDeveloper";
import "../site/site.css";
import "./dev.css";

const LiftCatalog = lazy(() => import("./catalog/LiftCatalog"));

const appName = id => {
  const app = apps.find(a => a.id === id);
  return app ? app.fullName ?? app.subtitle : id;
};
const when = iso =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const loadFeedback = status => listFeedback({ status });
const loadNotes = status => listNotes({ status });

const FEEDBACK_STATUSES = ["new", "seen", "planned", "fixed", "closed"];
const KIND_LABEL = { bug: "Bug", idea: "Idea", praise: "Praise", other: "Other" };

// Loads a list for the given filter, and reloads when the filter changes.
function useList(loader, filter) {
  const [state, setState] = useState({ rows: null, error: "" });
  const refresh = useCallback(() => {
    loader(filter)
      .then(rows => setState({ rows: rows ?? [], error: "" }))
      .catch(error => setState({ rows: [], error: error.message }));
  }, [loader, filter]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { ...state, refresh, setRows: rows => setState(s => ({ ...s, rows })) };
}

function FeedbackInbox() {
  const [filter, setFilter] = useState("open");
  const { rows, error, refresh, setRows } = useList(loadFeedback, filter);

  async function setStatus(row, status) {
    setRows(rows.map(r => (r.id === row.id ? { ...r, status } : r)));
    try {
      await updateFeedback(row.id, { status });
    } catch {
      refresh();
    }
  }

  async function saveNote(row, devNote) {
    try {
      await updateFeedback(row.id, { dev_note: devNote || null });
    } catch {
      refresh();
    }
  }

  return (
    <section>
      <div className="dev-toolbar">
        <div className="dev-segmented" role="tablist" aria-label="Which feedback">
          {[
            ["open", "Open"],
            ["new", "New"],
            ["fixed", "Fixed"],
            ["closed", "Closed"],
            ["all", "All"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? "is-on" : ""} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="site-button" onClick={refresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <p className="site-error">{error}</p>}
      {rows === null ? (
        <p className="dev-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="dev-empty">No feedback here yet.</p>
      ) : (
        <div className="dev-cards">
          {rows.map(row => (
            <article key={row.id} className={`dev-card dev-card--${row.status}`}>
              <header className="dev-card-head">
                <span className={`dev-kind dev-kind--${row.kind}`}>{KIND_LABEL[row.kind] ?? row.kind}</span>
                <strong>{row.app ? appName(row.app) : "Whole site"}</strong>
                <span className="dev-muted dev-small">{when(row.created_at)}</span>
              </header>
              <p className="dev-message">{row.message}</p>
              <p className="dev-muted dev-small">
                From {row.user_name || (row.user_id ? "a signed-in user" : "a visitor")}
                {row.contact ? ` · ${row.contact}` : ""}
                {row.page && (
                  <>
                    {" · "}
                    <Link to={row.page}>{row.page}</Link>
                  </>
                )}
              </p>
              <div className="dev-card-actions">
                <select value={row.status} onChange={e => setStatus(row, e.target.value)} aria-label="Status">
                  {FEEDBACK_STATUSES.map(s => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  defaultValue={row.dev_note ?? ""}
                  placeholder="Your note (saved when you leave the box)"
                  onBlur={e => e.target.value !== (row.dev_note ?? "") && saveNote(row, e.target.value.trim())}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const NOTE_STATUS = { open: "Open", picked_up: "Claude is on it", done: "Done", dropped: "Dropped" };

function NotesBoard() {
  const [filter, setFilter] = useState("open");
  const { rows, error, refresh, setRows } = useList(loadNotes, filter);
  const [draft, setDraft] = useState({ kind: "idea", title: "", body: "", app: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function save(event) {
    event.preventDefault();
    if (!draft.body.trim()) return;
    setSaving(true);
    setFormError("");
    try {
      await addNote({
        kind: draft.kind,
        title: draft.title.trim() || null,
        body: draft.body.trim(),
        app: draft.app || null,
      });
      setDraft(d => ({ ...d, title: "", body: "" }));
      refresh();
    } catch (err) {
      setFormError(`Couldn't save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(note, status) {
    setRows(rows.map(r => (r.id === note.id ? { ...r, status } : r)));
    try {
      await updateNote(note.id, { status });
    } catch {
      refresh();
    }
  }

  async function remove(note) {
    setRows(rows.filter(r => r.id !== note.id));
    try {
      await deleteNote(note.id);
    } catch {
      refresh();
    }
  }

  return (
    <section>
      <form className="site-card dev-note-form" onSubmit={save}>
        <div className="dev-segmented" role="radiogroup" aria-label="Kind of note">
          {[
            ["idea", "New app idea"],
            ["general", "General note"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={draft.kind === id ? "is-on" : ""} onClick={() => setDraft(d => ({ ...d, kind: id }))}>
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder={draft.kind === "idea" ? "App name (e.g. Piano app)" : "Title (optional)"}
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          maxLength={120}
        />
        {draft.kind === "general" && (
          <select value={draft.app} onChange={e => setDraft(d => ({ ...d, app: e.target.value }))} aria-label="About which app">
            <option value="">Whole site</option>
            {apps.map(a => (
              <option key={a.id} value={a.id}>
                {a.fullName ?? a.subtitle}
              </option>
            ))}
          </select>
        )}
        <textarea
          rows={4}
          placeholder={draft.kind === "idea" ? "What should it do? Jot it down now, polish later." : "What should Claude know or change?"}
          value={draft.body}
          onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
          maxLength={8000}
        />
        {formError && <p className="site-error">{formError}</p>}
        <div className="site-actions">
          <button type="submit" className="site-button site-button--primary" disabled={saving || !draft.body.trim()}>
            {saving ? "Saving…" : "Save note"}
          </button>
          <span className="dev-muted dev-small">Page notes are added from the dev button on any page.</span>
        </div>
      </form>

      <div className="dev-toolbar">
        <div className="dev-segmented" role="tablist" aria-label="Which notes">
          {[
            ["open", "Open"],
            ["done", "Done"],
            ["all", "All"],
          ].map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? "is-on" : ""} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="site-button" onClick={refresh}>
          <RefreshCw size={14} aria-hidden="true" /> Refresh
        </button>
      </div>

      {error && <p className="site-error">{error}</p>}
      {rows === null ? (
        <p className="dev-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="dev-empty">No notes here.</p>
      ) : (
        <div className="dev-cards">
          {rows.map(note => (
            <article key={note.id} className={`dev-card dev-card--${note.status}`}>
              <header className="dev-card-head">
                <span className={`dev-kind dev-kind--${note.kind}`}>
                  {note.kind === "idea" ? <Lightbulb size={13} aria-hidden="true" /> : <StickyNote size={13} aria-hidden="true" />}
                  {note.kind === "idea" ? "App idea" : note.kind === "page" ? "Page note" : "Note"}
                </span>
                <strong>{note.title || (note.app ? appName(note.app) : note.page || "Whole site")}</strong>
                <span className="dev-muted dev-small">{when(note.created_at)}</span>
              </header>
              {note.page && (
                <p className="dev-small">
                  On <Link to={note.page}>{note.page}</Link>
                </p>
              )}
              <p className="dev-message">{note.body}</p>
              {note.reply && (
                <p className="dev-reply">
                  <strong>Claude:</strong> {note.reply}
                </p>
              )}
              <div className="dev-card-actions">
                <select value={note.status} onChange={e => setStatus(note, e.target.value)} aria-label="Status">
                  {Object.entries(NOTE_STATUS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <button type="button" className="site-button dev-delete" onClick={() => remove(note)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CatalogIndex() {
  return (
    <div className="dev-catalog-index">
      {CATALOGS.map(c => {
        const app = apps.find(a => a.id === c.appId);
        if (!app) return null;
        const Icon = app.icon;
        return (
          <Link key={c.appId} to={`/dev/catalog/${c.appId}`} className="dev-catalog-tile">
            <span className={`dev-catalog-icon app-icon--${app.accent}`} aria-hidden="true">
              <Icon size={20} />
            </span>
            <span>
              <strong>{app.fullName ?? app.subtitle}</strong>
              <small>{c.what}</small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function CatalogView({ appId }) {
  const catalog = catalogFor(appId);
  const [query, setQuery] = useState("");
  if (!catalog) return <p className="dev-empty">There's no catalog for that app yet.</p>;
  const app = apps.find(a => a.id === appId);
  return (
    <section>
      <div className="dev-toolbar">
        <div>
          <Link to="/dev/catalog" className="dev-small">
            ← All catalogs
          </Link>
          <h2 className="dev-catalog-title">Everything in {app?.fullName ?? app?.subtitle ?? appId}</h2>
        </div>
        <label className="dev-search">
          <Search size={15} aria-hidden="true" />
          <input type="search" placeholder="Search" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
      </div>
      {catalog.custom ? (
        <Suspense fallback={<p className="dev-muted">Loading…</p>}>
          <LiftCatalog query={query} />
        </Suspense>
      ) : (
        <GenericCatalog load={catalog.load} query={query} />
      )}
    </section>
  );
}

function Gate({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const dev = useDeveloper();
  if (loading || (isAuthenticated && dev === "checking")) return <p className="dev-muted">Checking your access…</p>;
  if (!isAuthenticated) {
    return (
      <div className="site-card">
        <h2>Developer area</h2>
        <p className="dev-muted">
          <Link to={withNext("/login", "/dev")}>Sign in</Link> with the developer account to continue.
        </p>
      </div>
    );
  }
  if (dev !== "yes") {
    return (
      <div className="site-card">
        <h2>Developer area</h2>
        <p className="dev-muted">This part of The ClusterFox is only for its developer.</p>
        <Link to="/" className="site-button">
          Go home
        </Link>
      </div>
    );
  }
  return children;
}

/**
 * The developer area: the feedback inbox, page notes and app ideas for
 * Claude to pick up, and catalogs that show everything an app contains.
 * Only accounts in site_admins see anything here; the database enforces it.
 */
export default function DevPage() {
  const { appId } = useParams();
  const [params] = useSearchParams();
  const tab = appId !== undefined || params.get("tab") === "catalog" ? "catalog" : params.get("tab") === "notes" ? "notes" : "feedback";

  return (
    <main className="site-page dev-page">
      <SiteHeader />
      <div className="site-container site-container--wide">
        <header className="site-heading">
          <p className="eyebrow">BEHIND THE SCENES</p>
          <h1>Developer area</h1>
        </header>

        <Gate>
          <nav className="dev-tabs" aria-label="Developer area">
            <NavLink to="/dev" end className={() => (tab === "feedback" ? "is-on" : "")}>
              <Inbox size={16} aria-hidden="true" /> Feedback
            </NavLink>
            <NavLink to="/dev?tab=notes" className={() => (tab === "notes" ? "is-on" : "")}>
              <StickyNote size={16} aria-hidden="true" /> Notes & ideas
            </NavLink>
            <NavLink to="/dev/catalog" className={() => (tab === "catalog" ? "is-on" : "")}>
              <BookOpen size={16} aria-hidden="true" /> Catalogs
            </NavLink>
          </nav>

          {!donateUrl && (
            <p className="dev-setup">
              Donate button: set <code>VITE_DONATE_URL</code> in Vercel to your donation link to turn it on.
            </p>
          )}

          {tab === "feedback" && <FeedbackInbox />}
          {tab === "notes" && <NotesBoard />}
          {tab === "catalog" && (appId ? <CatalogView key={appId} appId={appId} /> : <CatalogIndex />)}
        </Gate>
      </div>
    </main>
  );
}
