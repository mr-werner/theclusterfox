import { useEffect, useState } from "react";
import { HardDriveDownload, Library as LibraryIcon } from "lucide-react";

import { cachedKeys, forgetText, loadText, setPinned } from "../state/library";
import { SHELVES } from "../state/bookStore";
import { BookTile } from "./Store";

/** Your books, on the shelves you put them on, and which ones are on this device. */
export default function Library({ data, onOpen, onRead, onBrowse }) {
  const [onDevice, setOnDevice] = useState({});
  const [busy, setBusy] = useState(null);
  const refresh = () => cachedKeys().then(setOnDevice);
  useEffect(() => {
    refresh();
  }, []);

  const entries = Object.entries(data.books);
  if (!entries.length) {
    return (
      <section className="bx-page bx-empty-state">
        <LibraryIcon size={40} aria-hidden="true" />
        <h1>Your shelves are empty</h1>
        <p>Open any book, or tap “Want to read”, and it shows up here with your place saved.</p>
        <button type="button" className="bx-btn is-primary" onClick={onBrowse}>
          Browse the store
        </button>
      </section>
    );
  }

  async function keep(key, on) {
    setBusy(key);
    try {
      if (on) {
        await loadText(key);
        await setPinned(key, true);
      } else await forgetText(key);
    } catch {
      // The book's text couldn't download right now; nothing changes.
    }
    setBusy(null);
    refresh();
  }

  const recent = ([, a], [, b]) => (b.opened ?? b.added ?? "").localeCompare(a.opened ?? a.added ?? "");
  return (
    <section className="bx-page">
      <header className="bx-page-head">
        <p className="bx-kicker">My books</p>
        <h1>Your shelves</h1>
        <p>Your place, highlights and notes follow you to every device you sign in on. Books kept on this device open without a connection.</p>
      </header>
      {SHELVES.map(s => {
        const list = entries.filter(([, b]) => b.shelf === s.id).sort(recent);
        if (!list.length) return null;
        return (
          <section key={s.id} className="bx-lib-shelf">
            <h2>
              {s.name} <span>{list.length}</span>
            </h2>
            <div className="bx-grid">
              {list.map(([key, b]) => {
                const local = onDevice[key];
                return (
                  <div key={key} className="bx-lib-item">
                    <BookTile book={b} onOpen={() => (s.id === "want" ? onOpen(b) : onRead(key, b))} progress={b.progress} badge={s.id === "done" ? "Finished" : null} />
                    <button
                      type="button"
                      className={`bx-keep${local ? " is-on" : ""}`}
                      onClick={() => keep(key, !local?.pinned)}
                      disabled={busy === key}
                      title={local?.pinned ? "Kept on this device. Tap to free the space." : local ? "On this device for now. Tap to keep it." : "Download it to read without a connection"}
                    >
                      <HardDriveDownload size={13} aria-hidden="true" />
                      {busy === key ? "Saving…" : local?.pinned ? "On this device" : local ? "Keep offline" : "Save offline"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}
