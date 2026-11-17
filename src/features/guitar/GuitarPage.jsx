import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Activity, Download, Grid3x3, Library as LibraryIcon, Waves } from "lucide-react";

import AppBar from "../../components/AppBar";
import { builtInById } from "./data/songs";
import { useGuitarData } from "./state/useGuitarData";
import Library from "./components/Library";
import Practice from "./components/Practice";
import { ChordsTab, StrumsTab } from "./components/ChordsTab";
import Tuner from "./components/Tuner";
import ImportTab from "./components/ImportTab";
import "./guitar.css";
import "./identity.css";

const TABS = [
  { id: "songs", name: "Songs", icon: LibraryIcon },
  { id: "chords", name: "Chords", icon: Grid3x3 },
  { id: "strums", name: "Strums", icon: Waves },
  { id: "tuner", name: "Tuner", icon: Activity },
  { id: "import", name: "Import", icon: Download },
];

export default function GuitarPage() {
  const store = useGuitarData();
  const { data, setPrefs } = store;
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : "songs";
  const songId = params.get("song");
  const song = songId ? builtInById.get(songId) ?? data.songs.find(s => s.id === songId) ?? null : null;

  const openSong = useCallback(
    (id, part) => {
      const q = { song: id };
      if (part) {
        q.part = part;
        setPrefs({ part });
      }
      setParams(q);
      window.scrollTo({ top: 0 });
    },
    [setParams, setPrefs]
  );
  const pick = useCallback(
    patch => {
      setPrefs(patch);
      setParams({ ...Object.fromEntries(params), ...patch }, { replace: true });
    },
    [params, setParams, setPrefs]
  );

  const planTitle = song ? `Guitar: ${song.title}` : "Guitar practice";

  return (
    <div className="frx">
      <AppBar appId="fretfox" planTitle={planTitle} />
      <div className="frx-wrap">
        {song ? (
          <Practice key={song.id} song={song} store={store} part={params.get("part")} level={params.get("level")} onBack={() => setParams({})} onPick={pick} />
        ) : (
          <>
            <header className="frx-hero">
              <p className="frx-kicker">Learn guitar by playing</p>
              <h1>Watch the notes fall. Play them for real.</h1>
              <p>Falling notes, tab and sheet music side by side, with every finger shown on the neck. Slow it down, loop the hard bit, and let FretFox listen through your mic.</p>
            </header>
            <nav className="frx-tabs" aria-label="FretFox sections">
              {TABS.map(t => (
                <button key={t.id} type="button" className={tab === t.id ? "is-on" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => setParams(t.id === "songs" ? {} : { tab: t.id })}>
                  <t.icon size={16} aria-hidden="true" />
                  <span>{t.name}</span>
                </button>
              ))}
            </nav>
            {tab === "songs" && <Library data={data} onOpen={openSong} />}
            {tab === "chords" && <ChordsTab />}
            {tab === "strums" && <StrumsTab />}
            {tab === "tuner" && <Tuner />}
            {tab === "import" && <ImportTab store={store} onOpen={openSong} />}
            {songId && !song && <p className="frx-error">That song isn't here. It may have been imported on another device.</p>}
          </>
        )}
      </div>
    </div>
  );
}
