export function formatRest(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

export function describeItem(item) {
  const amount = item.seconds ? `${item.seconds}s hold` : `${item.reps} reps`;
  return `${item.sets} × ${amount}${item.perSide ? " each side" : ""}`;
}

// A rest countdown that starts now.
export function restFor(seconds) {
  const now = Date.now();
  return { endsAt: now + seconds * 1000, total: seconds, key: now };
}
