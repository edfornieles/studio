#!/usr/bin/env python3
"""Turn links and PDFs dropped into Jabber's inbox into books.

Runs on whatever machine does the narration (a Claude Code cloud session now,
your laptop later). It polls the private inbox, and for each new item:
  1. PDF: extracts text by bookmarks (or ~15-minute parts) with pdf-to-book.mjs
     link: fetches the page and extracts the article text (trafilatura);
           a link to a PDF is treated as a PDF
  2. narrates it with run-book.py (any TTS engine) and publishes it to the library
  3. reports progress back, which the Library screen shows

    python generator/process-inbox.py --pdfjs-dir <folder with node_modules/pdfjs-dist> [--once]
        [engine options, e.g. --engine fish --fish-voice ...]

Needs: pip install pocket-tts trafilatura; node; poppler-utils; ffmpeg.
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "deploy"))
from deploy import call, namespace, API  # noqa: E402
from tts_engines import add_engine_args  # noqa: E402

PREFIX = "library/_inbox/"
UA = "Mozilla/5.0 (compatible; JabberReader/1.0; personal listening app)"


def kv_keys(ns, prefix):
    res = call("GET", f"{API}/storage/kv/namespaces/{ns}/keys?prefix={urllib.request.quote(prefix)}&limit=1000")
    return [k["name"] for k in res.get("result") or []]


def _load_run_book():
    import importlib.util
    spec = importlib.util.spec_from_file_location("run_book", HERE / "run-book.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


kv_get = _load_run_book().kv_get  # raw bytes of a KV value, or None


def kv_put(ns, key, data, ctype="application/octet-stream"):
    return call("PUT", f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(key, safe='')}", data, ctype)


def kv_delete(ns, key):
    return call("DELETE", f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(key, safe='')}")


def update(ns, item, **fields):
    item.update(fields, updated=int(time.time() * 1000))
    kv_put(ns, PREFIX + item["id"] + ".json", json.dumps(item).encode(), "application/json")
    print(f"[{item['id']}] {item['status']}: {item.get('detail', '')}", flush=True)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "book"


def split_parts(title, text, size=13000):
    """Split article text into ~15-minute parts on paragraph boundaries."""
    paras = [p.strip() for p in re.split(r"\n\s*\n|\n", text) if p.strip()]
    parts, cur = [], []
    for p in paras:
        if cur and sum(len(x) for x in cur) + len(p) > size:
            parts.append(cur); cur = []
        cur.append(p)
    if cur:
        parts.append(cur)
    if len(parts) == 1:
        return [{"title": title, "text": title + ".\n\n" + "\n\n".join(parts[0])}]
    return [{"title": f"Part {i}", "text": f"Part {i}.\n\n" + "\n\n".join(p)} for i, p in enumerate(parts, 1)]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/pdf;q=0.9,*/*;q=0.8"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read(), r.headers.get("content-type", "")


def pdf_book(pdf_path, name, work, args):
    out = work / "book.json"
    subprocess.run(["node", str(HERE / "pdf-to-book.mjs"), str(pdf_path), str(out), "--no-filename-title"], cwd=args.pdfjs_dir, check=True,
                   capture_output=True, text=True)
    book = json.loads(out.read_text())
    meta_title = (book.get("title") or "").strip()
    if not meta_title or len(meta_title) < 4 or re.search(r"untitled|microsoft word|\.docx?$|\.pdf$", meta_title, re.I):
        book["title"] = re.sub(r"\.pdf$", "", name, flags=re.I).replace("_", " ").strip() or "Untitled"
    if len(book["sections"]) == 1 and book["sections"][0]["title"].startswith("Part 1"):  # one part: use the book's title
        sec = book["sections"][0]
        sec["title"] = book["title"]
        sec["intro"] = book["title"] + "."
        sec["text"] = book["title"] + "." + sec["text"][len("Part 1."):]
    subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-jpeg", "-jpegopt", "quality=85", "-scale-to", "900", "-singlefile",
                    str(pdf_path), str(work / "cover")], check=True)
    out.write_text(json.dumps(book, ensure_ascii=False))
    return book, work / "cover.jpg"


def url_book(item, work, args):
    data, ctype = fetch(item["url"])
    if "pdf" in ctype or data[:5] == b"%PDF-":
        pdf = work / "source.pdf"
        pdf.write_bytes(data)
        return (*pdf_book(pdf, item["url"].rstrip("/").split("/")[-1] or "Document.pdf", work, args), pdf)
    import trafilatura
    html = data.decode("utf-8", "replace")
    text = trafilatura.extract(html, url=item["url"], include_comments=False, include_tables=False, favor_precision=True)
    if not text or len(text) < 300:
        raise RuntimeError("Couldn’t find readable article text on that page (it may need a login or JavaScript).")
    meta = trafilatura.extract_metadata(html, default_url=item["url"])
    title = (meta.title if meta and meta.title else item["name"]).strip()
    author = (meta.author if meta and meta.author else "") or ""
    if not author or len(author.split()) > 6 or re.search(r"database|control|staff|admin", author, re.I):
        author = (meta.sitename if meta and meta.sitename else "") or ""
    text = re.sub(r"\[(?:\d+|[a-z]|citation needed|note \d+)\]", "", text)  # footnote markers aren't worth hearing
    book = {"title": title, "author": author, "source": item["url"], "sections": split_parts(title, text), "notes": []}
    (work / "book.json").write_text(json.dumps(book, ensure_ascii=False))
    return book, None, None


def process(ns, item, args, engine_args):
    work = Path(args.work) / item["id"]
    work.mkdir(parents=True, exist_ok=True)
    pdf = cover = None
    if item["kind"] == "pdf":
        update(ns, item, status="processing", detail="Reading the PDF")
        pdf = work / "source.pdf"
        pdf.write_bytes(kv_get(ns, PREFIX + item["id"] + ".pdf"))
        book, cover = pdf_book(pdf, item["name"], work, args)
    else:
        update(ns, item, status="processing", detail="Fetching the page")
        book, cover, pdf = url_book(item, work, args)
    if not book["sections"]:
        raise RuntimeError("No readable text found (scanned PDFs need OCR, which isn’t supported yet).")
    book_id = slug(book["title"]) + "-" + item["id"][-4:]
    n = len(book["sections"]) + (1 if book.get("notes") else 0)
    update(ns, item, status="narrating", detail=f"Narrating · 0 of {n} ready", bookId=book_id, title=book["title"])
    cmd = [sys.executable, str(HERE / "run-book.py"), str(work / "book.json"), "--id", book_id, "--work", str(work / "audio")]
    if cover and cover.exists():
        cmd += ["--cover", str(cover)]
    if pdf:
        cmd += ["--pdf", str(pdf)]
    proc = subprocess.Popen(cmd + engine_args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    done = 0
    for line in proc.stdout:
        if line.startswith("DONE "):
            done += 1
            update(ns, item, detail=f"Narrating · {done} of {n} ready")
    if proc.wait() != 0:
        raise RuntimeError("Narration stopped with an error; see the generator log.")
    # Finished: the book is in the library; the inbox entry is no longer needed.
    kv_delete(ns, PREFIX + item["id"] + ".pdf")
    kv_delete(ns, PREFIX + item["id"] + ".json")
    print(f"[{item['id']}] ready as {book_id}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdfjs-dir", required=True, help="folder where `npm i pdfjs-dist@3.11.174` was run")
    ap.add_argument("--work", default=str(Path(tempfile.gettempdir()) / "jabber-inbox"))
    ap.add_argument("--once", action="store_true", help="process what is queued, then exit")
    ap.add_argument("--every", type=int, default=30, help="seconds between checks")
    add_engine_args(ap)
    args = ap.parse_args()
    engine_args = ["--engine", args.engine, "--voice", args.voice]
    if args.engine == "fish":
        engine_args += ["--fish-url", args.fish_url] + (["--fish-voice", args.fish_voice] if args.fish_voice else []) \
            + (["--fish-model", args.fish_model] if args.fish_model else [])

    ns = namespace()
    print("watching the inbox…", flush=True)
    while True:
        names = sorted(k for k in kv_keys(ns, PREFIX) if k.endswith(".json"))
        items = [json.loads(kv_get(ns, k) or b"{}") for k in names]
        queued = sorted((i for i in items if i.get("status") == "queued"), key=lambda i: i["created"])
        for item in queued:
            try:
                process(ns, item, args, engine_args)
            except Exception as e:  # report to the phone and keep going
                update(ns, item, status="failed", detail=str(e)[:300])
        if args.once:
            break
        time.sleep(args.every)


if __name__ == "__main__":
    main()
