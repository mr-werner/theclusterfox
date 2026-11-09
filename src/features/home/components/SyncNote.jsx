import { Link } from "react-router-dom";
import { Cloud, CloudOff, HardDrive, Loader2 } from "lucide-react";

// Where the home screen layout is saved, in a few words.
export default function SyncNote({ status, compact = false }) {
  if (status === "local") {
    return (
      <span className="sync-note">
        <HardDrive size={14} aria-hidden="true" />
        {compact ? (
          <span>Saved on this device</span>
        ) : (
          <span>
            Your home screen is saved in this browser. <Link to="/login">Log in</Link> to keep it on every device.
          </span>
        )}
      </span>
    );
  }
  if (status === "syncing") {
    return (
      <span className="sync-note">
        <Loader2 size={14} className="spin" aria-hidden="true" />
        <span>Saving to your account…</span>
      </span>
    );
  }
  if (status === "synced") {
    return (
      <span className="sync-note">
        <Cloud size={14} aria-hidden="true" />
        <span>Saved to your ClusterFox account</span>
      </span>
    );
  }
  return (
    <span className="sync-note">
      <CloudOff size={14} aria-hidden="true" />
      <span>{status === "unavailable" ? "Saved on this device (account sync is coming soon)" : "Couldn't reach your account, saved on this device"}</span>
    </span>
  );
}
