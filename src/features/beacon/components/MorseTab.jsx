import { useEffect, useMemo, useRef, useState } from "react";
import { Delete, Play, Repeat, Square } from "lucide-react";

import { MAX_MESSAGE, MORSE, encode, readKeying, unitMs } from "../model/morse";
import { flashesTooFast } from "../model/signals";

const pretty = code => code.replaceAll(".", "·").replaceAll("-", "─");

export default function MorseTab({ prefs, setPrefs, onSend, sending, onStop, keyOutput, ensureTorch, closeTorch, unlockTone, color, busy }) {
  const letters = useMemo(() => encode(prefs.message), [prefs.message]);
  const unknown = [...new Set(letters.filter(l => !l.code).map(l => l.char))];
  const seconds = useMemo(() => {
    const unit = unitMs(prefs.wpm);
    const units = letters.reduce((sum, l, i) => {
      if (!l.code) return sum;
      if (l.code === " ") return sum + 7;
      const sym = [...l.code].reduce((s, c) => s + (c === "-" ? 3 : 1), 0) + l.code.length - 1;
      return sum + sym + (i > 0 && letters[i - 1].code !== " " ? 3 : 0);
    }, 0);
    return Math.round((units * unit) / 1000);
  }, [letters, prefs.wpm]);
  const fast = flashesTooFast([{ on: true, ms: unitMs(prefs.wpm) }, { on: false, ms: unitMs(prefs.wpm) }]);

  return (
    <div className="bx-morse">
      <section className="bx-card">
        <h2>Send a message</h2>
        <p className="bx-muted">Type anything and it flashes in Morse code. Keep it short: a few words take under a minute.</p>
        <label className="bx-field">
          <span>Message</span>
          <textarea
            value={prefs.message}
            maxLength={MAX_MESSAGE}
            rows={2}
            onChange={e => setPrefs({ message: e.target.value })}
            placeholder="HELP 2 PEOPLE BROKEN ANKLE"
          />
        </label>

        <div className="bx-translation" aria-label="Morse code">
          {letters.length === 0 && <span className="bx-muted">Your Morse code shows here.</span>}
          {letters.map((l, i) =>
            l.char === " " ? (
              <span key={i} className="bx-word-gap" aria-hidden="true">/</span>
            ) : (
              <span key={i} className={`bx-letter${l.code ? "" : " is-skip"}`}>
                <b>{l.char}</b>
                <code>{l.code ? pretty(l.code) : "skip"}</code>
              </span>
            )
          )}
        </div>
        {unknown.length > 0 && <p className="bx-note bx-note-quiet">Morse has no code for {unknown.join(" ")}, so it's left out.</p>}

        <div className="bx-speed">
          <label htmlFor="bx-wpm">
            Speed <strong>{prefs.wpm} words a minute</strong>
          </label>
          <input id="bx-wpm" type="range" min="3" max="12" value={prefs.wpm} onChange={e => setPrefs({ wpm: Number(e.target.value) })} />
          <div className="bx-speed-ends" aria-hidden="true">
            <span>Slow, easy to read far away</span>
            <span>Fast</span>
          </div>
          {fast && <p className="bx-note bx-note-quiet">Fast flashing can bother people sensitive to flashing light.</p>}
        </div>

        <div className="bx-actions">
          {sending ? (
            <button type="button" className="bx-btn is-stop" onClick={onStop}>
              <Square size={16} aria-hidden="true" /> Stop
            </button>
          ) : (
            <button type="button" className="bx-btn" onClick={onSend} disabled={!letters.some(l => l.code && l.code !== " ")}>
              <Play size={16} aria-hidden="true" /> Flash it
            </button>
          )}
          <button type="button" className={`bx-chip${prefs.loop ? " is-on" : ""}`} aria-pressed={prefs.loop} onClick={() => setPrefs({ loop: !prefs.loop })}>
            <Repeat size={15} aria-hidden="true" /> Repeat
          </button>
          {seconds > 0 && <span className="bx-muted">About {seconds} s each time</span>}
        </div>
      </section>

      <KeyPad wpm={prefs.wpm} useTorch={prefs.torch} useSound={prefs.sound} keyOutput={keyOutput} ensureTorch={ensureTorch} closeTorch={closeTorch} unlockTone={unlockTone} color={color} busy={busy} />

      <section className="bx-card">
        <h2>Morse chart</h2>
        <div className="bx-chart">
          {Object.entries(MORSE).map(([ch, code]) => (
            <span key={ch}>
              <b>{ch}</b>
              <code>{pretty(code)}</code>
            </span>
          ))}
        </div>
        <p className="bx-muted bx-small">
          A dot is one beat, a dash is three. Wait one beat between parts of a letter, three between letters, seven between words. SOS is sent as one run: ···───···.
        </p>
      </section>
    </div>
  );
}

// Tap your own Morse: hold for light, let go for dark. It reads your taps
// back as letters so you can practice.
function KeyPad({ wpm, useTorch, useSound, keyOutput, ensureTorch, closeTorch, unlockTone, color, busy }) {
  const [down, setDown] = useState(false);
  const [presses, setPresses] = useState([]);
  const pressAt = useRef(0);
  const releaseAt = useRef(0);
  const torchReady = useRef(false);
  const unit = unitMs(wpm);

  useEffect(
    () => () => {
      if (torchReady.current) closeTorch();
      torchReady.current = false;
    },
    [closeTorch, useTorch]
  );

  const press = async event => {
    if (busy || down) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (useSound) unlockTone();
    const now = performance.now();
    if (releaseAt.current && presses.length) {
      const gap = now - releaseAt.current;
      setPresses(p => p.map((x, i) => (i === p.length - 1 ? { ...x, gapAfter: gap } : x)));
    }
    pressAt.current = now;
    setDown(true);
    keyOutput(true);
    if (useTorch && !torchReady.current) {
      torchReady.current = await ensureTorch();
      if (torchReady.current && pressAt.current === now) keyOutput(true);
    }
  };

  const release = () => {
    if (!down) return;
    const now = performance.now();
    releaseAt.current = now;
    setDown(false);
    keyOutput(false);
    setPresses(p => [...p, { down: now - pressAt.current, gapAfter: null, releasedAt: now }].slice(-200));
  };

  // A long pause finishes the last letter (and then the word) on screen.
  const [idleAt, setIdleAt] = useState(0);
  useEffect(() => {
    if (!presses.length || down) return undefined;
    const a = setTimeout(() => setIdleAt(performance.now()), unit * 3);
    const b = setTimeout(() => setIdleAt(performance.now()), unit * 6);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [presses, down, unit]);

  const last = presses[presses.length - 1];
  const settled =
    last && !down && last.gapAfter == null && idleAt > last.releasedAt
      ? [...presses.slice(0, -1), { ...last, gapAfter: idleAt - last.releasedAt }]
      : presses;
  const read = readKeying(settled, unit);

  return (
    <section className="bx-card">
      <h2>Tap it yourself</h2>
      <p className="bx-muted">Hold for light, let go for dark. A quick tap is a dot, hold a little longer for a dash.</p>
      <button
        type="button"
        className={`bx-key${down ? " is-down" : ""}`}
        style={down ? { background: color } : undefined}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={e => (e.key === " " || e.key === "Enter") && !e.repeat && press(e)}
        onKeyUp={e => (e.key === " " || e.key === "Enter") && release()}
        onContextMenu={e => e.preventDefault()}
        disabled={busy}
      >
        {busy ? "Stop the signal to tap" : down ? "" : "Hold to flash"}
      </button>
      <div className="bx-read" aria-live="polite">
        <span className="bx-read-text">{read.text || (presses.length ? "" : "Your letters show here")}</span>
        {read.pending && <code>{pretty(read.pending)}</code>}
        {presses.length > 0 && (
          <button type="button" className="bx-chip" onClick={() => setPresses([])} title="Clear" aria-label="Clear">
            <Delete size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {presses.length > 0 && <p className="bx-muted bx-small">At {wpm} words a minute a dot is {unit} ms. Slow the speed if your letters come out wrong.</p>}
    </section>
  );
}
