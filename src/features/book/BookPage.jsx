import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Highlighter, Library as LibraryIcon, Search, Store } from "lucide-react";

import AppBar from "../../components/AppBar";
import { parseBookId } from "../../services/books/catalog.js";
import { useBookData } from "./state/useBookData";
import { bookDetails, rememberBook } from "./state/library";
import { GenrePage, SearchResults, StoreFront } from "./components/Store";
import BookDetail from "./components/BookDetail";
import Library from "./components/Library";
import Notes from "./components/Notes";
import Reader from "./components/Reader";
import "./book.css";
import "./identity.css";

const TABS = [
  { id: "store", name: "Store", icon: Store },
  { id: "library", name: "My books", icon: LibraryIcon },
  { id: "notes", name: "Notes", icon: Highlighter },
];

export default function BookPage() {
  const store = useBookData();
  const { data } = store;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const readKey = params.get("read");
  const readId = parseBookId(readKey);
  const bookId = parseBookId(params.get("book"));
  const genre = params.get("genre");
  const q = params.get("q") ?? "";
  const at = Number.parseInt(params.get("at"), 10);
  const requested = params.get("tab");
  const tab = TABS.some(t => t.id === requested) ? requested : "store";

  // The search box follows the address (back and forward included).
  const [query, setQuery] = useState(q);
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setQuery(q);
  }

  // What the reader needs to know about the book it's opening: what you
  // saved, what the page you came from knew, or else a lookup.
  const [given, setGiven] = useState(null);
  const [fetched, setFetched] = useState({ id: null, book: null });
  const savedMeta = readId !== null ? data.books[String(readId)] : null;
  const known = savedMeta ? { ...savedMeta, id: readId } : given && given.id === readId ? given : null;
  useEffect(() => {
    if (readId === null || known) return undefined;
    let live = true;
    bookDetails(readId).then(
      b => live && setFetched({ id: readId, book: b }),
      () => live && setFetched({ id: readId, book: { id: readId, title: "This book", authors: [] } })
    );
    return () => {
      live = false;
    };
  }, [readId, Boolean(known)]); // eslint-disable-line react-hooks/exhaustive-deps
  const readMeta = known ?? (fetched.id === readId ? fetched.book : null);

  const push = useCallback(next => setParams(next, { state: { inApp: true } }), [setParams]);
  const openBook = useCallback(
    book => {
      rememberBook(book);
      push({ book: String(book.id) });
    },
    [push]
  );
  const readBook = useCallback(
    (key, book, block) => {
      if (book) setGiven({ ...book, id: parseBookId(key) });
      push(Number.isInteger(block) ? { read: key, at: String(block) } : { read: key });
    },
    [push]
  );
  const closeReader = useCallback(() => {
    if (location.state?.inApp) navigate(-1);
    else setParams({ book: readKey }, { replace: true });
  }, [location.state, navigate, setParams, readKey]);
  const switchTab = id => {
    setParams(id === "store" ? {} : { tab: id }, { state: { inApp: true } });
    window.scrollTo({ top: 0 });
  };
  const search = e => {
    e.preventDefault();
    const words = query.trim();
    if (words) push({ q: words });
  };

  const reading = readId !== null;
  const planTitle = reading ? `Read ${readMeta?.title ?? "a book"}` : bookId !== null ? `Read ${data.books[String(bookId)]?.title ?? "a book"}` : "Read a book";
  const planHref = bookId !== null ? `/books?read=${encodeURIComponent(String(bookId))}` : undefined;

  return (
    <div className={`bx${reading ? " is-reading" : ""}`}>
      <AppBar appId="bookfox" planTitle={planTitle} planHref={planHref} />

      {reading ? (
        <Reader
          key={readKey}
          bookKey={String(readId)}
          meta={readMeta}
          data={data}
          store={store}
          at={Number.isInteger(at) ? at : null}
          onClose={closeReader}
          onAbout={() => push({ book: String(readId) })}
        />
      ) : (
        <div className="bx-wrap">
          <div className="bx-top">
            <nav className="bx-tabs" aria-label="BookFox sections">
              {TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id && bookId === null && !genre && !q ? "is-on" : ""}
                  aria-current={tab === t.id ? "page" : undefined}
                  onClick={() => switchTab(t.id)}
                >
                  <t.icon size={17} aria-hidden="true" />
                  <span>{t.name}</span>
                </button>
              ))}
            </nav>
            <form className="bx-search" onSubmit={search} role="search">
              <Search size={18} aria-hidden="true" />
              <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search 75,000 free books by title, author or subject" aria-label="Search books" />
            </form>
          </div>

          {bookId !== null ? (
            <BookDetail key={bookId} id={bookId} data={data} store={store} onOpen={openBook} onRead={readBook} />
          ) : q ? (
            <SearchResults q={q} data={data} onOpen={openBook} />
          ) : genre ? (
            <GenrePage genre={genre} data={data} onOpen={openBook} onSearch={words => push({ q: words })} />
          ) : tab === "library" ? (
            <Library data={data} onOpen={openBook} onRead={readBook} onBrowse={() => switchTab("store")} />
          ) : tab === "notes" ? (
            <Notes data={data} onJump={(key, b, book) => readBook(key, book, b)} onBrowse={() => switchTab("store")} />
          ) : (
            <StoreFront data={data} onOpen={openBook} onRead={readBook} onGenre={id => push({ genre: id })} />
          )}
        </div>
      )}
    </div>
  );
}
