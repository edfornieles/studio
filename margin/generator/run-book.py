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
import argparse, json, os, re, sys, time, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "deploy"))
import generate  # noqa: E402
from tts_engines import add_engine_args, make_engine  # noqa: E402
from deploy import call, must, namespace, API, TOKEN  # noqa: E402


def kv_put(ns, key, data, ctype="application/octet-stream"):
    must(call("PUT", f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(key, safe='')}", data, ctype), f"upload {key}")


KV_LIMIT = 24 * 1024 * 1024  # Workers KV values max out at 25 MiB


def encode_fitting(pcm, rate, path):
    """MP3 at 48 kbit/s (plenty for mono speech); long chapters get a lower
    bitrate so the file stays under the storage limit."""
    seconds = len(pcm) / rate
    kbps = min(48, int(KV_LIMIT * 8 / seconds / 1000 * 0.97))
    generate.encode_mp3(pcm, rate, path, f"{max(24, kbps)}k")


def kv_get(ns, key):
    """Raw bytes of a KV value, or None if missing."""
    req = urllib.request.Request(f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(key, safe='')}")
    req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def notes_section(notes, title="Notes in this PDF"):
    """Narrated summary of PDF sticky notes (e.g. reading suggestions)."""
    if not notes:
        return None
    parts = []
    for n in sorted(notes, key=lambda n: n["text"]):
        t = re.sub(r"\s*Status:.*$", "", n["text"], flags=re.S)       # drop bookkeeping lines
        t = re.sub(r"^M(\d\d) \| [^|]+\| ", lambda m: f"Suggestion {int(m.group(1))}. ", t)
        parts.append(t.replace("\n\n", "\n\n").strip())
    return {"title": title, "pages": None, "kind": "notes",
            "text": f"{title}. {len(parts)} note{'s' if len(parts) != 1 else ''} from this book.\n\n" + "\n\n".join(parts)}


CUE = "There's an image here: {short}."
CUE_TAIL = "Tap Describe if you'd like to hear more about it."


def _words(s):
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def drop_repeated_heading(title, parts):
    """The section title is spoken first, so skip the printed heading lines that
    repeat it (e.g. "Preface" / "Source in the cause of New Music")."""
    tw = _words(title)
    out, skipping = [], True
    for part in parts:
        paras = part["text"].split("\n\n") if part["text"] else []
        if skipping:
            def mostly_title(p):
                ws = re.findall(r"[a-z0-9]+", p.lower())
                return ws and sum(w in tw for w in ws) / len(ws) >= 0.6
            while paras and len(paras[0]) < 120 and (_words(paras[0]) <= tw or len(paras[0].split()) <= 2 or mostly_title(paras[0])):
                paras.pop(0)
            if paras:  # heading run into the first line: "letter to the editor United States …"
                toks = paras[0].split(" ")
                k = 0
                while k < len(toks) and k < 12 and _words(toks[k]) and _words(toks[k]) <= tw:
                    k += 1
                if k >= 2:
                    paras[0] = " ".join(toks[k:])
            if paras or part["text"]:
                skipping = False
        out.append({**part, "text": "\n\n".join(paras)})
    return out


def section_text(sec, figures):
    """Section text, with a spoken cue where each described figure's page starts.
    Returns (text, [figure dicts in the order their cues appear])."""
    if not sec.get("parts"):
        return sec["text"], []
    figures = figures or {}
    chunks, order = [sec.get("intro", sec["title"] + ".")], []
    for part in drop_repeated_heading(sec["title"], sec["parts"]):
        for k, f in enumerate(figures.get(str(part["page"])) or []):
            short = f["short"].strip().rstrip(".")
            short = short[0].lower() + short[1:] if short[:1].isupper() and not short[1:2].isupper() else short  # keep "LP", "ONCE"
            chunks.append(CUE.format(short=short) + " " + CUE_TAIL)
            order.append({**f, "page": part["page"], "n": k})
        if part["text"]:
            chunks.append(part["text"])
    return re.sub(r"[\ue000-\uf8ff]", "", "\n\n".join(chunks)), order  # drop private-use font glyphs


def build_manifest(book, sections, work, voice):
    out = {"title": book["title"], "author": book.get("author", ""), "voice": voice, "sections": [], "notes": book.get("notes", [])}
    for i, sec in enumerate(sections, 1):
        side = work / f"section-{i:02d}.json"
        entry = {"id": f"s{i:02d}", "title": sec["title"], "pages": sec.get("pages"), "kind": sec.get("kind", "text"), "file": None,
                 "est": round(len(sec["text"]) / 14.5)}  # estimated seconds until generated (Pocket TTS ≈ 14.5 chars/s)
        if side.exists():
            entry.update(json.loads(side.read_text()))
        out["sections"].append(entry)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("--id", required=True, help="book id used in URLs, e.g. source")
    ap.add_argument("--work", required=True, help="local folder for finished sections")
    ap.add_argument("--figures", help="figures.json from describe-images.py: adds spoken image cues")
    add_engine_args(ap)
    ap.add_argument("--first", default="", help="comma-separated title prefixes to generate first")
    ap.add_argument("--priority-pages", default="", help="pages whose sections come next (e.g. annotated pages)")
    ap.add_argument("--worker", type=int, default=0)
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--manifest-only", action="store_true")
    ap.add_argument("--cover", help="JPEG cover image to upload (e.g. the PDF's first page)")
    ap.add_argument("--pdf", help="original PDF to upload (private), viewable from the player")
    args = ap.parse_args()

    book = json.loads(Path(args.book).read_text())
    work = Path(args.work); work.mkdir(parents=True, exist_ok=True)
    sections = list(book["sections"])
    ns_sec = notes_section(book.get("notes"), book.get("notesTitle", "Notes in this PDF"))
    if ns_sec:
        sections.insert(0, ns_sec)
    ns = namespace()
    prefix = f"library/{args.id}/"

    if args.cover:
        kv_put(ns, prefix + "cover.jpg", Path(args.cover).read_bytes(), "image/jpeg")
    if args.pdf:
        kv_put(ns, prefix + "book.pdf", Path(args.pdf).read_bytes(), "application/pdf")

    has_pdf = bool(args.pdf) or kv_get(ns, prefix + "book.pdf") is not None

    def publish_manifest():
        m = build_manifest(book, sections, work, args.voice if args.engine == "pocket" else args.fish_voice)
        m["cover"] = "cover.jpg" if args.cover or kv_get(ns, prefix + "cover.jpg") is not None else None
        m["pdf"] = "book.pdf" if args.pdf or has_pdf else None
        kv_put(ns, prefix + "manifest.json", json.dumps(m, ensure_ascii=False).encode(), "application/json")
        # Library index: one entry per book, shown on the home screen.
        index = json.loads(kv_get(ns, "library/index.json") or b'{"books": []}')
        entry = {"id": args.id, "title": m["title"], "author": m["author"], "cover": m["cover"],
                 "sections": len(m["sections"]), "ready": sum(1 for s in m["sections"] if s["file"]),
                 "seconds": round(sum(s.get("duration") or s["est"] for s in m["sections"]))}
        index["books"] = [b for b in index["books"] if b["id"] != args.id] + [entry]
        kv_put(ns, "library/index.json", json.dumps(index, ensure_ascii=False).encode(), "application/json")

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
    # Workers share one queue: each claims the next unfinished section in
    # reading order with an exclusive lock file, so the book fills in front to back.
    def claim(i):
        try:
            os.close(os.open(work / f"section-{i + 1:02d}.lock", os.O_CREAT | os.O_EXCL | os.O_WRONLY))
            return True
        except FileExistsError:
            return False
    mine = order

    figures = json.loads(Path(args.figures).read_text()) if args.figures else {}
    engine = make_engine(args)
    for i in mine:
        n = i + 1
        side = work / f"section-{n:02d}.json"
        text, figs = section_text(sections[i], figures)
        if side.exists():
            done = json.loads(side.read_text())
            if not figs or "figures" in done:
                continue  # finished; regenerate only to add newly described figures
        if args.workers > 1 and not claim(i):
            continue  # another worker has it
        t0 = time.time()
        pcm, rate, timings = generate.render(engine, text)
        mp3 = work / f"section-{n:02d}.mp3"
        encode_fitting(pcm, rate, mp3)
        kv_put(ns, prefix + mp3.name, mp3.read_bytes(), "audio/mpeg")
        meta = {"file": mp3.name, "duration": round(len(pcm) / rate, 2), "voice": engine.label, "sentences": timings}
        if figs:
            cue_idx = [k for k, t in enumerate(timings) if t["text"].startswith("There's an image here:")]
            meta["figures"] = []
            for f, k in zip(figs, cue_idx):
                dpcm, drate, _ = generate.render(engine, f["description"])
                dname = f"figure-p{f['page']}-{f['n']}.mp3"
                encode_fitting(dpcm, drate, work / dname)
                kv_put(ns, prefix + dname, (work / dname).read_bytes(), "audio/mpeg")
                meta["figures"].append({"page": f["page"], "kind": f["kind"], "short": f["short"], "description": f["description"],
                                        "sentence": k, "at": timings[k]["start"], "file": dname, "duration": round(len(dpcm) / drate, 2)})
        side.write_text(json.dumps(meta, ensure_ascii=False))
        kv_put(ns, prefix + f"text/s{n:02d}.txt", " ".join(t["text"] for t in timings).encode(), "text/plain")  # for summaries & Reflect
        publish_manifest()
        print(f"DONE s{n:02d} {len(pcm) / rate / 60:.1f} min audio in {(time.time() - t0) / 60:.1f} min · {sections[i]['title'][:60]}"
              + (f" · {len(figs)} image(s)" if figs else ""), flush=True)
    # Parallel workers can finish together and overwrite each other's manifest;
    # publish once more after a pause so the last word includes every section.
    time.sleep(5)
    publish_manifest()
    print(f"WORKER {args.worker} FINISHED", flush=True)


if __name__ == "__main__":
    main()
