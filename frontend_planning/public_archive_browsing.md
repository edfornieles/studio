# Public Archive Browsing (planning)

How visitors move through the curated archive on the public site.

## What is browsable (all opt-in, from `exports/public_website/` only)

- **Project cards** — the `Public-facing summary` + approved metadata, never the
  full internal card. Linked images, press, related references.
- **Images** — approved records from the image manifest with caption,
  photographer credit and rights cleared. Lazy-loaded gallery + per-project strips.
- **Exhibition texts & public PDFs** — extracts with links to the hosting
  gallery/institution rather than full re-publication where rights are unclear.
- **References** — the reference cards (public by design): why each matters,
  what operation it teaches. This is the practice's reading list as artwork.
- **Selected training examples** — a curated handful of Q→A pairs and dialogue
  examples, shown as *specimens* of the training set with their schemas.
- **Selected interview fragments** — approved excerpts from processed
  interview transcripts.
- **Visual datasets** — tag-based views across the image corpus (e.g. every
  "residue" image across all projects; every "cute" image 2017–2024).

## Browsing structures

1. **By project** — the canonical route: project page → images → texts → references.
2. **By operation** — the studio-logic index: "aggregation of many into one,"
   "escalation," "residue becomes sculpture" → every work that uses that move.
   This is the distinctive one; no normal portfolio can offer it.
3. **By year / life phase** — the practice's own framing of life stages.
4. **By tag** — flat folksonomy across images, cards and texts.
5. **Ask the model** — every browsing page offers "ask Studio Clippy about
   this" deep-linking into `/model` with context.

## What is deliberately visible about the system

Counts, schemas, manifest structures, the constitution, the rubric — the
machinery is shown. What is described but never shown: the vault, the
self-knowledge layer, person cards. The site says these exist (that's part of
the work's honesty) without exposing a word of them.

## Editorial workflow

Curation happens in the console review queue (`public_website_visible` +
`approved_public`), not on the site. The site is a pure render of the export —
if it isn't in `exports/public_website/`, it does not exist publicly.
