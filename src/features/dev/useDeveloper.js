import { useEffect, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { checkDeveloper } from "./devApi";

const CACHE_KEY = "clusterfox:dev-check";

function cached(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    return saved?.userId === userId ? saved.isDev : null;
  } catch {
    return null;
  }
}

/**
 * Whether the signed-in person is a ClusterFox developer (in site_admins).
 * Checked once per visit and remembered for the tab, so every page can ask
 * without a request each time. status: "checking" | "yes" | "no".
 */
export function useDeveloper() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const [result, setResult] = useState({ userId: null, isDev: null });

  useEffect(() => {
    if (loading || !userId || cached(userId) !== null) return undefined;
    let cancelled = false;
    checkDeveloper(userId).then(isDev => {
      if (cancelled) return;
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ userId, isDev }));
      } catch {
        // Private mode: check again next page.
      }
      setResult({ userId, isDev });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, loading]);

  if (loading) return "checking";
  if (!userId) return "no";
  const known = result.userId === userId ? result.isDev : cached(userId);
  return known === null ? "checking" : known ? "yes" : "no";
}
