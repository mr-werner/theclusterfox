import { useEffect, useState } from "react";
import { BatteryWarning, Copy, Eye, Moon, Plug, Power, RefreshCw, Share2, SwitchCamera } from "lucide-react";

import { useMonitor } from "../state/useMonitor";
import { showCode } from "../lib/code";
import { useWakeLock } from "../lib/wakeLock";
import Meter from "./Meter";

// The phone by the crib: a preview, the code to pair with, and Dim.
export default function Monitor({ code, prefs, save, onLeave, onNewCode }) {
  const [facing, setFacing] = useState(prefs.facing || "environment");
  const [dim, setDim] = useState(false);
  const [copied, setCopied] = useState(false);
  const m = useMonitor(code, { facing, dim });
  const { start, running, stream, videoRef } = m;
  const awake = useWakeLock(running);

  useEffect(() => {
    // Started from a tap on the start screen, so the camera may open now.
    start();
    // Only once per code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream, videoRef]);

  const link = `${window.location.origin}/crib?watch=${code}`;
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "CribFox baby monitor", text: `Watch the baby monitor with code ${showCode(code)}`, url: link });
        return;
      } catch {
        // Cancelled: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", link);
    }
  }

  async function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    save({ facing: next });
    await m.switchCamera(next);
  }

  async function stop() {
    await m.stop();
    onLeave();
  }

  const lowBattery = m.battery && !m.battery.charging;

  return (
    <main className="cf-wrap cf-monitor">
      {m.error && (
        <div className="cf-card">
          <p className="cf-error" role="alert">
            {m.error}
          </p>
          <div className="cf-row">
            {!running && (
              <button className="cf-btn" onClick={start}>
                <RefreshCw size={18} /> Try again
              </button>
            )}
            {!running && m.error.includes("Another phone") && (
              <button className="cf-btn cf-btn--ghost" onClick={onNewCode}>
                Make a new code
              </button>
            )}
            <button className="cf-btn cf-btn--ghost" onClick={onLeave}>
              Back
            </button>
          </div>
        </div>
      )}

      <div className="cf-stage">
        <video ref={videoRef} className={`cf-video${facing === "user" ? " cf-video--mirror" : ""}`} autoPlay playsInline muted />
        {!running && !m.error && <p className="cf-stage-note">Starting the camera…</p>}
        {running && (
          <span className={`cf-chip ${m.viewers ? "cf-chip--live" : ""}`}>
            <Eye size={14} /> {m.viewers === 0 ? "Nobody watching yet" : m.viewers === 1 ? "1 phone watching" : `${m.viewers} phones watching`}
          </span>
        )}
        {m.offline && <span className="cf-chip cf-chip--warn cf-chip--right">Reconnecting…</span>}
      </div>

      {running && (
        <>
          <section className="cf-card cf-pair">
            <span className="cf-label">On your phone, open CribFox, tap Watch and type</span>
            <span className="cf-code" aria-label={`Code ${[...code].join(" ")}`}>
              {showCode(code)}
            </span>
            <button className="cf-btn cf-btn--ghost" onClick={share}>
              {copied ? <Copy size={18} /> : <Share2 size={18} />} {copied ? "Link copied" : "Send the link instead"}
            </button>
          </section>

          <section className="cf-card">
            <Meter level={m.level} label="Sound in the room" />
            {lowBattery && (
              <p className="cf-warn">
                <BatteryWarning size={18} /> Not charging ({m.battery.level}%). Plug this phone in so it lasts the night.
              </p>
            )}
            {!m.battery && (
              <p className="cf-muted cf-small">
                <Plug size={14} /> Keep this phone plugged in, with this page open. It stops if the phone locks or you switch apps.
              </p>
            )}
            {awake === false && (
              <p className="cf-warn">This browser can't keep the screen awake. Turn off auto-lock in the phone's display settings while it's a monitor.</p>
            )}
          </section>

          <div className="cf-row cf-actions">
            <button className="cf-btn" onClick={() => setDim(true)}>
              <Moon size={18} /> Dim
            </button>
            <button className="cf-btn cf-btn--ghost" onClick={flip}>
              <SwitchCamera size={18} /> Flip camera
            </button>
            <button className="cf-btn cf-btn--ghost cf-btn--stop" onClick={stop}>
              <Power size={18} /> Stop
            </button>
          </div>
        </>
      )}

      {dim && (
        <button className="cf-dim" onClick={() => setDim(false)} aria-label="Brighten the screen">
          <span className="cf-dim-dot" style={{ opacity: 0.15 + Math.min(m.level, 100) / 140 }} />
          <span className="cf-dim-text">
            Monitoring{m.viewers ? ` · ${m.viewers} watching` : ""} · tap to brighten
          </span>
        </button>
      )}
    </main>
  );
}
