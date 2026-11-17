import { lazy, Suspense, useMemo, useState } from "react";
import { Bookmark, FileDown, Highlighter, NotebookPen, Search } from "lucide-react";

import { marksFor } from "../state/bookStore";
import { readHref } from "../model/planLink";
import { marksMarkdown } from "../model/text";

// "Add to Study" comes from StudyFox; it appears here once StudyFox is part
// of the site. Until then this finds nothing and the button stays hidden.
const studyModules = import.meta.glob("../../../components/AddToStudy.jsx");
const studyLoader = Object.values(studyModules)[0];
const AddToStudy = studyLoader ? lazy(studyLoader) : null;

const authorOf = b => (b.authors?.length ? b.authors.join(", ") : "Anonymous");


function saveFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Every highlight, note and bookmark, book by book. */
export default function Notes({ data, onJump, onBrowse }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return Object.entries(data.books)
      .map(([key, book]) => {
        const marks = marksFor(data, key).filter(m => !words.length || words.every(w => `${m.text} ${m.note} ${book.title}`.toLowerCase().includes(w)));
        return { key, book, marks, last: marks.reduce((t, m) => (m.at > t ? m.at : t), "") };
      })
      .filter(g => g.marks.length)
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [data, q]);

  const any = Object.keys(data.marks).length > 0;
  if (!any) {
    return (
      <section className="bx-page bx-empty-state">
        <Highlighter size={40} aria-hidden="true" />
        <h1>No highlights yet</h1>
        <p>While you read, select any words to highlight them in four colors or write a note. They all collect here, and you can save them or study them.</p>
        <button type="button" className="bx-btn is-primary" onClick={onBrowse}>
          Find something to read
        </button>
      </section>
    );
  }

  return (
    <section className="bx-page">
      <header className="bx-page-head">
        <p className="bx-kicker">Notes</p>
        <h1>Highlights & notes</h1>
        <label className="bx-filter">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search your notes" />
        </label>
      </header>
      {groups.map(({ key, book, marks }) => (
        <section key={key} className="bx-note-book">
          <header>
            <div>
              <h2>{book.title}</h2>
              <p>
                {authorOf(book)} · {marks.length} {marks.length === 1 ? "mark" : "marks"}
              </p>
            </div>
            <div className="bx-note-tools">
              {AddToStudy && marks.some(m => m.kind === "hl") && (
                <Suspense fallback={null}>
                  <AddToStudy app="bookfox" deck={key} title={book.title} compact />
                </Suspense>
              )}
              <button type="button" className="bx-btn is-small" onClick={() => saveFile(`${book.title.replace(/[^\w\s-]/g, "").trim() || "notes"} - notes.md`, marksMarkdown(book, marksFor(data, key)))}>
                <FileDown size={15} aria-hidden="true" /> Save as Markdown
              </button>
            </div>
          </header>
          <ul className="bx-note-list">
            {marks.map(m => (
              <li key={m.id} className={`bx-note is-${m.kind} c-${m.color}`}>
                <a
                  href={`${readHref(key)}&at=${m.a[0]}`}
                  onClick={e => {
                    e.preventDefault();
                    onJump(key, m.a[0], book);
                  }}
                >
                  {m.kind === "bm" ? (
                    <span className="bx-note-bm">
                      <Bookmark size={15} aria-hidden="true" /> {m.label || "Bookmark"}
                    </span>
                  ) : (
                    <blockquote>{m.text}</blockquote>
                  )}
                  {m.note && (
                    <p className="bx-note-text">
                      <NotebookPen size={14} aria-hidden="true" /> {m.note}
                    </p>
                  )}
                  <time dateTime={m.at}>{new Date(m.at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
