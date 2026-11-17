import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkCheck, BookOpen, ChevronLeft, ChevronRight, Copy, List, NotebookPen, Trash2, Type, X } from "lucide-react";

import { COLORS, comparePoints, marksFor, newId } from "../state/bookStore";
import { loadText } from "../state/library";
import { blockAtProgress, marksInBlock, minutesLabel, namedSections, progressAt, runs, sectionAt, textOfRange, wordsBetween } from "../model/text";
import { todayKey } from "../model/dates";

const GAP = 56; // space between pages (and between the two pages of a spread)

// ── One paragraph, heading or picture ──────────────────────────────────

const STYLE_CLASS = { i: "s-i", b: "s-b", sc: "s-sc" };

const Block = memo(function Block({ block, index, marks }) {
  if (block.t === "hr") return <hr data-b={index} className="bx-r-hr" />;
  if (block.t === "img") {
    return (
      <figure data-b={index} className="bx-r-fig">
        <img src={block.src} alt={block.alt ?? ""} loading="lazy" />
        {block.alt && block.alt.length > 3 && <figcaption>{block.alt}</figcaption>}
      </figure>
    );
  }
  const parts = runs(block.x, block.s, marks).map((r, i) => {
    const cls = [...r.styles].map(k => STYLE_CLASS[k]).filter(Boolean);
    if (r.mark) cls.push("hl", `c-${r.mark.color}`);
    const noted = r.mark?.note && r.mark.last && r.to === r.mark.to;
    if (noted) cls.push("has-note");
    return cls.length ? (
      <span key={i} className={cls.join(" ")} data-mark={r.mark?.id}>
        {r.text}
      </span>
    ) : (
      r.text
    );
  });
  if (block.t === "h") {
    const H = `h${Math.min(6, Math.max(2, block.l + 1))}`;
    return (
      <H data-b={index} className={`bx-r-h l${block.l}`}>
        {parts}
      </H>
    );
  }
  if (block.t === "pre") {
    return (
      <pre data-b={index} className="bx-r-pre">
        {parts}
      </pre>
    );
  }
  const cls = ["bx-r-p"];
  if (block.q) cls.push("is-quote");
  if (block.v) cls.push("is-verse");
  return (
    <p data-b={index} className={cls.join(" ")}>
      {parts}
    </p>
  );
});

// ── Where a DOM selection falls in the book ─────────────────────────────

function blockOf(node, root) {
  let el = node.nodeType === 1 ? node : node.parentElement;
  while (el && el !== root && !el.hasAttribute?.("data-b")) el = el.parentElement;
  return el && el !== root ? el : null;
}

function pointOf(node, offset, root, atEnd) {
  const el = blockOf(node, root);
  if (!el) return null;
  const r = document.createRange();
  r.setStart(el, 0);
  try {
    r.setEnd(node, offset);
  } catch {
    return null;
  }
  const b = Number(el.getAttribute("data-b"));
  const len = r.toString().length;
  return [b, atEnd ? len : len];
}

function selectionPoints(root) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  let a = pointOf(range.startContainer, range.startOffset, root, false);
  let z = pointOf(range.endContainer, range.endOffset, root, true);
  if (!a || !z) return null;
  if (comparePoints(a, z) > 0) [a, z] = [z, a];
  if (comparePoints(a, z) === 0) return null;
  const rects = [...range.getClientRects()].filter(r => r.width > 0);
  const box = range.getBoundingClientRect();
  return { a, z, top: rects[0]?.top ?? box.top, bottom: rects[rects.length - 1]?.bottom ?? box.bottom, left: box.left, right: box.right, word: sel.toString().trim() };
}

// ── The reader ──────────────────────────────────────────────────────────

export default function Reader({ bookKey, meta, data, store, at, onClose, onAbout }) {
  const [result, setResult] = useState({ attempt: -1, text: null, error: null });
  const [loading, setLoading] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const prefs = data.prefs;
  const saved = data.books[bookKey];
  const text = result.text;
  const error = result.attempt === attempt ? result.error : null;

  useEffect(() => {
    let live = true;
    loadText(bookKey, p => live && setLoading(p)).then(
      t => live && setResult({ attempt, text: t, error: null }),
      e => live && setResult({ attempt, text: null, error: e })
    );
    return () => {
      live = false;
    };
  }, [bookKey, attempt]);

  // Opening a book shelves it as Reading.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || !meta?.title) return;
    opened.current = true;
    store.open({ ...meta, id: saved?.id ?? meta.id });
  }, [meta, saved, store]);

  if (error) {
    return (
      <div className={`bx-reader t-${prefs.theme}`}>
        <div className="bx-r-state">
          <BookOpen size={36} aria-hidden="true" />
          <h2>This book didn't open</h2>
          <p>{error.message}</p>
          <div className="bx-actions">
            <button type="button" className="bx-btn is-primary" onClick={() => setAttempt(n => n + 1)}>
              Try again
            </button>
            <button type="button" className="bx-btn" onClick={onClose}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!text) {
    return (
      <div className={`bx-reader t-${prefs.theme}`}>
        <div className="bx-r-state">
          <div className="bx-r-spinner" aria-hidden="true" />
          <h2>{meta?.title ?? "Opening the book"}</h2>
          <p>{loading > 0 && loading < 1 ? `Downloading… ${Math.round(loading * 100)}%` : "Opening the book…"}</p>
        </div>
      </div>
    );
  }
  return <ReaderBody key={bookKey} bookKey={bookKey} text={text} meta={meta ?? saved} data={data} store={store} at={at} onClose={onClose} onAbout={onAbout} />;
}

function ReaderBody({ bookKey, text, meta, data, store, at, onClose, onAbout }) {
  const { blocks } = text;
  const prefs = data.prefs;
  const saved = data.books[bookKey];
  const secs = useMemo(() => namedSections(blocks, { start: text.start, end: text.end }), [blocks, text.start, text.end]);
  const marks = useMemo(() => marksFor(data, bookKey), [data, bookKey]);
  const highlights = useMemo(() => marks.filter(m => m.kind === "hl"), [marks]);

  const firstBlock = Number.isInteger(at) && at < blocks.length ? at : saved?.pos?.b < blocks.length ? saved.pos.b : text.start ?? 0;
  const [sec, setSec] = useState(() => sectionAt(secs, firstBlock));
  const [cur, setCur] = useState(firstBlock); // first block in view
  const curRef = useRef(firstBlock);
  useEffect(() => {
    curRef.current = cur;
  }, [cur]);
  const target = useRef({ b: firstBlock, flash: Number.isInteger(at) });
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState(null); // "contents" | "notes" | "look"
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null); // { id, top, bottom }
  const [, setTick] = useState(0);

  const paged = prefs.mode === "pages";
  const section = secs[sec];
  const { place: savePlace, log: logReading } = store;
  const contentRef = useRef(null);
  const viewRef = useRef(null);
  const [spread, setSpread] = useState(1);

  // ── Layout: how many pages this chapter takes ──
  const measure = useCallback(() => {
    const el = contentRef.current;
    const view = viewRef.current;
    if (!paged || !el || !view) return;
    const w = view.clientWidth;
    const n = w >= 980 ? 2 : 1;
    setSpread(n);
    const stride = w + GAP;
    const last = el.lastElementChild;
    if (!last) return setPages(1);
    const left = el.getBoundingClientRect().left;
    const right = Math.max(...[...el.children].slice(-3).map(c => c.getBoundingClientRect().right));
    setPages(Math.max(1, Math.ceil((right - left + GAP / 2) / stride)));
  }, [paged]);

  const pageOfBlock = useCallback(
    b => {
      const el = contentRef.current;
      const view = viewRef.current;
      if (!el || !view) return 0;
      const node = el.querySelector(`[data-b="${b}"]`);
      if (!node) return 0;
      const stride = view.clientWidth + GAP;
      const x = node.getBoundingClientRect().left - el.getBoundingClientRect().left;
      return Math.max(0, Math.floor((x + 4) / stride));
    },
    []
  );

  // Put the reader at the target block once the chapter is drawn.
  useLayoutEffect(() => {
    const t = target.current;
    if (!t) return;
    const el = contentRef.current;
    if (!el) return;
    if (paged) {
      measure();
      const p = t.b === "end" ? Infinity : pageOfBlock(t.b);
      setPage(p);
    } else {
      if (t.b === "end") window.scrollTo(0, document.body.scrollHeight);
      else {
        const node = el.querySelector(`[data-b="${t.b}"]`);
        if (node) window.scrollTo(0, Math.max(0, node.getBoundingClientRect().top + window.scrollY - 90));
        else window.scrollTo(0, 0);
      }
    }
    if (t.flash && t.b !== "end") {
      const node = el.querySelector(`[data-b="${t.b}"]`);
      node?.classList.add("is-flash");
      setTimeout(() => node?.classList.remove("is-flash"), 1800);
    }
    target.current = null;
  }, [sec, paged, measure, pageOfBlock]);

  // A chapter that got shorter (bigger type, say) keeps you on its last page.
  const shownPage = Math.min(page, Math.max(0, pages - 1));

  // Re-measure when the window, the type or pictures change size.
  useEffect(() => {
    if (!paged) return undefined;
    const view = viewRef.current;
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measure();
        setPage(pageOfBlock(curRef.current));
      });
    };
    const ro = new ResizeObserver(again);
    if (view) ro.observe(view);
    const imgs = contentRef.current?.querySelectorAll("img") ?? [];
    imgs.forEach(img => img.addEventListener("load", measure));
    document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      imgs.forEach(img => img.removeEventListener("load", measure));
    };
  }, [paged, sec, prefs.size, prefs.font, prefs.spacing, measure, pageOfBlock]);

  // ── Which block is in view ──
  const findCurrent = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const kids = el.children;
    let found = null;
    if (paged) {
      // The first block that starts on this page, so coming back to the
      // saved place lands on this page, not the one before.
      const view = viewRef.current.getBoundingClientRect();
      let spill = null;
      for (const k of kids) {
        const first = k.getClientRects()[0] ?? k.getBoundingClientRect();
        if (first.left >= view.left - 2 && first.left < view.right) {
          found = k;
          break;
        }
        const r = k.getBoundingClientRect();
        if (!spill && r.right > view.left + 2 && r.left < view.right) spill = k;
      }
      found ??= spill;
    } else {
      // Binary search: the first block whose bottom is below the top bar.
      let lo = 0;
      let hi = kids.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (kids[mid].getBoundingClientRect().bottom > 80) hi = mid;
        else lo = mid + 1;
      }
      found = kids[lo];
    }
    const b = Number(found?.getAttribute("data-b"));
    if (Number.isInteger(b)) setCur(b);
  }, [paged]);

  useEffect(() => {
    if (paged) {
      const t = setTimeout(findCurrent, 320);
      return () => clearTimeout(t);
    }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(findCurrent);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    findCurrent();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [paged, shownPage, sec, findCurrent]);

  // ── Save the place (and finish the book) ──
  const progress = progressAt(text, cur);
  useEffect(() => {
    const t = setTimeout(() => savePlace(bookKey, cur, progress), 700);
    return () => clearTimeout(t);
  }, [bookKey, cur, progress, savePlace]);

  // ── Reading time, for the goal and PlanFox ──
  const activity = useRef(0);
  const startProgress = useRef(progress);
  const pending = useRef(0);
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  useEffect(() => {
    activity.current = Date.now();
    const bump = () => (activity.current = Date.now());
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, bump, { passive: true }));
    const flush = () => {
      if (pending.current < 5) return;
      logReading({ day: todayKey(), book: bookKey, secs: Math.round(pending.current), from: startProgress.current, to: progressRef.current });
      pending.current = 0;
    };
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - activity.current < 150000) pending.current += 10;
      if (pending.current >= 60) flush();
    }, 10000);
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      events.forEach(e => window.removeEventListener(e, bump));
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [bookKey, logReading]);

  // ── Moving around ──
  const goSection = useCallback(
    (i, where = "start") => {
      if (i < 0 || i >= secs.length) return;
      target.current = { b: where === "end" ? "end" : where === "start" ? secs[i].from : where, flash: typeof where === "number" };
      setSel(null);
      setEditing(null);
      setPage(0);
      setSec(i);
      setCur(typeof where === "number" ? where : secs[i].from);
    },
    [secs]
  );

  const jumpTo = useCallback(
    (b, flash = true) => {
      const i = sectionAt(secs, b);
      if (i === sec) {
        target.current = { b, flash };
        // Same chapter: move without redrawing it.
        const el = contentRef.current;
        if (paged) setPage(pageOfBlock(b));
        else {
          const node = el?.querySelector(`[data-b="${b}"]`);
          if (node) window.scrollTo({ top: Math.max(0, node.getBoundingClientRect().top + window.scrollY - 90), behavior: "smooth" });
        }
        if (flash) {
          const node = el?.querySelector(`[data-b="${b}"]`);
          node?.classList.add("is-flash");
          setTimeout(() => node?.classList.remove("is-flash"), 1800);
        }
        target.current = null;
        setCur(b);
      } else goSection(i, b);
      setPanel(null);
    },
    [secs, sec, paged, pageOfBlock, goSection]
  );

  const next = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSel(null);
    setEditing(null);
    if (paged && shownPage < pages - 1) setPage(shownPage + 1);
    else goSection(sec + 1);
  }, [paged, shownPage, pages, sec, goSection]);
  const prev = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSel(null);
    setEditing(null);
    if (paged && shownPage > 0) setPage(shownPage - 1);
    else if (sec > 0) goSection(sec - 1, paged ? "end" : "start");
  }, [paged, shownPage, sec, goSection]);

  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.("input, textarea, select")) return;
      if (e.key === "Escape") {
        if (editing || sel) {
          setEditing(null);
          setSel(null);
        } else if (panel) setPanel(null);
        else onClose();
        return;
      }
      if (!paged) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, next, prev, panel, editing, sel, onClose]);

  // Swipe to turn pages.
  const swipe = useRef(null);
  const onPointerDown = e => {
    if (e.pointerType === "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() };
  };
  const onPointerUp = e => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || !paged) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - s.t < 700 && window.getSelection()?.isCollapsed) {
      swipe.current = "swiped";
      if (dx < 0) next();
      else prev();
    }
  };

  // ── Selecting and highlighting ──
  useEffect(() => {
    let t = 0;
    const check = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const root = contentRef.current;
        if (!root) return;
        const p = selectionPoints(root);
        setSel(p);
        if (p) setEditing(null);
      }, 220);
    };
    document.addEventListener("selectionchange", check);
    return () => {
      document.removeEventListener("selectionchange", check);
      clearTimeout(t);
    };
  }, []);

  const addHighlight = (color, withNote = false) => {
    if (!sel) return;
    const id = newId("h");
    store.mark({ id, book: bookKey, kind: "hl", a: sel.a, z: sel.z, color, note: "", text: textOfRange(blocks, sel.a, sel.z) });
    window.getSelection()?.removeAllRanges();
    if (withNote) setEditing({ id, top: sel.top, bottom: sel.bottom, focus: true });
    setSel(null);
  };

  const copySelection = async () => {
    const t = window.getSelection()?.toString() ?? "";
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      /* clipboard blocked */
    }
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const onContentClick = e => {
    if (swipe.current === "swiped") {
      swipe.current = null;
      return;
    }
    const markEl = e.target.closest?.("[data-mark]");
    if (markEl) {
      const r = markEl.getBoundingClientRect();
      setEditing({ id: markEl.getAttribute("data-mark"), top: r.top, bottom: r.bottom });
      setSel(null);
      return;
    }
    if (window.getSelection && !window.getSelection().isCollapsed) return;
    if (editing) {
      setEditing(null);
      return;
    }
    if (panel) {
      setPanel(null);
      return;
    }
    const w = window.innerWidth;
    if (paged && e.clientX < w * 0.28) prev();
    else if (paged && e.clientX > w * 0.72) next();
    else setChrome(c => !c);
  };

  // ── Bookmarks ──
  const bookmarks = marks.filter(m => m.kind === "bm");
  const here = bookmarks.find(m => m.a[0] >= cur && m.a[0] <= cur + 2);
  const toggleBookmark = () => {
    if (here) store.unmark(here.id);
    else {
      const first = blocks.slice(cur, cur + 6).find(b => b.x)?.x ?? "";
      store.mark({ id: newId("b"), book: bookKey, kind: "bm", a: [cur, 0], z: [cur, 0], text: first.slice(0, 200), label: `${section.title} · ${Math.round(progress * 100)}%` });
    }
    setTick(n => n + 1);
  };

  const editingMark = editing ? data.marks[editing.id] : null;

  const sectionMarks = useMemo(() => {
    const out = new Map();
    for (let b = section.from; b < section.to; b++) {
      const list = marksInBlock(highlights, b, blocks[b].x?.length ?? 0);
      if (list.length) out.set(b, list);
    }
    return out;
  }, [section, highlights, blocks]);

  const leftInChapter = wordsBetween(blocks, cur, section.to);
  const isLast = sec === secs.length - 1 || secs[sec + 1]?.extra && secs[sec + 1].from >= (text.end ?? blocks.length);
  const atEnd = paged ? shownPage >= pages - 1 : true;
  const finished = saved?.shelf === "done";

  const styleVars = {
    "--r-size": `${prefs.size}px`,
    "--r-lh": prefs.spacing,
    "--r-measure": `${prefs.width}em`,
    "--r-gap": `${GAP}px`,
    "--r-cols": spread,
  };

  return (
    <div className={`bx-reader t-${prefs.theme} f-${prefs.font}${paged ? " is-paged" : " is-scroll"}${chrome ? " show-chrome" : ""}`} style={styleVars}>
      <header className="bx-r-top">
        <button type="button" className="bx-r-icon" onClick={onClose} aria-label="Close the book" title="Close">
          <ChevronLeft size={22} />
        </button>
        <button type="button" className="bx-r-title" onClick={onAbout} title="About this book">
          <strong>{meta?.title}</strong>
          <span>{section.title}</span>
        </button>
        <div className="bx-r-tools">
          <button type="button" className={`bx-r-icon${panel === "contents" ? " is-on" : ""}`} onClick={() => setPanel(p => (p === "contents" ? null : "contents"))} aria-label="Contents" title="Contents">
            <List size={20} />
          </button>
          <button type="button" className={`bx-r-icon${panel === "notes" ? " is-on" : ""}`} onClick={() => setPanel(p => (p === "notes" ? null : "notes"))} aria-label="Highlights and notes" title="Highlights and notes">
            <NotebookPen size={19} />
            {marks.length > 0 && <span className="bx-r-count">{marks.length}</span>}
          </button>
          <button type="button" className={`bx-r-icon${panel === "look" ? " is-on" : ""}`} onClick={() => setPanel(p => (p === "look" ? null : "look"))} aria-label="Page style" title="Page style">
            <Type size={19} />
          </button>
          <button type="button" className={`bx-r-icon${here ? " is-on" : ""}`} onClick={toggleBookmark} aria-label={here ? "Remove bookmark" : "Bookmark this page"} title={here ? "Remove bookmark" : "Bookmark this page"}>
            {here ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
          </button>
        </div>
      </header>

      <main className="bx-r-main" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onClick={onContentClick}>
        {paged && here && <span className="bx-r-ribbon" aria-hidden="true" />}
        <div className="bx-r-view" ref={viewRef}>
          <div className="bx-r-content" ref={contentRef} style={paged ? { transform: `translateX(calc(${-shownPage} * (100% + ${GAP}px)))` } : undefined}>
            {blocks.slice(section.from, section.to).map((b, i) => (
              <Block key={section.from + i} block={b} index={section.from + i} marks={sectionMarks.get(section.from + i)} />
            ))}
          </div>
        </div>
        {!paged && (
          <ChapterEnd sec={sec} secs={secs} isLast={isLast} finished={finished} onNext={() => goSection(sec + 1)} onFinish={() => store.shelve(meta, "done")} />
        )}
      </main>

      {paged && atEnd && isLast && (
        <div className="bx-r-endcard">
          <ChapterEnd sec={sec} secs={secs} isLast finished={finished} onNext={() => {}} onFinish={() => store.shelve(meta, "done")} />
        </div>
      )}

      <footer className="bx-r-foot">
        {paged && (
          <button type="button" className="bx-r-icon" onClick={prev} aria-label="Previous page" disabled={sec === 0 && shownPage === 0}>
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="bx-r-progress">
          <div className="bx-r-bar">
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <p>
            {Math.round(progress * 100)}%{paged ? ` · page ${shownPage + 1} of ${pages} in this chapter` : ""}
            {leftInChapter > 40 ? ` · ${minutesLabel(leftInChapter)} left in chapter` : ""}
          </p>
        </div>
        {paged && (
          <button type="button" className="bx-r-icon" onClick={next} aria-label="Next page" disabled={atEnd && sec === secs.length - 1}>
            <ChevronRight size={20} />
          </button>
        )}
      </footer>

      {sel && <SelectionMenu sel={sel} onColor={addHighlight} onNote={() => addHighlight("yellow", true)} onCopy={copySelection} />}
      {editingMark && <MarkEditor key={editingMark.id} mark={editingMark} anchor={editing} store={store} onClose={() => setEditing(null)} />}

      {panel && (
        <aside className={`bx-r-panel is-${panel}`} aria-label={panel}>
          <header>
            <h2>{panel === "contents" ? "Contents" : panel === "notes" ? "Highlights & notes" : "Page style"}</h2>
            <button type="button" className="bx-r-icon" onClick={() => setPanel(null)} aria-label="Close">
              <X size={20} />
            </button>
          </header>
          {panel === "contents" && <Contents secs={secs} sec={sec} progress={progress} onSection={i => (goSection(i), setPanel(null))} onProgress={p => jumpTo(blockAtProgress(text, p), false)} />}
          {panel === "notes" && <BookMarks marks={marks} secs={secs} onJump={b => jumpTo(b)} store={store} />}
          {panel === "look" && <Look prefs={prefs} onChange={store.prefs} />}
        </aside>
      )}
    </div>
  );
}

function ChapterEnd({ sec, secs, isLast, finished, onNext, onFinish }) {
  if (isLast) {
    return (
      <div className="bx-r-end">
        <p className="bx-r-fleuron" aria-hidden="true">
          ❦
        </p>
        <h3>The end</h3>
        {finished ? <p>On your Finished shelf.</p> : (
          <button type="button" className="bx-btn is-primary" onClick={onFinish}>
            Mark as finished
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="bx-r-end">
      <button type="button" className="bx-btn" onClick={onNext}>
        Next: {secs[sec + 1]?.title} <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function place(anchor, height = 60) {
  // Below the selection when there's room (the phone's own menu sits above it).
  const below = anchor.bottom + 12;
  const top = below + height < window.innerHeight - 70 ? below : Math.max(64, anchor.top - height - 12);
  return { top };
}

function SelectionMenu({ sel, onColor, onNote, onCopy }) {
  const single = /^[\p{L}'’-]{2,40}$/u.test(sel.word);
  return (
    <div className="bx-r-menu" style={place(sel)} role="toolbar" aria-label="Highlight" onPointerDown={e => e.preventDefault()}>
      {COLORS.map(c => (
        <button key={c.id} type="button" className={`bx-swatch c-${c.id}`} onClick={() => onColor(c.id)} aria-label={`Highlight ${c.name.toLowerCase()}`} title={`Highlight ${c.name.toLowerCase()}`} />
      ))}
      <span className="bx-r-menu-sep" />
      <button type="button" onClick={onNote}>
        <NotebookPen size={16} aria-hidden="true" /> Note
      </button>
      <button type="button" onClick={onCopy} aria-label="Copy">
        <Copy size={16} aria-hidden="true" />
      </button>
      {single && (
        <a href={`https://en.wiktionary.org/wiki/${encodeURIComponent(sel.word.toLowerCase())}`} target="_blank" rel="noreferrer">
          Define
        </a>
      )}
    </div>
  );
}

function MarkEditor({ mark, anchor, store, onClose }) {
  const [note, setNote] = useState(mark.note);
  const area = useRef(null);
  useEffect(() => {
    if (anchor.focus) area.current?.focus();
  }, [anchor.focus]);
  const save = () => {
    if (note !== mark.note) store.mark({ ...mark, note });
    onClose();
  };
  return (
    <div className="bx-r-editor" style={place(anchor, 220)} role="dialog" aria-label="Edit highlight">
      <div className="bx-r-editor-row">
        {COLORS.map(c => (
          <button key={c.id} type="button" className={`bx-swatch c-${c.id}${mark.color === c.id ? " is-on" : ""}`} onClick={() => store.mark({ ...mark, color: c.id, note })} aria-label={c.name} />
        ))}
        <span className="bx-r-menu-sep" />
        <button type="button" className="bx-r-icon" onClick={() => store.unmark(mark.id)} aria-label="Delete highlight" title="Delete highlight">
          <Trash2 size={17} />
        </button>
      </div>
      <textarea ref={area} value={note} onChange={e => setNote(e.target.value)} placeholder="Write a note…" rows={3} onKeyDown={e => (e.key === "Enter" && (e.metaKey || e.ctrlKey) ? save() : null)} />
      <div className="bx-r-editor-row is-end">
        <button type="button" className="bx-btn is-small" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="bx-btn is-small is-primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

function Contents({ secs, sec, progress, onSection, onProgress }) {
  const list = useRef(null);
  const [drag, setDrag] = useState(null);
  useEffect(() => {
    list.current?.querySelector(".is-on")?.scrollIntoView({ block: "center" });
  }, []);
  const shown = secs.map((s, i) => ({ ...s, i })).filter(s => !s.continued || s.i === sec);
  return (
    <>
      <div className="bx-r-slider">
        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round((drag ?? progress) * 1000)}
          onChange={e => setDrag(Number(e.target.value) / 1000)}
          onPointerUp={() => drag !== null && (onProgress(drag), setDrag(null))}
          onKeyUp={() => drag !== null && (onProgress(drag), setDrag(null))}
          aria-label="Jump through the book"
        />
        <span>{Math.round((drag ?? progress) * 100)}%</span>
      </div>
      <ol className="bx-r-toc" ref={list}>
        {shown.map(s => (
          <li key={s.i} className={`${s.i === sec ? "is-on" : ""} lv${Math.min(4, s.level)}${s.extra ? " is-extra" : ""}`}>
            <button type="button" onClick={() => onSection(s.i)}>
              {s.title}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

function BookMarks({ marks, secs, onJump, store }) {
  if (!marks.length) return <p className="bx-r-hint">Select any words to highlight them or add a note. Tap the bookmark at the top to keep a page.</p>;
  return (
    <ul className="bx-r-marks">
      {marks.map(m => (
        <li key={m.id} className={`c-${m.color} is-${m.kind}`}>
          <button type="button" onClick={() => onJump(m.a[0])}>
            <small>{secs[sectionAt(secs, m.a[0])]?.title}</small>
            {m.kind === "bm" ? (
              <span className="bx-r-marks-bm">
                <Bookmark size={14} aria-hidden="true" /> {m.text.slice(0, 120) || "Bookmark"}
              </span>
            ) : (
              <q>{m.text.length > 260 ? `${m.text.slice(0, 257)}…` : m.text}</q>
            )}
            {m.note && <em>{m.note}</em>}
          </button>
          <button type="button" className="bx-r-icon" onClick={() => store.unmark(m.id)} aria-label="Delete">
            <Trash2 size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

const THEME_NAMES = { paper: "Paper", sepia: "Sepia", night: "Night" };
const FONT_NAMES = { serif: "Book", sans: "Modern", mono: "Typewriter" };

function Look({ prefs, onChange }) {
  return (
    <div className="bx-r-look">
      <div className="bx-r-look-row">
        <span>Page</span>
        <div className="bx-seg">
          {Object.entries(THEME_NAMES).map(([id, name]) => (
            <button key={id} type="button" className={`sw-${id}${prefs.theme === id ? " is-on" : ""}`} onClick={() => onChange({ theme: id })}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="bx-r-look-row">
        <span>Type</span>
        <div className="bx-seg">
          {Object.entries(FONT_NAMES).map(([id, name]) => (
            <button key={id} type="button" className={`ff-${id}${prefs.font === id ? " is-on" : ""}`} onClick={() => onChange({ font: id })}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="bx-r-look-row">
        <span>Size</span>
        <div className="bx-seg">
          <button type="button" onClick={() => onChange({ size: prefs.size - 1 })} aria-label="Smaller text" disabled={prefs.size <= 13}>
            A−
          </button>
          <output>{prefs.size}</output>
          <button type="button" onClick={() => onChange({ size: prefs.size + 1 })} aria-label="Larger text" disabled={prefs.size >= 32}>
            A+
          </button>
        </div>
      </div>
      <div className="bx-r-look-row">
        <span>Lines</span>
        <div className="bx-seg">
          {[
            [1.4, "Tight"],
            [1.6, "Normal"],
            [1.9, "Airy"],
          ].map(([v, name]) => (
            <button key={v} type="button" className={Math.abs(prefs.spacing - v) < 0.05 ? "is-on" : ""} onClick={() => onChange({ spacing: v })}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="bx-r-look-row">
        <span>Turn</span>
        <div className="bx-seg">
          <button type="button" className={prefs.mode === "pages" ? "is-on" : ""} onClick={() => onChange({ mode: "pages" })}>
            Pages
          </button>
          <button type="button" className={prefs.mode === "scroll" ? "is-on" : ""} onClick={() => onChange({ mode: "scroll" })}>
            Scroll
          </button>
        </div>
      </div>
      {prefs.mode === "scroll" && (
        <div className="bx-r-look-row">
          <span>Width</span>
          <input type="range" min="28" max="50" value={prefs.width} onChange={e => onChange({ width: Number(e.target.value) })} aria-label="Line length" />
        </div>
      )}
      <p className="bx-r-hint">Your page style is saved to your account, so every device reads the same way.</p>
    </div>
  );
}
