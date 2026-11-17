// A tiny XML reader (elements, attributes, text) so music files can be read
// the same way in the browser and in Node tests, with no DOM needed.

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = s =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e] ?? m;
  });

/** Parse XML text into { name, attrs, children, text } nodes; returns the root element. */
export function parseXml(text) {
  const root = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/\s*([^\s>]+)\s*>|<\s*([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const top = stack[stack.length - 1];
    if (m[1] != null) top.text += m[1];
    else if (m[2]) {
      if (stack.length > 1) stack.pop();
    } else if (m[3]) {
      const attrs = {};
      const ar = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a;
      while ((a = ar.exec(m[4]))) attrs[a[1]] = decode(a[2] ?? a[3] ?? "");
      const node = { name: m[3], attrs, children: [], text: "" };
      top.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6]) top.text += decode(m[6]);
  }
  return root.children[0] ?? null;
}

export const kids = (node, name) => (node?.children ?? []).filter(c => c.name === name);
export const kid = (node, name) => (node?.children ?? []).find(c => c.name === name) ?? null;
export const textOf = (node, name) => {
  const n = name ? kid(node, name) : node;
  return n ? n.text.trim() : null;
};
