# Backend Database Schema (planning)

The markdown/JSONL files remain the **source of truth**; the database is an
index over them for search, tagging and approval workflows. This avoids lock-in
and keeps the dataset hand-editable and git-diffable. SQLite first; Postgres
only if/when the public site needs it.

## Core table: `items`

Everything is an item with a type. One table, uniform flags, joined to
relationships — mirrors the card frontmatter exactly.

```text
id                      text primary key      -- project_id / idea_id / card_id / asset_id / entry_id
title                   text
type                    text                  -- project | idea | diary | self_knowledge | reference | person | asset | source_doc
body                    text                  -- markdown body (or extracted text for source docs)
tags                    json                  -- conceptual + visual tags
related_projects        json
related_people          json
related_assets          json
confidentiality         text  check in (public, studio_private, sensitive_distilled, raw_private_vault)
training_eligible       boolean default false
public_website_visible  boolean default false
created_at              datetime
updated_at              datetime
source                  text                  -- file path or URL of record
review_status           text                  -- needs_review | reviewed | approved_public
```

## Supporting tables

```text
relationships (from_id, to_id, kind)          -- explicit graph: project↔reference, person↔project, idea↔project…
assets        (asset_id, local_path, drive_url, sha256, width, height, bytes, rights, photographer)
exports       (export_id, kind, created_at, record_count, excluded_levels, file_path)
audit_log     (timestamp, action, item_id, field, old, new)   -- every visibility/eligibility change is logged
people_aliases(person_id, alias, real_name_allowed)
```

## Rules enforced at the database layer

1. `type = diary` ⇒ `confidentiality = raw_private_vault`, `training_eligible = false`,
   `public_website_visible = false` — **not overridable through the API**.
2. `public_website_visible = true` requires `confidentiality = public` AND
   `review_status = approved_public`.
3. Visibility/eligibility changes append to `audit_log`.
4. Diary bodies are NOT stored in the index — only metadata + vault file path.
   (Raw text never enters a queryable store.)

## Sync model

`scripts/` (future `index_dataset.py`) walks the repo + manifests, upserts
`items`, and flags drift (file changed since last index). Writes flow the other
way only through the console/API, which edits the files first, then re-indexes.
