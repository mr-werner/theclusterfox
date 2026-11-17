// Turns a book's HTML (Project Gutenberg or Standard Ebooks) or plain text
// into BookFox's reading blocks. Runs on the server, so the browser gets a
// small, safe list instead of a page of someone else's HTML.
//
// A block is one of:
//   { t: "p", x, s?, q?, v? }   a paragraph. x is plain text ("\n" for line
//                               breaks), s is [[start, end, "i"|"b"|"sc"]]
//                               styling, q marks a quotation, v verse.
//   { t: "h", l, x, s? }        a heading, l is 1-6.
//   { t: "img", src, alt? }     an illustration.
//   { t: "hr" }                 a section break.
//   { t: "pre", x }             preformatted text, spacing kept.
// Highlights and the saved place point at blocks by index and characters
// by offset into x, so x must never change for a given source file.

const VOID = new Set(["br", "img", "hr", "meta", "link", "input", "wbr", "col", "area", "base", "source", "embed", "param", "track"]);
const SKIP = new Set(["script", "style", "head", "title", "svg", "math", "noscript", "template", "iframe", "object", "nav", "button", "form", "select", "textarea"]);
const BLOCK = new Set(["p", "div", "li", "dt", "dd", "blockquote", "pre", "tr", "section", "article", "header", "footer", "figure", "figcaption", "table", "tbody", "thead", "ul", "ol", "dl", "hgroup", "aside", "body", "main", "h1", "h2", "h3", "h4", "h5", "h6", "caption", "center", "address"]);
const STYLE = { i: "i", em: "i", cite: "i", var: "i", dfn: "i", b: "b", strong: "b" };
const VERSE = /\b(poem|poetry|stanza|verse|lg|song|z3998:poem|z3998:verse|z3998:song|z3998:hymn)\b/i;

const NAMED = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0", mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", laquo: "«", raquo: "»", middot: "·", bull: "•", copy: "©", reg: "®", deg: "°", pound: "£", euro: "€", cent: "¢", sect: "§",
  para: "¶", dagger: "†", Dagger: "‡", times: "×", divide: "÷", frac12: "½", frac14: "¼", frac34: "¾", sup1: "¹", sup2: "²", sup3: "³",
  thinsp: "\u2009", ensp: "\u2002", emsp: "\u2003", zwnj: "", zwj: "", shy: "", prime: "′", Prime: "″", larr: "←", rarr: "→", iexcl: "¡", iquest: "¿",
  aelig: "æ", AElig: "Æ", oelig: "œ", OElig: "Œ", szlig: "ß", ccedil: "ç", Ccedil: "Ç", ntilde: "ñ", Ntilde: "Ñ", oslash: "ø", Oslash: "Ø", aring: "å", Aring: "Å", eth: "ð", thorn: "þ",
};
for (const [base, ch] of Object.entries({ a: "aàáâãäāă", e: "eèéêëēĕ", i: "iìíîïīĭ", o: "oòóôõöōŏ", u: "uùúûüūŭ", y: "yỳýŷÿ" })) {
  const names = ["", "grave", "acute", "circ", "tilde", "uml", "macr", "breve"];
  const forms = base === "e" || base === "i" || base === "u" ? [0, 1, 2, 3, null, 4, 5, 6] : base === "y" ? [0, 1, 2, 3, null, 4] : [0, 1, 2, 3, 4, 5, 6, 7];
  forms.forEach((f, k) => {
    if (!k || f === null || !ch[f]) return;
    NAMED[base + names[k]] = ch[f];
    NAMED[base.toUpperCase() + names[k]] = ch[f].toUpperCase();
  });
}

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[e] ?? m;
  });
}

function attrsOf(raw) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(raw))) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  return out;
}

function resolve(src, base) {
  try {
    const url = new URL(src, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href.replace(/^http:/, "https:") : null;
  } catch {
    return null;
  }
}

/** { blocks, start, end } from a book's HTML. base resolves image paths. */
export function parseHtml(html, base) {
  const blocks = [];
  const stack = []; // { tag, skip, quote, verse, heading, mark }
  let start = 0;
  let end = null;
  let text = "";
  let styles = [];
  let open = []; // [kind, startOffset]
  let pendingImgs = [];
  let inPre = 0;

  const ctx = () => stack[stack.length - 1] ?? {};
  const skipping = () => stack.some(s => s.skip);

  function flush() {
    // Close styles still open and carry them on into the next block.
    const carry = open.map(([k]) => k);
    for (const [k, s] of open) if (text.length > s) styles.push([s, text.length, k]);
    let body = text;
    if (!inPre) body = body.replace(/[ \t]*\n[ \t]*/g, "\n");
    const lead = body.length - body.replace(/^\s+/, "").length;
    body = body.trim();
    const heading = stack.findLast(s => s.heading);
    if (pendingImgs.length && !heading) {
      blocks.push(...pendingImgs);
      pendingImgs = [];
    }
    if (!body && heading && pendingImgs.length) {
      // A heading drawn as a picture: name it from the picture's caption.
      const named = pendingImgs.find(img => img.alt && img.alt.length < 80);
      if (named) body = named.alt.replace(/\s+/g, " ").trim();
    }
    if (body) {
      const s = styles
        .map(([a, b, k]) => [Math.max(0, a - lead), Math.min(body.length, b - lead), k])
        .filter(([a, b]) => b > a);
      const c = ctx();
      const block = inPre ? { t: "pre", x: body } : heading ? { t: "h", l: heading.level, x: body } : { t: "p", x: body };
      if (s.length && !inPre) block.s = s;
      if (!heading && !inPre) {
        if (stack.some(x => x.quote)) block.q = 1;
        if (stack.some(x => x.verse) || c.verse) block.v = 1;
      }
      blocks.push(block);
    }
    text = "";
    styles = [];
    open = carry.map(k => [k, 0]);
  }

  function addText(raw) {
    if (skipping()) return;
    let t = decodeEntities(raw);
    if (!inPre) {
      t = t.replace(/[\s\u00a0]+/g, m => (m.includes("\u00a0") && !/[\n\r\t ]/.test(m) ? "\u00a0" : " "));
      if (!text || /[ \n]$/.test(text)) t = t.replace(/^ /, "");
    }
    text += t;
  }

  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<!(?:DOCTYPE|doctype)[^>]*>|<\?[\s\S]*?\?>|<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g;
  let m;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) {
      addText(m[5]);
      continue;
    }
    if (m[1] !== undefined) {
      addText(m[1]);
      continue;
    }
    if (!m[3]) {
      if (m[0] === "<") addText("<");
      continue;
    }
    const closing = m[2] === "/";
    const tag = m[3].toLowerCase().replace(/^.*:/, "");
    const selfClose = /\/\s*$/.test(m[4] ?? "");

    if (!closing) {
      const a = attrsOf(m[4] ?? "");
      const cls = `${a.class ?? ""} ${a["epub:type"] ?? ""}`;
      if (tag === "br") {
        if (!skipping()) text = text.replace(/ $/, "") + "\n";
        continue;
      }
      if (tag === "img") {
        if (skipping()) continue;
        const src = resolve(a.src ?? "", base);
        if (!src) continue;
        const img = { t: "img", src };
        const alt = (a.alt ?? "").trim();
        if (alt && !/^(image|illustration|decoration|\[?illustration\]?)$/i.test(alt)) img.alt = alt.slice(0, 300);
        if (stack.some(s => s.heading) || text.trim()) pendingImgs.push(img);
        else {
          flush();
          blocks.push(img);
        }
        continue;
      }
      if (tag === "hr") {
        if (skipping()) continue;
        flush();
        if (blocks.length && blocks[blocks.length - 1].t !== "hr" && !/pb|page/i.test(cls)) blocks.push({ t: "hr" });
        continue;
      }
      if (VOID.has(tag) || selfClose) continue;

      const entry = { tag };
      if (SKIP.has(tag) || /\b(pagenum|pageno|page-num|z3998:noteref|noteref|hidden)\b/i.test(cls) || /display:\s*none/i.test(a.style ?? "")) entry.skip = true;
      if (a.id === "pg-footer" && end === null) {
        flush();
        end = blocks.length;
      }
      if (a.id === "pg-header") entry.mark = "header";
      if (tag === "blockquote") entry.quote = true;
      if (VERSE.test(cls)) entry.verse = true;
      if (/^h[1-6]$/.test(tag)) {
        flush();
        entry.heading = true;
        entry.level = Number(tag[1]);
      } else if (BLOCK.has(tag)) {
        if (!stack.some(s => s.heading)) flush();
      } else if ((tag === "td" || tag === "th") && text.trim()) {
        if (!skipping()) text = text.replace(/ $/, "") + " · ";
      }
      if (tag === "pre") {
        flush();
        inPre += 1;
      }
      const kind = STYLE[tag] ?? (/\bsmcap|smallcaps|small-caps|z3998:small-caps\b/i.test(cls) ? "sc" : null);
      if (kind && !skipping()) {
        open.push([kind, text.length]);
        entry.style = kind;
      }
      stack.push(entry);
      continue;
    }

    // Closing tag: unwind to the nearest open element with this name.
    let i = stack.length - 1;
    while (i >= 0 && stack[i].tag !== tag) i--;
    if (i < 0) continue;
    while (stack.length > i) {
      const e = stack[stack.length - 1];
      if (e.style) {
        const k = open.findLastIndex(([kind]) => kind === e.style);
        if (k >= 0) {
          const [kind, s] = open[k];
          if (text.length > s) styles.push([s, text.length, kind]);
          open.splice(k, 1);
        }
      }
      if (e.heading || BLOCK.has(e.tag) || e.tag === "pre") {
        if (e.heading) {
          flush();
          if (pendingImgs.length) {
            // Pictures set inside a heading go just above it.
            const h = blocks.pop();
            blocks.push(...pendingImgs, ...(h ? [h] : []));
            pendingImgs = [];
          }
        } else if (!stack.slice(0, -1).some(s => s.heading)) flush();
      }
      if (e.tag === "pre") inPre = Math.max(0, inPre - 1);
      stack.pop();
      if (e.mark === "header") start = blocks.length;
    }
  }
  flush();
  if (pendingImgs.length) blocks.push(...pendingImgs);
  while (blocks.length && blocks[blocks.length - 1].t === "hr") blocks.pop();
  return { blocks, start: Math.min(start, blocks.length), end: end ?? blocks.length };
}

const HEADING = /^(chapter|book|part|act|scene|stave|letter|volume|canto|section|prologue|epilogue|preface|introduction|contents)\b/i;

/** { blocks, start, end } from a plain-text Gutenberg file. */
export function parseText(raw) {
  const lines = raw.replace(/\r\n?/g, "\n").replace(/^\ufeff/, "").split("\n");
  let startLine = lines.findIndex(l => /^\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(l));
  let endLine = lines.findIndex(l => /^\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i.test(l));
  if (startLine < 0) startLine = -1;
  if (endLine < 0) endLine = lines.length;
  const blocks = [];
  let start = 0;
  let end = null;
  let para = [];
  const flushPara = () => {
    if (!para.length) return;
    const trimmed = para.map(l => l.trim());
    const single = trimmed.join(" ").replace(/\s+/g, " ").trim();
    para = [];
    if (!single) return;
    if (/^[*\s.]+$/.test(single) && single.length < 30) {
      blocks.push({ t: "hr" });
      return;
    }
    const letters = single.replace(/[^A-Za-z]/g, "");
    const shouty = letters.length >= 3 && letters === letters.toUpperCase() && single.length < 70;
    if (trimmed.length <= 2 && single.length < 80 && (HEADING.test(single) || shouty)) {
      blocks.push({ t: "h", l: 2, x: single });
      return;
    }
    // Prose is wrapped near 70 characters; lines that all stop well short are verse.
    const verse = trimmed.length >= 2 && trimmed.slice(0, -1).every(l => l.length < 55);
    blocks.push(verse ? { t: "p", x: trimmed.join("\n"), v: 1 } : { t: "p", x: single });
  };
  lines.forEach((line, i) => {
    if (i === startLine + 1 && startLine >= 0) {
      flushPara();
      start = blocks.length;
    }
    if (i === endLine) {
      flushPara();
      end = blocks.length;
    }
    if (i === startLine || i === endLine) {
      flushPara();
      blocks.push({ t: "p", x: line.trim() });
      return;
    }
    if (!line.trim()) flushPara();
    else para.push(line);
  });
  flushPara();
  return { blocks, start, end: end ?? blocks.length };
}

/** Split blocks into parts that each stay under maxChars of JSON. */
export function splitParts(blocks, maxChars = 1_500_000) {
  const parts = [];
  let cur = [];
  let size = 0;
  for (const b of blocks) {
    const n = JSON.stringify(b).length + 1;
    if (cur.length && size + n > maxChars) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += n;
  }
  parts.push(cur);
  return parts;
}
