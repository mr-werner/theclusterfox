import { Bluetooth, BluetoothConnected, BluetoothOff, HeartPulse, LoaderCircle, X, Zap, Gauge, Waves } from "lucide-react";

import { KINDS } from "../model/bluetooth";

const ICONS = { hr: HeartPulse, power: Zap, machine: Gauge, pm5: Waves };

/** Connect buttons for heart rate, power and indoor machines. */
export default function Sensors({ sensors, sport, compact = false }) {
  if (!sensors.available) {
    return (
      <div className="pc-sensors is-off">
        <BluetoothOff size={18} aria-hidden="true" />
        <p>
          <strong>Bluetooth sensors aren't available in this browser.</strong> They work in Chrome or Edge on Android, Windows, Mac and ChromeOS. iPhone and iPad browsers
          don't allow websites to use Bluetooth. Voice cues still play through Bluetooth headphones, and you can record on your watch and import the file in the Log afterwards.
        </p>
      </div>
    );
  }
  const kinds = sport === "run" ? ["hr", "machine"] : sport === "ride" ? ["hr", "power", "machine"] : ["hr", "pm5", "machine"];
  return (
    <div className={`pc-sensors${compact ? " is-compact" : ""}`}>
      {kinds.map(k => {
        const d = sensors.devices[k];
        const Icon = ICONS[k];
        const v = sensors.values;
        const reading = k === "hr" ? (v.hr ? `${v.hr} bpm` : null) : k === "power" ? (v.power != null ? `${v.power} W` : null) : v.distance != null ? `${Math.round(v.distance)} m` : v.power != null ? `${v.power} W` : null;
        // A PM5 and an FTMS machine both fill the same readings; show each its own.
        if (k === "machine" && sensors.devices.pm5?.status === "on" && d?.status !== "on") return null;
        if (k === "pm5" && sensors.devices.machine?.status === "on" && d?.status !== "on") return null;
        return (
          <div key={k} className={`pc-sensor is-${d?.status ?? "none"}`}>
            <Icon size={18} aria-hidden="true" />
            <div>
              <strong>{d?.status === "on" ? d.name : KINDS[k].name}</strong>
              <small>
                {d?.status === "on"
                  ? reading ?? "Connected, waiting for data"
                  : d?.status === "lost"
                    ? "Lost the connection. Tap to reconnect."
                    : d?.status === "error"
                      ? d.error
                      : compact
                        ? "Not connected"
                        : KINDS[k].examples}
              </small>
            </div>
            {d?.status === "on" ? (
              <button type="button" className="pc-icon-btn" onClick={() => sensors.disconnect(k)} aria-label={`Disconnect ${d.name}`}>
                <X size={16} />
              </button>
            ) : (
              <button type="button" className="pc-btn pc-btn-small" disabled={d?.status === "connecting"} onClick={() => sensors.connect(k)}>
                {d?.status === "connecting" ? <LoaderCircle size={15} className="spin" /> : d?.status === "lost" ? <BluetoothConnected size={15} /> : <Bluetooth size={15} />}
                {d?.status === "connecting" ? "Pairing…" : "Connect"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
