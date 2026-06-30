#!/usr/bin/env python3
"""Quick capture: create an idea card, or append a note to an existing project.

Usage:
    # new idea card (default: studio_private, seed)
    python scripts/ingest_project_note.py --idea "A court that tries weather systems"
    python scripts/ingest_project_note.py --idea "..." --why "..." --next "email Linda"

    # append a dated note to an existing project card's Feed log
    python scripts/ingest_project_note.py --project finiliar --note "OpenSea floor moved; check oracle costs"
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from _common import PROJECT_CARDS_DIR, REPO_ROOT, md_files, read_text, slugify

IDEA_DIR = REPO_ROOT / "idea_cards"

IDEA_TEMPLATE = """---
idea_id: {idea_id}
date_created: {date}
status: seed
confidentiality: studio_private
related_projects:
related_people:
training_eligible: true
public_website_visible: false
---

# {title}

## Raw idea

{raw}

## Why it matters

{why}

## Possible project form

TKTK

## Social machine

TKTK

## Fictional device

TKTK

## Emotional engine

TKTK

## References

TKTK

## Next questions

TKTK

## Next practical step

{next}
"""


def create_idea(raw: str, why: str, nxt: str) -> Path:
    title = raw.strip().rstrip(".")
    idea_id = slugify(title, maxlen=60)
    IDEA_DIR.mkdir(parents=True, exist_ok=True)
    dest = IDEA_DIR / f"{idea_id}.md"
    n = 1
    while dest.exists():
        dest = IDEA_DIR / f"{idea_id}-{n}.md"
        n += 1
    dest.write_text(
        IDEA_TEMPLATE.format(
            idea_id=dest.stem,
            date=datetime.now().strftime("%Y-%m-%d"),
            title=title[:80],
            raw=raw.strip(),
            why=(why or "TKTK").strip(),
            next=(nxt or "TKTK").strip(),
        ),
        encoding="utf-8",
    )
    return dest


def append_note(project_id: str, note: str) -> Path | None:
    for card in md_files(PROJECT_CARDS_DIR):
        if card.stem == project_id:
            text = read_text(card)
            stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            bullet = f"- ({stamp}) {note.strip()}"
            if "## Feed log" in text:
                idx = text.index("## Feed log") + len("## Feed log")
                nxt = text.find("\n## ", idx)
                if nxt == -1:
                    text = text.rstrip() + "\n" + bullet + "\n"
                else:
                    text = text[:nxt].rstrip() + "\n" + bullet + "\n" + text[nxt:]
            else:
                text = text.rstrip() + f"\n\n## Feed log\n\n{bullet}\n"
            card.write_text(text, encoding="utf-8")
            return card
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--idea", help="raw idea text → creates an idea card")
    ap.add_argument("--why", default="", help="why it matters (optional)")
    ap.add_argument("--next", dest="nxt", default="", help="next practical step (optional)")
    ap.add_argument("--project", help="project_id to append a note to")
    ap.add_argument("--note", help="note text (with --project)")
    args = ap.parse_args()

    if args.idea:
        dest = create_idea(args.idea, args.why, args.nxt)
        print(f"Idea card created: {dest.relative_to(REPO_ROOT)}")
        return 0
    if args.project and args.note:
        card = append_note(args.project, args.note)
        if card is None:
            print(f"No project card found with id '{args.project}'.")
            return 1
        print(f"Note appended to {card.relative_to(REPO_ROOT)}")
        return 0
    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
