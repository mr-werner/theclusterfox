import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, Minus, Plus, Search, UserRound } from "lucide-react";

import { useAuth } from "../../../context/AuthContext";
import FreeAppIcon from "../../free/FreeAppIcon";
import { isOriginalKey, keyId } from "../state/homeStore";
import { useTileGestures } from "../useTileGestures";
import AppLink from "./AppLink";
import OriginalIcon from "./OriginalIcon";
import SyncNote from "./SyncNote";

const sameSection = (a, b) => isOriginalKey(a) === isOriginalKey(b);

function PhoneTile({ label, editing, dragging, onRemove, gestureProps, children }) {
  return (
    <div className={`phone-tile ${editing ? "is-editing" : ""} ${dragging ? "is-dragging" : ""}`} {...gestureProps}>
      {children}
      {editing && (
        <button
          type="button"
          className="home-remove"
          data-tile-action
          onClick={onRemove}
          aria-label={`Remove ${label} from your home screen`}
        >
          <Minus size={14} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

/**
 * The phone home screen: an icon grid like a phone's own. Press and hold an
 * icon (or tap Edit) to remove or rearrange; the + tile and the search pill
 * open the Add sheet, which is where alternatives are found on a phone.
 */
export default function PhoneHome({ home, alts, originalsById, onAdd, onSearch }) {
  const { user, isAuthenticated, loading } = useAuth();
  const [editing, setEditing] = useState(false);
  const enterEdit = useCallback(() => setEditing(true), []);
  const { tileProps, draggingKey } = useTileGestures({
    editing,
    onEnterEdit: enterEdit,
    onMove: home.move,
    canSwap: sameSection,
  });

  const originalKeys = home.keys.filter(key => isOriginalKey(key) && originalsById.has(keyId(key)));
  const altKeys = home.keys.filter(key => !isOriginalKey(key) && (!alts || alts.byName.has(keyId(key))));
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <main className={`phone-home ${editing ? "is-editing" : ""}`}>
      <header className="phone-topbar">
        <Link to="/" className="phone-brand" aria-label="The Cluster Fox">
          <img src="/clusterfox-logo.png" alt="" />
          <span>
            CLUSTER<strong>FOX</strong>
          </span>
        </Link>

        <div className="phone-topbar-actions">
          {editing ? (
            <button type="button" className="phone-pill-button phone-pill-button--done" onClick={() => setEditing(false)}>
              Done
            </button>
          ) : (
            <button type="button" className="phone-pill-button" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {!loading &&
            (isAuthenticated ? (
              <Link to="/account" className="phone-avatar" aria-label="Your account">
                {initial}
              </Link>
            ) : (
              <Link to="/login" className="phone-avatar phone-avatar--guest" aria-label="Log in">
                <UserRound size={18} />
              </Link>
            ))}
        </div>
      </header>

      <button type="button" className="phone-search-pill" onClick={onSearch}>
        <Search size={17} aria-hidden="true" />
        <span>Search apps & alternatives</span>
      </button>

      <section className="phone-section" aria-label="ClusterFox Originals">
        <h2 className="phone-section-label">ClusterFox Originals</h2>
        <div className="phone-grid">
          {originalKeys.map(key => {
            const app = originalsById.get(keyId(key));
            const label = app.fullName ?? app.subtitle;
            return (
              <PhoneTile
                key={key}
                label={label}
                editing={editing}
                dragging={draggingKey === key}
                onRemove={() => home.remove(key)}
                gestureProps={tileProps(key)}
              >
                <AppLink app={app} className="phone-tile-link" draggable={false} aria-label={`Open ${label}`}>
                  <OriginalIcon app={app} compact />
                  <span className="phone-tile-label">{app.subtitle.length > 10 ? app.name : app.subtitle}</span>
                </AppLink>
              </PhoneTile>
            );
          })}
        </div>
      </section>

      <section className="phone-section" aria-label="3rd Party Alternatives">
        <h2 className="phone-section-label">3rd Party Alternatives</h2>
        <div className="phone-grid">
          {altKeys.map(key => {
            const app = alts?.byName.get(keyId(key));
            return (
              <PhoneTile
                key={key}
                label={keyId(key)}
                editing={editing}
                dragging={draggingKey === key}
                onRemove={() => home.remove(key)}
                gestureProps={tileProps(key)}
              >
                {app ? (
                  <a href={app.url} target="_blank" rel="noopener noreferrer" className="phone-tile-link" draggable={false}>
                    <FreeAppIcon app={app} />
                    <span className="phone-tile-label">{app.name}</span>
                  </a>
                ) : (
                  <span className="phone-tile-link" aria-hidden="true">
                    <span className="free-app-icon phone-icon-placeholder" />
                    <span className="phone-tile-label">{keyId(key)}</span>
                  </span>
                )}
              </PhoneTile>
            );
          })}

          <div className="phone-tile">
            <button type="button" className="phone-tile-link" onClick={onAdd}>
              <span className="phone-add-icon" aria-hidden="true">
                <Plus size={28} />
              </span>
              <span className="phone-tile-label">Add</span>
            </button>
          </div>
        </div>
        {altKeys.length === 0 && (
          <p className="phone-hint">Tap Add to pin free alternatives to paid apps, right next to your ClusterFox apps.</p>
        )}
      </section>

      <footer className="phone-footer">
        <SyncNote status={home.syncStatus} compact />
        <Link to="/alternatives" className="phone-directory-link">
          <LayoutGrid size={14} aria-hidden="true" /> All alternatives
        </Link>
      </footer>
    </main>
  );
}
