// Engineer ToolFox projects: named folders of saved calculations that can be
// reopened later and printed as one report.
//
// How a tool plugs in (see components/SaveToProject.jsx):
//   <SaveToProject tool={{ kind: "calc", id, name, discipline }} getReport={() => report} />
// where `report` is a plain snapshot of what the tool shows, made with
// reportSnapshot() below. The saved item also keeps the page's URL, so
// "Open" puts the exact inputs back on screen. Everything here is pure data,
// so it is safe to keep in localStorage and in the account table.

export const PROJECTS_KEY = "toolfox-projects-v1";
export const EMPTY_PROJECTS = { projects: [] };

const LIMITS = { projects: 200, items: 300, text: 4000, rows: 400, figureBytes: 400_000, figures: 4, tables: 8, cols: 16 };

export const newId = (prefix = "p") => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : v === undefined || v === null ? "" : String(v).slice(0, max));
const strs = (list, max = LIMITS.text, n = 60) => (Array.isArray(list) ? list.slice(0, n).map((s) => str(s, max)).filter(Boolean) : []);
const date = (v) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

/** Only same-site tool links can be stored, so "Open" never leaves Engineer ToolFox. */
export function safePath(p) {
  return typeof p === "string" && /^\/tools(\/|\?|$)/.test(p) && !p.includes("//") ? p.slice(0, 60_000) : "/tools";
}

const row = (r) => ({ label: str(r?.label), value: str(r?.value, 400), unit: str(r?.unit, 40) });
const rows = (list) => (Array.isArray(list) ? list.slice(0, LIMITS.rows).map(row) : []);

function table(t) {
  const head = strs(t?.head, 80, LIMITS.cols);
  const body = Array.isArray(t?.rows) ? t.rows.slice(0, LIMITS.rows).map((r) => strs(r, 200, LIMITS.cols)) : [];
  return { title: str(t?.title, 120), head, rows: body };
}

function figure(f) {
  const svg = typeof f?.svg === "string" && f.svg.startsWith("<svg") && f.svg.length <= LIMITS.figureBytes ? f.svg : "";
  return svg ? { title: str(f.title, 120), svg, w: Number(f.w) || 0, h: Number(f.h) || 0 } : null;
}

/** A clean, size-limited copy of a tool's report snapshot. */
export function cleanReport(r = {}) {
  return {
    units: str(r.units, 40),
    primary: r.primary ? row(r.primary) : null,
    inputs: rows(r.inputs),
    results: rows(r.results),
    tables: Array.isArray(r.tables) ? r.tables.slice(0, LIMITS.tables).map(table).filter((t) => t.rows.length) : [],
    figures: Array.isArray(r.figures) ? r.figures.slice(0, LIMITS.figures).map(figure).filter(Boolean) : [],
    warnings: strs(r.warnings, 600),
    formula: strs(r.formula, 600),
    about: str(r.about, LIMITS.text),
    sources: str(r.sources, LIMITS.text),
  };
}

function cleanItem(it) {
  if (!it || typeof it !== "object") return null;
  return {
    id: str(it.id, 40) || newId("c"),
    kind: it.kind === "builder" ? "builder" : "calc",
    tool: str(it.tool, 60),
    toolName: str(it.toolName, 120),
    discipline: str(it.discipline, 80),
    title: str(it.title, 160) || str(it.toolName, 120) || "Calculation",
    note: str(it.note, LIMITS.text),
    path: safePath(it.path),
    savedAt: date(it.savedAt),
    updatedAt: date(it.updatedAt || it.savedAt),
    report: cleanReport(it.report),
  };
}

const FIELDS = ["name", "number", "client", "location", "preparedBy", "checkedBy", "revision", "description"];

function cleanProject(p) {
  if (!p || typeof p !== "object") return null;
  const out = { id: str(p.id, 40) || newId("p") };
  for (const f of FIELDS) out[f] = str(p[f], f === "description" ? LIMITS.text : 160);
  out.name = out.name || "Untitled project";
  out.createdAt = date(p.createdAt);
  out.updatedAt = date(p.updatedAt || p.createdAt);
  out.items = Array.isArray(p.items) ? p.items.slice(0, LIMITS.items).map(cleanItem).filter(Boolean) : [];
  return out;
}

/** Whatever was stored (or synced, or imported), made safe to use. */
export function cleanProjects(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.projects)) return EMPTY_PROJECTS;
  const seen = new Set();
  const projects = raw.projects
    .slice(0, LIMITS.projects)
    .map(cleanProject)
    .filter((p) => p && !seen.has(p.id) && seen.add(p.id));
  return { projects };
}

const now = () => new Date().toISOString();
const touchProject = (p, patch) => ({ ...p, ...patch, updatedAt: now() });
const mapProject = (doc, id, fn) => ({ projects: doc.projects.map((p) => (p.id === id ? fn(p) : p)) });

export function createProject(doc, fields = {}) {
  const p = cleanProject({ ...fields, id: newId("p"), createdAt: now(), items: [] });
  return { doc: { projects: [p, ...doc.projects] }, id: p.id };
}

export function updateProject(doc, id, patch) {
  const allowed = Object.fromEntries(Object.entries(patch).filter(([k]) => FIELDS.includes(k)).map(([k, v]) => [k, str(v, k === "description" ? LIMITS.text : 160)]));
  return mapProject(doc, id, (p) => touchProject(p, allowed));
}

export const deleteProject = (doc, id) => ({ projects: doc.projects.filter((p) => p.id !== id) });

/** Copy a project, for a new revision or a similar job. */
export function duplicateProject(doc, id) {
  const src = doc.projects.find((p) => p.id === id);
  if (!src) return { doc, id: null };
  const copy = { ...src, id: newId("p"), name: `${src.name} (copy)`, createdAt: now(), updatedAt: now(), items: src.items.map((it) => ({ ...it, id: newId("c") })) };
  return { doc: { projects: [copy, ...doc.projects] }, id: copy.id };
}

/** Add a saved calculation. `item` is { kind, tool, toolName, discipline, title, note, path, report }. */
export function addItem(doc, projectId, item) {
  const it = cleanItem({ ...item, id: newId("c"), savedAt: now(), updatedAt: now() });
  return { doc: mapProject(doc, projectId, (p) => touchProject(p, { items: [...p.items, it] })), id: it.id };
}

/** Replace a saved calculation's inputs and results, keeping its title and note unless given. */
export function updateItem(doc, projectId, itemId, patch) {
  return mapProject(doc, projectId, (p) =>
    touchProject(p, {
      items: p.items.map((it) => (it.id === itemId ? cleanItem({ ...it, ...patch, id: it.id, savedAt: it.savedAt, updatedAt: now() }) : it)),
    })
  );
}

export const removeItem = (doc, projectId, itemId) => mapProject(doc, projectId, (p) => touchProject(p, { items: p.items.filter((it) => it.id !== itemId) }));

export function moveItem(doc, projectId, itemId, by) {
  return mapProject(doc, projectId, (p) => {
    const i = p.items.findIndex((it) => it.id === itemId);
    const j = i + by;
    if (i < 0 || j < 0 || j >= p.items.length) return p;
    const items = [...p.items];
    [items[i], items[j]] = [items[j], items[i]];
    return touchProject(p, { items });
  });
}

/** Move or copy a saved calculation into another project. */
export function copyItemTo(doc, fromId, itemId, toId, move = false) {
  const it = doc.projects.find((p) => p.id === fromId)?.items.find((x) => x.id === itemId);
  if (!it || fromId === toId) return doc;
  let next = addItem(doc, toId, it).doc;
  if (move) next = removeItem(next, fromId, itemId);
  return next;
}

/** A project as a downloadable file, and back. */
export const exportProject = (p) => JSON.stringify({ app: "Engineer ToolFox", type: "project", version: 1, project: p }, null, 2);

export function importProject(doc, text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a ToolFox project.");
  }
  const src = raw?.type === "project" ? raw.project : raw;
  if (!src || !Array.isArray(src.items)) throw new Error("That file isn't a ToolFox project.");
  const p = cleanProject({ ...src, id: newId("p"), items: src.items.map((it) => ({ ...it, id: newId("c") })) });
  return { doc: { projects: [p, ...doc.projects] }, id: p.id };
}

/**
 * Build a report snapshot from the rows a calculator already makes for
 * "Copy calc" (model/report.js), plus anything captured from the page.
 */
export function reportSnapshot({ calc, inputs = [], results = [], primary = null, warnings = [], tables = [], figures = [], units = "", formula, about, sources }) {
  return cleanReport({
    units,
    primary,
    inputs,
    results,
    tables,
    figures,
    warnings,
    formula: formula ?? calc?.formula ?? [],
    about: about ?? calc?.about ?? "",
    sources: sources ?? calc?.sources ?? "",
  });
}

/** Short line shown under a saved calculation: its headline result. */
export function headline(item) {
  const p = item.report.primary || item.report.results[0];
  return p ? `${p.label}: ${p.value}${p.unit ? ` ${p.unit}` : ""}` : "";
}
