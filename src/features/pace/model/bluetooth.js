// Bluetooth sensors through Web Bluetooth: heart rate straps, cycling
// power meters, and indoor machines (rowers, bike trainers, treadmills)
// that speak the standard Fitness Machine (FTMS) profile.
//
// Web Bluetooth works in Chrome, Edge and Opera on Android, Windows, Mac,
// ChromeOS and Linux. Safari and every browser on iPhone and iPad don't
// offer it, so isBluetoothAvailable() is false there.

export const KINDS = {
  hr: { id: "hr", name: "Heart rate monitor", examples: "chest straps and arm bands (Polar, Garmin HRM, Wahoo TICKR, Coros), many watches in broadcast mode" },
  power: { id: "power", name: "Power meter", examples: "pedal, crank and hub power meters, most smart trainers" },
  machine: { id: "machine", name: "Rower, trainer or treadmill", examples: "machines with Bluetooth FTMS: many smart trainers, rowers and treadmills (the Concept2 PM5 uses its own protocol and doesn't work here yet)" },
};

export const isBluetoothAvailable = () => typeof navigator !== "undefined" && Boolean(navigator.bluetooth?.requestDevice);

// ---- Parsers (pure, take a DataView) -------------------------------------

/** Heart Rate Measurement (0x2A37) -> bpm. */
export function parseHeartRate(view) {
  const flags = view.getUint8(0);
  return flags & 0x01 ? view.getUint16(1, true) : view.getUint8(1);
}

/** Cycling Power Measurement (0x2A63) -> { power, crankRevs?, crankTime? }. */
export function parsePower(view) {
  const flags = view.getUint16(0, true);
  const power = view.getInt16(2, true);
  let o = 4;
  if (flags & 0x01) o += 1; // pedal power balance
  if (flags & 0x04) o += 2; // accumulated torque
  if (flags & 0x10) o += 6; // wheel revolution data
  const out = { power };
  if (flags & 0x20 && view.byteLength >= o + 4) {
    out.crankRevs = view.getUint16(o, true);
    out.crankTime = view.getUint16(o + 2, true);
  }
  return out;
}

const u24 = (v, o) => v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16);

/** FTMS Rower Data (0x2AD1). */
export function parseRower(view) {
  const flags = view.getUint16(0, true);
  const out = {};
  let o = 2;
  const has = bit => Boolean(flags & (1 << bit));
  if (!has(0)) {
    out.strokeRate = view.getUint8(o) / 2;
    out.strokes = view.getUint16(o + 1, true);
    o += 3;
  }
  if (has(1)) o += 1;
  if (has(2)) {
    out.distance = u24(view, o);
    o += 3;
  }
  if (has(3)) {
    const split = view.getUint16(o, true);
    if (split > 0 && split < 1000) out.split = split;
    o += 2;
  }
  if (has(4)) o += 2;
  if (has(5)) {
    out.power = view.getInt16(o, true);
    o += 2;
  }
  if (has(6)) o += 2;
  if (has(7)) o += 2;
  if (has(8)) o += 5;
  if (has(9)) {
    const hr = view.getUint8(o);
    if (hr) out.hr = hr;
  }
  return out;
}

/** FTMS Indoor Bike Data (0x2AD2). */
export function parseIndoorBike(view) {
  const flags = view.getUint16(0, true);
  const out = {};
  let o = 2;
  const has = bit => Boolean(flags & (1 << bit));
  if (!has(0)) {
    out.speed = view.getUint16(o, true) / 100 / 3.6;
    o += 2;
  }
  if (has(1)) o += 2;
  if (has(2)) {
    out.cadence = view.getUint16(o, true) / 2;
    o += 2;
  }
  if (has(3)) o += 2;
  if (has(4)) {
    out.distance = u24(view, o);
    o += 3;
  }
  if (has(5)) o += 2;
  if (has(6)) {
    out.power = view.getInt16(o, true);
    o += 2;
  }
  if (has(7)) o += 2;
  if (has(8)) o += 5;
  if (has(9)) {
    const hr = view.getUint8(o);
    if (hr) out.hr = hr;
  }
  return out;
}

/** FTMS Treadmill Data (0x2ACD). */
export function parseTreadmill(view) {
  const flags = view.getUint16(0, true);
  const out = {};
  let o = 2;
  const has = bit => Boolean(flags & (1 << bit));
  if (!has(0)) {
    out.speed = view.getUint16(o, true) / 100 / 3.6;
    o += 2;
  }
  if (has(1)) o += 2;
  if (has(2)) {
    out.distance = u24(view, o);
    o += 3;
  }
  if (has(3)) o += 4;
  if (has(4)) o += 4;
  if (has(5)) o += 1;
  if (has(6)) o += 1;
  if (has(7)) o += 5;
  if (has(8)) {
    const hr = view.getUint8(o);
    if (hr) out.hr = hr;
  }
  return out;
}

// ---- Connecting (browser only) --------------------------------------------

const FTMS = "fitness_machine";
const FTMS_CHARS = [
  ["00002ad1-0000-1000-8000-00805f9b34fb", parseRower, "rower"],
  ["00002ad2-0000-1000-8000-00805f9b34fb", parseIndoorBike, "bike"],
  ["00002acd-0000-1000-8000-00805f9b34fb", parseTreadmill, "treadmill"],
];

/**
 * Ask the browser to pick a device of this kind and start listening.
 * onData(values) gets { hr } | { power, cadence? } | machine values.
 * onDrop() is called if the device disconnects on its own.
 * Resolves to { name, disconnect }.
 */
export async function connectSensor(kind, onData, onDrop) {
  if (!isBluetoothAvailable()) throw new Error("This browser can't use Bluetooth.");
  const filters = { hr: [{ services: ["heart_rate"] }], power: [{ services: ["cycling_power"] }], machine: [{ services: [FTMS] }] }[kind];
  const device = await navigator.bluetooth.requestDevice({ filters });
  let manual = false;
  let lastCrank = null;

  async function subscribe() {
    const server = await device.gatt.connect();
    if (kind === "hr") {
      const ch = await (await server.getPrimaryService("heart_rate")).getCharacteristic("heart_rate_measurement");
      ch.addEventListener("characteristicvaluechanged", e => onData({ hr: parseHeartRate(e.target.value) }));
      await ch.startNotifications();
    } else if (kind === "power") {
      const ch = await (await server.getPrimaryService("cycling_power")).getCharacteristic("cycling_power_measurement");
      ch.addEventListener("characteristicvaluechanged", e => {
        const v = parsePower(e.target.value);
        const out = { power: v.power };
        if (v.crankRevs != null) {
          if (lastCrank) {
            const revs = (v.crankRevs - lastCrank.revs + 65536) % 65536;
            const secs = ((v.crankTime - lastCrank.time + 65536) % 65536) / 1024;
            if (secs > 0 && revs < 10) out.cadence = Math.round((revs / secs) * 60);
          }
          lastCrank = { revs: v.crankRevs, time: v.crankTime };
        }
        onData(out);
      });
      await ch.startNotifications();
    } else {
      const service = await server.getPrimaryService(FTMS);
      let found = false;
      for (const [uuid, parse, type] of FTMS_CHARS) {
        try {
          const ch = await service.getCharacteristic(uuid);
          ch.addEventListener("characteristicvaluechanged", e => onData({ ...parse(e.target.value), machine: type }));
          await ch.startNotifications();
          found = true;
          break;
        } catch {
          // Not this kind of machine; try the next.
        }
      }
      if (!found) throw new Error("That machine doesn't share rower, bike or treadmill data.");
    }
  }

  // A sensor that drops out (out of range, strap dried out) gets a few tries.
  device.addEventListener("gattserverdisconnected", async () => {
    if (manual) return;
    for (let i = 0; i < 3; i += 1) {
      await new Promise(r => setTimeout(r, 1500 * (i + 1)));
      try {
        await subscribe();
        return;
      } catch {
        // keep trying
      }
    }
    onDrop?.();
  });

  await subscribe();
  return {
    name: device.name || KINDS[kind].name,
    disconnect() {
      manual = true;
      try {
        device.gatt.disconnect();
      } catch {
        // already gone
      }
    },
  };
}
