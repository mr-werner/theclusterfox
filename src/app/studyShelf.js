// The "Add to Study" shelf, shared by every app. Adding a deck writes a
// link to StudyFox's saved data in this browser; StudyFox picks it up the
// next time it opens (or right away, in another tab) and syncs it to the
// account from there.
import { useCallback, useEffect, useState } from "react";

import { addDeck, hasDeck, loadData, removeDeck, saveData, STORAGE_KEY } from "../features/study/state/studyStore.js";

const EVENT = "studyfox:shelf";

export function isOnShelf(app, id) {
  return hasDeck(loadData(), app, id);
}

export function setOnShelf({ app, id, title }, on) {
  const data = loadData();
  const next = on ? addDeck(data, { app, id, title }) : removeDeck(data, app, id);
  if (next === data) return;
  saveData({ ...next, updatedAt: new Date().toISOString() });
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** [onShelf, toggle] for one deck, kept current across tabs. */
export function useShelf(app, id, title) {
  const [on, setOn] = useState(() => isOnShelf(app, id));
  useEffect(() => {
    const refresh = () => setOn(isOnShelf(app, id));
    refresh();
    const onStorage = e => e.key === STORAGE_KEY && refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [app, id]);
  const toggle = useCallback(() => {
    setOnShelf({ app, id, title }, !isOnShelf(app, id));
    setOn(isOnShelf(app, id));
  }, [app, id, title]);
  return [on, toggle];
}

export const SHELF_EVENT = EVENT;
