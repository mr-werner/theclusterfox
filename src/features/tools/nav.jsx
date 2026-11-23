// Links for Engineer ToolFox pages that also work inside a discipline app.
//
// Tool pages are written once with "/tools/..." links. A discipline app
// (Fluids & Piping at /fluids, and so on) shows the very same pages under
// its own address, so these wrappers swap the "/tools" at the front of a
// link for the address of whichever app is showing the page. Saved links
// (projects, TaskFox) keep the canonical "/tools" form and open anywhere.

import { rebase } from "./paths.js";
import { ToolsBase, useHomeLabel, useToolsBase } from "./navBase.js";
import { Link as RouterLink, NavLink as RouterNavLink, Navigate as RouterNavigate } from "react-router-dom";

export function ToolsBaseProvider({ base, discipline, children }) {
  return <ToolsBase.Provider value={{ base, discipline }}>{children}</ToolsBase.Provider>;
}

export function Link({ to, ...props }) {
  const { base } = useToolsBase();
  return <RouterLink to={rebase(to, base)} {...props} />;
}

export function NavLink({ to, ...props }) {
  const { base } = useToolsBase();
  return <RouterNavLink to={rebase(to, base)} {...props} />;
}

export function Navigate({ to, ...props }) {
  const { base } = useToolsBase();
  return <RouterNavigate to={rebase(to, base)} {...props} />;
}

/** The app's name as text, for breadcrumbs inside JSX. */
export function HomeLabel() {
  return useHomeLabel();
}
