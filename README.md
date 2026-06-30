# Studio Clippy

A living archive, dataset, training system and future artwork for the studio of
**Ed Fornieles**. Five connected parts (see [project_overview.md](project_overview.md)):
a living training set · an artistic archive · a reasoning system / model
interface · a backend + public artist website · a private personal documentation
system. It is explicitly **not** a generic chatbot and **not** a fake
replacement of Ed.

**Why both archive and training set:** the archive collects everything,
broadly and messily; the training set is the selected, structured, reviewed,
permissioned export of it. Keeping these separate — with explicit filtered
steps between them — is the project's core discipline.

## Current state

- **30 project cards** (deep-researched, sectioned), **6 self-knowledge cards**,
  **86 source-text captures**, **290-image manifest**, full CV.
- Working exports: ~1,200 RAG chunks, ~650 chat-format fine-tune pairs.
- A working v0 backend: the local console in [`app/`](app/README.md).

## Folder structure

```text
studio-clippy/
  project_overview.md            the five parts, the layer model
  dataset_principles.md          what the dataset privileges/avoids
  dataset_schema.md              all record schemas (cards, assets, exports)
  confidentiality_rules.md       the four levels + per-record flags
  assistant_modes.md             Studio Clippy vs Ed Double + system prompt
  studio_constitution.md         core studio logic
  assistant_critique_rubric.md   the ten questions
  dangers_and_safeguards.md      twelve failure modes and their guards
  roadmap.md                     phases 0–5

  archive/                       unprocessed bundles (public_practice, studio_private,
                                 public_website_content) — text captures live in source_texts/
  project_cards/                 completed/ active/ imagined/ abandoned/
  idea_cards/                    quick-captured ideas (seed → developing → …)
  self_knowledge_cards/          CANONICAL home for all distilled personal patterns
  personal_maps/                 entities: people, life_events, ideas_over_time (sensitive)
  reference_cards/               artists, films, books_theory, platforms_systems,
                                 memes_archetypes, institutions, people
  dialogue_examples/             behavioural training examples (incl. boundary set)
  image_manifests/ pdf_manifests/  JSONL asset records
  source_texts/                  public/ private/ processed/ captures
  interview_transcripts/         raw/ processed/
  eval_prompts/                  test prompts + scoring rubric
  backend_planning/              db schema, API routes, admin notes, privacy model
  frontend_planning/             website structure, public model, archive browsing
  scripts/                       the pipeline (below)
  exports/                       rag_ready/ fine_tune_ready/ public_website/ summaries/
  app/                           the local console (Flask)
```

Large/raw files live OUTSIDE the repo in `../studio-clippy-assets/`
(git-ignored): images, PDFs, videos, audio, diaries, therapy vault, private
emails, personal photos, thumbnails.

## How confidentiality works

Four levels — `public`, `studio_private`, `sensitive_distilled`,
`raw_private_vault` — plus two flags on every record: `training_eligible` and
`public_website_visible` (default false). Raw private material never enters the
repo, never exports, and is only used to produce distilled cards. Full rules:
[confidentiality_rules.md](confidentiality_rules.md); enforcement map:
[backend_planning/privacy_model.md](backend_planning/privacy_model.md).

## How to add things

- **A project card** — console (*+ New*) or copy the template from
  [dataset_schema.md](dataset_schema.md) into `project_cards/<status>/`.
- **An idea** — `python scripts/ingest_project_note.py --idea "…"` (or console
  quick capture, planned). Lands in `idea_cards/` as `studio_private`.
- **A diary entry** — `python scripts/ingest_diary_entry.py --type diary --title "…"`.
  Writes ONLY to the git-ignored vault; privacy fields are locked.
- **An image/PDF** — console (*project page → Add image* or *Feed/Upload*), or
  drop the file in `../studio-clippy-assets/` and add a manifest record.
- **A note on an existing project** —
  `python scripts/ingest_project_note.py --project <id> --note "…"`.

## The pipeline

```bash
source .venv/bin/activate                      # flask installed; pip install pypdf Pillow requests for full pipeline
python app/server.py                           # console → http://127.0.0.1:5050

python scripts/download_assets.py --dry-run    # collect public assets (gentle)
python scripts/extract_pdf_text.py             # PDFs → source_texts/processed/
python scripts/build_image_manifest.py         # scan images → manifest records
python scripts/make_thumbnails.py              # browsing thumbnails

python scripts/validate_dataset.py             # run often; CI-friendly exit code
python scripts/prepare_rag_export.py           # → exports/rag_ready/ (section chunks)
python scripts/prepare_finetune_export.py      # → exports/fine_tune_ready/ (chat SFT)
python scripts/prepare_public_export.py        # → exports/public_website/ (hard-filtered)
```

The RAG export always excludes `raw_private_vault`; the fine-tune export also
skips `training_eligible: false` and `## Private notes`, and quarantines
sensitive material behind `--include-sensitive` (separate git-ignored files).
The public export admits ONLY `public` + `public_website_visible: true` records
and uses each project's `## Public-facing summary`, never the full card.

## Backend and website

The private backend exists as the console (`app/`); its target state is
specced in [backend_planning/](backend_planning/). The public artist website is
planned in [frontend_planning/](frontend_planning/) and will be built solely
from `exports/public_website/` — the private dataset never reaches a public
server.

## What still needs doing

See [roadmap.md](roadmap.md). Headlines: resolve `needs_review` facts with Ed;
reference + person + idea cards for live threads; voice capture; download the
290 catalogued images; build the retrieval prototype; eval baseline; then
backend → website → training.
