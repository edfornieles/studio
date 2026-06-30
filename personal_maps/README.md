# Personal Maps

Structured, **distilled** personal documentation — the *entity* side of layer 5:
who, what happened, and how ideas evolved.

## The canonical split (consolidated 2026-06-11)

- **Patterns live in `self_knowledge_cards/`** — emotional patterns,
  relationship patterns, love/sex/intimacy patterns, blocks, desires. One
  canonical home, one schema, already wired into the exporters and the console's
  distillation flow. Do not create pattern cards here.
- **Entities live here** — person cards, dated life events, and the mutation of
  ideas over time.
- **Raw material lives in the vault only** — `studio-clippy-assets/` (git-ignored,
  outside the repo), written via `scripts/ingest_diary_entry.py` (types include
  `relationship`, `sex`, `love`). There are **no raw folders inside the repo**,
  by design: a `.gitignore` mistake should have nothing to expose.

## Folders

- `people/` — person cards for private individuals: **aliased by default**
  (`real_name_allowed: false`), `training_eligible: false`, with explicit
  `Boundaries` and `Do-not-surface notes` the assistant checks at retrieval
  time. Public figures go in `reference_cards/people/` instead.
- `life_events/` — major events as dated, distilled cards (sensitive_distilled).
- `ideas_over_time/` — how recurring ideas have mutated across years; links
  idea cards and project cards into longitudinal threads.

## Rules

Everything here is `sensitive_distilled` (or stricter) and
`public_website_visible: false`. Nothing in this folder is ever public. Third
parties have not consented to be in a dataset; person cards exist to *protect*
them, not to profile them.
