# Archive

Layer A of the project: where **unprocessed material** lives before it becomes
structured dataset records. The archive can be broad and messy; the dataset and
training set cannot.

## The canonical split (consolidated 2026-06-11)

- **Text captures live in `source_texts/`** — that is the single canonical home
  for captured/extracted text (`public/`, `private/`, `processed/`), and it's
  what the exporters read. Do not duplicate text captures here.
- **Raw personal material lives in the vault only** — `studio-clippy-assets/`
  (git-ignored, outside the repo), via `scripts/ingest_diary_entry.py`. There is
  no personal-documentation staging inside the repo, by design.
- **This folder holds what neither of those covers:** unprocessed bundles and
  authored-but-unpublished content.

## Folders

- `public_practice/` — unprocessed public bundles: old website dumps, scanned
  catalogues, zipped press kits — things not yet broken down into
  `source_texts/` records or manifest entries.
- `studio_private/` — working documents: unrealised project notes, grant
  drafts, internal planning, early sketches (text-form; big binaries go to the
  assets folder).
- `public_website_content/` — authored content destined for the public site
  (about texts, curated selections) before it passes through
  `prepare_public_export.py`.

When an item here gets processed, its text goes to `source_texts/`, its assets
to `../studio-clippy-assets/` + a manifest record, and its knowledge into cards.
The archive copy can then stay as provenance or be deleted.
