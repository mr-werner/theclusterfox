import { useEffect, useMemo, useState } from "react";

import { useAccountSync } from "../../../lib/useAccountSync";
import * as P from "../model/projects.js";
import { ProjectsContext } from "./projectsContext.js";

// Saved projects live in this browser and, when signed in, in the account
// (table tools_projects_user_data, see db/migrations/009). One provider at the
// top of Engineer ToolFox shares them with every tool page.

function load() {
  try {
    return P.cleanProjects(JSON.parse(localStorage.getItem(P.PROJECTS_KEY) || "null"));
  } catch {
    return P.EMPTY_PROJECTS;
  }
}

export default function ProjectsProvider({ children }) {
  const [doc, setDoc] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(P.PROJECTS_KEY, JSON.stringify(doc));
    } catch {
      // Storage full or blocked: projects still work until the tab closes.
    }
  }, [doc]);

  const syncStatus = useAccountSync("tools_projects_user_data", doc, (d) => setDoc(P.cleanProjects(d)), P.EMPTY_PROJECTS);

  const api = useMemo(() => {
    // New ids are made from the current doc up front, so callers can navigate to them.
    const create = (fields) => {
      const r = P.createProject(doc, fields);
      setDoc((d) => ({ projects: [r.doc.projects[0], ...d.projects] }));
      return r.id;
    };
    const addItem = (projectId, item) => {
      // Built against a stand-in, so it also works right after create() in the same tick.
      const r = P.addItem({ projects: [{ id: projectId, items: [] }] }, projectId, item);
      const added = r.doc.projects[0].items[0];
      setDoc((d) => ({ projects: d.projects.map((p) => (p.id === projectId ? { ...p, items: [...p.items, added], updatedAt: added.updatedAt } : p)) }));
      return r.id;
    };
    return {
      projects: doc.projects,
      byId: (id) => doc.projects.find((p) => p.id === id) || null,
      create,
      addItem,
      update: (id, patch) => setDoc((d) => P.updateProject(d, id, patch)),
      remove: (id) => setDoc((d) => P.deleteProject(d, id)),
      duplicate: (id) => {
        const r = P.duplicateProject(doc, id);
        if (r.id) setDoc((d) => ({ projects: [r.doc.projects[0], ...d.projects] }));
        return r.id;
      },
      updateItem: (pid, iid, patch) => setDoc((d) => P.updateItem(d, pid, iid, patch)),
      removeItem: (pid, iid) => setDoc((d) => P.removeItem(d, pid, iid)),
      moveItem: (pid, iid, by) => setDoc((d) => P.moveItem(d, pid, iid, by)),
      copyItemTo: (from, iid, to, move) => setDoc((d) => P.copyItemTo(d, from, iid, to, move)),
      importText: (text) => {
        const r = P.importProject(doc, text);
        setDoc((d) => ({ projects: [r.doc.projects[0], ...d.projects] }));
        return r.id;
      },
      syncStatus,
    };
  }, [doc, syncStatus]);

  return <ProjectsContext.Provider value={api}>{children}</ProjectsContext.Provider>;
}
