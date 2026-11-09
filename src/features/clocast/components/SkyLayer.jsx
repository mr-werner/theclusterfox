// The live sky behind CloCast. Pure CSS layers (see identity.css), so it
// costs no network and stops moving when reduced motion is asked for.
export default function SkyLayer({ sky }) {
  return (
    <div className={`cc-sky cc-sky--${sky}`} aria-hidden="true">
      <div className="cc-sky-glow" />
      <div className="cc-sky-clouds" />
      <div className="cc-sky-fall" />
      <div className="cc-sky-stars" />
      <div className="cc-sky-flash" />
    </div>
  );
}
