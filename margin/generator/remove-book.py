#!/usr/bin/env python3
"""Remove a book from the Jabber library (its audio, manifest, cover, PDF and index entry).

    python generator/remove-book.py <book id>
"""
import json, sys, urllib.request
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "deploy"))
from deploy import call, must, namespace, API  # noqa: E402

book = sys.argv[1]
ns = namespace()
res = must(call("GET", f"{API}/storage/kv/namespaces/{ns}/keys?prefix=library/{book}/&limit=1000"), "list")
keys = [k["name"] for k in res]
if keys:
    must(call("POST", f"{API}/storage/kv/namespaces/{ns}/bulk/delete", json.dumps(keys).encode()), "delete")
req = urllib.request.Request(f"{API}/storage/kv/namespaces/{ns}/values/library%2Findex.json")
from deploy import TOKEN  # noqa: E402
req.add_header("Authorization", f"Bearer {TOKEN}")
index = json.loads(urllib.request.urlopen(req).read())
index["books"] = [b for b in index["books"] if b["id"] != book]
must(call("PUT", f"{API}/storage/kv/namespaces/{ns}/values/library%2Findex.json", json.dumps(index).encode(), "application/json"), "index")
print(f"removed {book}: {len(keys)} files")
