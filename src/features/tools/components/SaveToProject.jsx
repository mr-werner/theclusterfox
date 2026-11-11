import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, FolderPlus, RefreshCw, X } from "lucide-react";
import { useProjects } from "../state/useProjects";

// "Save to project" for any Engineer ToolFox tool.
//
//   <SaveToProject tool={{ kind: "calc", id, name, discipline }} getReport={() => reportSnapshot(...)} />
//
// getReport() is called at the moment of saving and returns a snapshot (see
// model/projects.js reportSnapshot). getPath() returns the link that reopens
// these exact inputs; by default it is the current page URL. A tool opened
// from a project (Open on the project page) offers to update that copy.

const LAST_KEY = "toolfox-last-project";
const readLast = () => {
  try {
    return localStorage.getItem(LAST_KEY) || "";
  } catch {
    return "";
  }
};
const writeLast = (id) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    // Only a convenience.
  }
};

export default function SaveToProject({ tool, getReport, getPath, className = "tf-export-btn", label = "Save to project" }) {
  const api = useProjects();
  const location = useLocation();
  // Where this page was opened from, if from a project. Read once: the page rewrites its URL as you type.
  const [origin] = useState(() => location.state?.projectItem || null);
  const originProject = origin ? api.byId(origin.projectId) : null;
  const originItem = originProject?.items.find((it) => it.id === origin.itemId) || null;
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null); // { projectId, name, updated }

  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(null), 6000);
    return () => clearTimeout(t);
  }, [done]);

  const path = () => (getPath ? getPath() : `${window.location.pathname}${window.location.search}`);

  function updateOrigin() {
    api.updateItem(originProject.id, originItem.id, { path: path(), report: getReport() });
    setDone({ projectId: originProject.id, name: originProject.name, updated: true });
  }

  return (
    <>
      {originItem ? (
        <>
          <button type="button" className={className} onClick={updateOrigin} title={`Save these inputs and results over “${originItem.title}” in ${originProject.name}`}>
            <RefreshCw size={15} aria-hidden="true" /> Update in project
          </button>
          <button type="button" className={className} onClick={() => setOpen(true)} title="Save a new copy to a project">
            <FolderPlus size={15} aria-hidden="true" /> Save as new
          </button>
        </>
      ) : (
        <button type="button" className={className} onClick={() => setOpen(true)}>
          <FolderPlus size={15} aria-hidden="true" /> {label}
        </button>
      )}
      {done && (
        <p className="tf-saved-note" role="status">
          <Check size={15} aria-hidden="true" /> {done.updated ? "Updated in" : "Saved to"} <strong>{done.name}</strong>.
          <Link to={`/tools/projects/${done.projectId}`}>Open project</Link>
        </p>
      )}
      {open && (
        <SaveDialog
          tool={tool}
          onClose={() => setOpen(false)}
          onSave={({ projectId, newName, title, note }) => {
            const pid = projectId === "new" ? api.create({ name: newName }) : projectId;
            api.addItem(pid, { kind: tool.kind, tool: tool.id, toolName: tool.name, discipline: tool.discipline, title, note, path: path(), report: getReport() });
            writeLast(pid);
            setOpen(false);
            setDone({ projectId: pid, name: projectId === "new" ? newName || "Untitled project" : api.byId(pid)?.name || "project" });
          }}
        />
      )}
    </>
  );
}

function SaveDialog({ tool, onClose, onSave }) {
  const { projects } = useProjects();
  const last = readLast();
  const [projectId, setProjectId] = useState(projects.some((p) => p.id === last) ? last : projects[0]?.id || "new");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(tool.name);
  const [note, setNote] = useState("");
  const first = useRef(null);

  useEffect(() => {
    first.current?.focus();
    first.current?.select?.();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSave = title.trim() && (projectId !== "new" || newName.trim());

  return (
    <div className="tf-palette-backdrop tf-save-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="tf-save-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tf-save-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave({ projectId, newName: newName.trim(), title: title.trim(), note: note.trim() });
        }}
      >
        <header>
          <h2 id="tf-save-title">Save to a project</h2>
          <button type="button" className="tf-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <p className="tf-muted tf-small">Saves these inputs and results so you can reopen them later and print them in the project report.</p>
        <label className="tf-field">
          <span>Calculation title</span>
          <input ref={first} className="tf-text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. P-1 chilled water pump" />
        </label>
        <label className="tf-field">
          <span>Project</span>
          <select className="tf-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.number ? `${p.number} · ` : ""}
                {p.name}
              </option>
            ))}
            <option value="new">New project…</option>
          </select>
        </label>
        {projectId === "new" && (
          <label className="tf-field">
            <span>New project name</span>
            <input className="tf-text" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={160} placeholder="e.g. Building B mechanical upgrade" autoFocus />
          </label>
        )}
        <label className="tf-field">
          <span>Note (optional, printed with the calc)</span>
          <textarea className="tf-text" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={4000} placeholder="Purpose, basis of design, where the inputs came from…" />
        </label>
        <div className="tf-save-actions">
          <button type="button" className="tf-export-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="tf-export-btn is-primary" disabled={!canSave}>
            <FolderPlus size={15} aria-hidden="true" /> Save
          </button>
        </div>
      </form>
    </div>
  );
}
