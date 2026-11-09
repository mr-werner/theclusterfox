import { Link } from "react-router-dom";

import { isModifiedClick, openAppWindow, opensInOwnWindow } from "../lib/launchApp";

export default function AppTile({ app }) {
  const Icon = app.icon;

  function launch(event) {
    if (isModifiedClick(event) || !opensInOwnWindow()) return;
    if (openAppWindow(app)) event.preventDefault();
  }

  return (
    <Link
      to={app.path}
      className="app-tile"
      aria-label={`Open ${app.name} — ${app.subtitle}`}
      onClick={launch}
      viewTransition
    >
      <div className={`app-icon app-icon--${app.accent}`}>
        <Icon size={42} strokeWidth={1.8} />
        <span>{app.name}</span>
      </div>

      <div className="app-info">
        <h3>{app.subtitle}</h3>
        <p>{app.description}</p>
      </div>
    </Link>
  );
}
