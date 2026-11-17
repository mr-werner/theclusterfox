// Where the Donate button goes. Set VITE_DONATE_URL in Vercel to a Ko-fi,
// Buy Me a Coffee, GitHub Sponsors, PayPal or Stripe payment link, and
// optionally VITE_DONATE_LABEL to name it ("Ko-fi", "PayPal", ...).
// Until it is set, the Donate page says donations open soon.

function cleanUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const donateUrl = cleanUrl(import.meta.env.VITE_DONATE_URL ?? "");
export const donateLabel = (import.meta.env.VITE_DONATE_LABEL ?? "").trim() || null;
