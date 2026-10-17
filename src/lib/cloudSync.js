import { authClient } from "./auth";

// Per-app account data goes straight to the Neon Data API. Each app has a
// table with one row per user, and row-level security (see db/migrations)
// limits every request to the signed-in user's own row via the Neon Auth JWT.

function dataApiUrl() {
  const explicit = import.meta.env.VITE_NEON_DATA_API_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Same endpoint as Neon Auth: ep-x.neonauth.<region>/<db>/auth
  //                          → ep-x.apirest.<region>/<db>/rest/v1
  try {
    const url = new URL(import.meta.env.VITE_NEON_AUTH_URL);
    url.hostname = url.hostname.replace(".neonauth.", ".apirest.");
    url.pathname = url.pathname.replace(/\/auth\/?$/, "/rest/v1");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export class SyncUnavailableError extends Error {}

async function request(path, init = {}) {
  const base = dataApiUrl();
  if (!base) throw new SyncUnavailableError("Account sync is not configured.");

  const session = await authClient.getSession();
  const token = session?.data?.session?.token;
  if (!token) throw new SyncUnavailableError("Not signed in.");

  let response;
  try {
    response = await fetch(`${base}/${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
    });
  } catch {
    throw new Error("Couldn't reach the sync service.");
  }

  // 404 means the table or the Data API isn't set up yet.
  if (response.status === 404) throw new SyncUnavailableError("Account sync is not set up yet.");
  if (!response.ok) throw new Error(`Sync failed (${response.status}).`);
  return response;
}

export function createCloudSync(table) {
  return {
    async fetchRemoteData(userId) {
      const response = await request(
        `${table}?select=data,updated_at&user_id=eq.${encodeURIComponent(userId)}`
      );
      const rows = await response.json();
      return rows[0]?.data ?? null;
    },

    async pushRemoteData(userId, data) {
      await request(`${table}?on_conflict=user_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: userId,
          data,
          updated_at: new Date().toISOString(),
        }),
      });
    },
  };
}
