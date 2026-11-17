import { useCallback, useEffect, useRef, useState } from "react";

import { connectSensor, isBluetoothAvailable } from "../model/bluetooth";

const STALE_MS = 5000;

/**
 * Bluetooth sensors for the whole visit, so a strap paired on the Setup tab
 * is still there when you start recording.
 * devices: { hr|power|machine: { name, status: "connecting"|"on"|"lost", error } }
 * values: latest readings, each fresh for a few seconds.
 * subscribe(fn) gets every reading as it arrives.
 */
export function useSensors() {
  const [devices, setDevices] = useState({});
  const [raw, setRaw] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const handles = useRef({});
  const listeners = useRef(new Set());

  const onData = useCallback(v => {
    const at = Date.now();
    setRaw(r => {
      const next = { ...r };
      for (const [k, val] of Object.entries(v)) next[k] = { v: val, at };
      return next;
    });
    for (const fn of listeners.current) fn(v);
  }, []);

  const connect = useCallback(async kind => {
    setDevices(d => ({ ...d, [kind]: { name: d[kind]?.name ?? null, status: "connecting", error: null } }));
    try {
      handles.current[kind]?.disconnect();
      const handle = await connectSensor(kind, onData, () => setDevices(d => ({ ...d, [kind]: { ...d[kind], status: "lost" } })));
      handles.current[kind] = handle;
      setDevices(d => ({ ...d, [kind]: { name: handle.name, status: "on", error: null } }));
    } catch (error) {
      // Closing the picker isn't an error worth showing.
      const cancelled = error?.name === "NotFoundError" || /cancel/i.test(error?.message ?? "");
      setDevices(d => {
        const next = { ...d };
        if (cancelled) delete next[kind];
        else next[kind] = { name: null, status: "error", error: error?.message || "Couldn't connect." };
        return next;
      });
    }
  }, [onData]);

  const disconnect = useCallback(kind => {
    handles.current[kind]?.disconnect();
    delete handles.current[kind];
    setDevices(d => {
      const next = { ...d };
      delete next[kind];
      return next;
    });
  }, []);

  const subscribe = useCallback(fn => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  useEffect(() => () => Object.values(handles.current).forEach(h => h.disconnect()), []);

  // Re-render now and then so stale readings disappear.
  const anyOn = Object.values(devices).some(d => d.status === "on");
  useEffect(() => {
    if (!anyOn) return undefined;
    const id = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(id);
  }, [anyOn]);

  const values = {};
  const latest = Math.max(now, ...Object.values(raw).map(r => r.at));
  for (const [k, { v, at }] of Object.entries(raw)) if (latest - at < STALE_MS) values[k] = v;

  return { available: isBluetoothAvailable(), devices, values, connect, disconnect, subscribe };
}
