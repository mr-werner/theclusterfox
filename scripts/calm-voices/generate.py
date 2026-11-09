"""Record every CalmFox line with Kokoro, a free open-source neural voice (Apache-2.0).

Setup (once):
  python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
  curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

Run from the repo root (needs node and ffmpeg):
  .venv/bin/python scripts/calm-voices/generate.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin

Only lines without a recording are generated, so after editing a session just run it again.
Writes public/calm-voice/<voice>/<key>.mp3 and src/features/calm/data/voiceManifest.json.
"""

import argparse
import json
import pathlib
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

# id used in the app -> (Kokoro voice, language)
VOICES = {
    "willow": ("af_heart", "en-us"),
    "rowan": ("am_michael", "en-us"),
}
SPEED = 0.85  # unhurried
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "calm-voice"
MANIFEST = ROOT / "src" / "features" / "calm" / "data" / "voiceManifest.json"


def soften(samples, sr):
    """Short fades so lines start and end without clicks."""
    n = int(sr * 0.03)
    samples = samples.copy()
    samples[:n] *= np.linspace(0, 1, n)
    samples[-n:] *= np.linspace(1, 0, n)
    return samples


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--voices", required=True)
    args = ap.parse_args()

    lines = json.loads(subprocess.check_output(["node", "scripts/calm-voices/lines.mjs"], cwd=ROOT))
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    kokoro = Kokoro(args.model, args.voices)
    keys = {line["key"] for line in lines}

    for vid, (voice, lang) in VOICES.items():
        folder = OUT / vid
        folder.mkdir(parents=True, exist_ok=True)
        durations = {k: v for k, v in manifest.get(vid, {}).items() if k in keys and (folder / f"{k}.mp3").exists()}
        todo = [line for line in lines if line["key"] not in durations]
        print(f"{vid}: {len(todo)} to record, {len(durations)} already done")
        for i, line in enumerate(todo, 1):
            samples, sr = kokoro.create(line["text"], voice=voice, speed=SPEED, lang=lang)
            samples = soften(samples, sr)
            with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
                sf.write(wav.name, samples, sr)
                subprocess.run(
                    ["ffmpeg", "-loglevel", "error", "-y", "-i", wav.name, "-ac", "1", "-ar", "24000",
                     "-b:a", "32k", str(folder / f"{line['key']}.mp3")],
                    check=True,
                )
            durations[line["key"]] = round(len(samples) / sr, 2)
            if i % 25 == 0:
                print(f"  {i}/{len(todo)}")
        for stale in folder.glob("*.mp3"):
            if stale.stem not in keys:
                stale.unlink()
        manifest[vid] = dict(sorted(durations.items()))

    MANIFEST.write_text(json.dumps(manifest, indent=0, sort_keys=True) + "\n")
    print("done")


if __name__ == "__main__":
    main()
