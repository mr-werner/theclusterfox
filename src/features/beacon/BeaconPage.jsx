import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen, Flashlight, Lightbulb, MessageSquareText, Monitor, Siren, Square, Volume2 } from "lucide-react";

import AppBar from "../../components/AppBar";
import { SIGNALS, signalById } from "./model/signals";
import { encode, messageSegments } from "./model/morse";
import { createPlayer } from "./model/player";
import { isAppleMobile, openTorch, torchMaybeSupported } from "./model/torch";
import { createTone } from "./model/tone";
import { COLORS, usePrefs } from "./state/prefs";
import MorseTab from "./components/MorseTab";
import GuideTab from "./components/GuideTab";
import OfflineCard from "./components/OfflineCard";
import SignalOverlay from "./components/SignalOverlay";
import "./beacon.css";
import "./identity.css";

const TABS = [
  { id: "signals", name: "Signals", icon: Siren },
  { id: "morse", name: "Morse", icon: MessageSquareText },
  { id: "guide", name: "Guide", icon: BookOpen },
];

const TORCH_NOTE = {
  unsupported: "This browser can't turn on the phone's flashlight. iPhone and iPad browsers don't allow it, so the screen is your light there.",
  denied: "Camera permission was turned down, so the flashlight can't be used. The flashlight belongs to the camera; nothing is recorded or saved.",
  "no-torch": "No flashlight found on this device's cameras, so the screen is your light.",
  error: "The flashlight couldn't start. Close other apps using the camera and try again.",
};

export default function BeaconPage() {
  const [prefs, setPrefs] = usePrefs();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t.id === params.get("tab")) ? params.get("tab") : "signals";

  const [running, setRunning] = useState(null); // { id, name, letters? }
  const [lit, setLit] = useState({ on: false, at: null });
  const [torchNote, setTorchNote] = useState(() => (torchMaybeSupported() ? null : "unsupported"));

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  const torchRef = useRef(null);
  const wakeRef = useRef(null);
  const [tone] = useState(createTone);

  // Light, flashlight and beep all follow one switch.
  const output = useCallback(
    on => {
      torchRef.current?.set(on);
      if (prefsRef.current.sound || !on) tone.set(on);
    },
    [tone]
  );

  const [player] = useState(() => createPlayer());
  useEffect(
    () =>
      player.listen(state => {
        setLit({ on: state.on, at: state.at });
        output(state.on);
      }),
    [player, output]
  );

  const ensureTorch = useCallback(async () => {
    if (torchRef.current) return true;
    const torch = await openTorch();
    if (!torch.ok) {
      setTorchNote(torch.reason);
      return false;
    }
    setTorchNote(null);
    torchRef.current = torch;
    return true;
  }, []);

  const closeTorch = useCallback(() => {
    torchRef.current?.close();
    torchRef.current = null;
  }, []);

  const releaseWake = useCallback(() => {
    wakeRef.current?.release?.().catch(() => {});
    wakeRef.current = null;
  }, []);

  const stop = useCallback(() => {
    player.stop();
    tone.set(false);
    closeTorch();
    releaseWake();
    setRunning(null);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, [player, tone, closeTorch, releaseWake]);

  const begin = useCallback(
    async (job, segments, loop = true) => {
      const p = prefsRef.current;
      player.stop();
      // Things a browser only allows straight from a tap go first.
      if (p.screen) document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
      if (p.sound) tone.unlock();
      navigator.wakeLock?.request("screen").then(lock => (wakeRef.current = lock), () => {});

      let torchOk = false;
      if (p.torch) torchOk = await ensureTorch();
      // No flashlight and no screen would be no light at all: use the screen.
      if (!torchOk && !p.screen) {
        setPrefs({ screen: true });
      }
      setRunning(job);
      player.start(segments, { loop, onEnd: stop });
    },
    [player, tone, ensureTorch, setPrefs, stop]
  );

  const startSignal = id => {
    const sig = signalById.get(id);
    if (!sig) return;
    if (running?.id === id) {
      stop();
      return;
    }
    const letters = sig.morse ? [{ char: "SOS", code: "...---..." }] : null;
    begin({ id, name: sig.name, letters }, sig.build(prefs.wpm));
  };

  const startMessage = () => {
    const letters = encode(prefs.message);
    const segments = messageSegments(prefs.message, prefs.wpm);
    if (!segments.length) return;
    begin({ id: "message", name: "Your message", letters }, segments, prefs.loop);
  };

  // Keep the screen awake again after coming back to the tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && running && !wakeRef.current) {
        navigator.wakeLock?.request("screen").then(lock => (wakeRef.current = lock), () => {});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [running]);

  // Leaving the app turns everything off.
  useEffect(() => {
    return () => {
      player.stop();
      tone.close();
      torchRef.current?.close();
      torchRef.current = null;
      wakeRef.current?.release?.().catch(() => {});
    };
  }, [player, tone]);

  const toggleTorch = async () => {
    if (prefs.torch) {
      setPrefs({ torch: false });
      return;
    }
    // Check right away, so the permission question comes now and not mid-emergency.
    const ok = await ensureTorch();
    if (ok) {
      setPrefs({ torch: true });
      if (!running) closeTorch();
    }
  };

  const switchTab = id => setParams(id === "signals" ? {} : { tab: id }, { replace: true });

  const color = COLORS[prefs.color].value;
  const planTitle = tab === "morse" ? "Practice Morse code" : "Check my emergency signals";

  return (
    <div className="bx">
      <AppBar appId="beaconfox" planTitle={planTitle} />

      <main className="bx-wrap">
        <section className="bx-hero">
          <button
            type="button"
            className={`bx-sos${running?.id === "sos" ? " is-on" : ""}`}
            onClick={() => startSignal("sos")}
            aria-pressed={running?.id === "sos"}
          >
            <span className="bx-sos-word">{running?.id === "sos" ? "Stop" : "SOS"}</span>
            <span className="bx-sos-code" aria-hidden="true">··· ─── ···</span>
          </button>
          <div className="bx-hero-text">
            <p className="bx-kicker">Emergency light</p>
            <h1>Signal for help with your screen or flashlight</h1>
            <p className="bx-lede">
              If you have signal, call 911 (or 112) first. Then use light to be seen: one tap starts SOS, and it keeps going until you stop it.
            </p>
          </div>
        </section>

        <section className="bx-outputs" aria-label="Light source">
          <div className="bx-out-row">
            <Toggle on={prefs.screen} onClick={() => setPrefs({ screen: !prefs.screen })} icon={Monitor} label="Screen" />
            <Toggle
              on={prefs.torch}
              onClick={toggleTorch}
              icon={Flashlight}
              label="Flashlight"
              muted={torchNote === "unsupported"}
            />
            <Toggle on={prefs.sound} onClick={() => setPrefs({ sound: !prefs.sound })} icon={Volume2} label="Beep" />
          </div>
          <div className="bx-colors" role="radiogroup" aria-label="Screen color">
            {Object.entries(COLORS).map(([id, c]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={prefs.color === id}
                className={prefs.color === id ? "is-on" : ""}
                onClick={() => setPrefs({ color: id })}
                title={c.hint}
              >
                <span className="bx-swatch" style={{ background: c.value }} aria-hidden="true" />
                {c.name}
              </button>
            ))}
          </div>
          {torchNote && (
            <p className="bx-note">
              <Lightbulb size={15} aria-hidden="true" />
              {TORCH_NOTE[torchNote]}
            </p>
          )}
          {!torchNote && !prefs.torch && torchMaybeSupported() && (
            <p className="bx-note bx-note-quiet">Turn on Flashlight to use the phone's light too. It asks for the camera once, because the light belongs to the camera.</p>
          )}
          {isAppleMobile() && <p className="bx-note bx-note-quiet">Turn your screen brightness all the way up for the brightest signal.</p>}
        </section>

        <nav className="bx-tabs" aria-label="BeaconFox sections">
          {TABS.map(t => (
            <button key={t.id} type="button" className={tab === t.id ? "is-on" : ""} aria-current={tab === t.id ? "page" : undefined} onClick={() => switchTab(t.id)}>
              <t.icon size={17} aria-hidden="true" />
              <span>{t.name}</span>
            </button>
          ))}
        </nav>

        <div className="bx-body">
          <div className="bx-main">
            {tab === "signals" && (
              <div className="bx-signals">
                {SIGNALS.map(s => {
                  const on = running?.id === s.id;
                  return (
                    <button key={s.id} type="button" className={`bx-signal${on ? " is-on" : ""}`} onClick={() => startSignal(s.id)} aria-pressed={on}>
                      <span className="bx-signal-top">
                        <strong>{s.name}</strong>
                        <span className="bx-signal-act">{on ? "Stop" : "Start"}</span>
                      </span>
                      <span className="bx-signal-pattern" aria-hidden="true">{s.short}</span>
                      <span className="bx-signal-what">{s.what}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {tab === "morse" && (
              <MorseTab
                prefs={prefs}
                setPrefs={setPrefs}
                onSend={startMessage}
                sending={running?.id === "message"}
                onStop={stop}
                keyOutput={output}
                ensureTorch={ensureTorch}
                closeTorch={closeTorch}
                unlockTone={tone.unlock}
                color={color}
                busy={Boolean(running)}
              />
            )}
            {tab === "guide" && <GuideTab />}
          </div>
          <aside className="bx-side">
            <OfflineCard />
          </aside>
        </div>
      </main>

      {running && prefs.screen && <SignalOverlay job={running} lit={lit} color={color} onStop={stop} />}
      {running && !prefs.screen && (
        <div className="bx-running" role="status">
          <span className={`bx-dot${lit.on ? " is-on" : ""}`} aria-hidden="true" />
          <span>
            Sending <strong>{running.name}</strong> with the flashlight
          </span>
          <button type="button" onClick={stop}>
            <Square size={14} aria-hidden="true" /> Stop
          </button>
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onClick, icon: Icon, label, muted }) {
  return (
    <button type="button" className={`bx-toggle${on ? " is-on" : ""}${muted ? " is-muted" : ""}`} aria-pressed={on} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      <span>{label}</span>
      <span className="bx-toggle-state">{on ? "On" : "Off"}</span>
    </button>
  );
}
