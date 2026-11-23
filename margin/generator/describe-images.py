#!/usr/bin/env python3
"""Find the pictures in a PDF (photos, graphic scores, diagrams) and describe
them with Claude, so the narrator can offer a description while reading.

    python generator/describe-images.py book.pdf book.json figures.json [--pages 12-60]

For every page in the book's sections that has a sizeable raster image or very
little text, the page is rendered (poppler's pdftoppm) and sent to Claude with
the page's text. Claude returns zero or more figures, each with
  - short:       one sentence, spoken in the reading ("There's an image here: ...")
  - description: a fuller spoken description, played only if the listener asks
Results are cached in figures.json, so re-runs only process new pages.

Needs: pip install anthropic; poppler-utils (pdfimages, pdftoppm);
ANTHROPIC_API_KEY or an `ant auth login` profile.
Cost: one image-sized request per candidate page (roughly a few hundred pages
per dollar with Claude Opus 5.5 at the default settings below).
"""
import argparse
import base64
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import anthropic

MODEL = "claude-opus-5-5"

SCHEMA = {
    "type": "object",
    "properties": {
        "figures": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": ["photograph", "score", "diagram", "drawing", "table", "other"]},
                    "short": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["kind", "short", "description"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["figures"],
    "additionalProperties": False,
}

PROMPT = """This is page {page} of a book being listened to as an audiobook: {title}.
Its extracted text is below; the narrator reads that text aloud, so don't repeat it.

Find the meaningful visual elements on the page (photographs, graphic or notated
scores, diagrams, drawings, instrument designs, tables). Ignore page furniture:
logos, running headers, page numbers, decorative rules, and ordinary body text.

For each figure, write for a listener who cannot see the page:
- short: one spoken sentence (max 25 words) saying what the image is, e.g. "a photograph of
  four performers seated around a table of electronics".
- description: 60-180 words describing what is visible, in plain spoken English: layout,
  notable details, any legible caption or handwritten words, and how a graphic score is
  organised. Describe; don't evaluate or speculate beyond what is visible.
Return an empty list if the page has no meaningful figure.

Extracted page text:
---
{text}
---"""


def image_pages(pdf, min_pixels=120_000):
    """Pages that contain a raster image bigger than a small logo."""
    out = subprocess.run(["pdfimages", "-list", str(pdf)], capture_output=True, text=True, check=True).stdout
    pages = set()
    for line in out.splitlines()[2:]:
        f = line.split()
        if len(f) > 4 and f[0].isdigit() and f[3].isdigit() and f[4].isdigit():
            if int(f[3]) * int(f[4]) >= min_pixels:
                pages.add(int(f[0]))
    return pages


def render_page(pdf, page, folder):
    stem = Path(folder) / f"p{page}"
    subprocess.run(["pdftoppm", "-f", str(page), "-l", str(page), "-r", "110", "-png", "-singlefile", str(pdf), str(stem)], check=True)
    return Path(str(stem) + ".png").read_bytes()


def describe(client, png, page, title, text):
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=4000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",  # if a safety classifier declines, retry on a fallback model
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64.standard_b64encode(png).decode()}},
                {"type": "text", "text": PROMPT.format(page=page, title=title, text=text[:4000] or "(no text on this page)")},
            ],
        }],
    )
    if response.stop_reason == "refusal":
        return None
    raw = "".join(b.text for b in response.content if b.type == "text")
    return json.loads(raw)["figures"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("book")
    ap.add_argument("out")
    ap.add_argument("--pages", help="limit to a range, e.g. 12-60")
    args = ap.parse_args()

    book = json.loads(Path(args.book).read_text())
    page_text = {p["page"]: p["text"] for s in book["sections"] for p in s.get("parts", [])}
    in_book = set(page_text)
    candidates = (image_pages(args.pdf) | {p for p, t in page_text.items() if len(t) < 400}) & in_book
    if args.pages:
        a, b = map(int, args.pages.split("-"))
        candidates = {p for p in candidates if a <= p <= b}

    out = Path(args.out)
    cache = json.loads(out.read_text()) if out.exists() else {}
    client = anthropic.Anthropic()
    todo = sorted(p for p in candidates if str(p) not in cache)
    print(f"{len(candidates)} candidate pages, {len(todo)} to describe", file=sys.stderr)
    with tempfile.TemporaryDirectory() as tmp:
        for page in todo:
            try:
                figures = describe(client, render_page(args.pdf, page, tmp), page, book["title"], page_text.get(page, ""))
            except anthropic.RateLimitError:
                print("rate limited; stopping (re-run to continue)", file=sys.stderr)
                break
            except anthropic.APIStatusError as e:
                print(f"page {page}: API error {e.status_code}", file=sys.stderr)
                continue
            cache[str(page)] = figures or []
            out.write_text(json.dumps(cache, indent=1, ensure_ascii=False))
            print(f"page {page}: {len(figures or [])} figure(s)" + (f" · {figures[0]['short']}" if figures else ""), flush=True)


if __name__ == "__main__":
    main()
