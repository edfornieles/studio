#!/usr/bin/env python3
"""Studio Clippy console — a small local web app to browse and feed the dataset.

Run:
    pip install flask
    python app/server.py
    # then open http://127.0.0.1:5050

It reads and writes the dataset files directly (project cards, manifests,
source texts, self-knowledge cards). Personal uploads default to the git-ignored
raw vault and are never written into the repo. This app is for LOCAL use only —
it has no authentication and must not be exposed to a network.
"""
from __future__ import annotations

import io
import subprocess
import sys
from pathlib import Path

from flask import (
    Flask, abort, flash, redirect, render_template, request, send_file, url_for,
)

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dataset as ds  # noqa: E402

app = Flask(__name__)
app.secret_key = "studio-clippy-local-only"  # local app, no sessions of value
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200 MB uploads

# --------------------------------------------------------------------------- #
# local-only guard (defense-in-depth; there is no per-user auth)
# The app binds 127.0.0.1, but we also (1) require a loopback client and
# (2) allowlist the Host header — this blocks DNS-rebinding, where a malicious
# web page resolves its name to 127.0.0.1 and drives this app from the browser.
# To reach the app from another device, add that host:port below on purpose.
# --------------------------------------------------------------------------- #
import os

HOST = "127.0.0.1"
PORT = 5050
ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}", "127.0.0.1", "localhost"}
ALLOWED_HOSTS |= {h.strip().lower() for h in os.environ.get("STUDIO_ALLOWED_HOSTS", "").split(",") if h.strip()}


@app.before_request
def _local_only_guard():
    if request.remote_addr not in ("127.0.0.1", "::1"):
        abort(403)  # only ever reachable from this machine
    if (request.host or "").strip().lower() not in ALLOWED_HOSTS:
        abort(403)  # reject unexpected Host headers (DNS-rebinding defense)


import html as _html
import re as _re


@app.template_filter("md")
def md_to_html(text: str) -> str:
    """Tiny, safe Markdown subset: headings, bullets, links, bold, paragraphs."""
    if not text:
        return ""
    out, in_list = [], False
    for raw in text.splitlines():
        line = _html.escape(raw.rstrip())
        if line.strip().startswith("&lt;!--"):  # skip autogen marker comment
            continue
        line = _re.sub(r"\[\[([a-z0-9\-]+)\]\]", r'<a href="/project/\1">\1</a>', line)
        line = _re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', line)
        line = _re.sub(r"(?<!\")(https?://[^\s<)]+)", r'<a href="\1" target="_blank" rel="noopener">\1</a>', line)
        line = _re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", line)
        s = line.strip()
        if s.startswith("- "):
            if not in_list:
                out.append("<ul>"); in_list = True
            out.append(f"<li>{s[2:]}</li>")
            continue
        if in_list:
            out.append("</ul>"); in_list = False
        if s.startswith("### "):
            out.append(f"<h4>{s[4:]}</h4>")
        elif s.startswith("## "):
            out.append(f"<h3>{s[3:]}</h3>")
        elif s.startswith("# "):
            out.append(f"<h2>{s[2:]}</h2>")
        elif s:
            out.append(f"<p>{s}</p>")
    if in_list:
        out.append("</ul>")
    return "\n".join(out)


@app.context_processor
def inject_globals():
    return {
        "STATUSES": ds.STATUSES,
        "CONF_LEVELS": ds.CONFIDENTIALITY_LEVELS,
        "stats": ds.stats(),
    }


@app.route("/")
def index():
    projects = ds.list_projects()
    q = request.args.get("q", "").strip().lower()
    status = request.args.get("status", "").strip()
    if q:
        projects = [p for p in projects if q in p["title"].lower() or q in p["project_id"].lower() or q in p["excerpt"].lower()]
    if status:
        projects = [p for p in projects if p["status"] == status]
    grouped: dict[str, list] = {}
    for p in projects:
        grouped.setdefault(p["status"], []).append(p)
    return render_template("index.html", grouped=grouped, q=q, status=status)


@app.route("/project/<pid>")
def project(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    images = [r for r in ds.all_images() if r.get("project") == pid]
    return render_template("project.html", pid=pid, fm=proj["fm"], body=proj["body"], rel=proj["rel"], images=images)


@app.route("/project/<pid>/edit", methods=["POST"])
def project_edit(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    fm = dict(proj["fm"])
    for key in ("title", "date", "confidentiality"):
        if key in request.form:
            fm[key] = request.form[key].strip()
    fm["needs_review"] = "true" if request.form.get("needs_review") else "false"
    fm["public_website_visible"] = "true" if request.form.get("public_website_visible") else "false"
    body = request.form.get("body", proj["body"])
    new_status = request.form.get("status", fm.get("status"))
    ds.save_project(pid, fm, body, new_status=new_status)
    flash(f"Saved “{fm.get('title', pid)}”.", "ok")
    return redirect(url_for("project", pid=pid))


@app.route("/project/<pid>/feed", methods=["POST"])
def project_feed(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    section = request.form.get("section", "Feed log")
    text = request.form.get("text", "").strip()
    link = request.form.get("link", "").strip()
    if link:
        text = f"{text} {link}".strip() if text else link
    if not text:
        flash("Nothing to add.", "warn")
        return redirect(url_for("project", pid=pid))
    body = ds.append_to_section(proj["body"], section, text)
    ds.save_project(pid, dict(proj["fm"]), body)
    flash("Added to card.", "ok")
    return redirect(url_for("project", pid=pid))


@app.route("/project/<pid>/image", methods=["POST"])
def project_image(pid):
    url = request.form.get("url", "").strip()
    caption = request.form.get("caption", "").strip()
    conf = request.form.get("confidentiality", "public")
    if request.files.get("file") and request.files["file"].filename:
        f = request.files["file"]
        res = ds.save_uploaded_image(pid, f.filename, f.read(), caption, conf)
        flash(f"Uploaded image → {res['saved']}" + ("" if res.get("manifest") else " (private; not in repo manifest)"), "ok")
    elif url:
        if conf == "raw_private_vault":
            flash("Refusing to put a raw_private_vault image URL in a manifest. Upload the file instead.", "warn")
        else:
            rec = ds.add_image_by_url(pid, url, caption, conf, source_page=request.form.get("source_page", ""))
            if rec.get("error"):
                flash(rec["error"], "warn")
            else:
                flash("Image already catalogued." if rec.get("duplicate") else "Catalogued image by URL.", "ok")
    else:
        flash("Provide an image URL or a file.", "warn")
    return redirect(url_for("project", pid=pid))


@app.route("/new", methods=["GET", "POST"])
def new_project():
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        if not title:
            flash("Title is required.", "warn")
            return redirect(url_for("new_project"))
        pid = ds.create_project(
            title=title,
            status=request.form.get("status", "imagined"),
            confidentiality=request.form.get("confidentiality", "studio_private"),
            date=request.form.get("date", ""),
            description=request.form.get("description", ""),
        )
        flash(f"Created project “{title}”.", "ok")
        return redirect(url_for("project", pid=pid))
    return render_template("new_project.html")


@app.route("/assets")
def assets():
    images = ds.all_images()
    pid = request.args.get("project", "").strip()
    conf = request.args.get("confidentiality", "").strip()
    if pid:
        images = [r for r in images if r.get("project") == pid]
    if conf:
        images = [r for r in images if r.get("confidentiality") == conf]
    projects = sorted({r.get("project", "") for r in ds.all_images() if r.get("project")})
    return render_template("assets.html", images=images, projects=projects, pid=pid, conf=conf)


@app.route("/intake", methods=["GET"])
def intake():
    projects = ds.list_projects()
    return render_template("intake.html", projects=projects, private=ds.list_private_index())


@app.route("/intake/note", methods=["POST"])
def intake_note():
    path = ds.save_note(
        title=request.form.get("title", ""),
        text=request.form.get("text", ""),
        confidentiality=request.form.get("confidentiality", "studio_private"),
        project=request.form.get("project", ""),
    )
    flash(f"Saved note → {path}", "ok")
    return redirect(url_for("intake"))


@app.route("/intake/personal", methods=["POST"])
def intake_personal():
    f = request.files.get("file")
    if not f or not f.filename:
        flash("Choose a file to upload.", "warn")
        return redirect(url_for("intake"))
    conf = request.form.get("confidentiality", "raw_private_vault")
    path = ds.save_personal_file(f.filename, f.read(), confidentiality=conf)
    flash(f"Stored privately → {path} (git-ignored, never surfaced). Consider distilling it into a safe self-knowledge card below.", "ok")
    return redirect(url_for("intake") + "#distill")


@app.route("/intake/distill", methods=["POST"])
def intake_distill():
    pattern = request.form.get("pattern", "").strip()
    if not pattern:
        flash("A pattern name is required.", "warn")
        return redirect(url_for("intake") + "#distill")
    cid = ds.create_self_knowledge_card(pattern, request.form.to_dict())
    flash(f"Created distilled self-knowledge card “{cid}” (sensitive_distilled).", "ok")
    return redirect(url_for("intake"))


@app.route("/validate")
def validate():
    try:
        proc = subprocess.run(
            [sys.executable, str(ds.REPO_ROOT / "scripts" / "validate_dataset.py")],
            capture_output=True, text=True, timeout=60,
        )
        output = proc.stdout + ("\n" + proc.stderr if proc.stderr else "")
        ok = proc.returncode == 0
    except Exception as exc:  # noqa: BLE001
        output, ok = f"Could not run validator: {exc}", False
    return render_template("validate.html", output=output, ok=ok)


# --------------------------------------------------------------------------- #
# public website (read-only front-end; only public + visible exhibitions)
# Gallery-style replica scoped to a single artist. Confidentiality is enforced
# by ds.public_* helpers (allowlisted sections only; double-gated on visibility).
# --------------------------------------------------------------------------- #
ARTIST_NAME = "Ed Fornieles"
ARTIST_SLUG = "edfornieles"
SITE_NAME = "Ed Fornieles"  # wordmark (CSS uppercases it); change to re-brand
GALLERY = {
    "name": "Carlos/Ishikawa",
    "address": ["Unit 4, 88 Mile End Road", "London E1 4UN"],
    "hours": "Wed–Sat, noon–6pm",
    "phone": "+44 (0) 20 7001 1744",
    "email": "gallery@carlosishikawa.com",
    "map": "https://goo.gl/maps/Pr1SXFyZ3eovXQBCA",
}


@app.context_processor
def inject_site_globals():
    return {"SITE_NAME": SITE_NAME, "ARTIST_NAME": ARTIST_NAME,
            "ARTIST_SLUG": ARTIST_SLUG, "GALLERY": GALLERY}


def _artist_page():
    lib = ds.public_library()
    return render_template(
        "public_artist.html",
        selected=ds.public_selected_works(),
        work_groups=ds.public_work_layout(),
        press=lib["press"],
        publications=lib["publications"],
        cv=ds.public_cv(),
    )


@app.route("/site")
def site_artist():
    # Single-artist site: the home page IS the artist page (no roster).
    return _artist_page()


@app.route("/site/exhibitions")
def site_exhibitions():
    return render_template("public_exhibitions.html", projects=ds.public_projects())


@app.route("/site/exhibition/<pid>")
def site_exhibition(pid):
    ex = ds.public_exhibition(pid)
    if not ex:  # not found, or not public+visible — never leak private cards
        abort(404)
    return render_template("public_exhibition.html", ex=ex)


@app.route("/site/library")
def site_library():
    lib = ds.public_library()
    return render_template("public_library.html", press=lib["press"],
                           publications=lib["publications"])


@app.route("/site/news")
def site_news():
    return render_template("public_news.html", projects=ds.public_projects())


@app.route("/site/contact")
def site_contact():
    return render_template("public_contact.html")


# --------------------------------------------------------------------------- #
# studio backend (clean white) — create exhibitions; upload text / images / PDFs.
# Everything written here is part of the dataset (and thus the training set).
# --------------------------------------------------------------------------- #
@app.route("/studio")
def studio_index():
    imgs_by_pid = {}
    for r in ds.all_images():
        imgs_by_pid.setdefault(r.get("project"), []).append(r)
    tiles = []
    for p in ds.list_projects():
        imgs = imgs_by_pid.get(p["project_id"], [])
        poster = next((i for i in imgs if i.get("poster")), None) or (imgs[0] if imgs else None)
        tiles.append({**p, "thumb": poster, "year": ds.public_year(p.get("date", ""))})
    return render_template("studio_index.html", tiles=tiles)


@app.route("/studio/projects")
def studio_projects():
    projs = ds.public_projects()
    by_id = {p["project_id"]: p for p in projs}
    cols = ds.load_collections()
    used = set()
    collections = []
    for c in cols:
        members = [by_id[pid] for pid in c.get("members", []) if pid in by_id]
        used.update(m["project_id"] for m in members)
        collections.append({"id": c["id"], "title": c["title"], "members": members})
    unassigned = [p for p in projs if p["project_id"] not in used]
    return render_template("studio_projects.html", collections=collections, unassigned=unassigned)


@app.route("/studio/projects/new", methods=["POST"])
def studio_projects_new():
    title = request.form.get("title", "").strip()
    if title:
        ds.create_collection(title, request.form.get("description", "").strip())
        flash(f"Project “{title}” created. Drag works into it, then Save.", "ok")
    else:
        flash("A project name is required.", "warn")
    return redirect(url_for("studio_projects"))


@app.route("/studio/projects/delete", methods=["POST"])
def studio_projects_delete():
    cid = request.form.get("cid", "")
    if cid:
        ds.delete_collection(cid)
        flash("Project deleted (its works are now unassigned).", "ok")
    return redirect(url_for("studio_projects"))


@app.route("/studio/projects/save", methods=["POST"])
def studio_projects_save():
    import json as _json
    try:
        payload = _json.loads(request.form.get("layout", "{}"))
    except ValueError:
        payload = {}
    if isinstance(payload, dict):
        if "data" in payload or "order" in payload:  # new format {order, data}
            if isinstance(payload.get("order"), list):
                ds.reorder_collections(payload["order"])
            if isinstance(payload.get("data"), dict):
                ds.set_collections_layout(payload["data"])
        else:  # legacy: bare mapping {cid: ...}
            ds.set_collections_layout(payload)
        flash("Project arrangement saved.", "ok")
    return redirect(url_for("studio_projects"))


@app.route("/studio/selected", methods=["GET", "POST"])
def studio_selected():
    if request.method == "POST":
        featured = request.form.getlist("featured")
        featured.sort(key=lambda aid: _to_float(request.form.get(f"order_{aid}"), 9999))
        ds.set_selected_works(featured)
        flash(f"Selected Work carousel updated — {len(featured)} image(s).", "ok")
        return redirect(url_for("studio_selected"))

    projs = ds.public_projects()
    title = {p["project_id"]: p["title"] for p in projs}
    cands = []
    for pid in title:
        for im in ds.public_images(pid):
            cands.append({"rec": im, "pid": pid, "title": title[pid]})
    current = {r["asset_id"]: r.get("selected_order", 0)
               for r in ds.all_images() if r.get("selected_work")}
    # show featured first (in order), then the rest
    cands.sort(key=lambda c: (c["rec"]["asset_id"] not in current,
                              current.get(c["rec"]["asset_id"], 0)))
    return render_template("studio_selected.html", cands=cands, current=current)


def _to_float(v, default):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


@app.route("/studio/new", methods=["GET", "POST"])
def studio_new():
    if request.method == "POST":
        title = request.form.get("title", "").strip()
        if not title:
            flash("A title is required.", "warn")
            return redirect(url_for("studio_new"))
        pid = ds.create_project(
            title=title,
            status=request.form.get("status", "completed"),
            confidentiality=request.form.get("confidentiality", "public"),
            date=request.form.get("date", "").strip(),
            description=request.form.get("description", "").strip(),
            work_type=request.form.get("work_type", "Exhibitions").strip() or "Exhibitions",
        )
        if request.form.get("public_website_visible"):
            ds.set_public_visible(pid, True)
        flash(f"Created “{title}”. Now add text, images and PDFs.", "ok")
        return redirect(url_for("studio_project", pid=pid))
    return render_template("studio_new.html",
                           statuses=ds.STATUSES, levels=ds.CONFIDENTIALITY_LEVELS,
                           work_types=ds.WORK_TYPES)


@app.route("/studio/project/<pid>")
def studio_project(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    images = [r for r in ds.all_images() if r.get("project") == pid]
    pdfs = ds.project_pdfs(pid)
    sections = ds.split_sections(proj["body"])
    blurb = sections.get("Public-facing summary", "")
    return render_template("studio_project.html", pid=pid, fm=proj["fm"],
                           blurb=blurb, images=images, pdfs=pdfs,
                           statuses=ds.STATUSES, levels=ds.CONFIDENTIALITY_LEVELS,
                           work_types=ds.WORK_TYPES)


@app.route("/studio/project/<pid>/edit", methods=["POST"])
def studio_project_edit(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    fm = dict(proj["fm"])
    for key in ("title", "date", "confidentiality", "work_type"):
        if key in request.form:
            fm[key] = request.form.get(key, fm.get(key, "")).strip()
    fm["public_website_visible"] = "true" if request.form.get("public_website_visible") else "false"
    new_status = request.form.get("status", fm.get("status"))
    body = proj["body"]
    if "blurb" in request.form:  # public blurb -> Public-facing summary section
        body = ds.set_section(body, "Public-facing summary", request.form.get("blurb", ""))
    ds.save_project(pid, fm, body, new_status=new_status)
    flash("Saved.", "ok")
    return redirect(url_for("studio_project", pid=pid))


@app.route("/studio/project/<pid>/poster", methods=["POST"])
def studio_set_poster(pid):
    if not ds.get_project(pid):
        abort(404)
    asset_id = request.form.get("asset_id", "")
    if asset_id:
        ds.set_poster_image(pid, asset_id)
        flash("Poster image set.", "ok")
    return redirect(url_for("studio_project", pid=pid))


@app.route("/studio/project/<pid>/images", methods=["POST"])
def studio_upload_images(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    conf = proj["fm"].get("confidentiality", "public")
    caption = request.form.get("caption", "").strip()
    files = [f for f in request.files.getlist("images") if f and f.filename]
    n_ok = n_fail = 0
    for f in files:
        try:
            ds.save_uploaded_image(pid, f.filename, f.read(), caption, conf)
            n_ok += 1
        except Exception:  # noqa: BLE001
            n_fail += 1
    flash(_upload_msg(n_ok, "image", n_fail), "ok" if n_ok else "warn")
    return redirect(url_for("studio_project", pid=pid))


@app.route("/studio/project/<pid>/pdfs", methods=["POST"])
def studio_upload_pdfs(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    conf = proj["fm"].get("confidentiality", "public")
    label = request.form.get("label", "").strip() or "Download Publication"
    as_download = request.form.get("as_download")
    files = [f for f in request.files.getlist("pdfs") if f and f.filename]
    n_ok = n_fail = 0
    for f in files:
        try:
            res = ds.save_uploaded_pdf(pid, f.filename, f.read(), label, conf)
            if as_download and not res.get("private") and res.get("local_path"):
                ds.add_download_link(pid, label, url_for("local_asset", relpath=res["local_path"]))
            n_ok += 1
        except Exception:  # noqa: BLE001
            n_fail += 1
    flash(_upload_msg(n_ok, "PDF", n_fail), "ok" if n_ok else "warn")
    return redirect(url_for("studio_project", pid=pid))


IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".tiff", ".tif", ".bmp", ".heic")


def _upload_msg(n_ok, kind, n_fail):
    if not n_ok and not n_fail:
        return f"No {kind}s selected."
    msg = f"Uploaded {n_ok} {kind}(s)."
    if n_fail:
        msg += f" {n_fail} failed to save."
    return msg


@app.route("/studio/project/<pid>/upload", methods=["POST"])
def studio_upload_batch(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    conf = proj["fm"].get("confidentiality", "public")
    as_dl = request.form.get("pdf_as_download")
    files = [f for f in request.files.getlist("files") if f and f.filename]
    n_img = n_pdf = n_skip = n_fail = 0
    for f in files:
        name = f.filename.lower()
        mime = (f.mimetype or "").lower()
        try:
            data = f.read()
            if name.endswith(".pdf") or mime == "application/pdf":
                res = ds.save_uploaded_pdf(pid, f.filename, data, "Download Publication", conf)
                if as_dl and not res.get("private") and res.get("local_path"):
                    ds.add_download_link(pid, "Download Publication", url_for("local_asset", relpath=res["local_path"]))
                n_pdf += 1
            elif name.endswith(IMAGE_EXTS) or mime.startswith("image/"):
                ds.save_uploaded_image(pid, f.filename, data, "", conf)
                n_img += 1
            else:
                n_skip += 1
        except Exception:  # noqa: BLE001
            n_fail += 1
    msg = (f"Uploaded {n_img} image(s) and {n_pdf} PDF(s)"
           + (f"; skipped {n_skip} unsupported" if n_skip else "")
           + (f"; {n_fail} failed" if n_fail else "") + ".")
    flash(msg if (n_img or n_pdf) else "No supported files (images or PDFs) found.",
          "ok" if (n_img or n_pdf) else "warn")
    return redirect(url_for("studio_project", pid=pid))


@app.route("/studio/project/<pid>/text", methods=["POST"])
def studio_add_text(pid):
    proj = ds.get_project(pid)
    if not proj:
        abort(404)
    conf = proj["fm"].get("confidentiality", "public")
    title = request.form.get("title", "").strip() or "Note"
    text = request.form.get("text", "").strip()
    if text:
        ds.save_note(title, text, conf, project=pid)
        flash("Text saved to the dataset.", "ok")
    else:
        flash("Nothing to save.", "warn")
    return redirect(url_for("studio_project", pid=pid))


def _within(path, root):
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


# Only these asset subfolders may be served over HTTP. The private vault
# (private_diaries, therapy_raw_vault, private_emails, visual_references, …)
# is deliberately excluded and can never be reached via /local/.
_SERVABLE_DIRS = ("project_images", "pdfs", "thumbnails", "public_gallery_docs")


@app.route("/local/<path:relpath>")
def local_asset(relpath):
    """Serve a file from the PUBLIC asset subfolders only — never the vault."""
    target = (ds.ASSETS_ROOT.parent / relpath).resolve()
    allowed = [(ds.ASSETS_ROOT / d).resolve() for d in _SERVABLE_DIRS]
    if not target.is_file() or not any(_within(target, a) for a in allowed):
        abort(404)
    return send_file(target)


if __name__ == "__main__":
    print(f"Studio Clippy console → http://{HOST}:{PORT}  (local only; Ctrl+C to stop)")
    app.run(host=HOST, port=PORT, debug=False)
