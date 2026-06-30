# Confidentiality Rules

Every card and asset in this dataset carries a `confidentiality` field. There are
**four levels**. They govern what may be stored where, what may be surfaced by
the assistant, and what may be exported.

```text
public
studio_private
sensitive_distilled
raw_private_vault
```

## Definitions

- **`public`** — already-public material: gallery texts, press, published
  images, public PDFs. Safe to store in the repo, quote, and export.

- **`studio_private`** — private studio notes, unrealised projects, working
  documents. May live in the repo as text/cards. Not for public release.
  Exportable to private (not public) RAG/fine-tune targets.

- **`sensitive_distilled`** — processed self-knowledge derived from diaries,
  therapy, personal reflections. **Safe to use, but not public.** This is the
  *only* form in which personal/emotional material should reach the assistant.
  Self-knowledge cards carry `do_not_quote_raw: true`.

- **`raw_private_vault`** — raw diaries, therapy transcripts, private emails,
  intimate recordings. **Must not be surfaced directly or uploaded to public
  repos.** Lives only in `studio-clippy-assets/therapy_raw_vault/` and
  `private_diaries/` (git-ignored). It is *input to distillation*, never output.

## Hard rules

1. Raw private material (`raw_private_vault`) is **never** committed to the repo
   and **never** exported. The `.gitignore` enforces the first; the validator
   and `prepare_rag_export.py` enforce the second.
2. Therapy and diary material is processed into **distilled self-knowledge
   cards** (`sensitive_distilled`), never surfaced raw.
3. The assistant must **not** diagnose, moralise, therapise, or quote raw
   therapy/diary material, even when distilled cards are available.
4. Any record whose source is private but whose `confidentiality` is marked
   `public` is a **validation error** (see `scripts/validate_dataset.py`).

## The distillation flow

```text
raw_private_vault  ──(human review + careful summarisation)──>  sensitive_distilled
   (vault only)                                                 (self_knowledge_cards/)
```

The arrow only ever points one way. Nothing flows back from a distilled card to
expose its raw source.

## v2 additions: per-record flags

Beyond the level, every record carries two booleans that drive the exporters:

- **`training_eligible`** — may this record enter fine-tune exports?
  Diary entries are locked to `false`. Default for person cards: `false`.
- **`public_website_visible`** — may this appear on the public artist website?
  **Default `false` everywhere.** Setting it `true` is only valid on
  `confidentiality: public` records, and the public export
  (`scripts/prepare_public_export.py`) enforces this plus a review step.

Extended `raw_private_vault` examples: private emails, sex/love documentation,
voice notes, unprocessed relationship notes, personal photos, sensitive
third-party information. All live outside the repo; `validate_dataset.py` also
fails if any export file contains vault-level material.

Project cards have two body sections with special handling regardless of the
card's level: `## Public-facing summary` (the only section the public site may
use) and `## Private notes` (never exported by any pipeline).
