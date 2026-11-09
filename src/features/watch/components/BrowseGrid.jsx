import { useEffect, useState } from "react";
import { Bookmark, Check, Film, Heart, LoaderCircle, Star, Tv } from "lucide-react";

import { browseTitles, recommendTitles } from "../../../services/watch/watchApi";
import { BROWSE_LISTS, GENRES } from "../../../services/watch/parse";
import Featured from "./Featured";
import PosterRow from "./PosterRow";
import { isFavorite, isIn, toggleFavorite } from "../state/watchStore";

const MAX_PAGES = 5;
const MAX_SEEDS = 10;
// Lists kept on this device rather than fetched.
const LOCAL = ["favorites", "watchlist", "watched"];

function firstList(data) {
  if (data.favorites.length) return "foryou";
  if (data.services.length) return "mine";
  return "trending";
}

export default function BrowseGrid({ data, update, onOpen }) {
  const hasServices = data.services.length > 0;
  const hasFavorites = data.favorites.length > 0;
  const lists = BROWSE_LISTS.filter(
    l =>
      (l.id !== "mine" || hasServices) &&
      (l.id !== "foryou" || hasFavorites) &&
      (!LOCAL.includes(l.id) || data[l.id]?.length > 0)
  );
  const [listId, setListId] = useState(() => firstList(data));
  const [genreId, setGenreId] = useState("");
  const list = lists.some(l => l.id === listId) ? listId : "trending";
  const genreOptions = GENRES.filter(g => (list === "movies" ? g.movie : list === "shows" ? g.tv : true));
  const isLocal = LOCAL.includes(list);
  const usesGenres = list !== "foryou" && !isLocal;
  const genre = usesGenres && genreOptions.some(g => g.id === genreId) ? genreId : "";
  const providerIds = data.services.map(s => s.id);
  const seeds = data.favorites.slice(0, MAX_SEEDS);
  const seedKey = seeds.map(f => `${f.type}:${f.id}`).join(",");
  const requestKey =
    isLocal
      ? list
      : list === "foryou"
        ? `foryou|${seedKey}`
        : `${list}|${data.region}|${genre}|${list === "mine" ? providerIds.join(",") : ""}`;
  const [state, setState] = useState({ key: null, items: [], page: 0, error: "", code: "", more: false });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (LOCAL.includes(requestKey)) return undefined;
    const controller = new AbortController();
    const [id, ...rest] = requestKey.split("|");
    const request =
      id === "foryou"
        ? recommendTitles(
            rest[0].split(",").map(part => {
              const [type, fid] = part.split(":");
              return { type, id: fid };
            }),
            { signal: controller.signal }
          )
        : browseTitles(id, rest[0], {
            genre: rest[1],
            providers: rest[2] ? rest[2].split(",") : [],
            signal: controller.signal,
          });
    request
      .then(items => setState({ key: requestKey, items, page: 1, error: "", code: "", more: id !== "foryou" && items.length > 0 }))
      .catch(error => {
        if (error.name !== "AbortError") setState({ key: requestKey, items: [], page: 0, error: error.message, code: error.code ?? "", more: false });
      });
    return () => controller.abort();
  }, [requestKey]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = state.page + 1;
      const items = await browseTitles(list, data.region, { genre, providers: list === "mine" ? providerIds : [], page: next });
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

  const all = isLocal ? data[list] : state.items;
  const loading = !isLocal && state.key !== requestKey;
  const unseen = all.filter(i => !isIn(data, "watched", i));
  // The marquee: the top title you haven't seen yet.
  const featured = !isLocal && !loading ? (unseen[0] ?? all[0] ?? null) : null;
  const items = featured ? all.filter(i => i !== featured) : all;
  const listName = lists.find(l => l.id === list)?.name ?? "";

  function pickForMe() {
    const pool = unseen.length ? unseen : all;
    if (pool.length) onOpen(pool[Math.floor(Math.random() * pool.length)]);
  }

  return (
    <div className="wf-browse">
      {featured && (
        <Featured
          key={`${featured.type}-${featured.id}`}
          item={featured}
          data={data}
          update={update}
          onOpen={onOpen}
          onPick={all.length > 1 ? pickForMe : null}
          badge={list === "mine" ? "Top pick on your services" : `Top of ${listName}`}
        />
      )}

      {list !== "watchlist" && (
        <PosterRow title="Up next on your watchlist" items={data.watchlist} onOpen={onOpen} onSeeAll={() => setListId("watchlist")} />
      )}

      <div className="wf-browse-head">
        <h2>Browse</h2>
        <button
          type="button"
          className="wf-chip wf-chip--small"
          aria-pressed={data.showRatings}
          onClick={() => update(current => ({ ...current, showRatings: !current.showRatings }))}
        >
          <Star size={13} aria-hidden="true" /> Ratings {data.showRatings ? "on" : "off"}
        </button>
      </div>

      <ul className="wf-chip-row" aria-label="Lists">
        {lists.map(item => (
          <li key={item.id}>
            <button type="button" className="wf-chip" aria-pressed={list === item.id} onClick={() => setListId(item.id)}>
              {item.name}
            </button>
          </li>
        ))}
      </ul>

      {usesGenres && (
        <ul className="wf-chip-row wf-genres-row" aria-label="Categories">
          <li>
            <button type="button" className="wf-chip wf-chip--small" aria-pressed={!genre} onClick={() => setGenreId("")}>
              All
            </button>
          </li>
          {genreOptions.map(g => (
            <li key={g.id}>
              <button type="button" className="wf-chip wf-chip--small" aria-pressed={genre === g.id} onClick={() => setGenreId(g.id)}>
                {g.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {list === "foryou" && (
        <p className="wf-note">Picked from titles people who liked your favorites also enjoyed. The more you favorite, the better it gets.</p>
      )}
      {!hasFavorites && (
        <p className="wf-note">
          Tap the <Heart size={12} aria-hidden="true" /> on anything you love to get a “For you” list.
        </p>
      )}

      {loading && (
        <p className="wf-muted wf-loading">
          <LoaderCircle size={16} className="spin" aria-hidden="true" /> Loading titles…
        </p>
      )}
      {!loading && state.error && !isLocal && (
        <p className="wf-alert">{state.code === "no-key" ? "Browsing isn’t switched on yet: the TMDB key is missing." : state.error}</p>
      )}
      {!loading && !(state.error && !isLocal) && !all.length && <p className="wf-muted">Nothing to show here yet.</p>}

      {!loading && items.length > 0 && (
        <>
          <ul className="wf-grid">
            {items.map(item => {
              const TypeIcon = item.type === "tv" ? Tv : Film;
              const saved = isFavorite(data, item);
              const seen = isIn(data, "watched", item);
              const later = isIn(data, "watchlist", item);
              return (
                <li key={`${item.type}-${item.id}`} className="wf-tile-wrap">
                  <button type="button" className={`wf-tile${seen ? " is-seen" : ""}`} onClick={() => onOpen(item)}>
                    {(seen || later) && (
                      <span className={`wf-badge ${seen ? "is-seen" : "is-later"}`}>
                        {seen ? <Check size={11} aria-hidden="true" /> : <Bookmark size={11} aria-hidden="true" />}
                        {seen ? "Seen" : "Watchlist"}
                      </span>
                    )}
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
                      {data.showRatings && item.rating && (
                        <span className="wf-rating">
                          <Star size={11} aria-hidden="true" /> {item.rating}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="wf-fav"
                    aria-pressed={saved}
                    aria-label={saved ? `Remove ${item.title} from favorites` : `Add ${item.title} to favorites`}
                    onClick={() => update(current => toggleFavorite(current, item))}
                  >
                    <Heart size={16} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {!isLocal && state.more && (
            <button type="button" className="wf-btn wf-btn--ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <LoaderCircle size={17} className="spin" aria-hidden="true" /> : "Show more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
