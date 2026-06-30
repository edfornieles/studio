#!/usr/bin/env python3
"""Prepare a RAG-ready export from cards, source texts and manifests.

Writes flattened JSONL into exports/rag_ready/:
    project_cards.jsonl
    reference_cards.jsonl
    self_knowledge_cards.jsonl
    source_text_chunks.jsonl
    image_manifest.jsonl

Each chunk follows the shape:
    {id, type, title, project, text, tags, source, confidentiality}

Confidentiality filtering (default: exclude raw_private_vault):
    --exclude raw_private_vault sensitive_distilled    # private export hygiene
    --include-all                                       # no filtering (be careful)

Run scripts/validate_dataset.py first. raw_private_vault is ALWAYS excluded.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _common import (
    EXPORTS_RAG,
    IMAGE_MANIFEST_DIR,
    PROJECT_CARDS_DIR,
    REFERENCE_CARDS_DIR,
    REPO_ROOT,
    SELF_KNOWLEDGE_DIR,
    jsonl_files,
    md_files,
    read_jsonl,
    read_text,
    slugify,
    write_jsonl,
)

SOURCE_TEXTS = REPO_ROOT / "source_texts"
CHUNK_CHARS = 1200  # rough character window for source-text chunking


def split_frontmatter(text: str):
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end].strip().splitlines()
    body = text[end + 4 :].strip()
    fm: dict[str, str] = {}
    for line in block:
        if ":" in line and not line.strip().startswith("#"):
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm, body


def split_sections(body: str) -> list[tuple[str, str]]:
    """Split a card body into (section_title, content) pairs on '## ' headings."""
    sections: list[tuple[str, str]] = []
    current_title, current_lines = "", []
    for line in body.splitlines():
        if line.startswith("## "):
            if current_title and "".join(current_lines).strip():
                sections.append((current_title, "\n".join(current_lines).strip()))
            current_title, current_lines = line[3:].strip(), []
        elif not line.startswith("# "):
            current_lines.append(line)
    if current_title and "".join(current_lines).strip():
        sections.append((current_title, "\n".join(current_lines).strip()))
    return sections


def _is_placeholder(text: str) -> bool:
    t = text.strip()
    return not t or t.startswith("TKTK") or t in ("(none yet)", "(none)")


def card_chunks(base: Path, type_name: str, id_key: str, by_section: bool = False) -> list[dict]:
    """One chunk per card — or, with by_section, one chunk per '## ' section.

    Section-level chunks retrieve far better for long cards: a query about the
    'emotional engine' of a work should pull that section, not a 200-line blob.
    Placeholder (TKTK) sections are skipped.
    """
    out = []
    for card in md_files(base):
        fm, body = split_frontmatter(read_text(card))
        if not fm:
            continue
        cid = fm.get(id_key) or slugify(card.stem)
        common = {
            "type": type_name,
            "title": fm.get("title", card.stem.replace("-", " ").title()),
            "project": fm.get("project_id", "") if type_name == "project_card" else "",
            "tags": [t.strip() for t in fm.get("related_references", "").strip("[]").split(",") if t.strip()],
            "source": str(card.relative_to(REPO_ROOT)),
            "confidentiality": fm.get("confidentiality", "studio_private"),
            "training_eligible": str(fm.get("training_eligible", "true")).lower() != "false",
            "public_website_visible": str(fm.get("public_website_visible", "false")).lower() == "true",
        }
        if not by_section:
            out.append({"id": cid, "text": body, "section": "", **common})
            continue
        for sec_title, sec_text in split_sections(body):
            if _is_placeholder(sec_text):
                continue
            if sec_title == "Private notes":
                continue  # never exported, regardless of card confidentiality
            out.append(
                {
                    "id": f"{cid}__{slugify(sec_title)}",
                    "text": f"{common['title']} — {sec_title}:\n{sec_text}",
                    "section": sec_title,
                    **common,
                }
            )
    return out


def source_text_chunks() -> list[dict]:
    out = []
    files = [p for p in SOURCE_TEXTS.rglob("*.txt")] + [p for p in SOURCE_TEXTS.rglob("*.md")]
    for txt in sorted(files):
        if txt.name.startswith("._") or txt.name.upper() == "README.MD":
            continue
        # confidentiality inferred from folder: private/ -> studio_private, else public
        conf = "studio_private" if "private" in txt.parts else "public"
        content = read_text(txt)
        # project association inferred from the '<project_id>__source' filename convention
        project = txt.stem.split("__")[0] if "__" in txt.stem else ""
        # accumulate whole paragraphs up to ~CHUNK_CHARS — never cut mid-sentence
        paras = [p.strip() for p in content.split("\n\n") if p.strip()]
        buf: list[str] = []
        size = 0
        pieces: list[str] = []
        for p in paras:
            if size + len(p) > CHUNK_CHARS and buf:
                pieces.append("\n\n".join(buf))
                buf, size = [], 0
            buf.append(p)
            size += len(p)
        if buf:
            pieces.append("\n\n".join(buf))
        for n, piece in enumerate(pieces):
            out.append(
                {
                    "id": f"{slugify(txt.stem)}_{n:04d}",
                    "type": "source_text",
                    "title": txt.stem.replace("-", " ").title(),
                    "project": project,
                    "text": piece,
                    "tags": [],
                    "source": str(txt.relative_to(REPO_ROOT)),
                    "confidentiality": conf,
                    "training_eligible": conf == "public",
                    "public_website_visible": False,
                }
            )
    return out


def image_chunks() -> list[dict]:
    out = []
    for mf in jsonl_files(IMAGE_MANIFEST_DIR):
        for rec in read_jsonl(mf):
            if rec.get("asset_id") == "img_seed_placeholder":
                continue
            text = " ".join(
                filter(None, [rec.get("caption", ""), rec.get("description", "")])
            )
            out.append(
                {
                    "id": rec.get("asset_id", ""),
                    "type": "image",
                    "title": rec.get("caption", "") or rec.get("asset_id", ""),
                    "project": rec.get("project", ""),
                    "text": text,
                    "tags": (rec.get("conceptual_tags", []) or []) + (rec.get("visual_tags", []) or []),
                    "source": rec.get("source_url", "") or rec.get("local_path", ""),
                    "confidentiality": rec.get("confidentiality", "public"),
                    "training_eligible": bool(rec.get("training_eligible", True)),
                    "public_website_visible": bool(rec.get("public_website_visible", False)),
                }
            )
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--exclude",
        nargs="*",
        default=["raw_private_vault"],
        help="confidentiality levels to exclude (raw_private_vault always excluded)",
    )
    ap.add_argument("--include-all", action="store_true", help="disable filtering except raw_private_vault")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    exclude = set() if args.include_all else set(args.exclude)
    exclude.add("raw_private_vault")  # never exportable

    datasets = {
        # project cards are section-chunked: precise retrieval beats whole-card blobs
        "project_cards.jsonl": card_chunks(PROJECT_CARDS_DIR, "project_card", "project_id", by_section=True),
        "idea_cards.jsonl": card_chunks(REPO_ROOT / "idea_cards", "idea_card", "idea_id"),
        "reference_cards.jsonl": card_chunks(REFERENCE_CARDS_DIR, "reference_card", "reference_id"),
        "self_knowledge_cards.jsonl": card_chunks(SELF_KNOWLEDGE_DIR, "self_knowledge_card", "card_id"),
        "source_text_chunks.jsonl": source_text_chunks(),
        "image_manifest.jsonl": image_chunks(),
    }

    total = 0
    for name, records in datasets.items():
        kept = [r for r in records if r.get("confidentiality") not in exclude]
        dropped = len(records) - len(kept)
        total += len(kept)
        if args.dry_run:
            print(f"  [dry-run] {name}: {len(kept)} kept, {dropped} excluded")
            continue
        write_jsonl(EXPORTS_RAG / name, kept)
        print(f"  + {name}: {len(kept)} kept, {dropped} excluded")

    print(f"\nExcluded levels: {sorted(exclude)}")
    print(f"Total exported chunks: {total}" if not args.dry_run else "(dry run)")
    print(f"Output dir: {EXPORTS_RAG}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
