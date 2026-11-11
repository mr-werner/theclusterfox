// Live shelf prices at one Kroger-family store for a list of search terms:
// GET /api/cook/prices?store=<locationId>&terms=eggs|butter|...
// Each term gets up to four matching products, best match first.

import { kroger, krogerReady, parseProducts } from "./_kroger.js";

const MAX_TERMS = 40;
const AT_ONCE = 5;

export default async function prices(req, res) {
  if (!krogerReady()) return res.status(503).json({ error: "Live prices aren't set up on this site yet." });
  const store = String(req.query.store ?? "");
  if (!/^[0-9A-Za-z]{4,12}$/.test(store)) return res.status(400).json({ error: "A store is required." });
  const terms = [...new Set(String(req.query.terms ?? "").split("|").map(t => t.trim().slice(0, 60)).filter(Boolean))].slice(0, MAX_TERMS);
  if (!terms.length) return res.status(400).json({ error: "Nothing to price." });

  const results = {};
  let failed = 0;
  for (let i = 0; i < terms.length; i += AT_ONCE) {
    await Promise.all(
      terms.slice(i, i + AT_ONCE).map(async term => {
        try {
          const body = await kroger("/products", { "filter.term": term, "filter.locationId": store, "filter.limit": 8 });
          results[term] = parseProducts(body).slice(0, 4);
        } catch (error) {
          failed++;
          console.error("CookFox prices:", term, error.message);
        }
      })
    );
  }
  if (failed === terms.length) return res.status(502).json({ error: "Kroger isn't responding. Try again in a moment." });
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  return res.status(200).json({ store, results });
}
