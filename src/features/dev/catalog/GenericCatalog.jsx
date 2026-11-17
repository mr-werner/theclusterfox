import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check } from "lucide-react";

const textOf = item =>
  [item.title, item.meta, item.text, ...(item.list ?? []), ...(item.tags ?? []), ...(item.choices?.options ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

function Item({ item }) {
  return (
    <article className="dev-item">
      <div className="dev-item-head">
        <h4>{item.title}</h4>
        {item.href && (
          <Link to={item.href} className="dev-open" title="Open it in the app">
            Open <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        )}
      </div>
      {item.meta && <p className="dev-muted dev-small">{item.meta}</p>}
      {item.text && <p className="dev-item-text">{item.text}</p>}
      {item.choices && (
        <ol className="dev-choices" type="A">
          {item.choices.options.map((option, i) => (
            <li key={i} className={i === item.choices.answer ? "is-answer" : ""}>
              {option} {i === item.choices.answer && <Check size={13} aria-label="correct answer" />}
            </li>
          ))}
        </ol>
      )}
      {item.choices?.why && <p className="dev-muted dev-small">{item.choices.why}</p>}
      {item.list?.length > 0 && (
        <ul className="dev-list">
          {item.list.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {item.tags?.length > 0 && (
        <p className="dev-chips">
          {item.tags.map(tag => (
            <span key={tag} className="dev-chip">
              {tag}
            </span>
          ))}
        </p>
      )}
    </article>
  );
}

/** Any app's contents as searchable groups of cards. */
export default function GenericCatalog({ load, query }) {
  const [state, setState] = useState({ load: null, data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    load()
      .then(data => !cancelled && setState({ load, data, error: "" }))
      .catch(error => !cancelled && setState({ load, data: null, error: error.message }));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const groups = useMemo(() => {
    if (state.load !== load || !state.data) return null;
    const q = query.trim().toLowerCase();
    return state.data.groups
      .map(g => ({ ...g, items: q ? g.items.filter(item => textOf(item).includes(q)) : g.items }))
      .filter(g => g.items.length > 0);
  }, [state, load, query]);

  if (state.load === load && state.error) return <p className="dev-error">Couldn't load this catalog: {state.error}</p>;
  if (!groups) return <p className="dev-muted">Loading…</p>;
  if (groups.length === 0) return <p className="dev-muted">Nothing matches.</p>;

  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="dev-catalog">
      <p className="dev-muted">
        {total} items in {groups.length} {groups.length === 1 ? "group" : "groups"}
      </p>
      <nav className="dev-jump" aria-label="Groups">
        {groups.map(g => (
          <a key={g.title} href={`#g-${encodeURIComponent(g.title)}`}>
            {g.title} <small>{g.items.length}</small>
          </a>
        ))}
      </nav>
      {groups.map(g => (
        <section key={g.title} id={`g-${encodeURIComponent(g.title)}`} className="dev-group">
          <h3>
            {g.title} <small>{g.items.length}</small>
          </h3>
          <div className="dev-items">
            {g.items.map(item => (
              <Item key={item.id} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
