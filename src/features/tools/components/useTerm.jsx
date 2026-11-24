import { useId, useState } from "react";
import { TermButton, TermCard } from "./TermInfo";

/** Open/closed state for one field's definition, with ids to tie button and panel together. */
export function useTerm(term) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!term) return { button: null, panel: null, open: false };
  const button = <TermButton term={term} open={open} onToggle={() => setOpen((o) => !o)} controls={panelId} />;
  const panel = open ? <TermCard term={term} id={panelId} /> : null;
  return { button, panel, open };
}
