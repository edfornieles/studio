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
    .venv/bin/python generate.py --engine fish --probe "Hello."   # test another engine
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

from tts_engines import add_engine_args, make_engine

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


def render(engine, text, pause=0.35, para_pause=0.8):
    """Generate one section with any engine (see tts_engines.py).
    Returns (pcm float32, sample rate, sentence timings)."""
    pieces, timings, at, rate = [], [], 0.0, None
    for s in sentences(text):
        audio, r = engine.synth(s.strip())
        if rate is None:
            rate = r
        elif r != rate:  # engines should be consistent; resample crudely if not
            audio = np.interp(np.linspace(0, len(audio), int(len(audio) * rate / r), endpoint=False), np.arange(len(audio)), audio).astype(np.float32)
        dur = len(audio) / rate
        timings.append({"text": s.strip(), "start": round(at, 3), "end": round(at + dur, 3)})
        gap = para_pause if s.endswith("\n") else pause
        pieces += [audio, np.zeros(int(gap * rate), dtype=np.float32)]
        at += dur + gap
    if not pieces:
        return np.zeros(1, dtype=np.float32), 24000, []
    return np.concatenate(pieces), rate, timings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book", nargs="?", help="JSON with title and sections")
    ap.add_argument("--out")
    ap.add_argument("--bitrate", default="64k")
    ap.add_argument("--probe", metavar="TEXT", help="just synthesise TEXT to probe.mp3 to test an engine")
    add_engine_args(ap)
    args = ap.parse_args()

    t0 = time.time()
    engine = make_engine(args)
    print(f"{engine.label} ready in {time.time() - t0:.1f}s", file=sys.stderr)

    if args.probe:
        pcm, rate, _ = render(engine, args.probe)
        encode_mp3(pcm, rate, Path("probe.mp3"), args.bitrate)
        print(f"probe.mp3: {len(pcm) / rate:.1f}s of audio in {time.time() - t0:.1f}s", file=sys.stderr)
        return

    book = json.loads(Path(args.book).read_text())
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {"title": book["title"], "author": book.get("author", ""), "voice": engine.label,
                "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "sections": []}
    for i, sec in enumerate(book["sections"], 1):
        t1 = time.time()
        pcm, rate, timings = render(engine, sec["text"])
        name = f"section-{i:02d}.mp3"
        encode_mp3(pcm, rate, out / name, args.bitrate)
        manifest["sections"].append({"id": f"s{i:02d}", "title": sec["title"], "file": name,
                                     "duration": round(len(pcm) / rate, 2), "sentences": timings})
        print(f"section {i}: {len(timings)} sentences, {len(pcm) / rate / 60:.1f} min audio "
              f"in {(time.time() - t1) / 60:.1f} min", file=sys.stderr)
        (out / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
