import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import AppBar from "../../components/AppBar";
import { SONGS, songById } from "./data/songs";
import { useKeysData } from "./state/useKeysData";
import Library from "./components/Library";
import Player from "./components/Player";
import ImportPanel from "./components/ImportPanel";
import "./keys.css";
import "./identity.css";

export default function KeysPage() {
  const store = useKeysData();
  const { data, imported, setSettings, recordRun, opened, addSong, removeSong } = store;
  const [params, setParams] = useSearchParams();
  const [importing, setImporting] = useState(false);

  const songId = params.get("song");
  const song = useMemo(() => (songId ? songById.get(songId) ?? imported.find(s => s.id === songId) ?? null : null), [songId, imported]);

  // Links from PlanFox can pick the level and hand.
  const linkLevel = params.get("level");
  const linkHands = params.get("hands");
  useEffect(() => {
    const patch = {};
    if (["easy", "medium", "hard"].includes(linkLevel)) patch.level = linkLevel;
    if (["R", "L", "both"].includes(linkHands)) patch.hands = linkHands;
    if (Object.keys(patch).length) setSettings(patch);
  }, [linkLevel, linkHands, setSettings]);

  useEffect(() => {
    if (song) opened(song.id);
  }, [song, opened]);

  const open = useCallback(id => {
    setParams({ song: id });
    window.scrollTo({ top: 0 });
  }, [setParams]);
  const back = useCallback(() => setParams({}), [setParams]);

  const planTitle = song ? `Practice ${song.title} on piano` : "Piano practice";

  return (
    <div className={`ks${song ? " ks--playing" : ""}`}>
      <AppBar appId="keysfox" planTitle={planTitle} />
      {song ? (
        <Player key={song.id} song={song} settings={data.settings} setSettings={setSettings} onRun={recordRun} onBack={back} />
      ) : (
        <div className="ks-wrap">
          {songId && <p className="ks-warn">That song isn't on this device. Songs you import stay on the device you added them on.</p>}
          <Library songs={SONGS} imported={imported} data={data} setSettings={setSettings} onOpen={open} onImport={() => setImporting(true)} onRemove={removeSong} />
        </div>
      )}
      {importing && (
        <ImportPanel
          onAdd={addSong}
          onClose={added => {
            setImporting(false);
            if (added) open(added.id);
          }}
        />
      )}
    </div>
  );
}
