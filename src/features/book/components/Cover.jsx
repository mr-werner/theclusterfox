import { useState } from "react";

import { coverUrls } from "../../../services/books/catalog.js";

// Bound-book colors for covers drawn by BookFox, when a book has no picture
// of its own (or it won't load): leather, cloth and gilt.
const CLOTH = [
  ["#5b1f24", "#e8c77a"],
  ["#1f3b2d", "#e3c983"],
  ["#1d2c4a", "#d9c08a"],
  ["#4a2d18", "#f0d49a"],
  ["#3a1f45", "#e6c98f"],
  ["#2b3a3f", "#ead3a0"],
  ["#6b3a1e", "#f3dcaa"],
  ["#22252b", "#d8b46a"],
];

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A book's cover, falling back through mirrors to a drawn one. */
export default function Cover({ book, size = "medium", className = "", eager = false }) {
  const urls = coverUrls(book.id, size);
  const [i, setI] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [bg, ink] = CLOTH[hash(String(book.id) + book.title) % CLOTH.length];
  const author = (book.authors ?? [])[0] ?? "";
  const drawn = (
    <span className="bx-drawn" style={{ "--cloth": bg, "--gilt": ink }} aria-hidden={i < urls.length && loaded ? "true" : undefined}>
      <span className="bx-drawn-frame">
        <span className="bx-drawn-title">{book.title.length > 70 ? `${book.title.slice(0, 67)}…` : book.title}</span>
        <span className="bx-drawn-rule" />
        <span className="bx-drawn-author">{author}</span>
      </span>
    </span>
  );
  return (
    <span className={`bx-cover ${className}`.trim()}>
      {drawn}
      {i < urls.length && (
        <img
          key={urls[i]}
          src={urls[i]}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={loaded ? "is-loaded" : ""}
          onLoad={e => {
            // Gutenberg serves a 1-pixel image for a few books with no cover.
            if (e.currentTarget.naturalWidth < 20) setI(urls.length);
            else setLoaded(true);
          }}
          onError={() => {
            setLoaded(false);
            setI(n => n + 1);
          }}
        />
      )}
    </span>
  );
}
