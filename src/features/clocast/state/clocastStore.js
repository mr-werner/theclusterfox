// Everything CloCast remembers lives in one document. It is kept in this
// browser for everyone, and mirrored to the account when signed in.

export const STORAGE_KEY = "clocast-data-v1";
export const MAX_SAVED_PLACES = 8;

export function emptyData() {
  return {
    version: 1,
    units: "us",
    place: null,
    savedPlaces: [],
    activityId: "errands",
    hours: 2,
    profile: { heightCm: null, weightKg: null, ageYears: null, sex: null },
    tolerance: "normal",
    shaded: false,
    updatedAt: null,
    // Which account this browser last synced with (null = signed out data).
    syncedUserId: null,
  };
}

function isPlace(value) {
  return Boolean(
    value && typeof value === "object" && typeof value.name === "string" &&
      Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
  );
}

function cleanPlace(place) {
  return {
    id: String(place.id ?? `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`),
    name: place.name.slice(0, 80),
    region: typeof place.region === "string" ? place.region.slice(0, 80) : "",
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

const positive = value => (Number(value) > 0 ? Number(value) : null);

export function normalizeData(value) {
  const base = emptyData();
  if (!value || typeof value !== "object") return base;
  const profile = value.profile && typeof value.profile === "object" ? value.profile : {};
  return {
    ...base,
    units: value.units === "metric" ? "metric" : "us",
    place: isPlace(value.place) ? cleanPlace(value.place) : null,
    savedPlaces: Array.isArray(value.savedPlaces)
      ? value.savedPlaces.filter(isPlace).map(cleanPlace).slice(0, MAX_SAVED_PLACES)
      : [],
    activityId: typeof value.activityId === "string" ? value.activityId : base.activityId,
    hours: [1, 2, 4, 8, 12].includes(value.hours) ? value.hours : base.hours,
    profile: {
      heightCm: positive(profile.heightCm),
      weightKg: positive(profile.weightKg),
      ageYears: positive(profile.ageYears),
      sex: profile.sex === "male" || profile.sex === "female" ? profile.sex : null,
    },
    tolerance: ["cold", "warm"].includes(value.tolerance) ? value.tolerance : "normal",
    shaded: value.shaded === true,
    updatedAt: value.updatedAt ?? null,
    syncedUserId: value.syncedUserId ?? null,
  };
}

export function loadData() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return normalizeData(raw === null ? null : JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable (private mode, quota) */
  }
}

const time = value => (value ? Date.parse(value) || 0 : 0);

// The newer document wins. When signed-out data meets an account for the
// first time (combine), saved places are pooled and blank body details are
// filled from the other copy so nothing typed in is lost.
export function mergeData(local, remote, { combine = false } = {}) {
  const a = normalizeData(local);
  const b = normalizeData(remote);
  const newer = time(b.updatedAt) > time(a.updatedAt) ? b : a;
  const older = newer === a ? b : a;
  if (!combine) return { ...newer, syncedUserId: a.syncedUserId };

  const places = [];
  for (const place of [...newer.savedPlaces, ...older.savedPlaces]) {
    if (!places.some(p => p.id === place.id)) places.push(place);
  }
  const profile = { ...newer.profile };
  for (const key of Object.keys(profile)) profile[key] = profile[key] ?? older.profile[key];

  return {
    ...newer,
    place: newer.place ?? older.place,
    savedPlaces: places.slice(0, MAX_SAVED_PLACES),
    profile,
    syncedUserId: a.syncedUserId,
  };
}

// The account copy leaves out fields that only make sense in this browser.
export function toRemote(data) {
  // eslint-disable-next-line no-unused-vars
  const { syncedUserId, ...rest } = data;
  return rest;
}
