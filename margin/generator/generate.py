#!/usr/bin/env python3
"""Pre-generate narration for Margin with Kyutai Pocket TTS (CPU, free).

Input: a JSON file describing the sections to read:
    {"title": "...", "author": "...", "sections": [{"title": "...", "text": "..."}]}

Output (in --out): one MP3 per section plus manifest.json with sentence
timings, so the player can highlight and seek by sentence:
    {"title", "author", "voice", "sections": [{"id", "title", "file",
     "duration", "sentences": [{"text", "start", "end"}]}]}

Each sentence is generated separately and the pieces are joined with a short
pause. That gives exact timings and keeps the model's prompt short.

Setup (Linux, CPU-only PyTorch):
    python3 -m venv .venv
    .venv/bin/pip install pocket-tts --extra-index-url https://download.pytorch.org/whl/cpu
    # also needs ffmpeg on PATH
Run:
    .venv/bin/python generate.py book.json --out ../lab/audio --voice alba
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

ABBR = re.compile(r"^(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|vs|etc|e\.g|i\.e|cf|al|ed|eds|vol|no|pp?|ch|fig|op|cit|ibid|ca|c)\.$", re.I)
BOUNDARY = re.compile(r"[.!?…]+[\"'”’)\]]*(?=\s+[\"'“‘(\[]?[A-Z0-9])")
MAX_LEN = 200  # Pocket TTS warns above ~50 tokens per chunk


def sentences(text):
    """Split into sentences (same rules as js/chunks.js)."""
    out = []
    for para in re.split(r"\n\s*\n", text):
        para = re.sub(r"\s+", " ", para).strip()
        if not para:
            continue
        start = 0
        for m in BOUNDARY.finditer(para):
            end = m.end()
            last = para[start:end].split()[-1].lstrip("(\"'“‘[")
            if ABBR.match(last) or re.fullmatch(r"[A-Z]\.", last):
                continue
            out.extend(split_long(para[start:end].strip()))
            start = end
        if para[start:].strip():
            out.extend(split_long(para[start:].strip()))
        if out:
            out[-1] = out[-1] + "\n"  # mark paragraph end: longer pause
    return out


def split_long(s):
    parts = []
    while len(s) > MAX_LEN:
        cut = max(s.rfind(", ", 0, MAX_LEN), s.rfind("; ", 0, MAX_LEN))
        if cut < MAX_LEN * 0.4:
            cut = s.rfind(" ", 0, MAX_LEN)
        parts.append(s[: cut + 1].strip())
        s = s[cut + 1 :].strip()
    return parts + [s] if s else parts


def encode_mp3(pcm, rate, path, bitrate):
    data = (np.clip(pcm, -1, 1) * 32767).astype("<i2").tobytes()
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "-",
         "-codec:a", "libmp3lame", "-b:a", bitrate, "-ar", "24000", str(path)],
        input=data, check=True,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book", help="JSON with title and sections")
    ap.add_argument("--out", required=True)
    ap.add_argument("--voice", default="alba", help="Pocket TTS voice name or path to a .wav/.safetensors voice")
    ap.add_argument("--bitrate", default="64k")
    ap.add_argument("--pause", type=float, default=0.35, help="seconds between sentences")
    ap.add_argument("--para-pause", type=float, default=0.8, help="seconds after a paragraph")
    args = ap.parse_args()

    from pocket_tts import TTSModel  # imported late so --help works without it

    book = json.loads(Path(args.book).read_text())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    t0 = time.time()
    model = TTSModel.load_model()
    voice = model.get_state_for_audio_prompt(args.voice)
    rate = model.sample_rate
    print(f"model + voice loaded in {time.time() - t0:.1f}s (sample rate {rate})", file=sys.stderr)

    manifest = {"title": book["title"], "author": book.get("author", ""), "voice": Path(args.voice).stem,
                "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sections": []}
    for i, sec in enumerate(book["sections"], 1):
        pieces, timings, at = [], [], 0.0
        sents = sentences(sec["text"])
        t1 = time.time()
        for s in sents:
            audio = model.generate_audio(voice, s.strip()).numpy().astype(np.float32)
            dur = len(audio) / rate
            timings.append({"text": s.strip(), "start": round(at, 3), "end": round(at + dur, 3)})
            gap = args.para_pause if s.endswith("\n") else args.pause
            pieces += [audio, np.zeros(int(gap * rate), dtype=np.float32)]
            at += dur + gap
        pcm = np.concatenate(pieces)
        name = f"section-{i:02d}.mp3"
        encode_mp3(pcm, rate, out / name, args.bitrate)
        manifest["sections"].append({"id": f"s{i:02d}", "title": sec["title"], "file": name,
                                     "duration": round(len(pcm) / rate, 2), "sentences": timings})
        print(f"section {i}: {len(sents)} sentences, {len(pcm) / rate / 60:.1f} min audio "
              f"in {(time.time() - t1) / 60:.1f} min", file=sys.stderr)
        (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
