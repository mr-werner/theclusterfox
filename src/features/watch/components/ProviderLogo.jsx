export default function ProviderLogo({ provider, size = 28 }) {
  if (provider.logo) {
    return <img className="wf-logo" src={provider.logo} alt="" width={size} height={size} loading="lazy" />;
  }
  return (
    <span className="wf-logo wf-logo--text" style={{ width: size, height: size }} aria-hidden="true">
      {provider.name.slice(0, 1)}
    </span>
  );
}
