// Songs you import into KeysFox, kept on this device only.
const KEY = "keysfox-songs-v1";
const MAX = 40;

const isSong = s => s && typeof s === "object" && typeof s.id === "string" && Array.isArray(s.notes) && Array.isArray(s.timeSig);

export function loadImported() {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list) ? list.filter(isSong).map(s => ({ ...s, source: "import" })) : [];
  } catch {
    return [];
  }
}

/** Save the list; returns false when the browser has no room. */
export function saveImported(list) {
  try {
    // Notes stored compactly: [midi, t, d, hand, vel].
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    return true;
  } catch {
    return false;
  }
}
