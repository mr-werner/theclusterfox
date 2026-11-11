// Engineer ToolFox projects: saving, editing, ordering and cleaning stored data.
import assert from "node:assert/strict";
import * as P from "../model/projects.js";

const report = P.reportSnapshot({
  calc: { formula: ["Δp = f L/D ρv²/2"], about: "Steady flow.", sources: "Crane TP-410" },
  inputs: [{ label: "Flow", value: "200", unit: "gpm" }],
  results: [{ label: "Pressure drop", value: "4.2", unit: "psi" }],
  primary: { label: "Pressure drop", value: "4.2", unit: "psi" },
  warnings: ["Velocity is high."],
  tables: [{ title: "Line list", head: ["Run", "Loss"], rows: [["S1", "0.2 m"]] }, { title: "Empty", head: ["x"], rows: [] }],
  figures: [{ title: "Sketch", svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', w: 100, h: 50 }, { title: "Bad", svg: "<script>alert(1)</script>" }],
  units: "US customary",
});
assert.equal(report.formula[0], "Δp = f L/D ρv²/2");
assert.equal(report.tables.length, 1, "empty tables dropped");
assert.equal(report.figures.length, 1, "non-svg figures dropped");

let doc = P.EMPTY_PROJECTS;
const a = P.createProject(doc, { name: "Building B", number: "24-118" });
doc = a.doc;
const b = P.createProject(doc, { name: "" });
doc = b.doc;
assert.equal(doc.projects.length, 2);
assert.equal(doc.projects[0].name, "Untitled project");

const item = { kind: "calc", tool: "pressure-drop", toolName: "Pipe pressure drop", title: "CHW main", path: "/tools/calc/pressure-drop?Q=0.01", report };
const r1 = P.addItem(doc, a.id, item);
doc = r1.doc;
doc = P.addItem(doc, a.id, { ...item, title: "Second" }).doc;
const proj = () => doc.projects.find((p) => p.id === a.id);
assert.equal(proj().items.length, 2);
assert.equal(P.headline(proj().items[0]), "Pressure drop: 4.2 psi");

doc = P.moveItem(doc, a.id, r1.id, 1);
assert.equal(proj().items[1].id, r1.id, "moved down");
doc = P.moveItem(doc, a.id, r1.id, 1);
assert.equal(proj().items[1].id, r1.id, "can't move past the end");

doc = P.updateItem(doc, a.id, r1.id, { note: "Basis: ASHRAE", report: { ...report, primary: { label: "Pressure drop", value: "5", unit: "psi" } } });
const updated = proj().items.find((x) => x.id === r1.id);
assert.equal(updated.note, "Basis: ASHRAE");
assert.equal(updated.title, "CHW main", "title kept");
assert.equal(updated.report.primary.value, "5");

doc = P.updateProject(doc, a.id, { client: "ACME", id: "hijack", items: [] });
assert.equal(proj().client, "ACME");
assert.equal(proj().items.length, 2, "update can't replace items");

doc = P.copyItemTo(doc, a.id, r1.id, b.id, true);
assert.equal(proj().items.length, 1, "moved out");
assert.equal(doc.projects.find((p) => p.id === b.id).items.length, 1, "moved in");

// Round trip through a file, and stored junk is cleaned.
const file = P.exportProject(proj());
const imp = P.importProject(doc, file);
assert.notEqual(imp.id, a.id, "imported copy gets a new id");
assert.equal(imp.doc.projects[0].items[0].title, "Second");
assert.throws(() => P.importProject(doc, "nope"));

assert.equal(P.safePath("https://evil.example/tools"), "/tools");
assert.equal(P.safePath("//evil.example"), "/tools");
assert.equal(P.safePath("/tools/frame?m=abc"), "/tools/frame?m=abc");
const cleaned = P.cleanProjects({ projects: [{ id: "x", name: 5, items: [{ path: "javascript:alert(1)", report: { inputs: "no" } }, null] }, { id: "x" }, "junk"] });
assert.equal(cleaned.projects.length, 1, "duplicates and junk dropped");
assert.equal(cleaned.projects[0].items.length, 1);
assert.equal(cleaned.projects[0].items[0].path, "/tools");
assert.deepEqual(cleaned.projects[0].items[0].report.inputs, []);
assert.deepEqual(P.cleanProjects(null), P.EMPTY_PROJECTS);

const dup = P.duplicateProject(doc, a.id);
assert.equal(dup.doc.projects[0].name, "Building B (copy)");
assert.equal(P.deleteProject(dup.doc, dup.id).projects.length, doc.projects.length);

console.log("projects: ok");
