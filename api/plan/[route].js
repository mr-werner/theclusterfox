// One function for every /api/plan/* endpoint, so PlanFox stays within the
// Vercel plan's function limit. Each endpoint lives in its own _file.
// It also carries site-wide feedback (/api/plan/feedback), since PlanFox is
// the hub every app links to and the site is at the function limit.
// SnowFox's lift status and snow sensors ride along here as /api/plan/snow,
// since its trips feed PlanFox's calendar.

import events from "./_events.js";
import feed from "./_feed.js";
import feedback from "./_feedback.js";
import flights from "./_flights.js";
import games from "./_games.js";
import movies from "./_movies.js";
import schools from "./_schools.js";
import snow from "./_snow.js";
import sports from "./_sports.js";

const ROUTES = { events, feed, feedback, flights, games, movies, schools, snow, sports };

export default function handler(req, res) {
  const route = ROUTES[req.query.route];
  if (!route) return res.status(404).json({ error: "Not found" });
  return route(req, res);
}
