// Copy drawings and tables off a tool page into a saved report.
//
// Tools mark what belongs in a report with data attributes:
//   data-report-figure="System sketch"  on an <svg> or a wrapper holding one
//   data-report-table="Line list"       on a <table> or a wrapper holding one
// Pages without the attributes fall back to `fallback` selectors.

const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
];
const DROP = new Set(["script", "foreignobject", "style", "a", "image", "use", "animate", "animatetransform", "set"]);
const MAX_BYTES = 380_000;

const textOf = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

/** Cell text with a space between nested pieces ("4\" Steel" + "ID 102 mm" stay apart). */
function cellText(el) {
  if (el.getClientRects().length && typeof el.innerText === "string") return el.innerText.replace(/\s+/g, " ").trim();
  const parts = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) parts.push(n.nodeValue);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** An <svg> as standalone markup with its computed styles written inline. */
export function svgMarkup(svg) {
  const vb = svg.viewBox?.baseVal;
  const rect = svg.getBoundingClientRect();
  const w = vb?.width || rect.width || 600;
  const h = vb?.height || rect.height || 400;
  const clone = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll("*")];
  const dst = [clone, ...clone.querySelectorAll("*")];
  dst.forEach((el, i) => {
    const tag = el.tagName.toLowerCase();
    if (DROP.has(tag)) {
      el.remove();
      return;
    }
    const cs = window.getComputedStyle(src[i]);
    if (cs.display === "none" && i > 0) {
      el.remove();
      return;
    }
    for (const a of [...el.attributes]) if (/^on/i.test(a.name) || a.name === "class" || /href$/i.test(a.name)) el.removeAttribute(a.name);
    const style = STYLE_PROPS.map((p) => {
      const v = cs.getPropertyValue(p);
      return v && v !== "normal" && v !== "auto" ? `${p}:${v}` : "";
    })
      .filter(Boolean)
      .join(";");
    el.setAttribute("style", style.replace(/"/g, "'"));
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(Math.round(w)));
  clone.setAttribute("height", String(Math.round(h)));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  clone.removeAttribute("role");
  const markup = new XMLSerializer().serializeToString(clone);
  return markup.length <= MAX_BYTES ? { svg: markup, w, h } : null;
}

/** A <table> as { head, rows } text. */
export function tableData(table) {
  const headRow = table.tHead?.rows[0] || (table.rows[0] && [...table.rows[0].cells].every((c) => c.tagName === "TH") ? table.rows[0] : null);
  const head = headRow ? [...headRow.cells].map(cellText) : [];
  const bodyRows = [...table.rows].filter((r) => r !== headRow && !table.tHead?.contains(r));
  return { head, rows: bodyRows.map((r) => [...r.cells].map(cellText)).filter((r) => r.some(Boolean)) };
}

/** The heading just above an element, inside its card. */
function headingFor(el) {
  for (let node = el; node && node.tagName !== "ARTICLE"; node = node.parentElement) {
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (/^H[1-4]$/.test(sib.tagName)) return textOf(sib);
      const inner = sib.querySelectorAll?.("h2, h3, h4");
      if (inner?.length) return textOf(inner[inner.length - 1]);
    }
  }
  return "";
}

const largest = (list) =>
  [...list].sort((a, b) => {
    const area = (s) => (s.viewBox?.baseVal?.width || 0) * (s.viewBox?.baseVal?.height || 0) || s.getBoundingClientRect().width * s.getBoundingClientRect().height;
    return area(b) - area(a);
  })[0];

/**
 * Figures and tables on a page. `fallback` = { figures: [[selector, title]], tables: [[selector, title]] }
 * is used only when nothing on the page carries the data attributes.
 */
export function captureFromPage(root, fallback = {}) {
  if (!root || typeof window === "undefined") return { figures: [], tables: [] };
  const figures = [];
  const tables = [];
  const seenSvg = new Set();
  const seenTable = new Set();

  const addFigure = (el, title) => {
    const svg = el.tagName?.toLowerCase() === "svg" ? el : largest(el.querySelectorAll("svg[viewBox]"));
    if (!svg || seenSvg.has(svg)) return;
    seenSvg.add(svg);
    try {
      const m = svgMarkup(svg);
      if (m) figures.push({ title, ...m });
    } catch {
      // A drawing that can't be copied is left out; the numbers still save.
    }
  };
  const addTables = (el, title) => {
    const list = el.tagName === "TABLE" ? [el] : [...el.querySelectorAll("table")];
    list.forEach((t, k) => {
      if (seenTable.has(t)) return;
      seenTable.add(t);
      const d = tableData(t);
      if (d.rows.length) tables.push({ title: list.length > 1 && k > 0 ? `${title} (${k + 1})` : title, ...d });
    });
  };

  const markedFigures = root.querySelectorAll("[data-report-figure]");
  const markedTables = root.querySelectorAll("[data-report-table]");
  markedFigures.forEach((el) => addFigure(el, el.getAttribute("data-report-figure") || "Figure"));
  markedTables.forEach((el) => addTables(el, el.getAttribute("data-report-table") || "Table"));
  if (!markedFigures.length)
    for (const [sel, title] of fallback.figures || []) root.querySelectorAll(sel).forEach((el) => addFigure(el, title || textOf(el.querySelector("h2, h3")) || "Figure"));
  if (!markedTables.length)
    for (const [sel, title] of fallback.tables || [])
      root.querySelectorAll(sel).forEach((el) => {
        addTables(el, title || (el.tagName === "TABLE" ? "" : textOf(el.querySelector("h2, h3"))) || headingFor(el) || "Table");
      });
  return { figures: figures.slice(0, 4), tables: tables.slice(0, 8) };
}
