import { memo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

const cache = new Map();

function render(tex, display) {
  const k = `${display ? "D" : "I"}${tex}`;
  if (cache.has(k)) return cache.get(k);
  let html;
  try {
    html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
  } catch {
    html = tex;
  }
  if (cache.size > 2000) cache.clear();
  cache.set(k, html);
  return html;
}

export const Tex = memo(function Tex({ tex, display = false, className = "" }) {
  if (!tex) return null;
  return <span className={`mf-tex ${display ? "mf-tex--display" : ""} ${className}`} dangerouslySetInnerHTML={{ __html: render(tex, display) }} />;
});

// Plain text with $inline math$ mixed in.
export const RichText = memo(function RichText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("$") && p.endsWith("$") && p.length > 2 ? <Tex key={i} tex={p.slice(1, -1)} /> : <span key={i}>{p}</span>
      )}
    </>
  );
});
