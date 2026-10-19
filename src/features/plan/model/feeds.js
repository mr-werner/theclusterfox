// A quick check before saving a calendar link; the server checks again.
export function feedUrlLooksValid(raw) {
  try {
    const url = new URL(String(raw).trim().replace(/^webcals?:\/\//i, "https://"));
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}
