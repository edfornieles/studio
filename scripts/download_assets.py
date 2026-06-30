#!/usr/bin/env python3
"""Download / index public assets for the Studio Clippy dataset.

Reads seed URLs from scripts/seed_sources.json (and any existing manifest files),
fetches images and PDFs, avoids duplicate downloads, creates clean filenames,
preserves source URL + metadata, and writes a combined asset_manifest.{jsonl,csv}.

Be gentle: this is a respectful indexer, not an aggressive crawler. For a 'page'
seed it fetches the page once and extracts in-page image/PDF links (one level
deep, same registrable domain only). It does NOT recurse the whole site.

Usage:
    python scripts/download_assets.py --dry-run
    python scripts/download_assets.py --source carlosishikawa
    python scripts/download_assets.py            # download everything

Requires `requests` for live downloads (pip install requests). --dry-run needs
nothing.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse

from _common import (
    ASSETS_ROOT,
    REPO_ROOT,
    load_seed_sources,
    slugify,
    write_jsonl,
)

IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}
PDF_EXT = {".pdf"}
USER_AGENT = "StudioClippyIndexer/0.1 (respectful; contact studio)"
POLITE_DELAY_S = 1.5  # between network requests


class _LinkParser(HTMLParser):
    """Collect href/src links from a page."""

    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []

    def handle_starttag(self, tag, attrs):
        for key, val in attrs:
            if key in ("href", "src") and val:
                self.links.append(val)


def _ext_of(url: str) -> str:
    return Path(urlparse(url).path).suffix.lower()


def _registrable(host: str) -> str:
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def _fetch(url: str):
    import requests  # lazy

    return requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)


def expand_sources(seeds: dict, source_filter: str | None) -> list[dict]:
    """Turn seed entries into a flat list of downloadable asset descriptors."""
    out: list[dict] = []
    for s in seeds.get("sources", []):
        if source_filter and s.get("source") != source_filter:
            continue
        kind = s.get("type")
        if kind in ("pdf", "image"):
            out.append(s)
        elif kind == "page":
            out.append(s)  # handled specially: fetch + extract links
    return out


def discover_from_page(page: dict) -> list[dict]:
    """Fetch a page and return image/PDF asset descriptors found one level deep."""
    url = page["url"]
    try:
        resp = _fetch(url)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        print(f"  ! failed to fetch page {url}: {exc}")
        return []
    parser = _LinkParser()
    parser.feed(resp.text)
    base_host = _registrable(urlparse(url).netloc)
    found: list[dict] = []
    seen: set[str] = set()
    for link in parser.links:
        full = urljoin(url, link)
        if full in seen:
            continue
        seen.add(full)
        ext = _ext_of(full)
        if _registrable(urlparse(full).netloc) != base_host:
            continue  # stay on the same site
        if ext in IMG_EXT:
            kind = "image"
        elif ext in PDF_EXT:
            kind = "pdf"
        else:
            continue
        found.append(
            {
                "source": page.get("source", ""),
                "type": kind,
                "url": full,
                "project": page.get("project", ""),
                "source_page": url,
                "confidentiality": page.get("confidentiality", "public"),
                "conceptual_tags": page.get("conceptual_tags", []),
            }
        )
    print(f"  · discovered {len(found)} asset link(s) on {url}")
    return found


def dest_for(asset: dict) -> Path:
    kind = asset["type"]
    sub = "pdfs" if kind == "pdf" else "project_images"
    stem = slugify(f"{asset.get('source','')}-{Path(urlparse(asset['url']).path).name}")
    return ASSETS_ROOT / sub / stem


def download_one(asset: dict, dry_run: bool) -> dict:
    url = asset["url"]
    dest = dest_for(asset)
    rec = {
        "asset_id": f"{asset['type']}_{slugify(asset.get('source',''))}_{slugify(Path(urlparse(url).path).stem)}",
        "project": asset.get("project", ""),
        "type": asset["type"],
        "source_url": url,
        "local_path": str(dest.relative_to(ASSETS_ROOT.parent)) if dest else "",
        "source_page": asset.get("source_page", ""),
        "confidentiality": asset.get("confidentiality", "public"),
        "conceptual_tags": asset.get("conceptual_tags", []),
        "rights": asset.get("rights", "verify before reuse"),
        "downloaded": False,
    }
    if dry_run:
        print(f"  [dry-run] would download {url} -> {dest}")
        return rec
    if dest.exists():
        print(f"  = exists, skipping {dest.name}")
        rec["downloaded"] = True
        return rec
    try:
        resp = _fetch(url)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(resp.content)
        rec["sha256"] = hashlib.sha256(resp.content).hexdigest()
        rec["bytes"] = len(resp.content)
        rec["downloaded"] = True
        print(f"  + saved {dest.name} ({len(resp.content)} bytes)")
        time.sleep(POLITE_DELAY_S)
    except Exception as exc:  # noqa: BLE001
        rec["error"] = str(exc)
        print(f"  ! failed {url}: {exc}")
    return rec


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true", help="list actions, download nothing")
    ap.add_argument("--source", help="only process this source key (e.g. carlosishikawa)")
    ap.add_argument(
        "--out",
        default=str(REPO_ROOT / "asset_manifest"),
        help="output manifest path stem (.jsonl and .csv are appended). This is a "
        "generated combined download log (git-ignored); curated records belong in "
        "image_manifests/ and pdf_manifests/.",
    )
    args = ap.parse_args()

    if not args.dry_run:
        try:
            import requests  # noqa: F401
        except ImportError:
            print("requests not installed. `pip install requests` or use --dry-run.")
            return 2

    seeds = load_seed_sources()
    descriptors = expand_sources(seeds, args.source)
    if not descriptors:
        print("No matching seed sources.")
        return 0

    records: list[dict] = []
    for d in descriptors:
        if d.get("type") == "page":
            print(f"Page: {d['url']}")
            if args.dry_run:
                print("  [dry-run] would fetch page and extract image/PDF links")
                records.append(
                    {
                        "asset_id": f"page_{slugify(d.get('source',''))}",
                        "type": "page",
                        "source_url": d["url"],
                        "project": d.get("project", ""),
                        "confidentiality": d.get("confidentiality", "public"),
                        "downloaded": False,
                    }
                )
                continue
            for child in discover_from_page(d):
                records.append(download_one(child, args.dry_run))
            time.sleep(POLITE_DELAY_S)
        else:
            print(f"{d['type'].upper()}: {d['url']}")
            records.append(download_one(d, args.dry_run))

    # write combined manifest
    out_stem = Path(args.out)
    write_jsonl(out_stem.with_suffix(".jsonl"), records)
    csv_path = out_stem.with_suffix(".csv")
    fields = sorted({k for r in records for k in r})
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for r in records:
            w.writerow({k: r.get(k, "") for k in fields})

    print(f"\nWrote {len(records)} record(s) to:")
    print(f"  {out_stem.with_suffix('.jsonl')}")
    print(f"  {csv_path}")
    if args.dry_run:
        print("(dry run — nothing downloaded)")
    if seeds.get("search_queries"):
        print("\nManual search queries still to action (see seed_sources.json):")
        for q in seeds["search_queries"]:
            print(f"  - {q}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
