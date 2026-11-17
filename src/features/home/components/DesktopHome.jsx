import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, Minus, Pencil, Plus, RotateCcw } from "lucide-react";

import SiteHeader from "../../../components/SiteHeader";
import SiteFooter from "../../../components/SiteFooter";
import FreeAppIcon from "../../free/FreeAppIcon";
import { isOriginalKey, keyId } from "../state/homeStore";
import { useTileGestures } from "../useTileGestures";
import { groupOriginals, sectionOf } from "../categories";
import AppLink from "./AppLink";
import FeaturedPlan from "./FeaturedPlan";
import OriginalIcon from "./OriginalIcon";
import SyncNote from "./SyncNote";
import HomeSearch from "./HomeSearch";

function RemoveBadge({ label, onRemove }) {
  return (
    <button
      type="button"
      className="home-remove"
      data-tile-action
      onClick={onRemove}
      aria-label={`Remove ${label} from your home screen`}
    >
      <Minus size={16} strokeWidth={3} />
    </button>
  );
}

// Scrolls to a category without putting #cat-… in the address.
const jumpTo = id => event => {
  event.preventDefault();
  document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function DesktopHome({ home, alts, originalsById, onWantAlts, onAdd }) {
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
  const missingOriginals = originalsById.size - originalKeys.length;
  const { hub, sections } = groupOriginals(originalKeys, originalsById);
  const hubApp = hub ? originalsById.get(keyId(hub)) : null;

  const tileClass = key =>
    `home-tile ${editing ? "is-editing" : ""} ${draggingKey === key ? "is-dragging" : ""}`;

  return (
    <main className="home-page home-desktop">
      <SiteHeader />

      <section className="hero">
        <div className="fox-mark">
          <img src="/clusterfox-logo.png" alt="The Cluster Fox" />
        </div>
        <p className="eyebrow">WELCOME TO</p>
        <h1>
          THE CLUSTER <span>FOX</span>
        </h1>
        <p className="tagline">A cluster of useful & not so useful things.</p>
        <p className="hero-description">
          Tools, experiments, and ideas built to make everyday things a little more useful.
        </p>
      </section>

      <HomeSearch home={home} alts={alts} onWantAlts={onWantAlts} />

      <div className={`home-toolbar ${editing ? "is-editing" : ""}`}>
        {editing ? (
          <>
            <span className="home-toolbar-hint">Drag to rearrange. Use − to remove an app.</span>
            <div className="home-toolbar-actions">
              {home.isCustomized && (
                <button type="button" className="home-button home-button--ghost" onClick={home.reset}>
                  <RotateCcw size={15} aria-hidden="true" /> Reset
                </button>
              )}
              <button type="button" className="home-button" onClick={onAdd}>
                <Plus size={15} aria-hidden="true" /> Add apps
              </button>
              <button type="button" className="home-button home-button--primary" onClick={() => setEditing(false)}>
                <Check size={15} aria-hidden="true" /> Done
              </button>
            </div>
          </>
        ) : (
          <>
            <SyncNote status={home.syncStatus} />
            <div className="home-toolbar-actions">
              <button type="button" className="home-button" onClick={() => setEditing(true)}>
                <Pencil size={15} aria-hidden="true" /> Edit home screen
              </button>
            </div>
          </>
        )}
      </div>

      <section className="apps-section home-originals">
        <div className="section-heading">
          <div>
            <p className="section-label">CLUSTERFOX ORIGINALS</p>
            <h2>Recommended for you</h2>
          </div>
          <span className="app-count">
            {originalKeys.length} {originalKeys.length === 1 ? "app" : "apps"}
          </span>
        </div>

        <div className="home-hub-row">
          {hubApp && (
            <div className={`${tileClass(hub)} home-tile--feature`} {...tileProps(hub)}>
              <FeaturedPlan app={hubApp} />
              {editing && <RemoveBadge label={hubApp.subtitle} onRemove={() => home.remove(hub)} />}
            </div>
          )}

          <nav className="home-categories" aria-label="App categories">
            <p className="home-categories-title">Browse by category</p>
            {sections.map(section => (
              <a key={section.id} href={`#cat-${section.id}`} className="home-category-link" onClick={jumpTo(section.id)}>
                <span className="home-category-icons" aria-hidden="true">
                  {section.keys.slice(0, 3).map(key => {
                    const app = originalsById.get(keyId(key));
                    const Icon = app.icon;
                    return (
                      <span key={key} className={`home-category-dot app-icon--${app.accent}`}>
                        <Icon size={14} strokeWidth={2.2} />
                      </span>
                    );
                  })}
                </span>
                <span className="home-category-text">
                  <strong>{section.name}</strong>
                  <small>{section.blurb || `${section.keys.length} apps`}</small>
                </span>
                <span className="home-category-count">{section.keys.length}</span>
              </a>
            ))}
            {missingOriginals > 0 && (
              <button type="button" className="home-category-link home-category-link--hidden" onClick={onAdd}>
                <Plus size={16} aria-hidden="true" />
                <span className="home-category-text">
                  <strong>
                    {missingOriginals} hidden {missingOriginals === 1 ? "app" : "apps"}
                  </strong>
                  <small>Put them back on your home screen</small>
                </span>
              </button>
            )}
          </nav>
        </div>

        {sections.map(section => (
          <div key={section.id} id={`cat-${section.id}`} className="home-category">
            <div className="home-category-head">
              <h3>{section.name}</h3>
              {section.blurb && <p>{section.blurb}</p>}
            </div>
            <div className="app-grid">
              {section.keys.map(key => {
                const app = originalsById.get(keyId(key));
                return (
                  <div key={key} className={tileClass(key)} {...tileProps(key)}>
                    <AppLink app={app} className="app-tile" draggable={false} aria-label={`Open ${app.fullName ?? app.subtitle}`}>
                      <OriginalIcon app={app} />
                      <div className="app-info">
                        <h3>{app.fullName ?? app.subtitle}</h3>
                        <p>{app.description}</p>
                      </div>
                    </AppLink>
                    {editing && <RemoveBadge label={app.subtitle} onRemove={() => home.remove(key)} />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="apps-section home-alts">
        <div className="section-heading">
          <div>
            <p className="section-label">YOUR PICKS</p>
            <h2>3rd Party Alternatives</h2>
          </div>
          <Link to="/alternatives" className="home-heading-link">
            Browse all <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>

        {altKeys.length === 0 ? (
          <button type="button" className="home-alts-empty" onClick={onAdd}>
            <Plus size={22} aria-hidden="true" />
            <span>
              <strong>Pin your favorite free alternatives here</strong>
              <small>
                Search above or tap to browse free and open-source apps that replace the paid ones.
              </small>
            </span>
          </button>
        ) : (
          <div className="alt-grid">
            {altKeys.map(key => {
              const app = alts?.byName.get(keyId(key));
              return (
                <div key={key} className={tileClass(key)} {...tileProps(key)}>
                  {app ? (
                    <a href={app.url} target="_blank" rel="noopener noreferrer" className="alt-tile" draggable={false}>
                      <FreeAppIcon app={app} />
                      <span className="alt-tile-text">
                        <strong>
                          {app.name} <ExternalLink size={12} aria-hidden="true" />
                        </strong>
                        <small>Instead of {app.alt}</small>
                      </span>
                    </a>
                  ) : (
                    <span className="alt-tile alt-tile--loading" aria-hidden="true" />
                  )}
                  {editing && <RemoveBadge label={keyId(key)} onRemove={() => home.remove(key)} />}
                </div>
              );
            })}
            <button type="button" className="home-add-tile home-add-tile--small" onClick={onAdd}>
              <Plus size={20} aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
