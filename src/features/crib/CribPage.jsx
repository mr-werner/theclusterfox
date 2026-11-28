import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Baby, Eye, MonitorSmartphone, Moon, ShieldCheck, Wifi } from "lucide-react";

import AppBar from "../../components/AppBar";
import Monitor from "./components/Monitor";
import Viewer from "./components/Viewer";
import { cleanCode, isCode, newCode, showCode } from "./lib/code";
import { readPrefs, writePrefs } from "./lib/api";
import { unlock } from "./lib/audio";
import "./crib.css";
import "./identity.css";

// CribFox: two phones make a baby monitor. One films the crib, the other
// watches and listens, paired with an 8-character code.
export default function CribPage() {
  const [params, setParams] = useSearchParams();
  const [prefs, setPrefs] = useState(readPrefs);
  const [mode, setMode] = useState(null); // { role: "monitor" | "viewer", code }
  const [typed, setTyped] = useState(() => cleanCode(params.get("watch") || prefs.watchCode || ""));
  const [typedError, setTypedError] = useState(null);

  // A shared link (?watch=CODE) fills in the code; the tap still starts it,
  // since the browser only plays sound after a tap.
  useEffect(() => {
    if (params.get("watch")) {
      const next = new URLSearchParams(params);
      next.delete("watch");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const save = (change) => setPrefs(writePrefs(change));

  function startMonitor(fresh = false) {
    unlock();
    const code = !fresh && isCode(prefs.monitorCode || "") ? prefs.monitorCode : newCode();
    save({ monitorCode: code, role: "monitor" });
    setMode({ role: "monitor", code });
  }

  function startViewer(event) {
    event?.preventDefault();
    unlock();
    const code = cleanCode(typed);
    if (!isCode(code)) {
      setTypedError("Type the 8-character code shown on the monitor phone.");
      return;
    }
    setTypedError(null);
    save({ watchCode: code, role: "viewer" });
    setMode({ role: "viewer", code });
  }

  const leave = () => {
    save({ role: null });
    setMode(null);
  };

  return (
    <div className={`cf${mode ? ` cf--${mode.role}` : ""}`}>
      <AppBar appId="cribfox" />
      {mode?.role === "monitor" && (
        <Monitor
          code={mode.code}
          prefs={prefs}
          save={save}
          onLeave={leave}
          onNewCode={() => {
            const code = newCode();
            save({ monitorCode: code });
            setMode({ role: "monitor", code });
          }}
        />
      )}
      {mode?.role === "viewer" && <Viewer code={mode.code} prefs={prefs} save={save} onLeave={leave} />}
      {!mode && (
        <main className="cf-wrap">
          <section className="cf-hero">
            <span className="cf-hero-icon" aria-hidden="true">
              <Baby size={34} />
            </span>
            <h1>Two phones, one baby monitor</h1>
            <p className="cf-muted">
              Prop an old phone by the crib and watch and listen from yours, on the same Wi-Fi or across town. Nothing is recorded or saved.
            </p>
          </section>

          <section className="cf-card">
            <h2>
              <MonitorSmartphone size={20} /> This phone stays with the baby
            </h2>
            <p className="cf-muted">It films the crib and listens. You'll get a code to type on your phone.</p>
            <button className="cf-btn" onClick={() => startMonitor(false)}>
              <Moon size={18} /> Start the monitor
            </button>
            {isCode(prefs.monitorCode || "") && (
              <p className="cf-muted cf-small">
                Uses this phone's code, <b>{showCode(prefs.monitorCode)}</b>, so your viewer phone reconnects by itself.{" "}
                <button className="cf-link" onClick={() => startMonitor(true)}>
                  Use a new code
                </button>
              </p>
            )}
          </section>

          <form className="cf-card" onSubmit={startViewer}>
            <h2>
              <Eye size={20} /> This phone watches
            </h2>
            <label className="cf-label" htmlFor="cf-code">
              Code from the monitor phone
            </label>
            <input
              id="cf-code"
              className="cf-input cf-code-input"
              value={showCode(typed)}
              onChange={(e) => setTyped(cleanCode(e.target.value))}
              placeholder="K7QM-3XRA"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              inputMode="text"
            />
            {typedError && <p className="cf-error">{typedError}</p>}
            <button className="cf-btn" type="submit" disabled={!typed}>
              <Eye size={18} /> Watch and listen
            </button>
          </form>

          <section className="cf-card cf-tips">
            <h2>Before you leave the room</h2>
            <ul>
              <li>
                <b>Keep the monitor phone plugged in, with this page open on screen.</b> A browser stops the camera if that phone locks or you switch to
                another app. The page keeps its screen awake, and Dim makes it dark.
              </li>
              <li>
                <Wifi size={16} /> Both phones on the same Wi-Fi works best. Cell data works on most networks; when one won't carry live video, you get a
                fresh picture every 2 seconds instead, with sound alerts still on.
              </li>
              <li>Keep your phone's screen on too: alerts and sound need this page open. You'll hear a chime if the monitor drops.</li>
              <li>
                <ShieldCheck size={16} /> Video goes straight from one phone to the other, never stored. Only someone with the code can watch, and the monitor
                shows how many phones are watching.
              </li>
              <li>This is a helpful extra, not a medical or safety device. Keep checking on the baby in person.</li>
            </ul>
          </section>
        </main>
      )}
    </div>
  );
}
