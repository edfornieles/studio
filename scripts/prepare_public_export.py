#!/usr/bin/env python3
"""Build the public-website export — the ONLY content a public deployment ships.

Hard filter: a record is admitted only if
    confidentiality == "public"  AND  public_website_visible is true.
Everything else — including studio_private and sensitive_distilled — is excluded
by construction. Project cards additionally expose ONLY their
"Public-facing summary" section (never the full internal card) plus basic metadata.

Writes exports/public_website/:
    projects.jsonl    public project summaries
    images.jsonl      approved image records (caption/credit/source only)
    references.jsonl  public reference cards
    stats.json        counts + what was excluded (for the editorial review)

Run validate_dataset.py first; this script also refuses to write if any admitted
record looks private.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from _common import (
    IMAGE_MANIFEST_DIR,
    PROJECT_CARDS_DIR,
    REFERENCE_CARDS_DIR,
    REPO_ROOT,
    jsonl_files,
    looks_private,
    md_files,
    read_jsonl,
    read_text,
    slugify,
    write_jsonl,
)

OUT = REPO_ROOT / "exports" / "public_website"


def split_frontmatter(text: str):
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    fm = {}
    for line in text[3:end].strip().splitlines():
        if ":" in line and not line.strip().startswith("#"):
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm, text[end + 4 :].strip()


def section(body: str, name: str) -> str:
    marker = f"## {name}"
    if marker not in body:
        return ""
    start = body.index(marker) + len(marker)
    nxt = body.find("\n## ", start)
    return (body[start:nxt] if nxt != -1 else body[start:]).strip()


def is_public(fm_or_rec: dict) -> bool:
    conf = str(fm_or_rec.get("confidentiality", "")).strip()
    vis = str(fm_or_rec.get("public_website_visible", "false")).strip().lower()
    return conf == "public" and vis == "true"


def main() -> int:
    excluded = {"projects": 0, "images": 0, "references": 0}

    projects = []
    for card in md_files(PROJECT_CARDS_DIR):
        fm, body = split_frontmatter(read_text(card))
        if not is_public(fm):
            excluded["projects"] += 1
            continue
        summary = section(body, "Public-facing summary")
        if not summary or summary.startswith("TKTK"):
            excluded["projects"] += 1  # nothing authored for the public yet
            continue
        projects.append({
            "id": fm.get("project_id") or slugify(card.stem),
            "title": fm.get("title", ""),
            "date": fm.get("date", ""),
            "status": fm.get("status", ""),
            "summary": summary,
        })

    images = []
    for mf in jsonl_files(IMAGE_MANIFEST_DIR):
        for rec in read_jsonl(mf):
            if not is_public(rec):
                excluded["images"] += 1
                continue
            if looks_private(rec.get("local_path", ""), rec.get("source_url", "")):
                print(f"  ! REFUSING private-looking record: {rec.get('asset_id')}")
                return 1
            images.append({
                "asset_id": rec.get("asset_id"), "project": rec.get("project", ""),
                "caption": rec.get("caption", ""), "photographer": rec.get("photographer", ""),
                "rights": rec.get("rights", ""), "source_page": rec.get("source_page", ""),
                "source_url": rec.get("source_url", ""), "local_path": rec.get("local_path", ""),
            })

    references = []
    for card in md_files(REFERENCE_CARDS_DIR):
        fm, body = split_frontmatter(read_text(card))
        if not is_public(fm):
            excluded["references"] += 1
            continue
        references.append({
            "id": fm.get("reference_id") or slugify(card.stem),
            "type": fm.get("type", ""), "body": body,
        })

    OUT.mkdir(parents=True, exist_ok=True)
    write_jsonl(OUT / "projects.jsonl", projects)
    write_jsonl(OUT / "images.jsonl", images)
    write_jsonl(OUT / "references.jsonl", references)
    stats = {"included": {"projects": len(projects), "images": len(images), "references": len(references)}, "excluded": excluded}
    (OUT / "stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

    print(f"public export → {OUT}")
    print(json.dumps(stats, indent=2))
    if not any(stats["included"].values()):
        print("\nNothing is approved for the public site yet — that is the safe default.")
        print("Approve records by setting public_website_visible: true (public confidentiality only)")
        print("and authoring each project's '## Public-facing summary'.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
