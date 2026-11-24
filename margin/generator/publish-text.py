#!/usr/bin/env python3
"""Store each chapter's text as library/<book>/text/<sid>.txt (used for
summaries and Reflect). run-book.py does this for new books; this backfills
existing ones from their manifests.

    python generator/publish-text.py <book id> [<book id> ...]
"""
import json, sys, urllib.request
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "deploy"))
from deploy import call, must, namespace, API, TOKEN  # noqa: E402


def get(ns, key):
    req = urllib.request.Request(f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(key, safe='')}")
    req.add_header("Authorization", f"Bearer {TOKEN}")
    return urllib.request.urlopen(req).read()


ns = namespace()
for book in sys.argv[1:]:
    man = json.loads(get(ns, f"library/{book}/manifest.json"))
    n = 0
    for s in man["sections"]:
        if not s.get("sentences"):
            continue
        text = " ".join(x["text"] for x in s["sentences"])
        must(call("PUT", f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(f'library/{book}/text/{s['id']}.txt', safe='')}", text.encode(), "text/plain"), "put")
        n += 1
    print(f"{book}: {n} chapter texts")
