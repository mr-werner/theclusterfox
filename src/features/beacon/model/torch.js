// The phone's flashlight, through the camera. Browsers only let a page turn
// the torch on through the rear camera's "torch" setting, which Chrome on
// Android supports. iPhone and iPad browsers (Safari, and Chrome there too,
// since it runs on Safari's engine) do not, so there the screen is the light.

export function isAppleMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export function torchMaybeSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && !isAppleMobile();
}

/**
 * Opens the rear camera and checks for a torch.
 * Resolves { ok: true, set(on), close() } or { ok: false, reason }.
 * reason: "unsupported" | "denied" | "no-torch" | "error"
 */
export async function openTorch() {
  if (!torchMaybeSupported()) return { ok: false, reason: "unsupported" };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
  } catch (err) {
    const denied = err && (err.name === "NotAllowedError" || err.name === "SecurityError");
    return { ok: false, reason: denied ? "denied" : "error" };
  }

  let track = withTorch(stream);
  if (!track) {
    // Some phones have several rear cameras and only one owns the torch.
    stream.getTracks().forEach(t => t.stop());
    stream = null;
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
      for (const d of devices) {
        const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: d.deviceId } }, audio: false }).catch(() => null);
        if (!s) continue;
        track = withTorch(s);
        if (track) {
          stream = s;
          break;
        }
        s.getTracks().forEach(t => t.stop());
      }
    } catch {
      // Fall through to "no torch".
    }
  }
  if (!track) return { ok: false, reason: "no-torch" };

  // A few phones only light the torch while the camera is actually playing.
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  video.play().catch(() => {});

  let want = false;
  let busy = false;
  async function apply() {
    if (busy) return;
    busy = true;
    try {
      let current;
      do {
        current = want;
        await track.applyConstraints({ advanced: [{ torch: current }] }).catch(() => {});
      } while (current !== want);
    } finally {
      busy = false;
    }
  }

  return {
    ok: true,
    set(on) {
      want = Boolean(on);
      apply();
    },
    close() {
      want = false;
      track.applyConstraints({ advanced: [{ torch: false }] }).catch(() => {});
      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    },
  };
}

function withTorch(stream) {
  const track = stream.getVideoTracks()[0];
  const caps = track?.getCapabilities?.();
  return caps && caps.torch ? track : null;
}
