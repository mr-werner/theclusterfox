// The daily reminders someone picked in SkyFox, plus the body details and
// cold/heat tolerance SkyFox uses for the clothing reminder. Read from
// SkyFox's saved data in this browser, and read again when the tab comes
// back into view so a change made in SkyFox shows up here.

import { useEffect, useState } from "react";

import { normalizeData, STORAGE_KEY } from "../../clocast/state/clocastStore.js";

export function readSkyFoxReminders() {
  let data;
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    data = normalizeData(text === null ? null : JSON.parse(text));
  } catch {
    data = normalizeData(null);
  }
  return { settings: data.reminders, profile: data.profile, tolerance: data.tolerance };
}

export function useSkyFoxReminders() {
  const [value, setValue] = useState(readSkyFoxReminders);
  useEffect(() => {
    const refresh = () => setValue(readSkyFoxReminders());
    const onStorage = event => {
      if (event.key === STORAGE_KEY) refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return value;
}
