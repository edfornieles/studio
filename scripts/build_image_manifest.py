#!/usr/bin/env python3
"""Scan downloaded images and build/update an image JSONL manifest.

Records dimensions, file size and a content hash, and creates placeholder fields
for caption, tags, rights and project so they can be filled in by hand later.
Existing records (matched by file hash) are preserved — only missing technical
fields are filled, never your hand-written captions/tags.

Usage:
    python scripts/build_image_manifest.py
    python scripts/build_image_manifest.py --dir project_images
    python scripts/build_image_manifest.py --manifest image_manifests/public_gallery_manifest.jsonl

Pillow (pip install Pillow) is used for dimensions; without it, dimensions are
left blank.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

from _common import ASSETS_ROOT, IMAGE_MANIFEST_DIR, read_jsonl, slugify, write_jsonl

IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def dimensions(path: Path):
    try:
        from PIL import Image  # lazy
    except ImportError:
        return None, None
    try:
        with Image.open(path) as im:
            return im.width, im.height
    except Exception:  # noqa: BLE001
        return None, None


def blank_record(path: Path, rel: str, h: str, w, ht, size) -> dict:
    return {
        "asset_id": f"img_{slugify(path.stem)}_{h[:8]}",
        "project": "",
        "type": "image",
        "source_url": "",
        "local_path": rel,
        "drive_url": "",
        "caption": "",
        "description": "",
        "conceptual_tags": [],
        "visual_tags": [],
        "people_visible": False,
        "rights": "",
        "photographer": "",
        "source_page": "",
        "confidentiality": "public",
        "width": w,
        "height": ht,
        "bytes": size,
        "sha256": h,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", default="project_images", help="assets subfolder to scan")
    ap.add_argument(
        "--manifest",
        default=str(IMAGE_MANIFEST_DIR / "public_gallery_manifest.jsonl"),
        help="manifest file to update",
    )
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    scan_dir = ASSETS_ROOT / args.dir
    if not scan_dir.exists():
        print(f"No such folder: {scan_dir}. Run download_assets.py first.")
        return 0

    manifest_path = Path(args.manifest)
    existing = read_jsonl(manifest_path)
    # drop placeholder rows
    existing = [r for r in existing if r.get("asset_id") != "img_seed_placeholder"]
    by_hash = {r.get("sha256"): r for r in existing if r.get("sha256")}

    images = [
        p
        for p in sorted(scan_dir.rglob("*"))
        if p.suffix.lower() in IMG_EXT and not p.name.startswith("._")
    ]
    added = 0
    for img in images:
        h = file_hash(img)
        rel = str(img.relative_to(ASSETS_ROOT.parent))
        if h in by_hash:
            rec = by_hash[h]
            # backfill technical fields only
            if not rec.get("local_path"):
                rec["local_path"] = rel
            continue
        w, ht = dimensions(img)
        rec = blank_record(img, rel, h, w, ht, img.stat().st_size)
        existing.append(rec)
        by_hash[h] = rec
        added += 1
        print(f"  + {img.name} ({w}x{ht})")

    if args.dry_run:
        print(f"[dry-run] would write {len(existing)} record(s) ({added} new) to {manifest_path}")
        return 0

    write_jsonl(manifest_path, existing)
    print(f"Wrote {len(existing)} record(s) ({added} new) to {manifest_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
