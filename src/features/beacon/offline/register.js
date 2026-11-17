// Saves BeaconFox for use with no signal: registers the offline worker and
// reports how far along it is.
import { useEffect, useState } from "react";

const SW_URL = "/beacon-sw.js";
const SCOPE = "/beacon";

/**
 * state: "dev" (works on the live site), "unsupported", "saving", "ready", "error"
 */
export function useOffline() {
  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator && typeof caches !== "undefined";
  const dev = import.meta.env.DEV;
  const [state, setState] = useState(() => (dev ? "dev" : supported ? "saving" : "unsupported"));
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    if (dev || !supported) return undefined;
    let alive = true;
    const onMessage = event => {
      const data = event.data;
      if (!alive || data?.type !== "beacon-status") return;
      setState(data.cached >= data.total ? "ready" : "saving");
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const ask = reg => (reg.active || reg.waiting || reg.installing)?.postMessage("beacon-status");
    navigator.serviceWorker
      .register(SW_URL, { scope: SCOPE })
      .then(reg => {
        const watch = worker => {
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") ask(reg);
            if (worker.state === "redundant" && !reg.active && alive) setState("error");
          });
        };
        watch(reg.installing);
        reg.addEventListener("updatefound", () => watch(reg.installing));
        if (reg.active) ask(reg);
      })
      .catch(() => alive && setState("error"));

    return () => {
      alive = false;
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, [dev, supported]);

  return { state, online };
}

/** Catches Chrome's install offer so the page can show its own button. */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true)
  );
  useEffect(() => {
    const onPrompt = event => {
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const install = prompt
    ? async () => {
        prompt.prompt();
        await prompt.userChoice.catch(() => null);
        setPrompt(null);
      }
    : null;
  return { install, installed };
}
