import { sessionToken } from "../../lib/cloudSync";

/**
 * Sends feedback to /api/site/feedback. Signed-in people send their token so
 * the developer can see who it came from; anyone else is anonymous.
 * Resolves to true, or throws with a message meant for the person.
 */
export async function sendFeedback({ kind, message, contact, page, app, website }) {
  const token = await sessionToken();
  let response;
  try {
    response = await fetch("/api/site/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind, message, contact, page, app, website }),
    });
  } catch {
    throw new Error("Couldn't reach The ClusterFox. Check your connection and try again.");
  }
  if (response.ok) return true;
  let error = "";
  try {
    error = (await response.json()).error;
  } catch {
    // Not JSON.
  }
  throw new Error(error || `Couldn't send your feedback (${response.status}).`);
}
