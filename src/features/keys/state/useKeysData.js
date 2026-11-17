import { useCallback, useEffect, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { addRun, emptyData, loadData, normalizeData, normalizeSettings, saveData, STORAGE_KEY, touchRecent } from "./keysStore";
import { loadImported, saveImported } from "./importedSongs";

export function useKeysData() {
  const [data, setData] = useState(loadData);
  const [imported, setImported] = useState(loadImported);

  useEffect(() => saveData(data), [data]);

  // Keep two open tabs in step.
  useEffect(() => {
    const onStorage = e => {
      if (e.key === STORAGE_KEY && e.newValue !== null) {
        try {
          setData(normalizeData(JSON.parse(e.newValue)));
        } catch {
          /* ignore */
        }
      }
      if (e.key === "keysfox-songs-v1") setImported(loadImported());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const stamp = d => ({ ...d, updatedAt: new Date().toISOString() });
  const setSettings = useCallback(patch => setData(d => stamp({ ...d, settings: normalizeSettings({ ...d.settings, ...patch }) })), []);
  const recordRun = useCallback(run => setData(d => stamp(addRun(d, run))), []);
  const opened = useCallback(id => setData(d => (d.recent[0] === id ? d : stamp(touchRecent(d, id)))), []);

  const addSong = useCallback(
    song => {
      const next = [song, ...imported.filter(s => s.id !== song.id)];
      if (!saveImported(next)) return false;
      setImported(next);
      return true;
    },
    [imported]
  );
  const removeSong = useCallback(id => {
    setImported(list => {
      const next = list.filter(s => s.id !== id);
      saveImported(next);
      return next;
    });
  }, []);

  const syncStatus = useAccountSync("keys_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, imported, syncStatus, setSettings, recordRun, opened, addSong, removeSong };
}
