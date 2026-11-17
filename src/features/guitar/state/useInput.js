// Listening to your guitar: the microphone (any guitar, acoustic or
// plugged in through an audio interface) or a MIDI guitar / pickup.
import { useCallback, useEffect, useRef, useState } from "react";
import { micSupported, startMic } from "../../../lib/music/pitch.js";
import { connectMidi, midiSupported } from "../../../lib/music/midiInput.js";
import { noteName } from "../../../lib/music/theory.js";

export function useInput(onFrame) {
  const [mode, setMode] = useState(null); // null | "mic" | "midi"
  const [error, setError] = useState("");
  const [heard, setHeard] = useState("");
  const [level, setLevel] = useState(0);
  const stopRef = useRef(null);
  const cb = useRef(onFrame);
  useEffect(() => {
    cb.current = onFrame;
  }, [onFrame]);
  const held = useRef(new Set());

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    held.current.clear();
    setMode(null);
    setHeard("");
    setLevel(0);
  }, []);

  const listenMic = useCallback(async () => {
    stop();
    setError("");
    try {
      let lastShown = 0;
      stopRef.current = await startMic({
        minFreq: 70,
        maxFreq: 1400,
        onFrame: f => {
          cb.current?.(f);
          const now = performance.now();
          if (now - lastShown > 120) {
            lastShown = now;
            setHeard(f.midi != null ? noteName(f.midi) : "");
            setLevel(Math.min(1, f.level * 12));
          }
        },
      });
      setMode("mic");
    } catch (err) {
      setError(err?.name === "NotAllowedError" ? "Microphone permission was turned down. Allow it in your browser's site settings to have FretFox listen." : err?.message || "Couldn't open the microphone.");
    }
  }, [stop]);

  const listenMidi = useCallback(async () => {
    stop();
    setError("");
    try {
      const off = await connectMidi({
        onNoteOn: midi => {
          held.current.add(midi);
          cb.current?.({ midis: [...held.current] });
          setHeard(noteName(midi));
        },
        onNoteOff: midi => held.current.delete(midi),
      });
      stopRef.current = off;
      setMode("midi");
    } catch (err) {
      setError(err?.message || "Couldn't connect to a MIDI device.");
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { mode, error, heard, level, listenMic, listenMidi, stop, canMic: micSupported(), canMidi: midiSupported() };
}
