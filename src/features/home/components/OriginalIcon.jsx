// The gradient icon for a ClusterFox original. `compact` drops the label for
// the phone grid, where the name sits under the icon instead.

export default function OriginalIcon({ app, compact = false, size }) {
  const Icon = app.icon;
  return (
    <span className={`app-icon app-icon--${app.accent} ${compact ? "app-icon--compact" : ""}`} aria-hidden="true">
      <Icon size={size ?? (compact ? 30 : 42)} strokeWidth={compact ? 2 : 1.8} />
      {!compact && <span>{app.name}</span>}
    </span>
  );
}
