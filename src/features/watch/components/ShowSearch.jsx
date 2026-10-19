import { useState } from "react";
import { ExternalLink, Film, LoaderCircle, Search, Tv } from "lucide-react";

import ProviderLogo from "./ProviderLogo";
import { searchTitles } from "../../../services/watch/watchApi";
import { providerLink } from "../../../services/watch/links";
import { splitByServices } from "../../../services/watch/parse";

function ProviderList({ label, providers, mine, title, fallback }) {
  if (!providers.length) return null;
  return (
    <div className="wf-offer">
      <p className="wf-offer-label">{label}</p>
      <ul className="wf-offer-list">
        {providers.map(provider => (
          <li key={provider.id} className={mine ? "is-mine" : undefined}>
            <a href={providerLink(provider, title, fallback)} target="_blank" rel="noreferrer">
              <ProviderLogo provider={provider} size={24} />
              {provider.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TitleCard({ title, myServices }) {
  const providers = title.providers;
  const stream = providers ? splitByServices(providers.stream, myServices) : { mine: [], other: [] };
  const free = providers ? splitByServices(providers.free, myServices) : { mine: [], other: [] };
  const mine = [...stream.mine, ...free.mine];
  const rentBuy = providers ? [...providers.rent, ...providers.buy.filter(b => !providers.rent.some(r => r.id === b.id))] : [];
  const nowhere = providers && !providers.stream.length && !providers.free.length && !rentBuy.length;
  const TypeIcon = title.type === "tv" ? Tv : Film;

  return (
    <article className={`wf-title${mine.length ? " is-mine" : ""}`}>
      {title.poster ? (
        <img className="wf-poster" src={title.poster} alt="" loading="lazy" width="92" height="138" />
      ) : (
        <div className="wf-poster wf-poster--empty" aria-hidden="true">
          <TypeIcon size={28} />
        </div>
      )}
      <div className="wf-title-body">
        <h3>
          {title.title} {title.year && <span className="wf-muted">({title.year})</span>}
        </h3>
        <p className="wf-type">
          <TypeIcon size={14} aria-hidden="true" /> {title.type === "tv" ? "TV show" : "Movie"}
        </p>
        {mine.length > 0 && <p className="wf-verdict">Watch it on {mine.map(p => p.name).join(", ")}</p>}
        {providers === null && <p className="wf-muted">Couldn’t check where this streams.</p>}
        {nowhere && <p className="wf-muted">Not streaming anywhere in your region right now.</p>}
        {providers && (
          <>
            <ProviderList label="On your services" providers={stream.mine} mine title={title.title} fallback={providers.link} />
            <ProviderList label="Free on your services" providers={free.mine} mine title={title.title} fallback={providers.link} />
            <ProviderList label="Also streaming on" providers={stream.other} title={title.title} fallback={providers.link} />
            <ProviderList label="Free with ads" providers={free.other} title={title.title} fallback={providers.link} />
            <ProviderList label="Rent or buy" providers={rentBuy} title={title.title} fallback={providers.link} />
          </>
        )}
        {providers?.link && (
          <a className="wf-more" href={providers.link} target="_blank" rel="noreferrer">
            Full listing <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
    </article>
  );
}

export default function ShowSearch({ data, onPickServices }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ status: "idle", items: [], error: "", code: "", query: "" });
  const [onlyMine, setOnlyMine] = useState(false);
  const hasServices = data.services.length > 0;

  async function search(event) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    setResult(current => ({ ...current, status: "loading" }));
    try {
      const items = await searchTitles(text, data.region);
      setResult({ status: "ready", items, error: "", code: "", query: text });
    } catch (error) {
      setResult({ status: "error", items: [], error: error.message, code: error.code ?? "", query: text });
    }
  }

  const visible = onlyMine
    ? result.items.filter(item => item.providers && splitByServices([...item.providers.stream, ...item.providers.free], data.services).mine.length)
    : result.items;

  return (
    <section className="wf-panel">
      <form className="wf-search-row" onSubmit={search} role="search">
        <label className="wf-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search a show or movie"
            aria-label="Search a show or movie"
          />
        </label>
        <button type="submit" className="wf-btn" disabled={result.status === "loading"}>
          {result.status === "loading" ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : "Search"}
        </button>
      </form>

      <div className="wf-toolbar">
        {hasServices ? (
          <button type="button" className="wf-chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(v => !v)}>
            Only on my services
          </button>
        ) : (
          <p className="wf-muted">
            <button type="button" className="wf-link-btn" onClick={onPickServices}>
              Pick your services
            </button>{" "}
            to see what you can watch right away.
          </p>
        )}
      </div>

      {result.status === "error" && (
        <p className="wf-alert">
          {result.code === "no-key" ? "Show search isn’t switched on yet. Sports schedules still work." : result.error}
        </p>
      )}

      {result.status === "ready" && !visible.length && (
        <p className="wf-muted">
          {result.items.length
            ? `Nothing for “${result.query}” is on your services.`
            : `No shows or movies found for “${result.query}”.`}
        </p>
      )}

      {visible.length > 0 && (
        <div className="wf-results">
          {visible.map(title => (
            <TitleCard key={`${title.type}-${title.id}`} title={title} myServices={data.services} />
          ))}
        </div>
      )}
    </section>
  );
}
