import { useEffect, useMemo, useState } from "react";

import { isSitePath, PLAN_LINKS } from "../../../app/planLinks.js";

function readRaw(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Loads every app's planLink module once. Map of app id → module. */
export function useLinkModules() {
  const [modules, setModules] = useState(() => new Map());
  useEffect(() => {
    let live = true;
    Promise.allSettled(PLAN_LINKS.map(link => link.load().then(mod => [link.app, mod]))).then(results => {
      if (live) setModules(new Map(results.filter(r => r.status === "fulfilled").map(r => r.value)));
    });
    return () => {
      live = false;
    };
  }, []);
  return modules;
}

/**
 * A number that goes up whenever another app may have changed its data:
 * a save in another tab or window, or coming back to this one.
 */
function useFreshness() {
  const [stamp, setStamp] = useState(0);
  useEffect(() => {
    const bump = () => setStamp(n => n + 1);
    const onVisible = () => document.visibilityState === "visible" && bump();
    window.addEventListener("storage", bump);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return stamp;
}

/** Turns one app's answer into calendar-ready items, dropping anything malformed. */
export function cleanAppItems(app, list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(i => i && typeof i.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.day) && isSitePath(i.href))
    .map(i => ({
      id: `${app}:${i.id}`,
      app,
      day: i.day,
      time: typeof i.time === "string" && /^\d{2}:\d{2}$/.test(i.time) ? i.time : null,
      title: i.title.slice(0, 120),
      detail: typeof i.detail === "string" ? i.detail.slice(0, 160) : "",
      href: i.href,
      done: i.done === true,
      action: typeof i.action === "string" && i.action.trim() ? i.action.trim().slice(0, 14) : "Open",
    }));
}

/** What every linked app has on the days from..to. */
export function useAppItems({ enabled, hiddenApps, from, to }) {
  const modules = useLinkModules();
  const stamp = useFreshness();
  return useMemo(() => {
    if (!enabled || !from || !to) return [];
    return PLAN_LINKS.flatMap(link => {
      const mod = modules.get(link.app);
      if (!mod?.planItems || hiddenApps.includes(link.app)) return [];
      try {
        return cleanAppItems(link.app, mod.planItems(readRaw(link.storageKey), from, to));
      } catch {
        return [];
      }
    });
    // stamp re-reads the other apps' saved data when it may have changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hiddenApps, from, to, modules, stamp]);
}

/** Things a planner item can open in one app: [{ id, title, href }]. */
export async function loadLaunchTargets(appId) {
  const link = PLAN_LINKS.find(l => l.app === appId);
  if (!link) return [];
  try {
    const mod = await link.load();
    const list = (await mod.launchTargets?.(readRaw(link.storageKey))) ?? [];
    return list.filter(t => t && typeof t.title === "string" && isSitePath(t.href)).slice(0, 300);
  } catch {
    return [];
  }
}
