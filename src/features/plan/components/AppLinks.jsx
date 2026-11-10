import { useEffect, useState } from "react";
import { Check, ExternalLink, Play } from "lucide-react";

import { apps } from "../../../app/apps";
import { PLAN_LINKS } from "../../../app/planLinks";
import { appById, appName } from "../model/appInfo";
import { formatTime } from "../model/dates";
import { loadLaunchTargets } from "../state/useAppLinks";

// Apps a planner item can open: everything except PlanFox itself.
const LINKABLE = apps.filter(a => a.id !== "planfox");

/** The app's own small mark, in its own color. */
export function AppMark({ appId, size = 15 }) {
  const app = appById(appId);
  const Icon = app?.icon ?? ExternalLink;
  return (
    <span className="pf-app-mark" data-app={appId} aria-hidden="true">
      <Icon size={size} />
    </span>
  );
}

/** "Start", "Open": one tap into the app, right where you need to be. */
export function LaunchButton({ link, onLaunch, label, compact = false }) {
  const name = appName(link.app);
  return (
    <button type="button" className={`pf-launch${compact ? " is-compact" : ""}`} data-app={link.app} onClick={() => onLaunch(link)} aria-label={`${label ?? "Open"} in ${name}`} title={`Open in ${name}`}>
      <Play size={13} aria-hidden="true" />
      {!compact && <span>{label ?? "Open"}</span>}
    </button>
  );
}

/** One thing from another app on a day: its mark, what it is, and a way in. */
export function AppEntry({ entry, onLaunch, showTime = true }) {
  const link = entry.launch;
  return (
    <li className={`pf-entry pf-app-entry pf-l-apps${entry.done ? " is-done" : ""}`}>
      <AppMark appId={link.app} />
      <button type="button" className="pf-entry-main" onClick={() => onLaunch(link)}>
        <span className="pf-entry-title">
          {entry.done && <Check size={13} className="pf-app-done" aria-label="Done" />}
          {entry.title}
        </span>
        <span className="pf-entry-meta">
          {appName(link.app)}
          {showTime && entry.time && ` · ${formatTime(entry.time)}`}
          {entry.detail && ` · ${entry.detail}`}
        </span>
      </button>
      {!entry.done && <LaunchButton link={link} onLaunch={onLaunch} label={entry.cta ?? "Open"} />}
    </li>
  );
}

/** "Opens in": pick an app and, if it offers them, the exact thing to open. */
export function AppLinkField({ value, onChange }) {
  const appId = value?.app ?? "";
  const [targets, setTargets] = useState({ app: null, list: [] });
  useEffect(() => {
    if (!appId) return undefined;
    let live = true;
    loadLaunchTargets(appId).then(list => live && setTargets({ app: appId, list }));
    return () => {
      live = false;
    };
  }, [appId]);
  const list = targets.app === appId ? targets.list : [];
  const app = appById(appId);
  const pickApp = id => {
    const next = appById(id);
    onChange(next ? { app: next.id, href: next.path, label: "" } : null);
  };
  const pickTarget = href => {
    const target = list.find(t => t.href === href);
    onChange({ app: appId, href: target?.href ?? app.path, label: target?.title ?? "" });
  };
  const known = list.some(t => t.href === value?.href);

  return (
    <div className="pf-field pf-app-link">
      <span id="pf-app-link-label">Opens in an app (optional)</span>
      <div className="pf-field-row">
        <select value={appId} onChange={e => pickApp(e.target.value)} aria-labelledby="pf-app-link-label">
          <option value="">Nothing, just a reminder</option>
          {LINKABLE.map(a => (
            <option key={a.id} value={a.id}>
              {a.fullName ?? a.subtitle}
            </option>
          ))}
        </select>
        {appId && list.length > 0 && (
          <select value={known ? value.href : ""} onChange={e => pickTarget(e.target.value)} aria-label={`What to open in ${appName(appId)}`}>
            {!known && <option value="">{value?.label || `Open ${appName(appId)}`}</option>}
            {list.map(t => (
              <option key={t.id} value={t.href}>
                {t.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {appId && <p className="pf-muted pf-app-link-hint">A Start button on the day opens {value?.label ? `“${value.label}”` : appName(appId)} for you.</p>}
    </div>
  );
}

/** In settings: which apps feed the calendar. */
export function AppLinksSettings({ hiddenApps, onChange }) {
  const linked = PLAN_LINKS.map(l => appById(l.app)).filter(Boolean);
  const toggle = id => onChange(hiddenApps.includes(id) ? hiddenApps.filter(a => a !== id) : [...hiddenApps, id]);
  return (
    <div className="pf-app-settings">
      <p className="pf-muted">Workouts, plans and sessions from these apps show on their days, with a Start button that opens the app right there.</p>
      <ul className="pf-app-toggles">
        {linked.map(app => (
          <li key={app.id}>
            <label className="pf-check">
              <input type="checkbox" checked={!hiddenApps.includes(app.id)} onChange={() => toggle(app.id)} />
              <AppMark appId={app.id} size={13} /> {app.fullName ?? app.subtitle}
              <span className="pf-muted"> · {app.description}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
