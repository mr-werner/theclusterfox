import { useEffect, useState } from "react";

// Spoken guidance uses the browser's built-in speech (Web Speech API). It's free,
// works offline on most devices, and nothing is sent anywhere by CalmFox.

export const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

// macOS ships some joke voices. Nobody wants to meditate with them.
const NOVELTY =
  /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox)\b/i;
const PREFERRED = [
  /natural/i,
  /neural/i,
  /premium/i,
  /enhanced/i,
  /samantha/i,
  /serena/i,
  /karen/i,
  /moira/i,
  /tessa/i,
  /aria/i,
  /jenny/i,
  /libby/i,
  /sonia/i,
  /google uk english female/i,
  /google us english/i,
  /daniel/i,
];

function score(voice) {
  let s = 0;
  if (/^en/i.test(voice.lang)) s += 100;
  if (typeof navigator !== "undefined" && voice.lang === navigator.language) s += 10;
  const i = PREFERRED.findIndex(re => re.test(voice.name));
  if (i >= 0) s += 60 - i * 2;
  if (voice.localService) s += 3;
  return s;
}

/** Voices worth offering, best first. English voices lead; the rest follow by language. */
export function rankVoices(voices) {
  return voices
    .filter(v => !NOVELTY.test(v.name))
    .sort((a, b) => score(b) - score(a) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

export function pickVoice(voices, uri) {
  return voices.find(v => v.voiceURI === uri) || voices[0] || null;
}

export function useVoices() {
  const [voices, setVoices] = useState(() => (speechSupported ? rankVoices(window.speechSynthesis.getVoices()) : []));
  useEffect(() => {
    if (!speechSupported) return undefined;
    const load = () => setVoices(rankVoices(window.speechSynthesis.getVoices()));
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    // Some browsers fill the list late and never fire the event.
    const t = setTimeout(load, 800);
    return () => {
      clearTimeout(t);
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
    };
  }, []);
  return voices;
}

let current = null; // kept so the browser doesn't garbage-collect it mid-sentence

/** Speak a line, replacing anything already being said. */
export function speak(text, { voice, rate = 0.85, pitch = 1, volume = 1, onEnd } = {}) {
  if (!speechSupported || !text) return null;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  }
  u.rate = rate;
  u.pitch = pitch;
  u.volume = volume;
  u.onend = u.onerror = () => {
    if (current === u) current = null;
    onEnd?.();
  };
  current = u;
  synth.speak(u);
  return u;
}

export function isSpeaking() {
  return speechSupported && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
}

export function stopSpeaking() {
  if (speechSupported) window.speechSynthesis.cancel();
  current = null;
}

/** iOS only lets a page speak after a tap. Call this from the tap that starts a session. */
export function primeSpeech() {
  if (!speechSupported) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}
