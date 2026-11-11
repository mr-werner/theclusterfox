import { useContext } from "react";

import { ProjectsContext } from "./projectsContext.js";

/** Saved projects, from any page inside Engineer ToolFox. */
export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside ProjectsProvider");
  return ctx;
}
