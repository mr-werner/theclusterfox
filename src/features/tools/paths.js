// Pure path helpers for nav.jsx, kept apart so tests can import them in Node.

/** "/tools/calc/beam" -> "/mechanics/calc/beam" inside the Mechanics app. */
export function rebase(to, base) {
  if (base === "/tools") return to;
  if (typeof to === "string") return /^\/tools(?=\/|\?|#|$)/.test(to) ? base + to.slice(6) : to;
  if (to && typeof to === "object" && typeof to.pathname === "string") return { ...to, pathname: rebase(to.pathname, base) };
  return to;
}

/** The other way: "/mechanics/calc/beam" -> "/tools/calc/beam". */
export function canonical(path, base) {
  if (base === "/tools" || !path.startsWith(base)) return path;
  const rest = path.slice(base.length);
  return rest === "" || /^[/?#]/.test(rest) ? `/tools${rest}` : path;
}
