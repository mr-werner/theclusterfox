import { useEffect, useState } from "react";
import manifest from "../data/voiceManifest.json";
import { lineKey } from "../data/voiceLines";
import { audio } from "./sound";

// Two kinds of voice:
// - Natural voices: every line was recorded ahead of time with Kokoro, a free
//   open-source neural voice (see scripts/calm-voices). They play as small mp3s.
// - Device voices: the browser's built-in speech (Web Speech API), used if the
//   listener picks one, or as a fallback if a recording can't load.
// Nothing is sent anywhere by CalmFox.

export const NATURAL_VOICES = [
  { id: "willow", name: "Willow", note: "warm and gentle" },
  { id: "rowan", name: "Rowan", note: "calm and low" },
]
  .filter(v => manifest[v.id])
  .map(v => ({ ...v, natural: true, voiceURI: `calm:${v.id}` }));

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

/** The chosen voice. Natural voices come first and are the default. */
export function pickVoice(voices, uri) {
  return [...NATURAL_VOICES, ...voices].find(v => v.voiceURI === uri) || NATURAL_VOICES[0] || voices[0] || null;
}

/** Seconds a natural voice takes to say a line, or null if it has no recording. */
export function recordedSeconds(voice, text) {
  if (!voice?.natural) return null;
  return manifest[voice.id]?.[lineKey(text)] ?? null;
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
let playing = null; // { source, token } for a natural-voice line
let token = 0;
const buffers = new Map(); // "voice/key" -> Promise<AudioBuffer | null>

function loadLine(voice, text) {
  const key = `${voice.id}/${lineKey(text)}`;
  if (!buffers.has(key)) {
    const ac = audio();
    const promise = !ac || !recordedSeconds(voice, text)
      ? Promise.resolve(null)
      : fetch(`/calm-voice/${key}.mp3`)
          .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
          .then(data => new Promise((resolve, reject) => ac.decodeAudioData(data, resolve, reject)))
          .catch(() => {
            buffers.delete(key); // try again next time
            return null;
          });
    buffers.set(key, promise);
  }
  return buffers.get(key);
}

/** Fetch a session's recordings up front so each line plays the moment it's due. */
export function preloadLines(voice, texts) {
  if (!voice?.natural) return;
  for (const text of new Set(texts)) if (text) loadLine(voice, text);
}

function speakDevice(text, { voice, rate, pitch, volume, onEnd }) {
  if (!speechSupported) return null;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice && !voice.natural) {
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

/** Speak a line, replacing anything already being said. */
export function speak(text, { voice, rate = 0.85, pitch = 1, volume = 1, onEnd } = {}) {
  if (!text) return;
  stopSpeaking();
  const mine = ++token;
  if (!voice?.natural || !recordedSeconds(voice, text)) {
    speakDevice(text, { voice, rate, pitch, volume, onEnd });
    return;
  }
  // Natural voice. The recording is usually preloaded; if not, it's fetched now.
  playing = { source: null, token: mine };
  loadLine(voice, text).then(buffer => {
    if (mine !== token) return; // something newer was said, or speech was stopped
    if (!buffer) {
      playing = null;
      speakDevice(text, { voice: null, rate, pitch, volume, onEnd });
      return;
    }
    const ac = audio();
    const source = ac.createBufferSource();
    const gain = ac.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(ac.destination);
    source.onended = () => {
      if (playing?.source === source) playing = null;
      onEnd?.();
    };
    playing = { source, gain, token: mine };
    source.start();
  });
}

/** Change the volume of the line playing now. Device voices can't change mid-sentence, so they pick it up on the next line. */
export function setSpeakingVolume(volume) {
  const ac = audio();
  if (ac && playing?.gain) playing.gain.gain.setTargetAtTime(volume, ac.currentTime, 0.1);
}

export function isSpeaking() {
  return Boolean(playing) || (speechSupported && (window.speechSynthesis.speaking || window.speechSynthesis.pending));
}

export function stopSpeaking() {
  token++;
  if (playing?.source) {
    try {
      playing.source.stop();
    } catch {
      // already finished
    }
  }
  playing = null;
  if (speechSupported) window.speechSynthesis.cancel();
  current = null;
}

/** True if this browser can play guidance at all. */
export const voiceSupported = speechSupported || NATURAL_VOICES.length > 0;
