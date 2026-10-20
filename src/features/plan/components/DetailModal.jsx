import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ExternalLink, LoaderCircle, Play, Star, Ticket, X } from "lucide-react";

import { fetchGame } from "../../../services/plan/planApi";
import { fetchTitle } from "../../../services/watch/watchApi";
import { formatTime, longDate } from "../model/dates";
import { money } from "../model/entries";
import { useKeyed } from "../state/useLayerData";

const REGIONS = ["US", "CA", "GB", "IE", "AU", "NZ", "FR", "DE", "ES", "IT", "JP", "MX", "BR", "IN"];
const search = (base, q) => `${base}${encodeURIComponent(q)}`;
const gameTime = iso => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null);

function Links({ links }) {
  const shown = links.filter(l => l && l.url);
  if (!shown.length) return null;
  return (
    <div className="pf-detail-links">
      {shown.map((l, i) => (
        <a key={l.url} className={`pf-btn${i === 0 ? " pf-btn-primary" : ""}`} href={l.url} target="_blank" rel="noreferrer">
          {i === 0 ? <Ticket size={15} aria-hidden="true" /> : <ExternalLink size={14} aria-hidden="true" />} {l.label}
        </a>
      ))}
    </div>
  );
}

// YouTube loads only after a tap, so opening the pop-up stays quick.
function YouTube({ videoKey, title }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="pf-trailer">
      {playing ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1`} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${title} trailer`}>
          <img src={`https://i.ytimg.com/vi/${videoKey}/hqdefault.jpg`} alt="" loading="lazy" />
          <span className="pf-play">
            <Play size={22} aria-hidden="true" /> Trailer
          </span>
        </button>
      )}
    </div>
  );
}

function Facts({ items }) {
  const shown = items.filter(Boolean);
  return shown.length ? <p className="pf-detail-facts">{shown.join(" · ")}</p> : null;
}

function MovieDetail({ entry, country }) {
  const m = entry.movie;
  const region = REGIONS.includes(country) ? country : "US";
  const title = useKeyed(`movie:${m.id}:${region}`, signal => fetchTitle("movie", m.id, region, { signal }));
  const t = title.value;
  const providers = t?.providers;
  const where = providers ? [...providers.stream, ...providers.free].map(p => p.name) : [];
  const rentBuy = providers ? [...providers.rent, ...providers.buy].map(p => p.name).filter((n, i, list) => list.indexOf(n) === i) : [];
  return (
    <>
      {t?.trailer ? <YouTube videoKey={t.trailer.key} title={m.title} /> : t?.backdrop && <img className="pf-detail-hero" src={t.backdrop} alt="" />}
      {title.status === "loading" && (
        <p className="pf-note">
          <LoaderCircle size={14} className="spin" aria-hidden="true" /> Loading the trailer and details…
        </p>
      )}
      <Facts items={[m.release === "digital" ? "Out to stream, rent or buy" : "In theaters", t?.runtime && `${t.runtime} min`, ...(t?.genres ?? []).slice(0, 3), t?.rating && `★ ${t.rating}/10`]} />
      {t?.tagline && <p className="pf-detail-tagline">{t.tagline}</p>}
      <p className="pf-detail-text">{t?.overview || m.overview || "No summary yet."}</p>
      {where.length > 0 && <p className="pf-muted">Streaming on {where.slice(0, 4).join(", ")}</p>}
      {rentBuy.length > 0 && <p className="pf-muted">Rent or buy on {rentBuy.slice(0, 4).join(", ")}</p>}
      <Links
        links={[
          m.release !== "digital" && { label: "Showtimes and tickets", url: search("https://www.fandango.com/search?mode=general&q=", m.title) },
          providers?.link && { label: "Where to watch", url: providers.link },
          !t?.trailer && { label: "Find the trailer", url: search("https://www.youtube.com/results?search_query=", `${m.title} official trailer`) },
        ]}
      />
    </>
  );
}

function GameDetail({ entry }) {
  const r = entry.release;
  const game = useKeyed(`game:${r.id}`, signal => fetchGame(r.id, { signal }));
  const g = game.value;
  return (
    <>
      {g?.trailer ? (
        <video className="pf-detail-hero" src={g.trailer.video} poster={g.trailer.poster ?? undefined} controls preload="none" />
      ) : (
        (g?.image ?? r.image) && <img className="pf-detail-hero" src={g?.image ?? r.image} alt="" />
      )}
      {game.status === "loading" && (
        <p className="pf-note">
          <LoaderCircle size={14} className="spin" aria-hidden="true" /> Loading details…
        </p>
      )}
      {game.status === "error" && <p className="pf-note is-warn">{game.error}</p>}
      <Facts items={[(g?.platforms ?? r.platforms).join(", "), ...(g?.genres ?? []).slice(0, 2), g?.developers?.[0], g?.rating, g?.metacritic && `Metacritic ${g.metacritic}`]} />
      {g?.summary && <p className="pf-detail-text">{g.summary.length > 700 ? `${g.summary.slice(0, 700).trim()}…` : g.summary}</p>}
      <Links
        links={[
          ...(g?.stores ?? []).slice(0, 4).map(s => ({ label: `Buy on ${s.name}`, url: s.url })),
          !g?.trailer && { label: "Watch trailers", url: search("https://www.youtube.com/results?search_query=", `${r.title} trailer`) },
          g?.website && { label: "Official site", url: g.website },
          (g?.url ?? r.url) && { label: "More on RAWG", url: g?.url ?? r.url },
        ]}
      />
    </>
  );
}

function NearbyDetail({ entry }) {
  const e = entry.nearby;
  return (
    <>
      {e.image && <img className="pf-detail-hero" src={e.image} alt="" />}
      <Facts
        items={[
          e.time && formatTime(e.time),
          e.venue,
          e.city,
          e.distance != null && `${e.distance} mi away`,
          e.price && (e.price.max > e.price.min ? `${money(e.price.min, e.price.currency)}–${money(e.price.max, e.price.currency)}` : `from ${money(e.price.min, e.price.currency)}`),
          e.status === "offsale" && "Sold out",
          e.genre,
        ]}
      />
      {e.info && <p className="pf-detail-text">{e.info}</p>}
      {e.onsale && new Date(e.onsale) > new Date() && <p className="pf-muted">Tickets go on sale {new Date(e.onsale).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</p>}
      <Links
        links={[
          e.url && { label: "Buy tickets on Ticketmaster", url: e.url },
          e.youtube && { label: "Videos", url: e.youtube },
          e.seatmap && { label: "Seat map", url: e.seatmap },
        ]}
      />
    </>
  );
}

function SportsDetail({ entry }) {
  const g = entry.game;
  const team = t => (
    <span className="pf-team">
      {t.logo && <img src={t.logo} alt="" width="36" height="36" />}
      <strong>{t.name}</strong>
      {g.state !== "pre" && t.score != null && <span className="pf-team-score">{t.score}</span>}
    </span>
  );
  return (
    <>
      <div className="pf-matchup">
        {team(g.away)}
        <span className="pf-muted">at</span>
        {team(g.home)}
      </div>
      <Facts items={[g.league.toUpperCase(), g.state === "pre" ? gameTime(g.start) : g.detail, g.venue, g.venueCity, g.networks?.length && `On ${g.networks.join(", ")}`]} />
      <Links
        links={[
          g.state === "pre" && { label: "Find tickets", url: search("https://www.ticketmaster.com/search?q=", `${g.away.name} ${g.home.name}`) },
          { label: "Game info", url: search("https://www.google.com/search?q=", `${g.away.name} vs ${g.home.name} ${entry.day}`) },
        ]}
      />
    </>
  );
}

/**
 * Pop-up with the details behind a calendar entry: trailers and summaries
 * for movies and games, and ways to buy tickets.
 */
export default function DetailModal({ entry, country, onAdd, onClose }) {
  const dialog = useRef(null);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal?.();
    return () => node?.close?.();
  }, []);

  const kind = entry.movie ? "movie" : entry.release ? "game" : entry.nearby ? "nearby" : entry.game ? "sports" : null;
  const label = { movie: "MOVIE", game: "GAME RELEASE", nearby: "EVENT NEARBY", sports: "GAME" }[kind];
  const title = entry.game ? `${entry.game.away.short} at ${entry.game.home.short}` : entry.title;
  const time = entry.nearby?.time ?? (entry.game?.start && entry.time) ?? null;

  function add() {
    onAdd({
      kind: "event",
      title: entry.movie ? `${entry.title} (movie)` : title,
      day: entry.day,
      time,
      notes: entry.nearby?.url ?? entry.link ?? "",
    });
    setAdded(true);
  }

  return (
    <dialog ref={dialog} className="pf-dialog pf-detail" onCancel={onClose} onClick={e => e.target === dialog.current && onClose()} aria-labelledby="pf-detail-title">
      <div className="pf-form">
        <header className="pf-dialog-head">
          <div>
            <p className="pf-eyebrow">
              {entry.game?.favorite && <Star size={12} aria-hidden="true" />} {label} · {longDate(entry.day).toUpperCase()}
            </p>
            <h2 id="pf-detail-title">{title}</h2>
          </div>
          <button type="button" className="pf-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {kind === "movie" && <MovieDetail entry={entry} country={country} />}
        {kind === "game" && <GameDetail entry={entry} />}
        {kind === "nearby" && <NearbyDetail entry={entry} />}
        {kind === "sports" && <SportsDetail entry={entry} />}
        <footer className="pf-dialog-foot">
          <span className="pf-spacer" />
          <button type="button" className="pf-btn" onClick={add} disabled={added}>
            <CalendarPlus size={15} aria-hidden="true" /> {added ? "Added to your plans" : "Add to my plans"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}
