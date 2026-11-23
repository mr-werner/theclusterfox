// One function for every /api/watch/* endpoint, so WatchFox counts as a
// single function toward the Vercel plan's limit. Each endpoint lives in its
// own _file.

import browse from "./_browse.js";
import links from "./_links.js";
import providers from "./_providers.js";
import recommend from "./_recommend.js";
import search from "./_search.js";
import sports from "./_sports.js";
import title from "./_title.js";

const ROUTES = { browse, links, providers, recommend, search, sports, title };

export default function handler(req, res) {
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  return route(req, res);
}
