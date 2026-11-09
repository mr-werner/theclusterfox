import { useEffect, useState } from "react";

const SHOW_MS = 1300;
const FADE_MS = 350;

/**
 * The phone splash screen: the welcome message, briefly, then the home
 * screen. Shown once per visit; a tap skips it.
 */
export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = setTimeout(() => setLeaving(true), reduced ? 700 : SHOW_MS);
    return () => clearTimeout(show);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const done = setTimeout(onDone, FADE_MS);
    return () => clearTimeout(done);
  }, [leaving, onDone]);

  return (
    <div
      className={`phone-splash ${leaving ? "is-leaving" : ""}`}
      onClick={() => setLeaving(true)}
      role="presentation"
    >
      <div className="phone-splash-inner">
        <img src="/clusterfox-logo.png" alt="" className="phone-splash-logo" />
        <p className="eyebrow">WELCOME TO</p>
        <h1>
          THE CLUSTER <span>FOX</span>
        </h1>
        <p className="phone-splash-tagline">A cluster of useful & not so useful things.</p>
      </div>
    </div>
  );
}
