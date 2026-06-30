"""Data-access layer for the Studio Clippy console.

Reads/writes the dataset files directly: project cards (markdown + YAML-ish
frontmatter), the image/pdf manifests (JSONL), self-knowledge cards, and source
texts. No third-party YAML dependency — frontmatter here is flat `key: value`,
which is all the card schema uses.

Confidentiality is first-class: personal uploads default to the git-ignored raw
vault and are never written into the repo or its manifests.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime
from pathlib import Path

# app/ -> repo root
REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_ROOT = REPO_ROOT.parent / "studio-clippy-assets"

PROJECT_CARDS_DIR = REPO_ROOT / "project_cards"
SELF_KNOWLEDGE_DIR = REPO_ROOT / "self_knowledge_cards"
REFERENCE_CARDS_DIR = REPO_ROOT / "reference_cards"
IMAGE_MANIFEST_DIR = REPO_ROOT / "image_manifests"
PDF_MANIFEST_DIR = REPO_ROOT / "pdf_manifests"
SOURCE_TEXTS = REPO_ROOT / "source_texts"
PUBLIC_IMAGE_MANIFEST = IMAGE_MANIFEST_DIR / "public_gallery_manifest.jsonl"
PRIVATE_IMAGE_MANIFEST = IMAGE_MANIFEST_DIR / "private_visual_manifest.jsonl"
PUBLIC_PDF_MANIFEST = PDF_MANIFEST_DIR / "public_pdf_manifest.jsonl"
PRIVATE_PDF_MANIFEST = PDF_MANIFEST_DIR / "private_pdf_manifest.jsonl"
# "Collections" = named Projects that group exhibitions/works (UI: "Project").
COLLECTIONS_FILE = REPO_ROOT / "collections.jsonl"

STATUSES = ["completed", "active", "imagined", "abandoned"]
# Sub-headings used to group "The Work" on the public site (display order).
# Free-form: a card may use any value; unknown types sort after these.
WORK_TYPES = ["Exhibitions", "Series", "Documentation", "Texts"]
CONFIDENTIALITY_LEVELS = [
    "public",
    "studio_private",
    "sensitive_distilled",
    "raw_private_vault",
]
# where each confidentiality level's uploaded files live (under ASSETS_ROOT)
VAULT_SUBDIR = {
    "public": "project_images",
    "studio_private": "project_images",
    "sensitive_distilled": "visual_references",
    "raw_private_vault": "private_diaries",
}
# git-ignored private index (lives OUTSIDE the repo) — filename references only
PRIVATE_INDEX = ASSETS_ROOT / "_private_index.jsonl"


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def slugify(text: str, maxlen: int = 80) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"https?://", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:maxlen] or "untitled"


def _is_sidecar(p: Path) -> bool:
    return p.name.startswith("._")


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="replace")


def read_jsonl(path: Path) -> list[dict]:
    out = []
    if not path.exists() or _is_sidecar(path):
        return out
    for n, line in enumerate(read_text(path).splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            print(f"warn: skipping malformed JSONL line {n} in {path.name}", file=sys.stderr)
    return out


def write_jsonl(path: Path, records: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for r in records:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")


def now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


# --------------------------------------------------------------------------- #
# frontmatter cards
# --------------------------------------------------------------------------- #
def parse_card(path: Path) -> tuple[dict, str]:
    """Return (frontmatter dict, body string)."""
    text = read_text(path)
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    block = text[3:end].strip().splitlines()
    body = text[end + 4 :].lstrip("\n")
    fm: dict[str, str] = {}
    for line in block:
        if ":" in line and not line.strip().startswith("#"):
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm, body


def serialize_card(fm: dict, body: str) -> str:
    lines = ["---"]
    for k, v in fm.items():
        # collapse newlines so a value can never break the frontmatter block
        val = str(v).replace("\r", " ").replace("\n", " ")
        lines.append(f"{k}: {val}")
    lines.append("---")
    lines.append("")
    return "\n".join(lines) + "\n" + body.lstrip("\n")


def _card_paths(base: Path) -> list[Path]:
    if not base.exists():
        return []
    return [
        p
        for p in sorted(base.rglob("*.md"))
        if not _is_sidecar(p) and p.name.upper() != "README.MD"
    ]


def list_projects() -> list[dict]:
    """All project cards with summary metadata + image counts."""
    img_counts = image_counts_by_project()
    out = []
    for p in _card_paths(PROJECT_CARDS_DIR):
        fm, body = parse_card(p)
        pid = fm.get("project_id") or p.stem
        out.append(
            {
                "project_id": pid,
                "title": fm.get("title", p.stem.replace("-", " ").title()),
                "status": fm.get("status", "unknown"),
                "date": fm.get("date", ""),
                "confidentiality": fm.get("confidentiality", "studio_private"),
                "public_website_visible": str(fm.get("public_website_visible", "")).lower() == "true",
                "needs_review": str(fm.get("needs_review", "")).lower() == "true",
                "confidence": fm.get("research_confidence", ""),
                "path": str(p.relative_to(REPO_ROOT)),
                "image_count": img_counts.get(pid, 0),
                "excerpt": _first_para(body),
            }
        )
    out.sort(key=lambda r: (r["status"], r["title"].lower()))
    return out


def _first_para(body: str) -> str:
    # first non-heading, non-marker paragraph
    for chunk in body.split("\n\n"):
        c = chunk.strip()
        if not c or c.startswith("#") or c.startswith("<!--"):
            continue
        return (c[:240] + "…") if len(c) > 240 else c
    return ""


def get_project(pid: str) -> dict | None:
    for p in _card_paths(PROJECT_CARDS_DIR):
        fm, body = parse_card(p)
        if (fm.get("project_id") or p.stem) == pid:
            return {"fm": fm, "body": body, "path": p, "rel": str(p.relative_to(REPO_ROOT))}
    return None


def save_project(pid: str, fm: dict, body: str, new_status: str | None = None) -> Path:
    """Save a project card, moving the file if status changed."""
    proj = get_project(pid)
    if proj is None:
        raise FileNotFoundError(pid)
    path = proj["path"]
    status = (new_status or fm.get("status") or path.parent.name).strip()
    fm["status"] = status
    target_dir = PROJECT_CARDS_DIR / status
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / path.name
    target.write_text(serialize_card(fm, body), encoding="utf-8")
    if target != path and path.exists():
        path.unlink()  # moved between status folders
    return target


def create_project(title: str, status: str, confidentiality: str, date: str, description: str, work_type: str = "Exhibitions") -> str:
    title = " ".join((title or "").split())  # no newlines into frontmatter / "# title"
    pid = slugify(title)
    status = status if status in STATUSES else "imagined"
    fm = {
        "project_id": pid,
        "title": title,
        "date": date or today(),
        "status": status,
        "confidentiality": confidentiality if confidentiality in CONFIDENTIALITY_LEVELS else "studio_private",
        "work_type": work_type or "Exhibitions",
        "source_materials": "studio console intake",
        "related_assets": f"see image_manifests/public_gallery_manifest.jsonl (project: {pid})",
        "needs_review": "true",
    }
    body = _blank_project_body(title, description)
    dest = PROJECT_CARDS_DIR / status / f"{pid}.md"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        pid = f"{pid}-{slugify(now_iso())}"
        fm["project_id"] = pid
        dest = PROJECT_CARDS_DIR / status / f"{pid}.md"
    dest.write_text(serialize_card(fm, body), encoding="utf-8")
    return pid


SECTIONS = [
    "Short description", "Core question", "Social machine", "Fictional device",
    "Real-world system it attaches to", "Audience / participant role",
    "Performer / subject role", "Emotional engine", "Ethical danger",
    "Aesthetic world", "Research method", "Use of real material", "Use of fiction",
    "Emergent behaviour", "Residue / documentation / afterlife",
    "What this project teaches the studio", "What failed or remained unresolved",
    "Possible mutations", "Assistant behaviour rules derived from this project",
]


def _blank_project_body(title: str, description: str) -> str:
    parts = [f"# {title}", ""]
    for s in SECTIONS:
        parts.append(f"## {s}")
        parts.append("")
        if s == "Short description" and description:
            parts.append(description.strip())
        else:
            parts.append("TKTK — interview Ed.")
        parts.append("")
    parts += ["## Feed log", ""]
    return "\n".join(parts)


def _section_header_pos(body: str, section: str) -> int:
    """Index where the '## <section>' header line starts, or -1. Line-anchored,
    so it won't match a near-duplicate heading or a body line containing '## …'."""
    m = re.search(r"(?m)^##[ \t]+" + re.escape(section) + r"[ \t]*$", body)
    return m.start() if m else -1


def _append_line_to_section(body: str, section: str, line: str) -> str:
    pos = _section_header_pos(body, section)
    if pos == -1:
        return body.rstrip() + f"\n\n## {section}\n\n{line}\n"
    eol = body.find("\n", pos)
    after = body.find("\n## ", eol if eol != -1 else pos)
    if after == -1:
        return body.rstrip() + "\n" + line + "\n"
    return body[:after].rstrip() + "\n" + line + "\n" + body[after:]


def append_to_section(body: str, section: str, text: str) -> str:
    """Append a timestamped bullet to a named section, creating it if missing."""
    return _append_line_to_section(body, section, f"- ({now_iso()}) {text.strip()}")


def append_raw_to_section(body: str, section: str, line: str) -> str:
    """Append a raw line (no timestamp) to a section, creating it if missing."""
    return _append_line_to_section(body, section, line)


def set_section(body: str, section: str, text: str) -> str:
    """Replace a section's content with `text` (create the section if missing).
    Level-2 headers in user text are escaped so a blurb can't inject a new
    `## Section` (which split_sections would treat as a real, allowlisted heading)."""
    text = (text or "").strip()
    text = re.sub(r"(?m)^(##\s)", r"\\\1", text)
    block = f"## {section}\n\n{text}\n" if text else f"## {section}\n\n"
    pos = _section_header_pos(body, section)
    if pos == -1:
        return body.rstrip() + "\n\n" + block
    eol = body.find("\n", pos)
    after = body.find("\n## ", eol if eol != -1 else pos)
    tail = body[after + 1:] if after != -1 else ""
    head = body[:pos].rstrip()
    return (head + "\n\n" + block + ("\n" + tail if tail else "")).rstrip() + "\n"


def add_download_link(pid: str, label: str, url: str) -> None:
    """Add a markdown link to a card's Downloads section (surfaces on the site)."""
    proj = get_project(pid)
    if proj is None:
        raise FileNotFoundError(pid)
    body = append_raw_to_section(proj["body"], "Downloads", f"- [{label}]({url})")
    save_project(pid, dict(proj["fm"]), body)


# --------------------------------------------------------------------------- #
# images / manifests
# --------------------------------------------------------------------------- #
def all_images() -> list[dict]:
    recs = []
    for mf in sorted(IMAGE_MANIFEST_DIR.glob("*.jsonl")):
        if _is_sidecar(mf):
            continue
        for r in read_jsonl(mf):
            if r.get("asset_id") == "img_seed_placeholder":
                continue
            r["_manifest"] = mf.name
            recs.append(r)
    return recs


def image_counts_by_project() -> dict[str, int]:
    counts: dict[str, int] = {}
    for r in all_images():
        counts[r.get("project", "")] = counts.get(r.get("project", ""), 0) + 1
    return counts


# --------------------------------------------------------------------------- #
# public website (read-only front-end over the dataset)
# --------------------------------------------------------------------------- #
# STRICT ALLOWLIST. Only these card sections may ever reach the public site.
# Everything else — Ethical danger, What failed or remained unresolved,
# Assistant behaviour rules…, What this project teaches the studio, Private
# notes, Research notes — is excluded *by omission*. We never blocklist; if a
# new section appears it stays private until explicitly added here.
PUBLIC_SECTION_ALLOWLIST = [
    "Short description",
    "Public-facing summary",
    "Venue / context",
    "Sources",
    "Downloads",
]


def split_sections(body: str) -> dict[str, str]:
    """Parse a card body into an ordered {heading: text} map of its '## ' sections."""
    sections: dict[str, str] = {}
    current: str | None = None
    buf: list[str] = []
    for line in body.splitlines():
        m = re.match(r"^##\s+(.+?)\s*$", line)  # '## ' only; '### ' won't match
        if m:
            if current is not None:
                sections[current] = "\n".join(buf).strip()
            current = m.group(1).strip()
            buf = []
        elif current is not None:
            buf.append(line)
    if current is not None:
        sections[current] = "\n".join(buf).strip()
    return sections


def allowlisted_sections(body: str) -> dict[str, str]:
    """Only the sections that are safe to surface publicly. Makes
    PUBLIC_SECTION_ALLOWLIST the actual gate: anything not on it is unreachable
    from the public path, even if a future helper iterates over the result."""
    return {k: v for k, v in split_sections(body).items() if k in PUBLIC_SECTION_ALLOWLIST}


def public_year(date_str: str) -> int:
    """First 4-digit year in a (messy) date string, for sorting newest-first."""
    m = re.search(r"(?:19|20)\d{2}", date_str or "")
    return int(m.group(0)) if m else 0


def venue_line(sections: dict[str, str]) -> str:
    """One-line venue label: first non-empty line of the Venue / context section."""
    for line in sections.get("Venue / context", "").splitlines():
        s = re.sub(r"\*\*", "", line.strip().lstrip("-*•").strip()).strip()
        if s:
            return s
    return ""


def _is_visible_public(fm: dict) -> bool:
    """Double gate: confidentiality must be public AND the visible flag set."""
    return (
        fm.get("confidentiality", "studio_private") == "public"
        and str(fm.get("public_website_visible", "")).lower() == "true"
    )


def public_images(pid: str) -> list[dict]:
    """Public-confidentiality images for a project only."""
    return [
        r
        for r in all_images()
        if r.get("project") == pid and r.get("confidentiality", "studio_private") == "public"
    ]


def _public_blurb(sections: dict[str, str]) -> str:
    """Author's vetted public text if present, else the short description."""
    return sections.get("Public-facing summary") or sections.get("Short description", "")


def public_projects() -> list[dict]:
    """Visible exhibitions for the public site, newest first."""
    out = []
    for p in _card_paths(PROJECT_CARDS_DIR):
        fm, body = parse_card(p)
        if not _is_visible_public(fm):
            continue
        pid = fm.get("project_id") or p.stem
        sections = allowlisted_sections(body)
        imgs = public_images(pid)
        poster = next((i for i in imgs if i.get("poster")), None)
        out.append(
            {
                "project_id": pid,
                "title": fm.get("title", p.stem.replace("-", " ").title()),
                "date": fm.get("date", ""),
                "year": public_year(fm.get("date", "")),
                "venue": venue_line(sections),
                "blurb": _public_blurb(sections),
                "thumb": poster or (imgs[0] if imgs else None),
                "image_count": len(imgs),
                "work_type": (fm.get("work_type") or "Exhibitions").strip(),
            }
        )
    out.sort(key=lambda r: (-r["year"], r["title"].lower()))
    return out


# --------------------------------------------------------------------------- #
# collections ("Projects" that group exhibitions/works)
# --------------------------------------------------------------------------- #
def load_collections() -> list[dict]:
    return read_jsonl(COLLECTIONS_FILE)


def save_collections(cols: list[dict]) -> None:
    write_jsonl(COLLECTIONS_FILE, cols)


def create_collection(title: str, description: str = "") -> str:
    cols = load_collections()
    cid = slugify(title)
    ids = {c.get("id") for c in cols}
    if cid in ids:
        cid = f"{cid}-{slugify(now_iso())}"
    # new projects go to the top
    cols.insert(0, {"id": cid, "title": title.strip(), "description": description.strip(), "members": []})
    save_collections(cols)
    return cid


def reorder_collections(ordered_ids: list[str]) -> None:
    """Reorder collections to match the given id order (unknown ids kept at end)."""
    cols = load_collections()
    idx = {cid: i for i, cid in enumerate(ordered_ids)}
    cols.sort(key=lambda c: idx.get(c.get("id"), len(idx)))
    save_collections(cols)


def delete_collection(cid: str) -> None:
    save_collections([c for c in load_collections() if c.get("id") != cid])


def set_collections_layout(mapping: dict) -> None:
    """Update listed collections. mapping[cid] may be an ordered pid list, or a
    dict {members:[...], title, description}."""
    cols = load_collections()
    for c in cols:
        if c.get("id") not in mapping:
            continue
        v = mapping[c["id"]]
        if isinstance(v, dict):
            if v.get("title", "").strip():
                c["title"] = v["title"].strip()
            if "description" in v:
                c["description"] = v["description"].strip()
            members = v.get("members", [])
        else:
            members = v
        seen, out = set(), []
        for pid in members:
            if pid and pid not in seen:
                seen.add(pid)
                out.append(pid)
        c["members"] = out
    save_collections(cols)


def public_work_layout() -> list[dict]:
    """Groups for 'The Work': collections first (in order), then any ungrouped
    works by work_type. Each group is {type: label, projects: [...]}."""
    projs = public_projects()
    by_id = {p["project_id"]: p for p in projs}
    used, groups = set(), []
    for c in load_collections():
        members = [by_id[pid] for pid in c.get("members", []) if pid in by_id and pid not in used]
        if not members:
            continue
        used.update(m["project_id"] for m in members)
        groups.append({"type": c["title"], "projects": members,
                       "is_project": True, "description": c.get("description", "")})
    leftover = {}
    for p in projs:
        if p["project_id"] not in used:
            leftover.setdefault(p["work_type"], []).append(p)
    order = WORK_TYPES + sorted(t for t in leftover if t not in WORK_TYPES)
    for t in order:
        if t in leftover:
            groups.append({"type": t, "projects": leftover[t],
                           "is_project": False, "description": ""})
    return groups


def public_selected_works(limit: int = 40) -> list[dict]:
    """Images for the 'Selected Work' carousel.

    If any images are flagged `selected_work` (curated in the studio backend),
    show exactly those, ordered by `selected_order`. Otherwise fall back to one
    hero image per visible exhibition so the carousel is never empty.
    """
    projs = public_projects()
    title = {p["project_id"]: p["title"] for p in projs}
    visible = set(title)

    featured = [
        r for r in all_images()
        if r.get("selected_work")
        and r.get("project") in visible
        and r.get("confidentiality", "studio_private") == "public"
    ]
    if featured:
        featured.sort(key=lambda r: (r.get("selected_order", 0), r.get("asset_id", "")))
        out = []
        for r in featured[:limit]:
            rec = dict(r)
            rec["_project_id"] = r.get("project")
            rec["_title"] = title.get(r.get("project"), "")
            out.append(rec)
        return out

    out = []
    for proj in projs:
        if proj["thumb"]:
            rec = dict(proj["thumb"])
            rec["_project_id"] = proj["project_id"]
            rec["_title"] = proj["title"]
            out.append(rec)
        if len(out) >= limit:
            break
    return out


def set_poster_image(pid: str, asset_id: str) -> None:
    """Mark one image as the project's poster/tile; clear the flag on its others."""
    for mf in (PUBLIC_IMAGE_MANIFEST, PRIVATE_IMAGE_MANIFEST):
        recs = read_jsonl(mf)
        changed = False
        for r in recs:
            if r.get("project") != pid:
                continue
            want = r.get("asset_id") == asset_id
            if want and not r.get("poster"):
                r["poster"] = True
                changed = True
            elif not want and r.get("poster"):
                r.pop("poster", None)
                changed = True
        if changed:
            write_jsonl(mf, recs)


def set_selected_works(ordered_ids: list[str]) -> None:
    """Mark exactly these image asset_ids as Selected Work, in the given order;
    clear the flag on all others."""
    order = {aid: i for i, aid in enumerate(ordered_ids)}
    for mf in (PUBLIC_IMAGE_MANIFEST, PRIVATE_IMAGE_MANIFEST):
        recs = read_jsonl(mf)
        changed = False
        for r in recs:
            aid = r.get("asset_id")
            if aid in order:
                if not r.get("selected_work") or r.get("selected_order") != order[aid]:
                    r["selected_work"] = True
                    r["selected_order"] = order[aid]
                    changed = True
            elif r.get("selected_work") or "selected_order" in r:
                r.pop("selected_work", None)
                r.pop("selected_order", None)
                changed = True
        if changed:
            write_jsonl(mf, recs)


def _parse_sources(text: str) -> list[dict]:
    """Turn a Sources section into {text, url} link items (url may be empty)."""
    items = []
    for line in text.splitlines():
        s = line.strip().lstrip("-*•").strip()
        if not s:
            continue
        m = re.search(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", s)
        if m:
            items.append({"text": m.group(1).strip(), "url": m.group(2)})
            continue
        m = re.search(r"https?://[^\s)]+", s)
        if m:
            label = s.replace(m.group(0), "").strip(" —-:·|*").strip()
            items.append({"text": label or m.group(0), "url": m.group(0)})
        else:
            items.append({"text": re.sub(r"\*\*", "", s), "url": ""})
    return items


def public_exhibition(pid: str) -> dict | None:
    """Public-safe view of one exhibition, or None if not public+visible.

    Only allowlisted sections are surfaced; the raw body is never returned.
    """
    proj = get_project(pid)
    if not proj or not _is_visible_public(proj["fm"]):
        return None
    fm = proj["fm"]
    sections = allowlisted_sections(proj["body"])
    sources = _parse_sources(sections.get("Sources", ""))
    booklets, press = [], []
    for s in sources:
        url = (s.get("url") or "").lower()
        if not url:
            continue
        if url.endswith(".pdf"):
            booklets.append(s)
        elif "/exhibitions/" in url or "/artists/" in url or "goo.gl/maps" in url:
            continue  # the gallery's own pages / map pin
        else:
            press.append(s)
    return {
        # NB: full `fm` deliberately NOT exposed to the public template —
        # only the specific public-safe fields below.
        "project_id": pid,
        "title": fm.get("title", pid),
        "date": fm.get("date", ""),
        "venue": venue_line(sections),
        "venue_full": sections.get("Venue / context", ""),
        "blurb": _public_blurb(sections),
        "sources": sources,
        "booklets": booklets,
        "press": press,
        "downloads": _parse_sources(sections.get("Downloads", "")),
        "images": public_images(pid),
    }


def venue_is_ci(venue: str) -> bool:
    return "carlos/ishikawa" in (venue or "").lower()


# Friendly labels for known press / source domains (for the Press & Texts list).
_PRESS_DOMAINS = {
    "frieze.com": "Frieze", "ocula.com": "Ocula", "artlyst.com": "Artlyst",
    "fadmagazine.com": "FAD Magazine", "timeout.com": "Time Out",
    "tank.tv": "TANK", "rhizome.org": "Rhizome", "newmuseum.org": "New Museum",
    "artrabbit.com": "ArtRabbit", "curamagazine.com": "CURA",
    "artvisor.com": "Artvisor", "ofluxo.net": "O Fluxo",
    "computerworld.com": "Computerworld", "hek.ch": "HeK Basel",
    "gamescenes.org": "GameScenes", "theseenjournal.org": "The Seen",
    "newexhibitions.com": "New Exhibitions", "wikipedia.org": "Wikipedia",
    "arsenalcontemporary.com": "Arsenal Contemporary", "oomtogether.com": "Oom",
    "soundcloud.com": "SoundCloud", "vimeo.com": "Vimeo",
}


def _press_label(url: str) -> str:
    host = re.sub(r"^https?://(www\.)?", "", url or "").split("/")[0].lower()
    for dom, name in _PRESS_DOMAINS.items():
        if dom in host:
            return name
    return host or "Link"


def public_library() -> dict:
    """Aggregate Press & Texts and Publications (booklets) across visible shows."""
    press, pubs, seen = [], [], set()
    for proj in public_projects():
        ex = public_exhibition(proj["project_id"])
        if not ex:
            continue
        for s in ex["sources"]:
            url = (s.get("url") or "").strip()
            if not url:
                continue
            low = url.lower()
            if low.endswith(".pdf"):
                pubs.append({"title": proj["title"], "year": proj["year"],
                             "url": url, "pid": proj["project_id"]})
            elif "/exhibitions/" in low or "goo.gl/maps" in low or "/artists/" in low:
                continue  # the gallery's own pages / map pin
            else:
                label = _press_label(url)
                key = (label, proj["project_id"])
                if key in seen:
                    continue
                seen.add(key)
                press.append({"label": label, "title": proj["title"],
                              "year": proj["year"], "url": url})
    press.sort(key=lambda r: (-r["year"], r["label"]))
    pubs.sort(key=lambda r: (-r["year"], r["title"]))
    return {"press": press, "publications": pubs}


def public_cv() -> list[dict]:
    """Chronological exhibition list for the CV section."""
    return [
        {"year": p["year"], "title": p["title"], "venue": p["venue"],
         "pid": p["project_id"]}
        for p in public_projects()
    ]


def set_public_visible(pid: str, value: bool) -> None:
    """Flip a card's public_website_visible flag (hand-pick toggle)."""
    proj = get_project(pid)
    if proj is None:
        raise FileNotFoundError(pid)
    fm = dict(proj["fm"])
    fm["public_website_visible"] = "true" if value else "false"
    save_project(pid, fm, proj["body"])


def add_image_by_url(project: str, url: str, caption: str, confidentiality: str, source_page: str = "") -> dict:
    import hashlib

    url = (url or "").strip()
    if not re.match(r"(?i)^https?://", url):
        return {"error": "URL must start with http:// or https://"}

    manifest = PRIVATE_IMAGE_MANIFEST if confidentiality in ("sensitive_distilled", "raw_private_vault") else PUBLIC_IMAGE_MANIFEST
    if confidentiality == "raw_private_vault":
        raise ValueError("raw_private_vault images are not written to repo manifests")
    recs = read_jsonl(manifest)
    recs = [r for r in recs if r.get("asset_id") != "img_seed_placeholder"]
    aid = f"img_{slugify(project or 'unfiled')}_{hashlib.sha1(url.encode()).hexdigest()[:8]}"
    if any(r.get("asset_id") == aid for r in recs):
        return {"asset_id": aid, "duplicate": True}
    rec = {
        "asset_id": aid, "project": project, "type": "image", "source_url": url,
        "local_path": "", "drive_url": "", "caption": caption, "description": "",
        "conceptual_tags": [], "visual_tags": [], "people_visible": False,
        "rights": "verify before reuse", "photographer": "", "source_page": source_page,
        "confidentiality": confidentiality,
    }
    recs.append(rec)
    write_jsonl(manifest, recs)
    return rec


def save_uploaded_image(project: str, filename: str, data: bytes, caption: str, confidentiality: str) -> dict:
    """Save an uploaded image file and (unless raw) record it in a manifest."""
    import hashlib

    subdir = VAULT_SUBDIR.get(confidentiality, "project_images")
    dest_dir = ASSETS_ROOT / subdir / (slugify(project) if project else "unfiled")
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe = slugify(Path(filename).stem) + Path(filename).suffix.lower()
    dest = dest_dir / safe
    n = 1
    while dest.exists():
        dest = dest_dir / f"{Path(safe).stem}-{n}{Path(safe).suffix}"
        n += 1
    dest.write_bytes(data)
    rel = str(dest.relative_to(ASSETS_ROOT.parent))

    if confidentiality == "raw_private_vault":
        _append_private_index({"kind": "image", "project": project, "path": rel, "added": now_iso(), "confidentiality": confidentiality})
        return {"saved": rel, "manifest": None, "private": True}

    manifest = PRIVATE_IMAGE_MANIFEST if confidentiality == "sensitive_distilled" else PUBLIC_IMAGE_MANIFEST
    recs = [r for r in read_jsonl(manifest) if r.get("asset_id") != "img_seed_placeholder"]
    aid = f"img_{slugify(project or 'unfiled')}_{hashlib.sha1(rel.encode()).hexdigest()[:8]}"
    recs.append({
        "asset_id": aid, "project": project, "type": "image", "source_url": "",
        "local_path": rel, "drive_url": "", "caption": caption, "description": "",
        "conceptual_tags": [], "visual_tags": [], "people_visible": False,
        "rights": "", "photographer": "", "source_page": "", "confidentiality": confidentiality,
    })
    write_jsonl(manifest, recs)
    return {"saved": rel, "manifest": manifest.name, "private": False}


def all_pdfs() -> list[dict]:
    recs = []
    for mf in sorted(PDF_MANIFEST_DIR.glob("*.jsonl")):
        if _is_sidecar(mf):
            continue
        for r in read_jsonl(mf):
            r["_manifest"] = mf.name
            recs.append(r)
    return recs


def project_pdfs(pid: str) -> list[dict]:
    return [r for r in all_pdfs() if r.get("project") == pid]


def save_uploaded_pdf(project: str, filename: str, data: bytes, title: str, confidentiality: str) -> dict:
    """Save an uploaded PDF and (unless raw) record it in a PDF manifest."""
    import hashlib

    dest_dir = ASSETS_ROOT / "pdfs" / (slugify(project) if project else "unfiled")
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe = slugify(Path(filename).stem) + ".pdf"
    dest = dest_dir / safe
    n = 1
    while dest.exists():
        dest = dest_dir / f"{Path(safe).stem}-{n}.pdf"
        n += 1
    dest.write_bytes(data)
    rel = str(dest.relative_to(ASSETS_ROOT.parent))
    title = title or Path(filename).stem

    if confidentiality == "raw_private_vault":
        _append_private_index({"kind": "pdf", "project": project, "path": rel, "added": now_iso(), "confidentiality": confidentiality})
        return {"saved": rel, "manifest": None, "private": True, "local_path": rel, "title": title}

    manifest = PRIVATE_PDF_MANIFEST if confidentiality == "sensitive_distilled" else PUBLIC_PDF_MANIFEST
    recs = read_jsonl(manifest)
    aid = f"pdf_{slugify(project or 'unfiled')}_{hashlib.sha1(rel.encode()).hexdigest()[:8]}"
    recs.append({
        "asset_id": aid, "project": project, "type": "pdf", "local_path": rel,
        "title": title, "source_url": "", "confidentiality": confidentiality,
    })
    write_jsonl(manifest, recs)
    return {"saved": rel, "manifest": manifest.name, "private": False, "local_path": rel, "title": title}


# --------------------------------------------------------------------------- #
# intake: notes, links, personal uploads, distillation
# --------------------------------------------------------------------------- #
def save_note(title: str, text: str, confidentiality: str, project: str = "") -> str:
    """Save a free-text note. Public/studio -> source_texts; sensitive/raw -> vault."""
    stamp = today()
    name = f"{stamp}-{slugify(title or 'note')}.md"
    header = f"# {title or 'Note'}\n\n_added {now_iso()} · confidentiality: {confidentiality}"
    if project:
        header += f" · project: {project}"
    header += "_\n\n"
    content = header + text.strip() + "\n"

    if confidentiality in ("public", "studio_private"):
        sub = "public" if confidentiality == "public" else "private"
        dest = SOURCE_TEXTS / sub / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(content, encoding="utf-8")
        return str(dest.relative_to(REPO_ROOT))
    # sensitive/raw -> git-ignored vault, never in repo
    dest = ASSETS_ROOT / "private_diaries" / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content, encoding="utf-8")
    _append_private_index({"kind": "note", "title": title, "path": str(dest.relative_to(ASSETS_ROOT.parent)), "added": now_iso(), "confidentiality": confidentiality})
    return str(dest.relative_to(ASSETS_ROOT.parent))


def save_personal_file(filename: str, data: bytes, confidentiality: str = "raw_private_vault") -> str:
    """Personal upload. Defaults to the raw vault (git-ignored, never surfaced)."""
    folder = "therapy_raw_vault" if confidentiality == "raw_private_vault" else VAULT_SUBDIR.get(confidentiality, "private_diaries")
    dest_dir = ASSETS_ROOT / folder
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe = slugify(Path(filename).stem) + Path(filename).suffix.lower()
    dest = dest_dir / f"{today()}-{safe}"
    n = 1
    while dest.exists():
        dest = dest_dir / f"{today()}-{Path(safe).stem}-{n}{Path(safe).suffix}"
        n += 1
    dest.write_bytes(data)
    rel = str(dest.relative_to(ASSETS_ROOT.parent))
    _append_private_index({"kind": "personal_file", "original": filename, "path": rel, "added": now_iso(), "confidentiality": confidentiality})
    return rel


def _append_private_index(rec: dict) -> None:
    """Append to the git-ignored private index (lives outside the repo)."""
    PRIVATE_INDEX.parent.mkdir(parents=True, exist_ok=True)
    with PRIVATE_INDEX.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n")


def list_private_index() -> list[dict]:
    return read_jsonl(PRIVATE_INDEX)


def create_self_knowledge_card(pattern: str, fields: dict) -> str:
    """Write a distilled self-knowledge card (sensitive_distilled, never raw)."""
    cid = slugify(pattern)
    fm = {
        "card_id": cid,
        "confidentiality": "sensitive_distilled",
        "source_type": fields.get("source_type", "mixed"),
        "do_not_quote_raw": "true",
        "needs_review": "true",
    }
    body_sections = [
        ("Description", fields.get("description", "")),
        ("Where it appears", fields.get("where", "")),
        ("Emotional tone", fields.get("tone", "")),
        ("How it helps the work", fields.get("helps", "")),
        ("How it blocks the work", fields.get("blocks", "")),
        ("Useful Studio Clippy response", fields.get("useful", "")),
        ("Forbidden Studio Clippy response", fields.get("forbidden", "")),
        ("Related projects", fields.get("projects", "")),
        ("Related references", fields.get("references", "")),
    ]
    parts = [f"# {pattern}", ""]
    for h, v in body_sections:
        parts += [f"## {h}", "", (v.strip() or "TKTK"), ""]
    body = "\n".join(parts)
    SELF_KNOWLEDGE_DIR.mkdir(parents=True, exist_ok=True)
    dest = SELF_KNOWLEDGE_DIR / f"{cid}.md"
    if dest.exists():
        cid = f"{cid}-{slugify(now_iso())}"
        dest = SELF_KNOWLEDGE_DIR / f"{cid}.md"
        fm["card_id"] = cid
    dest.write_text(serialize_card(fm, body), encoding="utf-8")
    return cid


def stats() -> dict:
    projects = list_projects()
    imgs = all_images()
    by_status: dict[str, int] = {}
    needs_review = 0
    for p in projects:
        by_status[p["status"]] = by_status.get(p["status"], 0) + 1
        if p["needs_review"]:
            needs_review += 1
    return {
        "projects": len(projects),
        "by_status": by_status,
        "images": len(imgs),
        "needs_review": needs_review,
        "self_knowledge": len(_card_paths(SELF_KNOWLEDGE_DIR)),
        "references": len(_card_paths(REFERENCE_CARDS_DIR)),
        "private_items": len(list_private_index()),
    }
