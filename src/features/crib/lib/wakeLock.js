import { useEffect, useState } from "react";

/**
 * Keeps the screen on while `on`, taking the lock again whenever the page
 * comes back to the front. Returns true once held, false if the browser
 * can't, and null before it knows.
 */
export function useWakeLock(on) {
  const [held, setHeld] = useState(() => (typeof navigator !== "undefined" && navigator.wakeLock ? null : false));
  useEffect(() => {
    if (!on || !navigator.wakeLock) return undefined;
    let lock = null;
    let gone = false;
    const get = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (gone) lock.release();
        else setHeld(true);
      } catch {
        setHeld(false);
      }
    };
    get();
    document.addEventListener("visibilitychange", get);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", get);
      lock?.release().catch(() => {});
    };
  }, [on]);
  return held;
}
