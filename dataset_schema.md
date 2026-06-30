# Dataset Schema

All record templates in one place. Cards are Markdown with flat YAML frontmatter;
assets are JSONL. Keep field names stable — scripts and exporters depend on them.

**Three flags appear on every record type** and drive all filtering:

- `confidentiality`: `public / studio_private / sensitive_distilled / raw_private_vault`
- `training_eligible`: may this enter fine-tune exports? (default varies by type)
- `public_website_visible`: may this appear on the public site? (**default false everywhere** — opt-in only)

---

## Project Card — `project_cards/<status>/<project_id>.md`

```markdown
---
project_id:
title:
date:
status: completed / active / imagined / abandoned
confidentiality: public / studio_private / sensitive_distilled / raw_private_vault
source_materials:
related_assets:
related_references:
related_people:
needs_review: true
public_website_visible: false
training_eligible: true
---

# Title

## Short description
## Core question
## Social machine
## Fictional device
## Real-world system it attaches to
## Audience / participant role
## Performer / subject role
## Emotional engine
## Ethical danger
## Aesthetic world
## Research method
## Use of real material
## Use of fiction
## Emergent behaviour
## Residue / documentation / afterlife
## What this project teaches the studio
## What failed or remained unresolved
## Possible mutations
## Assistant behaviour rules derived from this project
## Public-facing summary
## Private notes
```

(`Public-facing summary` is the only body section the public website may use
directly; `Private notes` never exports, regardless of card confidentiality.)

---

## Idea Card — `idea_cards/<idea_id>.md`

```markdown
---
idea_id:
date_created:
status: seed / developing / active / abandoned
confidentiality: studio_private
related_projects:
related_people:
training_eligible: true
public_website_visible: false
---

# Idea

## Raw idea
## Why it matters
## Possible project form
## Social machine
## Fictional device
## Emotional engine
## References
## Next questions
## Next practical step
```

---

## Diary / Personal Documentation Entry — VAULT ONLY

Lives in `studio-clippy-assets/private_diaries/` (git-ignored, outside the repo).
Created via `scripts/ingest_diary_entry.py`, which locks the defaults:

```markdown
---
entry_id:
date:
type: diary / relationship / sex / love / fear / desire / life_event / thought / dream / therapy_reflection
confidentiality: raw_private_vault
related_people:
related_projects:
related_ideas:
training_eligible: false
public_website_visible: false
requires_distillation: true
---

# Entry

## Raw text
## Possible themes
## Possible self-knowledge cards to extract
## Do-not-use notes
```

---

## Self-Knowledge Card — `self_knowledge_cards/<card_id>.md`

```markdown
---
card_id:
confidentiality: sensitive_distilled
source_type: diary / therapy / interview / memory / conversation / mixed
do_not_quote_raw: true
training_eligible: true
public_website_visible: false
needs_review: true
---

# Pattern

## Description
## Where it appears
## Emotional tone
## How it helps the work
## How it blocks the work
## Useful Studio Clippy response
## Forbidden Studio Clippy response
## Related projects
## Related references
## Related people, if safe
```

---

## Person Card

Private people → `personal_maps/people/` (aliased, sensitive). Public figures
(curators, collaborators in their public capacity) → `reference_cards/people/`.

```markdown
---
person_id:
name_or_alias:
real_name_allowed: false
relationship_type:
confidentiality: sensitive_distilled
public_figure: false
training_eligible: false
public_website_visible: false
---

# Person

## Description
## Relationship to Ed
## Relationship to the work
## Themes
## Boundaries
## Do-not-surface notes
```

---

## Reference Card — `reference_cards/<category>/<reference_id>.md`

```markdown
---
reference_id:
type: artist / film / book / theory / platform / meme / institution / person / technology
confidentiality: public
training_eligible: true
public_website_visible: true
---

# Reference

## Why it matters
## Projects it touches
## Operation it teaches
## What should not be copied
## Possible mutation
```

---

## Image Asset (JSONL) — `image_manifests/*.jsonl`

```json
{
  "asset_id": "",
  "project": "",
  "type": "image",
  "source_url": "",
  "local_path": "",
  "drive_url": "",
  "caption": "",
  "description": "",
  "conceptual_tags": [],
  "visual_tags": [],
  "people_visible": false,
  "rights": "",
  "photographer": "",
  "source_page": "",
  "confidentiality": "public",
  "training_eligible": true,
  "public_website_visible": false
}
```

## PDF Asset (JSONL) — `pdf_manifests/*.jsonl`

Same shape as the image asset minus visual fields, plus `extracted_text_path`
and `title`; includes the two flags `training_eligible` / `public_website_visible`.

## Dialogue Example (JSONL) — `dialogue_examples/*.jsonl`

```json
{"id": "example_001", "mode": "studio_clippy|ed_double", "tag": "", "user": "", "assistant": ""}
```

## RAG export chunk (JSONL) — produced by `prepare_rag_export.py`

```json
{
  "id": "", "type": "", "title": "", "project": "", "section": "",
  "text": "", "tags": [], "source": "",
  "confidentiality": "", "training_eligible": true, "public_website_visible": false
}
```

## Fine-tune record (JSONL) — produced by `prepare_finetune_export.py`

```json
{"messages": [{"role": "system|user|assistant", "content": ""}], "meta": {"source": "dialogue|card_qa_synthetic", "id": "", "confidentiality": ""}}
```
