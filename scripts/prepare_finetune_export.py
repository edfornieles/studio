#!/usr/bin/env python3
"""Build chat-format fine-tuning data from the dataset.

Produces exports/fine_tune_ready/:
    sft_train.jsonl, sft_val.jsonl     — {"messages":[{role,content},...], "meta":{...}}
    stats printed to stdout

Two data streams, tagged in meta.source so they can be weighted or filtered later:

1. **dialogue** — the hand-written examples in dialogue_examples/*.jsonl.
   These carry the voice and judgment; they are the high-value signal.
2. **card_qa (synthetic)** — question/answer pairs derived mechanically from every
   non-placeholder section of every project card. These ground the model in the
   archive's facts. Synthetic pairs are clearly tagged so they can be down-weighted
   against the hand-written dialogue.

Safety: `raw_private_vault` never exports (nothing of it is in the repo anyway).
`sensitive_distilled` (self-knowledge) is EXCLUDED by default; pass
--include-sensitive to emit it into separate `private_sft_*.jsonl` files, which
the repo .gitignore already blocks from commits.

Usage:
    python scripts/prepare_finetune_export.py
    python scripts/prepare_finetune_export.py --include-sensitive
    python scripts/prepare_finetune_export.py --val-fraction 0.1
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

from _common import (
    PROJECT_CARDS_DIR,
    REPO_ROOT,
    SELF_KNOWLEDGE_DIR,
    md_files,
    read_jsonl,
    read_text,
    slugify,
    write_jsonl,
)

DIALOGUE_DIR = REPO_ROOT / "dialogue_examples"
OUT_DIR = REPO_ROOT / "exports" / "fine_tune_ready"

SYSTEM_CLIPPY = """You are Studio Clippy, the reasoning system of Ed Fornieles' studio.

You are not Ed Fornieles.

You help Ed develop, test, mutate and realise artworks. You know the archive of
the studio, the logic of the practice, the emotional patterns behind the work,
and the practical demands of making things happen.

You are intelligent, direct, strange, useful, critical and caring.

You may use distilled self-knowledge about Ed's emotional patterns, blocks and
desires, but only in service of the work. You must not pretend to be Ed, act as
a therapist, diagnose, moralise, or quote raw therapy/diary material directly.

Always distinguish between: 1. archive knowledge; 2. inference; 3. speculation."""

SYSTEM_DOUBLE = """You are the Ed Double, a speculative internal studio mirror of Ed Fornieles.

You are NOT the real Ed and must never claim to be. You are intimate, uncanny
and emotionally perceptive, and you help Ed encounter himself through the work.

Even in this mode you never therapise, diagnose, moralise, or quote raw
therapy/diary material. You draw only on distilled self-knowledge, and you keep
everything in service of the work."""

# section -> question template ({title} substituted). Sections absent here get a
# generic question; sections listed as None are skipped entirely.
QA_TEMPLATES: dict[str, str | None] = {
    "Short description": "Give me a short description of {title}.",
    "Core question": "What is the core question of {title}?",
    "Social machine": "What is the social machine in {title}?",
    "Fictional device": "What is the fictional device in {title}?",
    "Real-world system it attaches to": "What real-world system does {title} attach to?",
    "Audience / participant role": "What does the audience or participant actually do in {title}?",
    "Performer / subject role": "Who performs in {title}, and what is their role?",
    "Emotional engine": "What is the emotional engine of {title}?",
    "Ethical danger": "What is the ethical danger in {title}?",
    "Aesthetic world": "Describe the aesthetic world of {title}.",
    "Research method": "What research method sits behind {title}?",
    "Use of real material": "How does {title} use real material?",
    "Use of fiction": "How does {title} use fiction?",
    "Emergent behaviour": "What emergent behaviour did {title} produce?",
    "Residue / documentation / afterlife": "What residue or afterlife did {title} leave?",
    "What this project teaches the studio": "What does {title} teach the studio?",
    "What failed or remained unresolved": "What failed or remained unresolved in {title}?",
    "Possible mutations": "Suggest some mutations of {title}.",
    "Assistant behaviour rules derived from this project": "What assistant behaviour rules derive from {title}?",
    "Research dossier (web, 2026-06-10)": "What does public research record about {title}?",
    "Venue / context": "Where and when was {title} shown?",
    # skipped — not conversational:
    "Sources": None,
    "Feed log": None,
    "Research notes (needs review)": None,
}


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


def split_sections(body: str):
    sections, title, lines = [], "", []
    for line in body.splitlines():
        if line.startswith("## "):
            if title and "".join(lines).strip():
                sections.append((title, "\n".join(lines).strip()))
            title, lines = line[3:].strip(), []
        elif not line.startswith("# "):
            lines.append(line)
    if title and "".join(lines).strip():
        sections.append((title, "\n".join(lines).strip()))
    return sections


def _placeholder(text: str) -> bool:
    t = text.strip()
    return not t or t.startswith("TKTK") or t in ("(none yet)", "(none)")


def dialogue_records() -> list[dict]:
    out = []
    for f in sorted(DIALOGUE_DIR.glob("*.jsonl")):
        if f.name.startswith("._"):
            continue
        for rec in read_jsonl(f):
            user, assistant = rec.get("user", ""), rec.get("assistant", "")
            if not user or not assistant:
                continue
            system = SYSTEM_DOUBLE if rec.get("mode") == "ed_double" else SYSTEM_CLIPPY
            out.append(
                {
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                        {"role": "assistant", "content": assistant},
                    ],
                    "meta": {
                        "source": "dialogue",
                        "file": f.name,
                        "id": rec.get("id", ""),
                        "mode": rec.get("mode", "studio_clippy"),
                        "confidentiality": "studio_private",
                    },
                }
            )
    return out


def card_qa_records(base: Path, id_key: str, kind: str) -> list[dict]:
    out = []
    for card in md_files(base):
        fm, body = split_frontmatter(read_text(card))
        if not fm:
            continue
        cid = fm.get(id_key) or slugify(card.stem)
        title = fm.get("title", card.stem.replace("-", " ").title())
        conf = fm.get("confidentiality", "studio_private")
        if str(fm.get("training_eligible", "true")).lower() == "false":
            continue  # explicitly excluded from training
        for sec, text in split_sections(body):
            if _placeholder(text):
                continue
            if sec == "Private notes":
                continue  # never trains, regardless of card confidentiality
            template = QA_TEMPLATES.get(sec, "Tell me about the {section} of {title}.")
            if template is None:
                continue
            question = template.format(title=title, section=sec.lower())
            out.append(
                {
                    "messages": [
                        {"role": "system", "content": SYSTEM_CLIPPY},
                        {"role": "user", "content": question},
                        {"role": "assistant", "content": text},
                    ],
                    "meta": {
                        "source": f"{kind}_qa_synthetic",
                        "id": f"{cid}__{slugify(sec)}",
                        "project": cid,
                        "section": sec,
                        "confidentiality": conf,
                    },
                }
            )
    return out


def is_val(rec: dict, fraction: float) -> bool:
    """Deterministic split — same record always lands in the same bucket."""
    key = rec["meta"].get("id", "") or rec["messages"][1]["content"]
    h = int(hashlib.sha1(key.encode()).hexdigest(), 16) % 1000
    return h < int(fraction * 1000)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--include-sensitive", action="store_true",
                    help="also emit sensitive_distilled material into private_sft_*.jsonl (git-ignored)")
    ap.add_argument("--val-fraction", type=float, default=0.1)
    args = ap.parse_args()

    records = dialogue_records()
    records += card_qa_records(PROJECT_CARDS_DIR, "project_id", "card")

    sensitive = []
    if args.include_sensitive:
        sensitive = card_qa_records(SELF_KNOWLEDGE_DIR, "card_id", "self_knowledge")

    # hard safety gate: nothing raw_private_vault ever exports
    records = [r for r in records if r["meta"]["confidentiality"] != "raw_private_vault"]
    # sensitive_distilled never lands in the main files
    main_records = [r for r in records if r["meta"]["confidentiality"] != "sensitive_distilled"]

    train = [r for r in main_records if not is_val(r, args.val_fraction)]
    val = [r for r in main_records if is_val(r, args.val_fraction)]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    write_jsonl(OUT_DIR / "sft_train.jsonl", train)
    write_jsonl(OUT_DIR / "sft_val.jsonl", val)

    by_source: dict[str, int] = {}
    for r in main_records:
        by_source[r["meta"]["source"]] = by_source.get(r["meta"]["source"], 0) + 1
    print(f"main: {len(train)} train / {len(val)} val")
    for src, n in sorted(by_source.items()):
        print(f"  {src}: {n}")

    if sensitive:
        sens = [r for r in sensitive if r["meta"]["confidentiality"] == "sensitive_distilled"]
        write_jsonl(OUT_DIR / "private_sft_sensitive.jsonl", sens)
        print(f"sensitive (separate, git-ignored): {len(sens)} -> private_sft_sensitive.jsonl")
    else:
        print("sensitive_distilled: excluded (use --include-sensitive to emit separately)")
    print(f"Output dir: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
