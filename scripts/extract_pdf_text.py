#!/usr/bin/env python3
"""Extract text from downloaded PDFs into source_texts/processed/.

Walks the assets pdf folder (and any PDFs referenced in pdf_manifests/*.jsonl),
extracts text with pypdf, writes <stem>.txt into source_texts/processed/, and
updates the matching PDF manifest record's `extracted_text_path`.

Usage:
    python scripts/extract_pdf_text.py
    python scripts/extract_pdf_text.py --dry-run

Requires pypdf (pip install pypdf).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _common import (
    ASSETS_ROOT,
    PDF_MANIFEST_DIR,
    REPO_ROOT,
    SOURCE_TEXTS_PROCESSED,
    jsonl_files,
    read_jsonl,
    slugify,
    write_jsonl,
)

PDF_DIR = ASSETS_ROOT / "pdfs"


def extract(pdf_path: Path) -> str:
    from pypdf import PdfReader  # lazy

    reader = PdfReader(str(pdf_path))
    chunks = []
    for page in reader.pages:
        chunks.append(page.extract_text() or "")
    return "\n\n".join(chunks).strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.dry_run:
        try:
            import pypdf  # noqa: F401
        except ImportError:
            print("pypdf not installed. `pip install pypdf` or use --dry-run.")
            return 2

    pdfs = sorted(PDF_DIR.glob("*.pdf")) if PDF_DIR.exists() else []
    if not pdfs:
        print(f"No PDFs found in {PDF_DIR}. Run download_assets.py first.")
    SOURCE_TEXTS_PROCESSED.mkdir(parents=True, exist_ok=True)

    # map source_url/local_path -> manifest record for update
    manifests = {p: read_jsonl(p) for p in jsonl_files(PDF_MANIFEST_DIR)}

    extracted: dict[str, str] = {}  # pdf filename stem -> text path (repo-relative)
    for pdf in pdfs:
        out_txt = SOURCE_TEXTS_PROCESSED / f"{slugify(pdf.stem)}.txt"
        if args.dry_run:
            print(f"  [dry-run] {pdf.name} -> {out_txt}")
            continue
        try:
            text = extract(pdf)
            out_txt.write_text(text, encoding="utf-8")
            rel = str(out_txt.relative_to(REPO_ROOT))
            extracted[pdf.name] = rel
            print(f"  + {pdf.name} -> {rel} ({len(text)} chars)")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! failed {pdf.name}: {exc}")

    # update manifests where local_path basename matches an extracted pdf
    if not args.dry_run and extracted:
        for path, records in manifests.items():
            changed = False
            for rec in records:
                base = Path(rec.get("local_path", "")).name
                if base in extracted and not rec.get("extracted_text_path"):
                    rec["extracted_text_path"] = extracted[base]
                    changed = True
            if changed:
                write_jsonl(path, records)
                print(f"  ~ updated {path.name}")

    print("Done." if not args.dry_run else "(dry run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
