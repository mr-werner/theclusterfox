/* global process */
// The Kroger public API (free: developer.kroger.com). With an app's client
// ID and secret, it lists Kroger-family stores near a point and searches a
// store's products with that store's shelf and sale prices. It covers
// Kroger, Ralphs, Fred Meyer, King Soopers, Smith's, Fry's, QFC, Harris
// Teeter, Dillons, Mariano's, Pick 'n Save and the other Kroger banners.

const BASE = "https://api.kroger.com/v1";
let token = null; // { value, expires }

export const krogerReady = () => Boolean(process.env.KROGER_CLIENT_ID?.trim() && process.env.KROGER_CLIENT_SECRET?.trim());

async function accessToken() {
  if (token && token.expires > Date.now() + 60000) return token.value;
  const id = process.env.KROGER_CLIENT_ID.trim();
  const secret = process.env.KROGER_CLIENT_SECRET.trim();
  const response = await fetch(`${BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
  });
  if (!response.ok) throw new Error(`Kroger sign-in failed (${response.status})`);
  const body = await response.json();
  token = { value: body.access_token, expires: Date.now() + (Number(body.expires_in) || 1800) * 1000 };
  return token.value;
}

export async function kroger(path, params) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  const response = await fetch(url, { headers: { Authorization: `Bearer ${await accessToken()}`, Accept: "application/json" } });
  if (response.status === 401) token = null;
  if (!response.ok) throw new Error(`Kroger request failed (${response.status})`);
  return response.json();
}

export function parseLocations(body) {
  return (Array.isArray(body?.data) ? body.data : [])
    .filter(l => l.locationId && Number.isFinite(l.geolocation?.latitude) && Number.isFinite(l.geolocation?.longitude))
    .map(l => ({
      id: `kroger:${l.locationId}`,
      name: String(l.name ?? l.chain ?? "Kroger").slice(0, 80),
      chain: String(l.chain ?? "KROGER").toUpperCase(),
      lat: l.geolocation.latitude,
      lon: l.geolocation.longitude,
      address: [l.address?.addressLine1, l.address?.city, [l.address?.state, l.address?.zipCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      phone: typeof l.phone === "string" ? l.phone : null,
      krogerId: String(l.locationId),
    }));
}

// Each product's shelf price at the store, cheapest sale price first when on sale.
export function parseProducts(body) {
  const out = [];
  for (const p of Array.isArray(body?.data) ? body.data : []) {
    const item = (p.items ?? []).find(i => Number.isFinite(i.price?.regular) && i.price.regular > 0);
    if (!item) continue;
    const promo = Number.isFinite(item.price.promo) && item.price.promo > 0 && item.price.promo < item.price.regular ? item.price.promo : null;
    out.push({
      id: String(p.productId ?? p.upc ?? out.length),
      name: [p.brand, p.description].filter(Boolean).join(" ").replace(/^(.+?) \1 /, "$1 ").slice(0, 140) || "Product",
      size: typeof item.size === "string" ? item.size : "",
      price: promo ?? item.price.regular,
      regular: item.price.regular,
      sale: promo !== null,
      path: typeof p.productPageURI === "string" && p.productPageURI.startsWith("/") ? p.productPageURI.split("?")[0] : null,
      stock: item.inventory?.stockLevel ?? null,
    });
  }
  return out.filter(p => p.stock !== "TEMPORARILY_OUT_OF_STOCK");
}
