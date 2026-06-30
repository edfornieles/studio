# Admin Interface Notes (planning)

The private interface Ed uses to input and organise material. **Version 0
already exists**: the Flask console in `app/` (browse/edit project cards, feed
notes/links, catalogue/upload images, private uploads to the vault, distillation
form, validation tab). This document describes where it goes next.

## Design principles

- **Capture must be frictionless.** If adding an idea takes more than 20 seconds,
  it won't happen. One always-visible "quick capture" box that creates an idea
  card from a single sentence; refinement is a later, optional step.
- **Privacy is structural, not behavioural.** The diary form has no
  confidentiality selector — it *can't* save anywhere but the vault. Public
  visibility is a deliberate two-step (approve → publish), never a checkbox
  ticked in passing.
- **Files stay the source of truth.** The interface edits markdown/JSONL; the
  database only indexes. Everything remains hand-editable and git-diffable.

## Screens (target state)

1. **Quick capture** — one text box; AI suggests title/tags/related projects;
   saves as idea card (`seed`).
2. **Diary** — long-form input, date/type pickers, related-people as aliases;
   saves to vault only; shows "possible self-knowledge cards to extract" as
   prompts, never auto-extracts.
3. **Project card editor** — current console page, plus: related-people picker,
   per-section editing, `Public-facing summary` authoring with live preview of
   what the public site would show.
4. **Asset manager** — current gallery, plus: bulk caption/tag editing, rights
   review queue (everything still marked "verify before reuse"), local download
   + thumbnail triggers.
5. **People** — alias-first person cards; a "do-not-surface" list the assistant
   checks at retrieval time.
6. **Review queues** — three lists driving the whole permission system:
   `needs_review` (facts to confirm), `training_eligible` candidates,
   `public_website_visible` candidates. Approving moves items through
   review_status with an audit log.
7. **Distillation desk** — pick a vault entry → draft card appears side-by-side
   with the schema → Ed edits → save as sensitive_distilled. The raw text never
   leaves the left-hand pane.
8. **Exports** — buttons for RAG / fine-tune / public-website exports with the
   validator run automatically first and counts + exclusions shown.
9. **Assistant tab** — private Studio Clippy chat with retrieval citations and a
   mode toggle (Studio Clippy / Ed Double).

## Non-goals

No multi-user accounts, no cloud sync of the vault, no mobile app — until the
core loop (capture → structure → approve → export) is habitual.
