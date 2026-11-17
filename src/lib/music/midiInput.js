// Web MIDI input shared by the music apps: plug in a keyboard (or a MIDI
// guitar, drum pad...) and get note on / note off callbacks.
//
// Works in Chrome, Edge, Opera and Android Chrome, and in Firefox after it
// asks. Safari and iPhone/iPad browsers have no Web MIDI, so callers should
// offer the microphone or on-screen keys there (midiSupported() tells you).

export const midiSupported = () => typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";

let accessPromise = null;
function access() {
  if (!midiSupported()) return Promise.reject(new Error("This browser can't use MIDI devices."));
  accessPromise ??= navigator.requestMIDIAccess({ sysex: false }).catch(err => {
    accessPromise = null;
    throw err;
  });
  return accessPromise;
}

const describe = port => ({ id: port.id, name: port.name || "MIDI device", maker: port.manufacturer || "", state: port.state });

/** [{ id, name, maker, state }] of connected MIDI inputs. Asks for permission the first time. */
export async function listMidiInputs() {
  const a = await access();
  return [...a.inputs.values()].map(describe);
}

/**
 * Listen to every connected MIDI input (or just `deviceId`).
 * onNoteOn(midi, velocity 0–1, deviceId), onNoteOff(midi, deviceId),
 * onPedal(down: boolean), onDevices([{ id, name, ... }]) when devices come and go.
 * Resolves to a stop() function.
 */
export async function connectMidi({ onNoteOn, onNoteOff, onPedal, onDevices, deviceId = null } = {}) {
  const a = await access();
  const attached = new Map();

  const onMessage = port => e => {
    const [status, d1 = 0, d2 = 0] = e.data;
    const kind = status & 0xf0;
    if (kind === 0x90 && d2 > 0) onNoteOn?.(d1, d2 / 127, port.id);
    else if (kind === 0x80 || (kind === 0x90 && d2 === 0)) onNoteOff?.(d1, port.id);
    else if (kind === 0xb0 && d1 === 64) onPedal?.(d2 >= 64);
  };

  const attachAll = () => {
    for (const port of a.inputs.values()) {
      if (deviceId && port.id !== deviceId) continue;
      if (attached.has(port.id) || port.state !== "connected") continue;
      const handler = onMessage(port);
      port.addEventListener("midimessage", handler);
      attached.set(port.id, { port, handler });
    }
    for (const [id, { port, handler }] of attached) {
      if (port.state !== "connected") {
        port.removeEventListener("midimessage", handler);
        attached.delete(id);
      }
    }
    onDevices?.([...a.inputs.values()].map(describe));
  };

  attachAll();
  a.addEventListener("statechange", attachAll);
  return () => {
    a.removeEventListener("statechange", attachAll);
    for (const { port, handler } of attached.values()) port.removeEventListener("midimessage", handler);
    attached.clear();
  };
}
