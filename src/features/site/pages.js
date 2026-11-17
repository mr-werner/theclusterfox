import { apps } from "../../app/apps.js";

// Longest path first, so /tools/heat would match a /tools/heat app before /tools.
const byPath = [...apps].sort((a, b) => b.path.length - a.path.length);

/** The ClusterFox app a page belongs to, or null for site pages. */
export function appForPath(pathname = "/") {
  const path = pathname.split(/[?#]/)[0];
  return byPath.find(app => path === app.path || path.startsWith(`${app.path}/`)) ?? null;
}
