import { useCallback, useEffect, useRef, useState } from "react";

import { call, gathered, getIceServers, peerId } from "../lib/api";
import { meter, unlock } from "../lib/audio";

// The baby's side: films the room, checks in with the server about once a
// second, and opens a live stream to each viewer that says hello.

const VIDEO = (facing) => ({ facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 20, max: 24 } });
// Crying matters more than clean speech: no noise suppression, and a boost
// for a quiet room.
const AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: true };

export function useMonitor(code, { facing, dim }) {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [level, setLevel] = useState(0);
  const [battery, setBattery] = useState(null);
  const [running, setRunning] = useState(false);

  const me = peerId("monitor");
  const live = useRef({ stream: null, pcs: new Map(), after: 0, wantSnap: false, lastSnap: 0, level: 0, peak: 0, dim, battery: null });
  const videoRef = useRef(null);

  useEffect(() => {
    live.current.dim = dim;
  }, [dim]);

  const countViewers = useCallback(() => {
    let n = 0;
    for (const { pc } of live.current.pcs.values()) if (pc.connectionState === "connected") n++;
    setViewers(n);
    return n;
  }, []);

  const drop = useCallback(
    (viewer) => {
      const entry = live.current.pcs.get(viewer);
      if (!entry) return;
      live.current.pcs.delete(viewer);
      entry.pc.close();
      countViewers();
    },
    [countViewers],
  );

  // A viewer said hello: offer it the camera and microphone.
  const offer = useCallback(
    async (viewer, attempt) => {
      const s = live.current.stream;
      if (!s) return;
      drop(viewer);
      const pc = new RTCPeerConnection({ iceServers: await getIceServers() });
      live.current.pcs.set(viewer, { pc, attempt });
      s.getTracks().forEach((t) => pc.addTrack(t, s));
      pc.addEventListener("connectionstatechange", () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          if (live.current.pcs.get(viewer)?.pc === pc) drop(viewer);
        } else countViewers();
      });
      try {
        await pc.setLocalDescription(await pc.createOffer());
        await gathered(pc);
        if (live.current.pcs.get(viewer)?.pc !== pc) return;
        await call({ op: "send", code, peer: me, to: viewer, body: { type: "offer", attempt, sdp: pc.localDescription.sdp } });
      } catch {
        drop(viewer);
      }
    },
    [code, me, drop, countViewers],
  );

  const handle = useCallback(
    async (msg) => {
      const { from, body } = msg;
      if (!body || typeof body !== "object") return;
      if (body.type === "hello") offer(from, body.attempt);
      else if (body.type === "answer") {
        const entry = live.current.pcs.get(from);
        if (entry && entry.attempt === body.attempt && entry.pc.signalingState === "have-local-offer") {
          try {
            await entry.pc.setRemoteDescription({ type: "answer", sdp: body.sdp });
          } catch {
            drop(from);
          }
        }
      } else if (body.type === "bye") drop(from);
    },
    [offer, drop],
  );

  // A small still picture, for viewers whose network can't take the stream.
  const snapshot = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const w = 480;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.55);
  }, []);

  // Start: camera, then claim the code.
  const start = useCallback(async () => {
    setError(null);
    unlock();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't use the camera here. Open the page in Chrome or Safari, over https.");
      return false;
    }
    let s;
    try {
      s = await navigator.mediaDevices.getUserMedia({ video: VIDEO(facing), audio: AUDIO });
    } catch (e) {
      setError(
        e?.name === "NotAllowedError"
          ? "The camera or microphone is blocked. Allow them for this site in the browser's settings, then try again."
          : "Couldn't start the camera. Close other apps that might be using it and try again.",
      );
      return false;
    }
    try {
      await call({ op: "host", code, peer: me });
    } catch (e) {
      s.getTracks().forEach((t) => t.stop());
      setError(e.message);
      return false;
    }
    live.current.stream = s;
    live.current.after = 0;
    setStream(s);
    setRunning(true);
    return true;
  }, [code, facing, me]);

  // Switch between the front and back camera without dropping viewers.
  const switchCamera = useCallback(async (nextFacing) => {
    const s = live.current.stream;
    if (!s) return;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: VIDEO(nextFacing) });
      const track = fresh.getVideoTracks()[0];
      const old = s.getVideoTracks()[0];
      for (const { pc } of live.current.pcs.values()) {
        const sender = pc.getSenders().find((x) => x.track?.kind === "video");
        await sender?.replaceTrack(track);
      }
      if (old) {
        s.removeTrack(old);
        old.stop();
      }
      s.addTrack(track);
      setStream(new MediaStream(s.getTracks()));
      live.current.stream = s;
    } catch {
      setError("Couldn't switch cameras on this phone.");
    }
  }, []);

  const stop = useCallback(async () => {
    const l = live.current;
    for (const viewer of [...l.pcs.keys()]) drop(viewer);
    l.stream?.getTracks().forEach((t) => t.stop());
    l.stream = null;
    setStream(null);
    setRunning(false);
    try {
      await call({ op: "stop", code, peer: me }, { keepalive: true });
    } catch {
      // The room expires on its own.
    }
  }, [code, me, drop]);

  // Sound level of the baby's room, sampled often, peak sent to viewers.
  useEffect(() => {
    if (!stream) return undefined;
    const m = meter(stream);
    const id = setInterval(() => {
      const v = m.read();
      if (v == null) return;
      live.current.level = v;
      live.current.peak = Math.max(live.current.peak, v);
      setLevel(v);
    }, 150);
    return () => {
      clearInterval(id);
      m.stop();
    };
  }, [stream]);

  // Battery, where the browser shares it (Chrome on Android does; Safari doesn't).
  useEffect(() => {
    if (!running || !navigator.getBattery) return undefined;
    let b = null;
    const read = () => {
      const value = { level: Math.round(b.level * 100), charging: b.charging };
      live.current.battery = value;
      setBattery(value);
    };
    navigator.getBattery().then((x) => {
      b = x;
      read();
      b.addEventListener("levelchange", read);
      b.addEventListener("chargingchange", read);
    });
    return () => {
      b?.removeEventListener("levelchange", read);
      b?.removeEventListener("chargingchange", read);
    };
  }, [running]);

  // Check in with the server about once a second.
  useEffect(() => {
    if (!running) return undefined;
    let stopped = false;
    let timer = null;
    const status = (hidden = document.visibilityState !== "visible") => {
      const l = live.current;
      const s = { level: l.peak, viewers: countViewers(), dim: l.dim, hidden, battery: l.battery?.level ?? null, charging: l.battery?.charging ?? null };
      l.peak = l.level;
      return s;
    };
    async function poll() {
      if (stopped) return;
      const l = live.current;
      const body = { op: "poll", code, peer: me, after: l.after, status: status() };
      if (l.wantSnap && Date.now() - l.lastSnap > 1800) {
        const snap = snapshot();
        if (snap) {
          body.snap = snap;
          l.lastSnap = Date.now();
        }
      }
      try {
        const data = await call(body);
        if (stopped) return;
        setOffline(false);
        l.after = data.lastId ?? l.after;
        l.wantSnap = Boolean(data.wantSnap);
        for (const m of data.messages || []) handle(m);
      } catch (e) {
        if (stopped) return;
        if (e.status === 404) {
          // The room was cleared (it sat quiet too long): claim it again.
          call({ op: "host", code, peer: me }).catch(() => {});
        }
        setOffline(true);
      }
      timer = setTimeout(poll, l.wantSnap ? 900 : 1000);
    }
    poll();
    const onVisibility = () => {
      // Tell viewers straight away that this page went to the background.
      call({ op: "poll", code, peer: me, after: live.current.after, status: status() }, { keepalive: true }).catch(() => {});
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running, code, me, handle, snapshot, countViewers]);

  // Leaving the page: let go of the camera.
  useEffect(
    () => () => {
      const l = live.current;
      for (const { pc } of l.pcs.values()) pc.close();
      l.pcs.clear();
      l.stream?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return { stream, error, setError, offline, viewers, level, battery, running, start, stop, switchCamera, videoRef };
}
