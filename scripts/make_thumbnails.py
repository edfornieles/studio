#!/usr/bin/env python3
"""Make small browsing thumbnails of downloaded images.

Originals are never modified. Thumbnails are written to
studio-clippy-assets/thumbnails/ mirroring the source subfolder structure.

Usage:
    python scripts/make_thumbnails.py
    python scripts/make_thumbnails.py --dir project_images --size 320
    python scripts/make_thumbnails.py --dry-run

Requires Pillow (pip install Pillow).
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from _common import ASSETS_ROOT

IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".tif", ".tiff"}
THUMB_DIR = ASSETS_ROOT / "thumbnails"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", default="project_images", help="assets subfolder to scan")
    ap.add_argument("--size", type=int, default=400, help="max edge in px")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.dry_run:
        try:
            from PIL import Image  # noqa: F401
        except ImportError:
            print("Pillow not installed. `pip install Pillow` or use --dry-run.")
            return 2

    scan_dir = ASSETS_ROOT / args.dir
    if not scan_dir.exists():
        print(f"No such folder: {scan_dir}.")
        return 0

    images = [p for p in sorted(scan_dir.rglob("*")) if p.suffix.lower() in IMG_EXT]
    made = 0
    for img in images:
        rel = img.relative_to(ASSETS_ROOT)
        out = THUMB_DIR / rel.parent / f"{img.stem}_thumb.jpg"
        if args.dry_run:
            print(f"  [dry-run] {img.name} -> {out}")
            continue
        if out.exists():
            continue
        try:
            from PIL import Image

            out.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(img) as im:
                im = im.convert("RGB")
                im.thumbnail((args.size, args.size))
                im.save(out, "JPEG", quality=82)
            made += 1
            print(f"  + {out.relative_to(ASSETS_ROOT)}")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! failed {img.name}: {exc}")

    print(f"Made {made} thumbnail(s) in {THUMB_DIR}" if not args.dry_run else "(dry run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
