import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Copy, Download, ExternalLink, FolderOpen, FolderPlus, Printer, Trash2, Upload } from "lucide-react";
import { useProjects } from "../state/useProjects";
import { exportProject, headline } from "../model/projects";
import ReportDocument from "./ReportDocument";
import "./projects.css";

// Projects: a list of projects, one project's saved calculations, and its printable report.

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function useTitle(title) {
  useEffect(() => {
    document.title = `${title} · Engineer ToolFox`;
    return () => {
      document.title = "The ClusterFOX";
    };
  }, [title]);
}

const STARTERS = [
  ["/tools/calc/pump-system", "Pump system builder"],
  ["/tools/calc/fan-system", "Fan and duct system sizer"],
  ["/tools/calc/building-loads", "Building heating and cooling loads"],
  ["/tools/calc/beam?setup=custom", "Beam builder"],
  ["/tools/frame", "Frame builder"],
  ["/tools/calc/pressure-drop", "Pipe pressure drop"],
];

function download(name, text) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileName = (p) => `${(p.number ? `${p.number} ` : "") + p.name}`.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "project";

const SYNC_TEXT = {
  local: "Saved in this browser. Sign in to keep projects on every device.",
  syncing: "Syncing with your account…",
  synced: "Saved to your account.",
  unavailable: "Saved in this browser. Account sync isn't set up for projects yet.",
  error: "Saved in this browser. Couldn't reach your account just now.",
};

export function ProjectsIndex() {
  const api = useProjects();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  useTitle("Projects");

  function importFile(file) {
    if (!file) return;
    file.text().then((text) => {
      try {
        const id = api.importText(text);
        navigate(`/tools/projects/${id}`);
      } catch (e) {
        setError(e.message);
      }
    });
  }

  return (
    <div className="tf-category tf-projects">
      <header className="tf-page-head">
        <Link to="/tools" className="tf-crumb">
          <ArrowLeft size={15} aria-hidden="true" /> Engineer ToolFox
        </Link>
        <div className="tf-title-row">
          <h1>Projects</h1>
        </div>
        <p className="tf-lede">Group calculations by job. Save any calculator or the frame builder into a project, reopen it later with the same inputs, and print the whole set as one report with a cover sheet.</p>
      </header>

      <form
        className="tf-card tf-pj-new"
        onSubmit={(e) => {
          e.preventDefault();
          const id = api.create({ name: name.trim() || "Untitled project" });
          setName("");
          navigate(`/tools/projects/${id}`);
        }}
      >
        <label className="tf-field">
          <span className="tf-label">New project</span>
          <input className="tf-text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Building B mechanical upgrade" maxLength={160} />
        </label>
        <button type="submit" className="tf-export-btn is-primary">
          <FolderPlus size={15} aria-hidden="true" /> Create
        </button>
        <button type="button" className="tf-export-btn" onClick={() => fileRef.current?.click()}>
          <Upload size={15} aria-hidden="true" /> Open a project file
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => (importFile(e.target.files?.[0]), (e.target.value = ""))} />
      </form>
      {error && <p className="tf-warning">{error}</p>}
      <p className="tf-muted tf-small tf-pj-sync">{SYNC_TEXT[api.syncStatus] || SYNC_TEXT.local}</p>

      {api.projects.length === 0 ? (
        <Starters />
      ) : (
        <div className="tf-pj-grid">
          {api.projects.map((p) => (
            <Link key={p.id} to={`/tools/projects/${p.id}`} className="tf-pj-card">
              <span className="tf-pj-card-icon" aria-hidden="true">
                <FolderOpen size={18} />
              </span>
              <span className="tf-pj-card-text">
                {p.number && <small>{p.number}</small>}
                <strong>{p.name}</strong>
                <span>
                  {p.items.length} {p.items.length === 1 ? "calculation" : "calculations"}
                  {p.client ? ` · ${p.client}` : ""} · updated {day(p.updatedAt)}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Starters() {
  return (
    <section className="tf-card tf-pj-empty">
      <h2>How it works</h2>
      <ol>
        <li>Open a tool and set it up.</li>
        <li>
          Press <strong>Save to project</strong> under the results (or at the top of the frame builder).
        </li>
        <li>Come back here to reopen it, add notes, reorder, and print the report.</li>
      </ol>
      <div className="tf-chip-row">
        {STARTERS.map(([to, label]) => (
          <Link key={to} to={to} className="tf-chip">
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

const FIELDS = [
  ["name", "Project name"],
  ["number", "Project number"],
  ["client", "Client"],
  ["location", "Location / site"],
  ["preparedBy", "Prepared by"],
  ["checkedBy", "Checked by"],
  ["revision", "Revision"],
];

/** A text box that saves when you leave it, so typing doesn't sync every key. */
function Edit({ value, onSave, multiline, ...rest }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }
  const Tag = multiline ? "textarea" : "input";
  return <Tag className="tf-text" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onSave(text)} {...rest} />;
}

export function ProjectPage() {
  const { id } = useParams();
  const api = useProjects();
  const navigate = useNavigate();
  const project = api.byId(id);
  useTitle(project?.name || "Project");

  if (!project)
    return (
      <div className="tf-card tf-empty">
        <h2>That project isn't here.</h2>
        <p className="tf-muted">It may have been deleted, or saved in another browser before you signed in.</p>
        <Link to="/tools/projects">All projects</Link>
      </div>
    );

  const others = api.projects.filter((p) => p.id !== project.id);

  return (
    <div className="tf-category tf-projects">
      <header className="tf-page-head">
        <Link to="/tools/projects" className="tf-crumb">
          <ArrowLeft size={15} aria-hidden="true" /> All projects
        </Link>
        <div className="tf-title-row">
          <h1>{project.name}</h1>
          <div className="tf-actions">
            <button type="button" className="tf-icon-btn" title="Download a project file (backup, or to share)" onClick={() => download(`${fileName(project)}.json`, exportProject(project))}>
              <Download size={18} />
            </button>
            <button type="button" className="tf-icon-btn" title="Duplicate this project (for a new revision)" onClick={() => navigate(`/tools/projects/${api.duplicate(project.id)}`)}>
              <Copy size={18} />
            </button>
            <button
              type="button"
              className="tf-icon-btn"
              title="Delete this project"
              onClick={() => {
                if (window.confirm(`Delete “${project.name}” and its ${project.items.length} saved calculations? This can't be undone.`)) {
                  api.remove(project.id);
                  navigate("/tools/projects");
                }
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="tf-pj-layout">
        <section className="tf-card tf-pj-details" aria-label="Project details">
          <h2 className="tf-inputs-title">Report title block</h2>
          {FIELDS.map(([k, label]) => (
            <label key={k} className="tf-field">
              <span className="tf-label">{label}</span>
              <Edit value={project[k]} onSave={(v) => api.update(project.id, { [k]: k === "name" ? v.trim() || "Untitled project" : v })} maxLength={160} />
            </label>
          ))}
          <label className="tf-field">
            <span className="tf-label">Description (printed on the cover)</span>
            <Edit multiline rows={4} value={project.description} onSave={(v) => api.update(project.id, { description: v })} maxLength={4000} placeholder="Scope, design basis, codes used…" />
          </label>
        </section>

        <section className="tf-pj-items" aria-label="Saved calculations">
          <div className="tf-pj-items-head">
            <h2 className="tf-block-title">
              Calculations <span className="tf-muted">({project.items.length})</span>
            </h2>
            <Link to={`/tools/projects/${project.id}/report`} className={`tf-export-btn is-primary ${project.items.length ? "" : "is-disabled"}`} aria-disabled={!project.items.length}>
              <Printer size={15} aria-hidden="true" /> Print report
            </Link>
          </div>
          {project.items.length === 0 && <Starters />}
          <ol className="tf-pj-list">
            {project.items.map((it, i) => (
              <li key={it.id} className="tf-card tf-pj-item">
                <div className="tf-pj-item-head">
                  <span className="tf-pj-num">{i + 1}</span>
                  <div className="tf-pj-item-title">
                    <Edit value={it.title} onSave={(v) => api.updateItem(project.id, it.id, { title: v.trim() || it.toolName })} aria-label="Calculation title" maxLength={160} />
                    <small className="tf-muted">
                      {it.toolName}
                      {it.discipline ? ` · ${it.discipline}` : ""} · saved {day(it.updatedAt)}
                    </small>
                  </div>
                </div>
                {headline(it) && <p className="tf-pj-headline">{headline(it)}</p>}
                {it.report.warnings.length > 0 && (
                  <p className="tf-muted tf-small">
                    {it.report.warnings.length} {it.report.warnings.length === 1 ? "note" : "notes"} in the results
                  </p>
                )}
                <label className="tf-field">
                  <span className="tf-label">Note</span>
                  <Edit multiline rows={2} value={it.note} onSave={(v) => api.updateItem(project.id, it.id, { note: v })} maxLength={4000} placeholder="Printed with this calculation" />
                </label>
                <div className="tf-pj-item-actions">
                  <Link to={it.path} state={{ projectItem: { projectId: project.id, itemId: it.id } }} className="tf-export-btn is-primary">
                    <ExternalLink size={15} aria-hidden="true" /> Open
                  </Link>
                  <Link to={`/tools/projects/${project.id}/report?item=${it.id}`} className="tf-export-btn">
                    <Printer size={15} aria-hidden="true" /> Print this
                  </Link>
                  <button type="button" className="tf-icon-btn" title="Move up" disabled={i === 0} onClick={() => api.moveItem(project.id, it.id, -1)}>
                    <ArrowUp size={16} />
                  </button>
                  <button type="button" className="tf-icon-btn" title="Move down" disabled={i === project.items.length - 1} onClick={() => api.moveItem(project.id, it.id, 1)}>
                    <ArrowDown size={16} />
                  </button>
                  {others.length > 0 && (
                    <select className="tf-select tf-pj-move" value="" aria-label="Copy or move to another project" onChange={(e) => {
                      const [how, to] = e.target.value.split(":");
                      if (to) api.copyItemTo(project.id, it.id, to, how === "move");
                    }}>
                      <option value="">Copy / move…</option>
                      {others.map((p) => (
                        <optgroup key={p.id} label={p.name}>
                          <option value={`copy:${p.id}`}>Copy to {p.name}</option>
                          <option value={`move:${p.id}`}>Move to {p.name}</option>
                        </optgroup>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className="tf-icon-btn"
                    title="Remove from project"
                    onClick={() => window.confirm(`Remove “${it.title}” from this project?`) && api.removeItem(project.id, it.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

const OPTIONS = [
  ["cover", "Cover sheet"],
  ["figures", "Drawings"],
  ["tables", "Tables"],
  ["equations", "Equations"],
  ["assumptions", "Assumptions and references"],
];
const OPT_KEY = "toolfox-report-options";
const readOpts = () => {
  try {
    return { cover: true, figures: true, tables: true, equations: true, assumptions: true, ...JSON.parse(localStorage.getItem(OPT_KEY) || "{}") };
  } catch {
    return { cover: true, figures: true, tables: true, equations: true, assumptions: true };
  }
};

export function ProjectReport() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const api = useProjects();
  const project = api.byId(id);
  const [opts, setOpts] = useState(readOpts);
  const only = params.get("item");
  const items = project ? (only ? project.items.filter((it) => it.id === only) : project.items) : [];
  useTitle(project ? `${project.number ? `${project.number} ` : ""}${project.name} report` : "Report");

  useEffect(() => {
    try {
      localStorage.setItem(OPT_KEY, JSON.stringify(opts));
    } catch {
      // Only a convenience.
    }
  }, [opts]);

  if (!project)
    return (
      <div className="tf-card tf-empty">
        <h2>That project isn't here.</h2>
        <Link to="/tools/projects">All projects</Link>
      </div>
    );

  return (
    <div className="tf-report-page">
      <div className="tf-report-bar">
        <Link to={`/tools/projects/${project.id}`} className="tf-crumb">
          <ArrowLeft size={15} aria-hidden="true" /> {project.name}
        </Link>
        <div className="tf-report-opts" role="group" aria-label="Include in the report">
          {OPTIONS.map(([k, label]) => (
            <label key={k} className="tf-check">
              <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} /> {label}
            </label>
          ))}
        </div>
        <button type="button" className="tf-export-btn is-primary" onClick={() => window.print()} disabled={!items.length}>
          <Printer size={15} aria-hidden="true" /> Print or save as PDF
        </button>
      </div>
      {only && (
        <p className="tf-muted tf-small tf-report-hint">
          Printing one calculation. <Link to={`/tools/projects/${project.id}/report`}>Print the whole project</Link>
        </p>
      )}
      {items.length ? (
        <ReportDocument project={project} items={items} total={project.items} opts={{ ...opts, cover: opts.cover && !only }} />
      ) : (
        <p className="tf-card tf-empty">This project has no saved calculations yet.</p>
      )}
    </div>
  );
}
