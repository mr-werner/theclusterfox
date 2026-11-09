// Recent problems, kept only in this browser.

export const HISTORY_KEY = "mathfox-history-v1";
export const MAX_HISTORY = 12;

export function loadHistory() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(x => typeof x === "string" && x.length <= 300).slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function pushHistory(list, q) {
  const clean = q.trim();
  if (!clean) return list;
  return [clean, ...list.filter(x => x !== clean)].slice(0, MAX_HISTORY);
}

export function saveHistory(list) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // private mode or storage full: history just won't persist
  }
}
