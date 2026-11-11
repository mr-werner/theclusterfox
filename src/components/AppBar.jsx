import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CalendarPlus, ChevronLeft } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { withNext } from "../lib/redirect";
import { apps } from "../app/apps";
import { planAddHref } from "../app/planLinks";
import { openInApp } from "../lib/launchApp";
import { defaultParent, isAppStart, isInside, previousAddress } from "../lib/appBack";
import themes from "../app/appThemes.json";
import "../styles/appbar.css";

// The top bar every ClusterFox original wears instead of the site header.
// The app's own name sits on the left, styled by that app. The ClusterFox
// account sits on the right, so every app is plainly signed in to the
// same account and saves its settings there.
//
// Once you are past an app's start screen a back button sits at the far
// left, because apps open in their own window where the browser's back
// button isn't there. An app whose pages are folders passes `backTo`,
// the page above a given location, for when there is no step back to take.
export default function AppBar({ appId, children, planTitle, planHref, backTo }) {
  const app = apps.find((a) => a.id === appId);
  const Icon = app?.icon;
  const title = app?.fullName || app?.subtitle;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useAppIdentity(app, title);

  const here = location.pathname + location.search;
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  async function handleLogout() {
    setOpen(false);
    try {
      await logout();
    } catch {
      // The account menu stays usable; the header shows the signed-out state.
    }
  }

  function goHome(event) {
    // Opened as its own window from the hub: bring the hub back instead of
    // loading a second copy of it here.
    const hub = window.opener;
    if (hub && !hub.closed) {
      try {
        if (hub.location.origin === window.location.origin) {
          event.preventDefault();
          hub.focus();
          return;
        }
      } catch {
        // Cross-origin opener: fall through to a normal link.
      }
    }
    setOpen(false);
    event.preventDefault();
    navigate("/");
  }

  const appPath = app?.path || "/";
  const showBack = Boolean(app) && !isAppStart(appPath, location);

  function goBack() {
    setOpen(false);
    if (isInside(previousAddress(), appPath)) {
      navigate(-1);
      return;
    }
    // Nothing of this app behind us: climb to the page above instead of
    // leaving the app, and take this page's place so the trail stays tidy.
    const parent = (backTo && backTo(location)) || defaultParent(appPath, location);
    navigate(parent, { replace: true });
  }

  return (
    <header className={`appbar${showBack ? " has-back" : ""}`} data-app={appId}>
      {showBack && (
        <button type="button" className="appbar-back" onClick={goBack} aria-label="Back" title="Back">
          <ChevronLeft size={20} strokeWidth={2.25} aria-hidden="true" />
          <span>Back</span>
        </button>
      )}
      <Link to={app?.path || "/"} className="appbar-brand" aria-label={title}>
        {Icon && (
          <span className="appbar-mark" aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
        <span className="appbar-name">{title}</span>
      </Link>

      {children && <div className="appbar-extra">{children}</div>}

      {appId !== "planfox" && (
        // Put whatever is open here on your PlanFox calendar, ready to start.
        <button
          type="button"
          className="appbar-plan"
          onClick={() => openInApp("planfox", planAddHref({ app: appId, href: planHref ?? here, title: planTitle }), navigate)}
          title="Add this to your PlanFox calendar"
        >
          <CalendarPlus size={16} aria-hidden="true" />
          <span>Plan this</span>
        </button>
      )}

      <div className="appbar-account" ref={menuRef}>
        {loading ? null : isAuthenticated ? (
          <>
            <button
              type="button"
              className="appbar-chip"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              title="Your ClusterFox account"
            >
              <img src="/clusterfox-logo.png" alt="" className="appbar-fox" />
              <span className="appbar-avatar" aria-hidden="true">{initial}</span>
              <span className="appbar-user">{user?.name || "Account"}</span>
            </button>
            {open && (
              <div className="appbar-menu" role="menu">
                <div className="appbar-menu-who">
                  <small>Signed in to The ClusterFox</small>
                  <strong>{user?.name || "Account"}</strong>
                  <span>{user?.email}</span>
                </div>
                <p className="appbar-menu-note">
                  {title} saves your settings to this account.
                </p>
                <Link to="/account" className="appbar-menu-item" role="menuitem" onClick={() => setOpen(false)}>
                  ClusterFox account
                </Link>
                <a href="/" className="appbar-menu-item" role="menuitem" onClick={goHome}>
                  Back to The ClusterFox
                </a>
                <button type="button" className="appbar-menu-item appbar-menu-out" role="menuitem" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            )}
          </>
        ) : (
          <Link to={withNext("/login", here)} className="appbar-signin">
            <img src="/clusterfox-logo.png" alt="" className="appbar-fox" />
            <span>Sign in</span>
          </Link>
        )}
      </div>
    </header>
  );
}

// While an app is open, the browser treats it as that app: its own title,
// theme color and Add to Home Screen details (name, icon, start page).
function useAppIdentity(app, title) {
  useEffect(() => {
    if (!app) return undefined;
    const head = document.head;
    const changed = [];
    const set = (selector, create, attr, value) => {
      let el = head.querySelector(selector);
      if (!el) {
        el = create();
        head.appendChild(el);
        changed.push(() => el.remove());
      } else {
        const before = el.getAttribute(attr);
        changed.push(() => (before === null ? el.removeAttribute(attr) : el.setAttribute(attr, before)));
      }
      el.setAttribute(attr, value);
    };
    const meta = name => () => Object.assign(document.createElement("meta"), { name });
    const link = rel => () => Object.assign(document.createElement("link"), { rel });

    set('link[rel="manifest"]', link("manifest"), "href", `/apps/${app.id}.webmanifest`);
    set('link[rel="apple-touch-icon"]', link("apple-touch-icon"), "href", `/apps/${app.id}-180.png`);
    set('meta[name="theme-color"]', meta("theme-color"), "content", themes[app.id] ?? "#111111");
    set('meta[name="apple-mobile-web-app-title"]', meta("apple-mobile-web-app-title"), "content", title);
    set('meta[name="apple-mobile-web-app-capable"]', meta("apple-mobile-web-app-capable"), "content", "yes");
    set('meta[name="mobile-web-app-capable"]', meta("mobile-web-app-capable"), "content", "yes");
    return () => changed.reverse().forEach(undo => undo());
  }, [app, title]);
}
