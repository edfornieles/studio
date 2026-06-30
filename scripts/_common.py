"""Shared path helpers for Studio Clippy dataset scripts.

The dataset repo (studio-clippy-dataset/) holds text, schemas, manifests and
these scripts. Large binary assets live in a SIBLING folder
(studio-clippy-assets/) that is git-ignored. Nothing here depends on third-party
packages; the heavier scripts import pypdf / Pillow lazily and degrade gracefully.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# scripts/ -> repo root (studio-clippy-dataset/)
REPO_ROOT = Path(__file__).resolve().parent.parent
# sibling assets folder (outside the repo, git-ignored)
ASSETS_ROOT = REPO_ROOT.parent / "studio-clippy-assets"

# common subpaths
SEED_SOURCES = REPO_ROOT / "scripts" / "seed_sources.json"
PDF_MANIFEST_DIR = REPO_ROOT / "pdf_manifests"
IMAGE_MANIFEST_DIR = REPO_ROOT / "image_manifests"
SOURCE_TEXTS_PROCESSED = REPO_ROOT / "source_texts" / "processed"
PROJECT_CARDS_DIR = REPO_ROOT / "project_cards"
REFERENCE_CARDS_DIR = REPO_ROOT / "reference_cards"
SELF_KNOWLEDGE_DIR = REPO_ROOT / "self_knowledge_cards"
EXPORTS_RAG = REPO_ROOT / "exports" / "rag_ready"

CONFIDENTIALITY_LEVELS = {
    "public",
    "studio_private",
    "sensitive_distilled",
    "raw_private_vault",
}

# substrings in a path/url that strongly imply private origin
PRIVATE_HINTS = (
    "therapy_raw_vault",
    "private_diaries",
    "raw_private",
    "diary",
    "therapy",
)


def slugify(text: str, maxlen: int = 80) -> str:
    """Make a clean, filesystem-safe filename stem."""
    text = text.strip().lower()
    text = re.sub(r"https?://", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:maxlen] or "untitled"


def is_sidecar(path: Path) -> bool:
    """True for macOS AppleDouble '._' resource-fork sidecar files."""
    return path.name.startswith("._")


def jsonl_files(directory: Path):
    """*.jsonl in a directory, excluding AppleDouble sidecars."""
    return [p for p in sorted(directory.glob("*.jsonl")) if not is_sidecar(p)]


def md_files(base: Path):
    """*.md under base (recursive), excluding sidecars and READMEs."""
    return [
        p
        for p in sorted(base.rglob("*.md"))
        if not is_sidecar(p) and p.name.upper() != "README.MD"
    ]


def read_text(path: Path) -> str:
    """UTF-8 read that tolerates the occasional stray byte."""
    return path.read_text(encoding="utf-8", errors="replace")


def read_jsonl(path: Path) -> list[dict]:
    records = []
    if not path.exists() or is_sidecar(path):
        return records
    for i, line in enumerate(read_text(path).splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError as exc:  # surface, don't crash the whole run
            print(f"  ! {path.name}:{i} invalid JSON: {exc}")
    return records


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def load_seed_sources() -> dict:
    if not SEED_SOURCES.exists():
        return {"sources": [], "search_queries": []}
    return json.loads(SEED_SOURCES.read_text(encoding="utf-8"))


def looks_private(*values: str) -> bool:
    blob = " ".join(v.lower() for v in values if v)
    return any(hint in blob for hint in PRIVATE_HINTS)
