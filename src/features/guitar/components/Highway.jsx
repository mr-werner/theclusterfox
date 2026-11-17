// The falling notes: six lanes, one per string (low E on the left), notes
// dropping onto the line where you play them. Each gem shows the fret and
// is colored by the finger that frets it. Strums are bars across the
// strings with their direction. Drawn on a canvas, every frame.
import { useEffect, useRef } from "react";
import { STRING_NAMES } from "../data/chords";
import { fingerColor } from "./colors";

const AHEAD = 4.5; // beats visible above the line

export default function Highway({ timeline, player, lefty = false }) {
  const canvas = useRef(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = c.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width;
      h = r.height;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      draw(player.beatRef.current, player.judged.current);
    });
    ro.observe(c);

    function draw(beat, judged) {
      ctx.clearRect(0, 0, w, h);
      const pad = Math.max(10, w * 0.04);
      const laneW = (w - pad * 2) / 6;
      const hitY = h - 34;
      const ppb = (hitY - 10) / AHEAD;
      const laneX = s => pad + laneW * ((lefty ? 5 - s : s) + 0.5);
      const yOf = t => hitY - (t - beat) * ppb;

      // Lanes and strings.
      for (let s = 0; s < 6; s++) {
        const x = laneX(s);
        ctx.fillStyle = s % 2 ? "rgba(255,240,220,0.025)" : "rgba(255,240,220,0.05)";
        ctx.fillRect(x - laneW / 2, 0, laneW, hitY);
        ctx.strokeStyle = "rgba(240,220,190,0.22)";
        ctx.lineWidth = 0.6 + (5 - s) * 0.35;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, hitY);
        ctx.stroke();
      }
      // Beat and bar lines.
      const first = Math.floor(beat - 1);
      for (let b = first; b <= beat + AHEAD + 1; b++) {
        const y = yOf(b);
        if (y < 0 || y > hitY) continue;
        const rel = b - timeline.start;
        const isBar = Math.abs(((b % timeline.barLen) + timeline.barLen) % timeline.barLen) < 1e-6;
        ctx.strokeStyle = isBar ? "rgba(232,164,90,0.35)" : "rgba(255,255,255,0.07)";
        ctx.lineWidth = isBar ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(pad, y);
        ctx.lineTo(w - pad, y);
        ctx.stroke();
        if (isBar && b >= 0) {
          ctx.fillStyle = "rgba(232,164,90,0.7)";
          ctx.font = "600 10px 'JetBrains Mono', monospace";
          ctx.fillText(String(Math.round(b / timeline.barLen) + 1), 2, y - 3);
        }
        void rel;
      }

      // Notes stop at the line instead of sliding under the string names.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, hitY + 8);
      ctx.clip();
      // Events, far ones first so near ones draw on top.
      const evs = timeline.events.filter(e => e.t + e.d >= beat - 0.6 && e.t <= beat + AHEAD + 0.5);
      for (let i = evs.length - 1; i >= 0; i--) {
        const e = evs[i];
        const y = yOf(e.t);
        const state = judged.get(e.id);
        const past = e.t < beat - 0.02;
        const alpha = state === "miss" ? 0.3 : past ? 0.55 : 1;
        if (e.kind === "strum") {
          const strings = e.notes.map(n => n.string);
          const xs = strings.map(laneX);
          const x0 = Math.min(...xs) - laneW * 0.42;
          const x1 = Math.max(...xs) + laneW * 0.42;
          const bh = Math.max(12, Math.min(22, ppb * 0.22));
          ctx.globalAlpha = alpha;
          ctx.fillStyle = state === "hit" ? "#57e389" : e.dir === "U" ? "rgba(232,164,90,0.55)" : "#e8a45a";
          roundRect(ctx, x0, y - bh / 2, x1 - x0, bh, bh / 2);
          ctx.fill();
          ctx.fillStyle = "#1a1210";
          ctx.font = `800 ${Math.round(bh * 0.72)}px 'Bricolage Grotesque', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`${e.dir === "U" ? "↑" : "↓"} ${e.chord}`, (x0 + x1) / 2, y + 1);
          ctx.globalAlpha = 1;
          continue;
        }
        for (const n of e.notes) {
          const x = laneX(n.string);
          const r = Math.max(9, Math.min(laneW * 0.36, 19));
          // Sustain tail.
          const tail = Math.max(0, e.d * ppb - r * 1.2);
          if (tail > 4) {
            ctx.globalAlpha = alpha * 0.45;
            ctx.fillStyle = fingerColor(n.finger);
            roundRect(ctx, x - 3, y - r - tail, 6, tail, 3);
            ctx.fill();
          }
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          if (n.fret === 0) {
            ctx.fillStyle = "#1a1210";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = state === "hit" ? "#57e389" : fingerColor(0);
            ctx.stroke();
          } else {
            ctx.fillStyle = state === "hit" ? "#57e389" : fingerColor(n.finger);
            ctx.fill();
          }
          ctx.fillStyle = n.fret === 0 ? "#efe6d6" : "#140d0b";
          ctx.font = `800 ${Math.round(r * 1.05)}px 'Bricolage Grotesque', sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(n.fret), x, y + 1);
          if (n.fret > 0 && r >= 12) {
            // Finger number in a little badge.
            ctx.beginPath();
            ctx.arc(x + r * 0.78, y - r * 0.78, r * 0.42, 0, Math.PI * 2);
            ctx.fillStyle = "#140d0b";
            ctx.fill();
            ctx.fillStyle = fingerColor(n.finger);
            ctx.font = `800 ${Math.round(r * 0.55)}px 'Bricolage Grotesque', sans-serif`;
            ctx.fillText(String(n.finger), x + r * 0.78, y - r * 0.78 + 0.5);
          }
          ctx.globalAlpha = 1;
        }
      }

      ctx.restore();
      // The line you play on.
      ctx.fillStyle = "rgba(232,164,90,0.16)";
      ctx.fillRect(pad, hitY - 3, w - pad * 2, 6);
      ctx.fillStyle = "#e8a45a";
      ctx.fillRect(pad, hitY - 1, w - pad * 2, 2);
      ctx.font = "700 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let s = 0; s < 6; s++) {
        ctx.fillStyle = "rgba(239,230,214,0.75)";
        ctx.fillText(STRING_NAMES[s], laneX(s), hitY + 10);
      }
    }

    const unsub = player.subscribe(draw);
    return () => {
      unsub();
      ro.disconnect();
    };
  }, [timeline, player, lefty]);

  return <canvas ref={canvas} className="frx-highway" aria-label="Falling notes. Each circle is a note: the number is the fret, the color is the finger." role="img" />;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
