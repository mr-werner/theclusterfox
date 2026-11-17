// One function for every /api/site/* endpoint (site-wide things that aren't
// part of any one app), so the site stays within the Vercel plan's function
// limit. Each endpoint lives in its own _file.

import feedback from "./_feedback.js";

const ROUTES = { feedback };

export default function handler(req, res) {
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  return route(req, res);
}
