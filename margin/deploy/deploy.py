#!/usr/bin/env python3
"""Deploy margin/ to Cloudflare as a Worker serving files from KV.

Needs a Cloudflare API token (Workers Scripts, Workers KV, Workers Routes /
custom domains). In a Claude Code cloud session the token is injected by the
network proxy for api.cloudflare.com; elsewhere set CLOUDFLARE_API_TOKEN.

    python3 deploy/deploy.py            # upload files + worker
    python3 deploy/deploy.py --domain   # also attach jabber.edfornieles.com
"""
import json, os, subprocess, sys, urllib.request
from pathlib import Path

ACCOUNT = "a257d20748dbf6badd898ffcf58e8f3d"
ZONE = "3fc5971d606a60b62e4e64b8d22066e6"  # edfornieles.com
NAME = "jabber"
HOST = "jabber.edfornieles.com"
API = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}"
ROOT = Path(__file__).resolve().parent.parent
INCLUDE = ["index.html", "v0.html", "app.css", "manifest.webmanifest", "js", "lab", "listen", "docs"]
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "proxy-injected")


def call(method, url, data=None, ctype="application/json"):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {TOKEN}")
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}") | {"success": False, "status": e.code}


def must(res, what):
    if not res.get("success"):
        sys.exit(f"{what} failed: {res.get('errors')}")
    return res.get("result")


def namespace():
    for ns in must(call("GET", f"{API}/storage/kv/namespaces?per_page=100"), "list KV"):
        if ns["title"] == f"{NAME}-files":
            return ns["id"]
    return must(call("POST", f"{API}/storage/kv/namespaces", json.dumps({"title": f"{NAME}-files"}).encode()), "create KV")["id"]


def main():
    ns = namespace()
    files = []
    for item in INCLUDE:
        p = ROOT / item
        files += [p] if p.is_file() else [f for f in sorted(p.rglob("*")) if f.is_file()]
    for f in files:
        key = f.relative_to(ROOT).as_posix()
        must(call("PUT", f"{API}/storage/kv/namespaces/{ns}/values/{urllib.request.quote(key, safe='')}", f.read_bytes(), "application/octet-stream"), f"upload {key}")
        print("uploaded", key, f.stat().st_size)

    meta = {"main_module": "worker.js", "compatibility_date": "2026-11-01",
            "bindings": [{"type": "kv_namespace", "name": "FILES", "namespace_id": ns}],
            "keep_bindings": ["secret_text"]}  # keep ACCESS_KEY set via the secrets API
    boundary = "----jabberdeploy"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\nContent-Type: application/json\r\n\r\n{json.dumps(meta)}\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"worker.js\"; filename=\"worker.js\"\r\nContent-Type: application/javascript+module\r\n\r\n").encode()
    body += (ROOT / "deploy" / "worker.js").read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    must(call("PUT", f"{API}/workers/scripts/{NAME}", body, f"multipart/form-data; boundary={boundary}"), "upload worker")
    print("worker deployed")
    call("POST", f"{API}/workers/scripts/{NAME}/subdomain", json.dumps({"enabled": True}).encode())

    if "--set-key" in sys.argv:  # new private-library access key; prints it once
        import secrets
        key = secrets.token_urlsafe(18)
        must(call("PUT", f"{API}/workers/scripts/{NAME}/secrets", json.dumps({"name": "ACCESS_KEY", "text": key, "type": "secret_text"}).encode()), "set key")
        print("ACCESS_KEY", key)

    if "--domain" in sys.argv:
        res = call("PUT", f"{API}/workers/domains", json.dumps({"hostname": HOST, "service": NAME, "zone_id": ZONE, "environment": "production"}).encode())
        print("custom domain:", "ok" if res.get("success") else res.get("errors"))


if __name__ == "__main__":
    main()
