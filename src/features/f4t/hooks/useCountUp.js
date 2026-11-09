import { useEffect, useRef, useState } from "react";

const reduce = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A number that glides to its new value instead of jumping. */
export function useCountUp(target, ms = 450) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const span = reduce() ? 0 : ms;
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = now => {
      const t = span ? Math.min(1, (now - start) / span) : 1;
      const eased = 1 - (1 - t) ** 3;
      const value = begin + (target - begin) * eased;
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return shown;
}
