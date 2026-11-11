// Box layout of a feature control frame, shared by the frame drawings.

/**
 * Lay out a feature control frame. Returns its width and the cells so the page
 * can draw it, highlight a cell and explain it.
 */
export function frameCells({ symbol, tol, dia, mod, datums, datumMods = [], fmtTol }) {
  const h = 30;
  const cells = [{ key: "symbol", w: h }];
  const tolText = fmtTol(tol);
  const tolW = 18 + tolText.length * 8.4 + (dia ? 16 : 0) + (mod && mod !== "RFS" ? 22 : 0);
  cells.push({ key: "tol", w: tolW, tolText });
  datums.forEach((d, i) => {
    const dmod = datumMods[i] === "MMB" || datumMods[i] === "LMB" ? datumMods[i] : null;
    cells.push({ key: `datum${i}`, w: dmod ? h + 18 : h, letter: d, dmod });
  });
  let x = 0;
  for (const c of cells) {
    c.x = x;
    x += c.w;
  }
  return { cells, w: x, h, symbol, dia, mod };
}
