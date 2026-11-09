// Recent problems, kept in this browser and, when signed in, the account.

export const HISTORY_KEY = "mathfox-history-v1";
export const MAX_HISTORY = 12;

export const cleanHistory = raw => (Array.isArray(raw) ? raw.filter(x => typeof x === "string" && x.length <= 300).slice(0, MAX_HISTORY) : []);

export function loadHistory() {
  try {
    return cleanHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]"));
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
