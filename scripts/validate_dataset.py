#!/usr/bin/env python3
"""Validate the Studio Clippy dataset.

Checks:
  - every manifest record has an asset_id;
  - local paths exist if claimed (warning, not error — assets live outside repo);
  - confidentiality level is present and valid on cards and assets;
  - no raw private material is accidentally marked public;
  - no duplicate asset IDs (across all manifests);
  - card frontmatter has required keys.

Exit code is non-zero if any ERROR-level problems are found (good for CI / hooks).

Usage:
    python scripts/validate_dataset.py
    python scripts/validate_dataset.py --strict   # warnings also fail
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _common import (
    ASSETS_ROOT,
    CONFIDENTIALITY_LEVELS,
    IMAGE_MANIFEST_DIR,
    PDF_MANIFEST_DIR,
    PROJECT_CARDS_DIR,
    REFERENCE_CARDS_DIR,
    REPO_ROOT,
    SELF_KNOWLEDGE_DIR,
    jsonl_files,
    looks_private,
    md_files,
    read_jsonl,
    read_text,
)

errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def parse_frontmatter(path: Path) -> dict:
    """Minimal YAML-frontmatter reader (key: value, no nested structures needed)."""
    text = read_text(path)
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    block = text[3:end].strip().splitlines()
    fm: dict[str, str] = {}
    for line in block:
        if ":" in line and not line.strip().startswith("#"):
            key, _, val = line.partition(":")
            fm[key.strip()] = val.strip()
    return fm


def check_manifests() -> None:
    seen_ids: dict[str, str] = {}
    manifest_files = jsonl_files(PDF_MANIFEST_DIR) + jsonl_files(IMAGE_MANIFEST_DIR)
    for mf in manifest_files:
        for i, rec in enumerate(read_jsonl(mf), 1):
            loc = f"{mf.name}:{i}"
            aid = rec.get("asset_id", "").strip()
            if not aid:
                err(f"{loc}: record missing asset_id")
                continue
            if aid in seen_ids:
                err(f"{loc}: duplicate asset_id '{aid}' (also in {seen_ids[aid]})")
            else:
                seen_ids[aid] = loc

            conf = rec.get("confidentiality", "").strip()
            if not conf:
                err(f"{loc}: missing confidentiality")
            elif conf not in CONFIDENTIALITY_LEVELS:
                err(f"{loc}: invalid confidentiality '{conf}'")

            # private material marked public?
            if conf == "public" and looks_private(
                rec.get("local_path", ""), rec.get("source_url", ""), rec.get("source_page", "")
            ):
                err(f"{loc}: asset looks private but marked public ('{aid}')")

            # local path existence (warn only — assets may be in cloud storage)
            lp = rec.get("local_path", "").strip()
            if lp:
                candidate = ASSETS_ROOT.parent / lp
                if not candidate.exists():
                    warn(f"{loc}: local_path does not exist: {lp}")


def check_cards() -> None:
    card_dirs = [
        (PROJECT_CARDS_DIR, ["project_id", "title", "status", "confidentiality"]),
        (REFERENCE_CARDS_DIR, ["reference_id", "type", "confidentiality"]),
        (SELF_KNOWLEDGE_DIR, ["card_id", "confidentiality"]),
    ]
    for base, required in card_dirs:
        for card in md_files(base):
            fm = parse_frontmatter(card)
            loc = str(card.relative_to(REPO_ROOT))
            if not fm:
                warn(f"{loc}: no frontmatter found")
                continue
            for key in required:
                if not fm.get(key):
                    err(f"{loc}: missing frontmatter key '{key}'")
            conf = fm.get("confidentiality", "")
            if conf and conf not in CONFIDENTIALITY_LEVELS:
                err(f"{loc}: invalid confidentiality '{conf}'")
            # self-knowledge cards must never be public
            if base == SELF_KNOWLEDGE_DIR and conf == "public":
                err(f"{loc}: self-knowledge card marked public (must be sensitive_distilled)")
            if base == SELF_KNOWLEDGE_DIR and conf == "raw_private_vault":
                err(f"{loc}: raw_private_vault material must not live in the repo")


def check_exports() -> None:
    """No export may contain raw_private_vault; public exports may contain ONLY
    public-confidentiality records."""
    exports_dir = REPO_ROOT / "exports"
    if not exports_dir.exists():
        return
    for f in exports_dir.rglob("*.jsonl"):
        if f.name.startswith("._"):
            continue
        is_public_export = "public_website" in f.parts
        for i, rec in enumerate(read_jsonl(f), 1):
            level = str(rec.get("confidentiality", "")).strip() or str(
                (rec.get("meta") or {}).get("confidentiality", "")
            ).strip()
            if level == "raw_private_vault":
                err(f"exports/{f.relative_to(exports_dir)}:{i}: raw_private_vault material in an export")
            if is_public_export and level and level != "public":
                err(f"exports/{f.relative_to(exports_dir)}:{i}: non-public material ('{level}') in the public export")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--strict", action="store_true", help="treat warnings as failures")
    args = ap.parse_args()

    check_manifests()
    check_cards()
    check_exports()

    print("=== Studio Clippy dataset validation ===")
    for w in warnings:
        print(f"  WARN  {w}")
    for e in errors:
        print(f"  ERROR {e}")
    print(f"\n{len(errors)} error(s), {len(warnings)} warning(s).")

    if errors or (args.strict and warnings):
        print("VALIDATION FAILED")
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
