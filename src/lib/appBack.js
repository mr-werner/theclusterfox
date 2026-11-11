// The back button the apps wear in their top bar. Apps open in their own
// window or as an installed app, where there is no browser back button,
// so each app carries one.
//
// The trail remembers which address sits at each step of this tab's
// history, so "back" knows whether the step before is still inside the
// same app. When it is, back is the browser's own back. When it isn't
// (a shared link, or the app was opened straight onto a deep page), back
// climbs to the page above instead, so it never drops you out of the app.

import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const KEY = "cf-history-trail";
let memory = {};

function readTrail() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) || {};
  } catch {
    // Storage blocked: the in-memory copy still covers this visit.
  }
  return memory;
}

function writeTrail(trail) {
  memory = trail;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    // Storage blocked or full: keep the in-memory copy.
  }
}

/** Where this page sits in the tab's history (React Router keeps the count). */
export function historyIndex() {
  const idx = typeof window !== "undefined" ? window.history.state?.idx : undefined;
  return Number.isInteger(idx) ? idx : null;
}

/** Record every page the site shows. Call once, near the top of the app. */
export function useHistoryTrail() {
  const location = useLocation();
  const navType = useNavigationType();
  // Opening a new page starts at its top, so its back button is in view.
  // Going back leaves the scroll to the browser, which puts you where you were.
  useEffect(() => {
    if (navType === "PUSH") window.scrollTo(0, 0);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const idx = historyIndex();
    if (idx === null) return;
    const trail = { ...readTrail() };
    // A new page forgets the forward steps it replaced.
    for (const k of Object.keys(trail)) if (Number(k) > idx) delete trail[k];
    trail[idx] = location.pathname + location.search;
    writeTrail(trail);
  }, [location.key, location.pathname, location.search]);
}

/** The address one step back in this tab, if the trail knows it. */
export function previousAddress() {
  const idx = historyIndex();
  if (idx === null || idx < 1) return null;
  return readTrail()[idx - 1] ?? null;
}

/** True when an address (path with or without a query) is inside an app. */
export function isInside(address, appPath) {
  if (!address || !appPath) return false;
  const path = address.split(/[?#]/)[0];
  return path === appPath || path.startsWith(`${appPath}/`);
}

/**
 * The page above this one when there is no step back to take. An app
 * whose pages are folders (/tools/calc/x) passes its own rule; the rest
 * keep their screens in the query, so a detail opened from a tab returns
 * to that tab and anything else returns to the app's start.
 */
export function defaultParent(appPath, location) {
  const params = new URLSearchParams(location.search);
  const tab = params.get("tab");
  const others = [...params.keys()].some((k) => k !== "tab");
  if (location.pathname !== appPath) return appPath;
  if (tab && others) return `${appPath}?${new URLSearchParams({ tab })}`;
  return appPath;
}

/** The app's start screen: its own path with nothing in the query. */
export function isAppStart(appPath, location) {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  return path === appPath && !location.search.replace(/^\?/, "");
}
