import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { withNext } from "../lib/redirect";
import { apps } from "../app/apps";
import "../styles/appbar.css";

// The top bar every ClusterFox original wears instead of the site header.
// The app's own name sits on the left, styled by that app. The ClusterFox
// account sits on the right, so every app is plainly signed in to the
// same account and saves its settings there.
export default function AppBar({ appId, children }) {
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

  return (
    <header className="appbar" data-app={appId}>
      <Link to={app?.path || "/"} className="appbar-brand" aria-label={title}>
        {Icon && (
          <span className="appbar-mark" aria-hidden="true">
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
        <span className="appbar-name">{title}</span>
      </Link>

      {children && <div className="appbar-extra">{children}</div>}

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
