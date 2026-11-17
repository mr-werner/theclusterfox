import { useEffect, useState } from "react";

// Runs an async loader when `key` changes, with abort on change or unmount.
// -> { data, error, loading }. A null key loads nothing.
export function useLoad(key, loader) {
  const [state, setState] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    if (key === null || key === undefined) return undefined;
    const ctl = new AbortController();
    let live = true;
    loader(ctl.signal).then(
      data => live && setState({ key, data, error: null }),
      error => live && error.name !== "AbortError" && setState({ key, data: null, error: error.message || "Something went wrong." })
    );
    return () => {
      live = false;
      ctl.abort();
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = state.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: key !== null && key !== undefined && !current };
}
