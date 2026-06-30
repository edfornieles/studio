# Roadmap

## Phase 0 — Foundation (done)

- Layered repo + git-ignored asset vault; four-level confidentiality model.
- 30 project cards (deep-researched, sectioned schema), 6 self-knowledge cards,
  86 source-text captures, 290-image manifest, full CV.
- Scripts: download/extract/manifest/thumbnails/validate + RAG and fine-tune
  exporters (1,200+ RAG chunks; ~650 chat-format SFT pairs incl. boundary set).
- Local Flask console (`app/`) — the v0 backend: browse/edit cards, catalogue
  images, feed notes, private uploads, distillation, validation.

## Phase 1 — Complete the dataset (current)

- Resolve `needs_review` conflicts (dates, attributions) via interview/console.
- Reference cards (Makhmalbaf, Herzog, von Trier's Idiots, Robert Ashley,
  Mike Kelley, Milady, The Rehearsal…), person cards for public figures.
- Idea cards for live threads (the Foundation/meaning camp, Borrowed Lives,
  becoming/AI-nurture, mosaic community).
- Capture Ed's voice: record studio monologues + interviews → transcripts →
  cards. Download the 290 catalogued images locally + thumbnails.

## Phase 2 — Private assistant (next build)

- Retrieval prototype (`clippy_chat.py`): hybrid search over `exports/rag_ready/`
  with confidentiality gates; archive/inference/speculation labelling; citations.
- Wire into the console as a chat tab. Eval harness: run `eval_prompts/` with
  retrieval on/off, score with rubric, keep transcripts as future training data.
- Write-back loop: conversations append to Feed logs; distillation proposals
  always human-approved.

## Phase 3 — Backend proper

- Promote the console toward `backend_planning/` spec: quick capture, diary
  input (vault-defaulted), tagging, approval workflows (`training_eligible`,
  `public_website_visible`), export buttons. SQLite index over the markdown/JSONL
  (files stay the source of truth).

## Phase 4 — Public artist website

- Static or lightly dynamic site from `exports/public_website/` (filtered,
  opt-in content only). Public model interface with its own restricted index,
  clear "this is a model/artwork, not Ed" framing, rate limits.
- The training-set-as-artwork presentation: show how the archive produces the
  assistant.

## Phase 5 — Training

- Fine-tune on SFT export (dialogue weighted over synthetic QA); evaluate against
  Phase 2 baseline; iterate with correction/preference pairs gathered in daily use.
