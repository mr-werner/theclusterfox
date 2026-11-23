import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, LayoutGrid, MessageSquare, Minus, Plus, Search, UserRound } from "lucide-react";

import { useAuth } from "../../../context/AuthContext";
import FreeAppIcon from "../../free/FreeAppIcon";
import { isOriginalKey, keyId } from "../state/homeStore";
import { useTileGestures } from "../useTileGestures";
import { groupOriginals, sectionOf } from "../categories";
import AppLink from "./AppLink";
import FeaturedPlan from "./FeaturedPlan";
import OriginalIcon from "./OriginalIcon";
import SyncNote from "./SyncNote";

// Scrolls to a category without putting #cat-… in the address.
const jumpTo = id => event => {
  event.preventDefault();
  document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

function PhoneTile({ label, editing, dragging, onRemove, gestureProps, feature = false, children }) {
  return (
    <div
      className={`phone-tile ${feature ? "phone-tile--feature" : ""} ${editing ? "is-editing" : ""} ${dragging ? "is-dragging" : ""}`}
      {...gestureProps}
    >
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
  const sameSection = useCallback(
    (a, b) => sectionOf(a, originalsById) === sectionOf(b, originalsById),
    [originalsById]
  );
  const enterEdit = useCallback(() => setEditing(true), []);
  const { tileProps, draggingKey } = useTileGestures({
    editing,
    onEnterEdit: enterEdit,
    onMove: home.move,
    canSwap: sameSection,
  });

  const originalKeys = home.keys.filter(key => isOriginalKey(key) && originalsById.has(keyId(key)));
  const altKeys = home.keys.filter(key => !isOriginalKey(key) && (!alts || alts.byName.has(keyId(key))));
  const { hub, sections } = groupOriginals(originalKeys, originalsById);
  const hubApp = hub ? originalsById.get(keyId(hub)) : null;
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

      {hubApp && (
        <section className="phone-section" aria-label="PlanFox, your hub">
          <div className="phone-grid phone-original-grid">
            <PhoneTile
              label={hubApp.fullName ?? hubApp.subtitle}
              editing={editing}
              dragging={draggingKey === hub}
              onRemove={() => home.remove(hub)}
              gestureProps={tileProps(hub)}
              feature
            >
              <FeaturedPlan app={hubApp} phone />
            </PhoneTile>
          </div>
        </section>
      )}

      {sections.length > 1 && (
        <nav className="phone-category-chips" aria-label="App categories">
          {sections.map(section => (
            <a key={section.id} href={`#cat-${section.id}`} onClick={jumpTo(section.id)}>
              {section.name}
            </a>
          ))}
        </nav>
      )}

      {sections.map(section => (
        <section key={section.id} id={`cat-${section.id}`} className="phone-section" aria-label={section.name}>
          <h2 className="phone-section-label">{section.name}</h2>
          <div className="phone-grid">
            {section.keys.map(key => {
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
      ))}

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
      <nav className="phone-footer-links" aria-label="About the site">
        <Link to="/feedback?from=%2F">
          <MessageSquare size={14} aria-hidden="true" /> Send feedback
        </Link>
        <Link to="/donate">
          <Heart size={14} aria-hidden="true" /> Donate
        </Link>
      </nav>
    </main>
  );
}
