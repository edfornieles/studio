#!/usr/bin/env python3
"""Create a structured diary / personal documentation entry — VAULT ONLY.

Writes to studio-clippy-assets/private_diaries/ (git-ignored, outside the repo)
and registers the filename in the private index. The privacy defaults are
LOCKED — this script has no flag to change them:

    confidentiality: raw_private_vault
    training_eligible: false
    public_website_visible: false
    requires_distillation: true

Usage:
    python scripts/ingest_diary_entry.py --type diary --title "10 June"
        # opens $EDITOR (or reads stdin with --stdin) for the raw text
    python scripts/ingest_diary_entry.py --type dream --title "The slug" --stdin < dream.txt
    cat entry.txt | python scripts/ingest_diary_entry.py --stdin

Types: diary / relationship / sex / love / fear / desire / life_event / thought
/ dream / therapy_reflection
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

from _common import ASSETS_ROOT, slugify

VAULT = ASSETS_ROOT / "private_diaries"
PRIVATE_INDEX = ASSETS_ROOT / "_private_index.jsonl"
TYPES = [
    "diary", "relationship", "sex", "love", "fear", "desire",
    "life_event", "thought", "dream", "therapy_reflection",
]

TEMPLATE = """---
entry_id: {entry_id}
date: {date}
type: {type}
confidentiality: raw_private_vault
related_people:
related_projects:
related_ideas:
training_eligible: false
public_website_visible: false
requires_distillation: true
---

# Entry

## Raw text

{raw}

## Possible themes

(to fill during distillation — never auto-extracted)

## Possible self-knowledge cards to extract

-

## Do-not-use notes

-
"""


def get_text(use_stdin: bool) -> str:
    if use_stdin or not sys.stdin.isatty():
        return sys.stdin.read().strip()
    editor = os.environ.get("EDITOR", "nano")
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w+", delete=False) as tf:
        path = tf.name
    subprocess.call([editor, path])
    text = Path(path).read_text(encoding="utf-8").strip()
    Path(path).unlink(missing_ok=True)
    return text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--type", default="diary", choices=TYPES)
    ap.add_argument("--title", default="", help="short label for the filename")
    ap.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"))
    ap.add_argument("--stdin", action="store_true", help="read raw text from stdin")
    args = ap.parse_args()

    raw = get_text(args.stdin)
    if not raw:
        print("No text provided — nothing written.")
        return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    entry_id = f"{args.date}-{args.type}-{slugify(args.title) or stamp}"
    VAULT.mkdir(parents=True, exist_ok=True)
    dest = VAULT / f"{entry_id}.md"
    n = 1
    while dest.exists():
        dest = VAULT / f"{entry_id}-{n}.md"
        n += 1
    dest.write_text(
        TEMPLATE.format(entry_id=entry_id, date=args.date, type=args.type, raw=raw),
        encoding="utf-8",
    )

    PRIVATE_INDEX.parent.mkdir(parents=True, exist_ok=True)
    with PRIVATE_INDEX.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({
            "kind": "diary_entry", "type": args.type, "title": args.title,
            "path": str(dest.relative_to(ASSETS_ROOT.parent)),
            "added": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "confidentiality": "raw_private_vault",
        }, ensure_ascii=False) + "\n")

    print(f"Vaulted (git-ignored, never exported): {dest}")
    print("To use it safely later: distil into a self-knowledge card via the console.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
