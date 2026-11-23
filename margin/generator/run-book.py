#!/usr/bin/env python3
"""Generate a whole book section by section, uploading each finished section
to the jabber Worker's KV store so it can be listened to while the rest is
still being generated. Resumable: finished sections are skipped.

    python generator/run-book.py book.json --id source --work /tmp/source-audio \
        [--first "Preface,Introduction"] [--priority-pages 193,197,265,335,349,359] \
        [--worker 0 --workers 2]

Run several workers in parallel (each uses ~2 CPU cores). The manifest
(library/<id>/manifest.json) lists every section; ones not yet generated
have "file": null.
"""
import argparse, json, re, sys, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "deploy"))
import generate  # noqa: E402
from deploy import call, must, namespace, API  # noqa: E402


def kv_put(ns, key, data, ctype="application/octet-stream"):
    must(call("PUT", f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(key, safe='')}", data, ctype), f"upload {key}")


def notes_section(notes):
    """Narrated summary of PDF sticky notes (e.g. reading suggestions)."""
    if not notes:
        return None
    parts = []
    for n in sorted(notes, key=lambda n: n["text"]):
        t = re.sub(r"\s*Status:.*$", "", n["text"], flags=re.S)       # drop bookkeeping lines
        t = re.sub(r"^M(\d\d) \| [^|]+\| ", lambda m: f"Suggestion {int(m.group(1))}. ", t)
        parts.append(t.replace("\n\n", "\n\n").strip())
    return {"title": "Mackenzie's suggestions for Mother", "pages": None, "kind": "notes",
            "text": "Mackenzie's suggestions for Mother. Six readings from this book, with notes.\n\n" + "\n\n".join(parts)}


def build_manifest(book, sections, work, voice):
    out = {"title": book["title"], "author": book.get("author", ""), "voice": voice, "sections": [], "notes": book.get("notes", [])}
    for i, sec in enumerate(sections, 1):
        side = work / f"section-{i:02d}.json"
        entry = {"id": f"s{i:02d}", "title": sec["title"], "pages": sec.get("pages"), "kind": sec.get("kind", "text"), "file": None}
        if side.exists():
            entry.update(json.loads(side.read_text()))
        out["sections"].append(entry)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("--id", required=True, help="book id used in URLs, e.g. source")
    ap.add_argument("--work", required=True, help="local folder for finished sections")
    ap.add_argument("--voice", default="alba")
    ap.add_argument("--first", default="", help="comma-separated title prefixes to generate first")
    ap.add_argument("--priority-pages", default="", help="pages whose sections come next (e.g. annotated pages)")
    ap.add_argument("--worker", type=int, default=0)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--manifest-only", action="store_true")
    args = ap.parse_args()

    book = json.loads(Path(args.book).read_text())
    work = Path(args.work); work.mkdir(parents=True, exist_ok=True)
    sections = list(book["sections"])
    ns_sec = notes_section(book.get("notes"))
    if ns_sec:
        sections.insert(0, ns_sec)
    ns = namespace()
    prefix = f"library/{args.id}/"

    def publish_manifest():
        kv_put(ns, prefix + "manifest.json", json.dumps(build_manifest(book, sections, work, args.voice), ensure_ascii=False).encode(), "application/json")

    if args.manifest_only:
        publish_manifest(); return

    # Order: notes, then --first titles, then sections containing priority pages, then the rest.
    first = [t.strip().lower() for t in args.first.split(",") if t.strip()]
    pp = {int(p) for p in args.priority_pages.split(",") if p.strip()}
    def rank(i):
        s = sections[i]
        if s.get("kind") == "notes": return (0, i)
        if any(s["title"].lower().startswith(f) for f in first): return (1, i)
        if s.get("pages") and any(s["pages"][0] <= p <= s["pages"][1] for p in pp): return (2, i)
        return (3, i)
    order = sorted(range(len(sections)), key=rank)
    mine = [i for k, i in enumerate(order) if k % args.workers == args.worker]

    model, voice = generate.load(args.voice)
    for i in mine:
        n = i + 1
        side = work / f"section-{n:02d}.json"
        if side.exists():
            continue
        t0 = time.time()
        pcm, timings = generate.render(model, voice, sections[i]["text"])
        mp3 = work / f"section-{n:02d}.mp3"
        generate.encode_mp3(pcm, model.sample_rate, mp3, "64k")
        kv_put(ns, prefix + mp3.name, mp3.read_bytes(), "audio/mpeg")
        side.write_text(json.dumps({"file": mp3.name, "duration": round(len(pcm) / model.sample_rate, 2), "sentences": timings}, ensure_ascii=False))
        publish_manifest()
        print(f"DONE s{n:02d} {len(pcm) / model.sample_rate / 60:.1f} min audio in {(time.time() - t0) / 60:.1f} min · {sections[i]['title'][:60]}", flush=True)
    publish_manifest()
    print(f"WORKER {args.worker} FINISHED", flush=True)


if __name__ == "__main__":
    main()
