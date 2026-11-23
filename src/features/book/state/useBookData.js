import { useCallback, useEffect, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { deleteMark, emptyData, loadData, logReading, normalizeData, openBook, putMark, removeBook, saveData, savePlace, shelveBook, STORAGE_KEY } from "./bookStore";

export function useBookData() {
  const [data, setData] = useState(loadData);

  useEffect(() => saveData(data), [data]);

  // Keep two open tabs in step.
  useEffect(() => {
    const onStorage = e => {
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      try {
        setData(normalizeData(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const stamp = d => ({ ...d, updatedAt: new Date().toISOString() });
  const change = useCallback(fn => setData(d => {
    const next = fn(d);
    return next === d ? d : stamp(next);
  }), []);

  const actions = {
    shelve: useCallback((book, shelf) => change(d => shelveBook(d, book, shelf)), [change]),
    remove: useCallback(key => change(d => removeBook(d, key)), [change]),
    open: useCallback(book => change(d => openBook(d, book)), [change]),
    place: useCallback((key, b, progress) => change(d => savePlace(d, key, b, progress)), [change]),
    mark: useCallback(mark => change(d => putMark(d, mark)), [change]),
    unmark: useCallback(id => change(d => deleteMark(d, id)), [change]),
    log: useCallback(entry => change(d => logReading(d, entry)), [change]),
    prefs: useCallback(p => change(d => ({ ...d, prefs: normalizeData({ ...d, prefs: { ...d.prefs, ...p } }).prefs })), [change]),
    goal: useCallback(goal => change(d => ({ ...d, goal })), [change]),
  };

  const syncStatus = useAccountSync("book_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, syncStatus, ...actions };
}
