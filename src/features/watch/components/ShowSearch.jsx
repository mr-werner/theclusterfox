import { useState } from "react";
import { Film, Info, LoaderCircle, Search, Tv, X } from "lucide-react";

import BrowseGrid from "./BrowseGrid";
import TitleDetail from "./TitleDetail";
import WhereToWatch from "./WhereToWatch";
import { myOffers } from "../../../services/watch/parse";
import { searchTitles } from "../../../services/watch/watchApi";

function TitleCard({ title, myServices, onOpen }) {
  const mine = myOffers(title.providers, myServices);
  const TypeIcon = title.type === "tv" ? Tv : Film;

  return (
    <article className={`wf-title${mine.length ? " is-mine" : ""}`}>
      <button type="button" className="wf-poster-btn" onClick={onOpen} aria-label={`Details for ${title.title}`}>
        {title.poster ? (
          <img className="wf-poster" src={title.poster} alt="" loading="lazy" width="92" height="138" />
        ) : (
          <span className="wf-poster wf-poster--empty" aria-hidden="true">
            <TypeIcon size={28} />
          </span>
        )}
      </button>
      <div className="wf-title-body">
        <h3>
          {title.title} {title.year && <span className="wf-muted">({title.year})</span>}
        </h3>
        <p className="wf-type">
          <TypeIcon size={14} aria-hidden="true" /> {title.type === "tv" ? "TV show" : "Movie"}
        </p>
        <WhereToWatch title={title.title} providers={title.providers} myServices={myServices} />
        <button type="button" className="wf-link-btn wf-details-btn" onClick={onOpen}>
          <Info size={14} aria-hidden="true" /> Synopsis and trailer
        </button>
      </div>
    </article>
  );
}

export default function ShowSearch({ data, onPickServices }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState({ status: "idle", items: [], error: "", code: "", query: "" });
  const [onlyMine, setOnlyMine] = useState(false);
  const [open, setOpen] = useState(null);
  const hasServices = data.services.length > 0;
  const searching = result.status !== "idle";

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

  function clear() {
    setQuery("");
    setResult({ status: "idle", items: [], error: "", code: "", query: "" });
  }

  const visible = onlyMine ? result.items.filter(item => myOffers(item.providers, data.services).length) : result.items;

  return (
    <section className="wf-panel">
      <form className="wf-search-row" onSubmit={search} role="search">
        <label className="wf-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              if (!event.target.value) clear();
            }}
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
          searching && (
            <button type="button" className="wf-chip" aria-pressed={onlyMine} onClick={() => setOnlyMine(v => !v)}>
              Only on my services
            </button>
          )
        ) : (
          <p className="wf-muted">
            <button type="button" className="wf-link-btn" onClick={onPickServices}>
              Pick your services
            </button>{" "}
            to see what you can watch right away.
          </p>
        )}
        {searching && (
          <button type="button" className="wf-link-btn" onClick={clear}>
            <X size={14} aria-hidden="true" /> Back to browsing
          </button>
        )}
      </div>

      {!searching && <BrowseGrid data={data} onOpen={setOpen} />}

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

      {searching && visible.length > 0 && (
        <div className="wf-results">
          {visible.map(title => (
            <TitleCard key={`${title.type}-${title.id}`} title={title} myServices={data.services} onOpen={() => setOpen(title)} />
          ))}
        </div>
      )}

      {open && (
        <TitleDetail
          key={`${open.type}-${open.id}`}
          item={open}
          region={data.region}
          myServices={data.services}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
