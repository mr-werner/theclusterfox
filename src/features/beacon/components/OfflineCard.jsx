import { CheckCircle2, Download, Loader2, Share, WifiOff } from "lucide-react";

import { useInstallPrompt, useOffline } from "../offline/register";
import { isAppleMobile } from "../model/torch";

// Shows whether BeaconFox is saved on this device for use with no signal,
// and how to put it on the home screen.
export default function OfflineCard() {
  const { state, online } = useOffline();
  const { install, installed } = useInstallPrompt();

  const status = {
    ready: { icon: CheckCircle2, cls: "is-ready", title: "Saved on this device", text: "BeaconFox opens and works with no signal, even in airplane mode." },
    saving: { icon: Loader2, cls: "is-saving", title: "Saving for offline…", text: "Keep this page open for a moment while it saves." },
    unsupported: { icon: WifiOff, cls: "", title: "Can't save offline here", text: "This browser can't keep BeaconFox for offline use. Try Chrome or Safari." },
    error: { icon: WifiOff, cls: "", title: "Couldn't save offline", text: "Open BeaconFox again with a good connection to try once more." },
    dev: { icon: Download, cls: "", title: "Offline saving is on the live site", text: "This preview doesn't save offline. The published site does." },
  }[state];
  const Icon = status.icon;

  return (
    <section className="bx-card bx-offline">
      <h2>Works without signal</h2>
      {!online && <p className="bx-pill">You're offline right now</p>}
      <div className={`bx-offline-status ${status.cls}`}>
        <Icon size={20} aria-hidden="true" className={state === "saving" ? "bx-spin" : undefined} />
        <div>
          <strong>{status.title}</strong>
          <span>{status.text}</span>
        </div>
      </div>

      {installed ? (
        <p className="bx-muted bx-small">Installed on this device. Open it from your home screen.</p>
      ) : install ? (
        <button type="button" className="bx-btn" onClick={install}>
          <Download size={16} aria-hidden="true" /> Install BeaconFox
        </button>
      ) : isAppleMobile() ? (
        <p className="bx-muted bx-small">
          Put it on your home screen: tap <Share size={14} aria-label="Share" className="bx-inline-icon" /> Share, then <strong>Add to Home Screen</strong>. It opens like an app, ready when you need it.
        </p>
      ) : (
        <p className="bx-muted bx-small">Add it to your home screen from the browser menu (Install app, or Add to Home screen) so it's one tap away.</p>
      )}
      <p className="bx-muted bx-small">Open it once now, before a trip, so it's saved before you lose signal.</p>
    </section>
  );
}
