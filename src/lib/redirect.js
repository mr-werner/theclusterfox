// Where to send someone after logging in or signing up. Only same-site
// paths are allowed, so a crafted link can't bounce people to another site.
export function nextPath(searchParams, fallback = "/") {
    const next = searchParams.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export function withNext(path, next) {
    return next && next !== "/" ? `${path}?next=${encodeURIComponent(next)}` : path;
}
