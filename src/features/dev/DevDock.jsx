import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Check, Code2, Inbox, Lightbulb, StickyNote, X } from "lucide-react";

import { appForPath } from "../site/pages";
import { catalogFor } from "./catalog/registry";
import { addNote, listNotes, updateNote } from "./devApi";
import { useDeveloper } from "./useDeveloper";
import "../site/site.css";
import "./dev.css";

const HIDE_KEY = "clusterfox:dev-dock-hidden";

/**
 * A small button on every page, only for the developer. It opens a panel to
 * leave a note about the page you're looking at (saved with its address, so
 * Claude can find the right screen), jot down an app idea, see the open notes
 * for this page, and jump to the developer area or this app's catalog.
 */
export default function DevDock() {
  const dev = useDeveloper();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dev !== "yes" || location.pathname.startsWith("/dev")) return null;
  if (hidden) {
    return (
      <button
        type="button"
        className="dev-dock-peek"
        onClick={() => {
          setHidden(false);
          try {
            sessionStorage.removeItem(HIDE_KEY);
          } catch {
            // Ignore.
          }
        }}
        aria-label="Show the developer button"
        title="Show the developer button"
      />
    );
  }

  return (
    <div className="dev-dock">
      {open && <DockPanel location={location} onClose={() => setOpen(false)} onHide={() => {
        setOpen(false);
        setHidden(true);
        try {
          sessionStorage.setItem(HIDE_KEY, "1");
        } catch {
          // Ignore.
        }
      }} />}
      <button
        type="button"
        className={`dev-dock-button ${open ? "is-open" : ""}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label="Developer notes for this page"
        title="Developer notes for this page"
      >
        {open ? <X size={18} aria-hidden="true" /> : <Code2 size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

function DockPanel({ location, onClose, onHide }) {
  const page = location.pathname + location.search;
  const app = appForPath(location.pathname);
  const catalog = app ? catalogFor(app.id) : null;
  const [kind, setKind] = useState("page");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState({ saving: false, saved: false, error: "" });
  const [notes, setNotes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listNotes({ page, status: "open", limit: 20 })
      .then(rows => !cancelled && setNotes(rows ?? []))
      .catch(() => !cancelled && setNotes([]));
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setStatus({ saving: true, saved: false, error: "" });
    try {
      const note = await addNote({
        kind,
        body: body.trim(),
        page: kind === "page" ? page : null,
        app: app?.id ?? null,
      });
      setBody("");
      setStatus({ saving: false, saved: true, error: "" });
      if (note && kind === "page") setNotes(list => [note, ...(list ?? [])]);
    } catch (error) {
      setStatus({ saving: false, saved: false, error: error.message });
    }
  }

  async function done(note) {
    setNotes(list => list.filter(n => n.id !== note.id));
    try {
      await updateNote(note.id, { status: "done" });
    } catch {
      // It stays open in the developer area.
    }
  }

  return (
    <section className="dev-panel" aria-label="Developer notes">
      <header className="dev-panel-head">
        <strong>Developer</strong>
        <code title={page}>{page}</code>
      </header>

      <form onSubmit={save} className="dev-panel-form">
        <div className="dev-segmented dev-segmented--small" role="radiogroup" aria-label="Kind of note">
          <button type="button" className={kind === "page" ? "is-on" : ""} onClick={() => setKind("page")}>
            <StickyNote size={13} aria-hidden="true" /> This page
          </button>
          <button type="button" className={kind === "idea" ? "is-on" : ""} onClick={() => setKind("idea")}>
            <Lightbulb size={13} aria-hidden="true" /> App idea
          </button>
        </div>
        <textarea
          rows={3}
          value={body}
          onChange={e => {
            setBody(e.target.value);
            if (status.saved) setStatus(s => ({ ...s, saved: false }));
          }}
          placeholder={kind === "page" ? "What should change on this screen?" : "An idea for a new app…"}
          maxLength={8000}
          autoFocus
        />
        {status.error && <p className="dev-error">{status.error}</p>}
        <div className="dev-panel-row">
          <button type="submit" className="site-button site-button--primary" disabled={status.saving || !body.trim()}>
            {status.saving ? "Saving…" : "Save note"}
          </button>
          {status.saved && (
            <span className="dev-saved">
              <Check size={14} aria-hidden="true" /> Saved for Claude
            </span>
          )}
        </div>
      </form>

      {notes?.length > 0 && (
        <div className="dev-panel-notes">
          <p className="dev-muted dev-small">Open notes on this page</p>
          {notes.map(note => (
            <div key={note.id} className="dev-panel-note">
              <p>{note.body}</p>
              {note.reply && <p className="dev-muted dev-small">Claude: {note.reply}</p>}
              <button type="button" onClick={() => done(note)} title="Mark done" aria-label="Mark done">
                <Check size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <nav className="dev-panel-links">
        <Link to="/dev">
          <Inbox size={14} aria-hidden="true" /> Feedback & notes
        </Link>
        {catalog && (
          <Link to={`/dev/catalog/${app.id}`}>
            <BookOpen size={14} aria-hidden="true" /> Everything in {app.subtitle}
          </Link>
        )}
        <button type="button" onClick={onHide}>
          Hide button
        </button>
      </nav>
    </section>
  );
}
