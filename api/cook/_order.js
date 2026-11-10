/* global process */
// Turns the shopping list into an Instacart shopping-list page (Instacart
// Developer Platform, free key: instacart.com/company/business/developers).
// On that page the shopper picks any store Instacart delivers from near
// them (Aldi, Costco, Publix, Safeway, Kroger and hundreds more), sees that
// store's prices and checks out for delivery or pickup.

import { clean, webUrl } from "./_geo.js";

const PRODUCTION = "https://connect.instacart.com";
const MAX_ITEMS = 100;

export function instacartBody(input) {
  const items = (Array.isArray(input?.items) ? input.items : [])
    .map(i => {
      const name = clean(i?.name, 80);
      if (!name) return null;
      const quantity = Number.isFinite(i.quantity) && i.quantity > 0 ? Math.min(99, i.quantity) : 1;
      const unit = ["each", "package", "can", "bunch", "head", "bag", "box", "bottle", "jar"].includes(i.unit) ? i.unit : "each";
      const line = { name, line_item_measurements: [{ quantity, unit }] };
      const display = clean(i.display, 140);
      if (display) line.display_text = display;
      return line;
    })
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  const body = { title: clean(input?.title, 80) || "CookFox shopping list", link_type: "shopping_list", line_items: items };
  const back = webUrl(input?.back);
  if (back) body.landing_page_configuration = { partner_linkback_url: back };
  return body;
}

export default async function order(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const key = process.env.INSTACART_API_KEY?.trim();
  if (!key) return res.status(503).json({ error: "Instacart ordering isn't set up on this site yet." });
  const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  const body = instacartBody(input);
  if (!body.line_items.length) return res.status(400).json({ error: "The list is empty." });
  try {
    const base = process.env.INSTACART_API_URL?.trim() || PRODUCTION;
    const response = await fetch(`${base}/idp/v1/products/products_link`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Instacart ${response.status}`);
    const out = await response.json();
    const url = webUrl(out.products_link_url);
    if (!url) throw new Error("Instacart returned no link");
    return res.status(200).json({ url });
  } catch (error) {
    console.error("CookFox order:", error.message);
    return res.status(502).json({ error: "Instacart isn't responding. Try again in a moment." });
  }
}
