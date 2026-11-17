import { dataRequest, SyncUnavailableError } from "../../lib/cloudSync";

// The developer area talks to the Neon Data API with the signed-in person's
// token. Row-level security (db/migrations/011) only lets admins read
// feedback and read or write dev notes, so nothing here is trusted to the
// browser: a non-admin simply gets nothing back.

const json = async response => (response.status === 204 ? null : response.json());

/** True when this account is in site_admins. Never throws. */
export async function checkDeveloper(userId) {
  if (!userId) return false;
  try {
    const rows = await json(await dataRequest(`site_admins?select=user_id&user_id=eq.${encodeURIComponent(userId)}`));
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    if (!(error instanceof SyncUnavailableError)) console.warn("Developer check:", error.message);
    return false;
  }
}

export async function listFeedback({ status = "open", limit = 200 } = {}) {
  let filter = "";
  if (status === "open") filter = "&status=in.(new,seen,planned)";
  else if (status !== "all") filter = `&status=eq.${encodeURIComponent(status)}`;
  return json(await dataRequest(`site_feedback?select=*&order=created_at.desc&limit=${limit}${filter}`));
}

export async function updateFeedback(id, patch) {
  await dataRequest(`site_feedback?id=eq.${Number(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

export async function listNotes({ page = null, status = "open", limit = 300 } = {}) {
  let filter = "";
  if (status === "open") filter += "&status=in.(open,picked_up)";
  else if (status !== "all") filter += `&status=eq.${encodeURIComponent(status)}`;
  if (page) filter += `&page=eq.${encodeURIComponent(page)}`;
  return json(await dataRequest(`dev_notes?select=*&order=created_at.desc&limit=${limit}${filter}`));
}

export async function addNote({ kind, body, title = null, page = null, app = null }) {
  const rows = await json(
    await dataRequest("dev_notes", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ kind, body, title, page, app }),
    })
  );
  return rows?.[0] ?? null;
}

export async function updateNote(id, patch) {
  await dataRequest(`dev_notes?id=eq.${Number(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
}

export async function deleteNote(id) {
  await dataRequest(`dev_notes?id=eq.${Number(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}
