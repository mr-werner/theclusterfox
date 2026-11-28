import { useCallback, useEffect, useRef, useState } from "react";

import { call, gathered, getIceServers, peerId } from "../lib/api";

// The parent's side: checks in about once a second, asks the monitor for a
// live stream, and keeps asking when it drops. If no live stream gets
// through for a while (some cell networks block it), it switches to picture
// mode, a still frame every couple of seconds, and keeps trying for live
// video in the background.

const RETRY_MS = 9000;
const PICTURE_AFTER_MS = 18000;
const PICTURE_RETRY_MS = 25000;
const LOST_MS = 20000;

export function useViewer(code) {
  const [monitor, setMonitor] = useState(null); // { online, status, seen }
  const [stream, setStream] = useState(null);
  const [state, setState] = useState("connecting"); // connecting | live | picture | offline | missing
  const [snap, setSnap] = useState(null);
  const [error, setError] = useState(null);
  const [net, setNet] = useState(true);
  const [lost, setLost] = useState(false);

  const me = peerId("viewer");
  const live = useRef({ pc: null, attempt: 0, lastHello: 0, firstTry: 0, liveAt: 0, monitorPeer: null, after: 0, picture: false, snapAt: 0, everLive: false });

  const closePc = useCallback(() => {
    const l = live.current;
    if (l.pc) {
      l.pc.close();
      l.pc = null;
    }
  }, []);

  const hello = useCallback(async () => {
    const l = live.current;
    if (!l.monitorPeer) return;
    closePc();
    l.attempt += 1;
    l.lastHello = Date.now();
    l.firstTry ||= Date.now();
    try {
      await call({ op: "send", code, peer: me, to: l.monitorPeer, body: { type: "hello", attempt: l.attempt } });
    } catch {
      // Next poll tries again.
    }
  }, [code, me, closePc]);

  const answer = useCallback(
    async (from, body) => {
      const l = live.current;
      if (from !== l.monitorPeer || body.attempt !== l.attempt) return;
      closePc();
      const pc = new RTCPeerConnection({ iceServers: await getIceServers() });
      l.pc = pc;
      pc.addEventListener("track", (e) => {
        const s = e.streams[0] || new MediaStream([e.track]);
        setStream(s);
      });
      pc.addEventListener("connectionstatechange", () => {
        if (l.pc !== pc) return;
        if (pc.connectionState === "connected") {
          l.liveAt = Date.now();
          l.everLive = true;
          l.firstTry = 0;
          l.picture = false;
          setState("live");
        } else if (pc.connectionState === "failed") {
          // Try again on the next check-in.
          l.lastHello = 0;
        }
      });
      try {
        await pc.setRemoteDescription({ type: "offer", sdp: body.sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        await gathered(pc);
        if (l.pc !== pc) return;
        await call({ op: "send", code, peer: me, to: from, body: { type: "answer", attempt: body.attempt, sdp: pc.localDescription.sdp } });
      } catch {
        if (l.pc === pc) closePc();
      }
    },
    [code, me, closePc],
  );

  useEffect(() => {
    let stopped = false;
    let timer = null;
    async function poll() {
      if (stopped) return;
      const l = live.current;
      const now = Date.now();
      try {
        const data = await call({ op: "poll", code, peer: me, after: l.after, wantSnap: l.picture, snapAt: l.snapAt });
        if (stopped) return;
        setNet(true);
        setError(null);
        l.after = data.lastId ?? l.after;
        const m = data.monitor;
        setMonitor(m);
        setLost(!m.online && data.now - (m.seen || 0) > LOST_MS);
        if (data.snap) {
          l.snapAt = data.snapAt;
          setSnap({ src: data.snap, at: data.snapAt });
        }
        if (m.peer !== l.monitorPeer) {
          // The monitor page reloaded: start over with it.
          closePc();
          l.monitorPeer = m.peer;
          l.lastHello = 0;
          l.after = data.lastId ?? 0;
        }
        for (const msg of data.messages || []) if (msg.body?.type === "offer") answer(msg.from, msg.body);

        const pcState = l.pc?.connectionState;
        const isLive = pcState === "connected";
        if (!m.online) {
          if (l.pc) closePc();
          setState("offline");
        } else if (!isLive) {
          const stuck = !l.pc || pcState === "failed" || pcState === "closed" || pcState === "disconnected";
          const wait = l.picture ? PICTURE_RETRY_MS : RETRY_MS;
          if (now - l.lastHello > wait && (stuck || now - l.lastHello > wait * 1.5)) hello();
          if (!l.picture && l.firstTry && now - l.firstTry > PICTURE_AFTER_MS) l.picture = true;
          setState(l.picture ? "picture" : "connecting");
        } else {
          setState("live");
        }
      } catch (e) {
        if (stopped) return;
        if (e.status === 404) {
          // Turned off (or never started). Keep checking: it picks up again
          // by itself when the monitor starts with the same code.
          closePc();
          setMonitor(null);
          setLost(false);
          setState("missing");
          setError(l.everLive ? "The monitor phone was turned off. This screen reconnects when it starts again." : e.message);
        } else if (e.status === 400) {
          setState("missing");
          setError(e.message);
        } else setNet(false);
      }
      timer = setTimeout(poll, 1000);
    }
    poll();
    const wake = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [code, me, hello, answer, closePc]);

  // Leaving: tell the monitor, so it stops sending.
  useEffect(
    () => () => {
      const l = live.current;
      if (l.monitorPeer) call({ op: "send", code, peer: me, to: l.monitorPeer, body: { type: "bye" } }, { keepalive: true }).catch(() => {});
      l.pc?.close();
      l.pc = null;
    },
    [code, me],
  );

  return { monitor, stream, state, snap, error, net, lost, retry: hello };
}
