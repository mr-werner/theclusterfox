// One function for every /api/cook/* endpoint, so CookFox adds a single
// function to the Vercel plan's limit. Each endpoint lives in its own _file.

import order from "./_order.js";
import prices from "./_prices.js";
import stores from "./_stores.js";

const ROUTES = { order, prices, stores };

export default function handler(req, res) {
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  return route(req, res);
}
