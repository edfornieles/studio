# Studio Clippy Console

A small **local** web app for browsing and feeding the Studio Clippy dataset.
It reads and writes the dataset files directly (project cards, manifests, source
texts, self-knowledge cards) — no database, no build step.

## Run

```bash
cd studio-clippy-dataset
python3 -m venv .venv && source .venv/bin/activate   # if not already
pip install flask                                    # the only extra dependency
python app/server.py
```

Then open **http://127.0.0.1:5050**.

## What you can do

- **Projects** — browse all cards grouped by status; search; filter; see image
  counts, confidentiality badges and `needs review` flags.
- **Project page** — read the rendered card, edit any field or the markdown body,
  change status (the file moves between `project_cards/<status>/` folders),
  append a note/link to a section, and catalogue images (by URL or upload).
- **+ New** — create a project card from the schema (all sections stubbed `TKTK`).
- **Images** — a gallery of everything in the image manifests, filterable by
  project and confidentiality. Remote images load from `source_url`; downloaded
  ones are served locally.
- **Feed / Upload** — three things:
  1. **Notes / links** → saved to `source_texts/` (public/studio) or the vault.
  2. **Personal information** → defaults to the **git-ignored raw vault**
     (`studio-clippy-assets/`), never committed or surfaced. A private index
     (filenames only) lives outside the repo.
  3. **Distil** → turn raw material into a safe `sensitive_distilled`
     self-knowledge card (never quoting the raw source).
- **Validate** — runs `scripts/validate_dataset.py` and shows the result.

## Safety

- **Local only.** Binds to `127.0.0.1`, has no authentication. Do not expose it
  to a network or the internet.
- Personal uploads default to `raw_private_vault` and are written **outside** the
  repo into `studio-clippy-assets/` (git-ignored). The app refuses to put a
  `raw_private_vault` image into a repo manifest.
- After editing, click **Validate** (or run the script) before committing.

## How it maps to files

| UI action | Writes to |
|---|---|
| Edit / create project | `project_cards/<status>/<id>.md` |
| Append note to card | the card's chosen section |
| Catalogue image (URL) | `image_manifests/public_gallery_manifest.jsonl` (or `private_visual_manifest.jsonl` for sensitive) |
| Upload image | `studio-clippy-assets/<vault>/…` + manifest (unless raw) |
| Note / link | `source_texts/public|private/…` or vault |
| Personal file | `studio-clippy-assets/therapy_raw_vault|private_diaries/…` (git-ignored) |
| Distil card | `self_knowledge_cards/<id>.md` |
