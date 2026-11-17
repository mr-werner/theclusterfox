// The context and hooks behind nav.jsx: which app is showing the ToolFox
// pages ("/tools", or a discipline app like "/fluids").

import { createContext, useCallback, useContext } from "react";
import { useNavigate as useRouterNavigate } from "react-router-dom";
import { rebase } from "./paths.js";

export const ToolsBase = createContext({ base: "/tools", discipline: null });

/** { base: "/tools" | "/fluids" | ..., discipline: the discipline or null }. */
export const useToolsBase = () => useContext(ToolsBase);

/** react-router's navigate, with "/tools/..." swapped for this app's address. */
export function useNavigate() {
  const navigate = useRouterNavigate();
  const { base } = useToolsBase();
  return useCallback((to, opts) => (typeof to === "number" ? navigate(to) : navigate(rebase(to, base), opts)), [navigate, base]);
}

/** The app's own name for breadcrumbs: "Engineer ToolFox" or the discipline's. */
export function useHomeLabel() {
  const { discipline } = useToolsBase();
  return discipline ? discipline.name : "Engineer ToolFox";
}
