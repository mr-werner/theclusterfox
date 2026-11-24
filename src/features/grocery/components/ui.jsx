export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="gx-empty">
      {Icon && <Icon size={28} aria-hidden="true" />}
      <h3>{title}</h3>
      {children}
    </div>
  );
}
