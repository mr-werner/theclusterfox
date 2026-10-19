import { useEffect, useState } from "react";
import { Film, LoaderCircle, Tv } from "lucide-react";

import { browseTitles } from "../../../services/watch/watchApi";
import { BROWSE_LISTS } from "../../../services/watch/parse";

const MAX_PAGES = 5;

export default function BrowseGrid({ data, onOpen }) {
  const hasServices = data.services.length > 0;
  const lists = BROWSE_LISTS.filter(list => list.id !== "mine" || hasServices);
  const [listId, setListId] = useState(hasServices ? "mine" : "trending");
  const list = lists.some(l => l.id === listId) ? listId : "trending";
  const providerIds = data.services.map(s => s.id);
  const requestKey = `${list}|${data.region}|${list === "mine" ? providerIds.join(",") : ""}`;
  const [state, setState] = useState({ key: null, items: [], page: 0, error: "", code: "", more: true });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const [id, region, ids] = requestKey.split("|");
    browseTitles(id, region, { providers: ids ? ids.split(",") : [], signal: controller.signal })
      .then(items => setState({ key: requestKey, items, page: 1, error: "", code: "", more: items.length > 0 }))
      .catch(error => {
        if (error.name !== "AbortError") setState({ key: requestKey, items: [], page: 0, error: error.message, code: error.code ?? "", more: false });
      });
    return () => controller.abort();
  }, [requestKey]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = state.page + 1;
      const items = await browseTitles(list, data.region, { providers: list === "mine" ? providerIds : [], page: next });
      const seen = new Set(state.items.map(i => `${i.type}-${i.id}`));
      setState(current => ({
        ...current,
        page: next,
        items: [...current.items, ...items.filter(i => !seen.has(`${i.type}-${i.id}`))],
        more: items.length > 0 && next < MAX_PAGES,
      }));
    } catch {
      setState(current => ({ ...current, more: false }));
    } finally {
      setLoadingMore(false);
    }
  }

  const loading = state.key !== requestKey;

  return (
    <div className="wf-browse">
      <div className="wf-browse-head">
        <h2>Browse</h2>
        <ul className="wf-chip-row" aria-label="Lists">
          {lists.map(item => (
            <li key={item.id}>
              <button type="button" className="wf-chip" aria-pressed={list === item.id} onClick={() => setListId(item.id)}>
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {loading && (
        <p className="wf-muted wf-loading">
          <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading titles…
        </p>
      )}
      {!loading && state.error && (
        <p className="wf-alert">{state.code === "no-key" ? "Browsing isn’t switched on yet: the TMDB key is missing." : state.error}</p>
      )}
      {!loading && !state.error && !state.items.length && <p className="wf-muted">Nothing to show here yet.</p>}

      {!loading && state.items.length > 0 && (
        <>
          <ul className="wf-grid">
            {state.items.map(item => {
              const TypeIcon = item.type === "tv" ? Tv : Film;
              return (
                <li key={`${item.type}-${item.id}`}>
                  <button type="button" className="wf-tile" onClick={() => onOpen(item)}>
                    {item.poster ? (
                      <img src={item.poster} alt="" loading="lazy" width="171" height="256" />
                    ) : (
                      <span className="wf-tile-blank" aria-hidden="true">
                        <TypeIcon size={28} />
                      </span>
                    )}
                    <span className="wf-tile-title">{item.title}</span>
                    <span className="wf-tile-meta">
                      {[item.year, item.type === "tv" ? "Show" : "Movie"].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {state.more && (
            <button type="button" className="wf-btn wf-btn--ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : "Show more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
