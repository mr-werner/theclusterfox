// One function for every /api/plan/* endpoint, so PlanFox stays within the
// Vercel plan's function limit. Each endpoint lives in its own _file.

import feed from "./_feed.js";
import games from "./_games.js";
import movies from "./_movies.js";
import schools from "./_schools.js";
import sports from "./_sports.js";

const ROUTES = { feed, games, movies, schools, sports };

export default function handler(req, res) {
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  return route(req, res);
}
