# API Routes (planning)

Future backend routes. The existing Flask console (`app/`) already implements
form-based versions of most write paths; these are their JSON-API equivalents.

## Capture / write

```text
POST /ideas                      create idea card (defaults: studio_private)
POST /diary                      create diary entry → VAULT ONLY (locked: raw_private_vault, training_eligible=false)
POST /projects                   create project card
POST /projects/:id/feed          append note/link to a card section
POST /assets                     upload or register image/PDF/audio (confidentiality-routed storage)
POST /references                 create reference card
POST /people                     create person card (alias by default)
POST /self-knowledge             create distilled card (always sensitive_distilled)
POST /distill/diary-to-self-knowledge   draft a distilled card from a vault entry — returns DRAFT for human approval, never auto-saves
```

## Read / search

```text
GET /archive/search?q=&type=&confidentiality=     private search (console only; binds 127.0.0.1)
GET /projects/:id
GET /projects                                     list with filters
GET /public/projects                              ONLY confidentiality=public AND public_website_visible=true AND review_status=approved_public
GET /public/archive                               same filter, archive extracts
```

## Approval / curation

```text
POST /items/:id/review            set review_status (reviewed / approved_public) — audit-logged
POST /items/:id/visibility        toggle public_website_visible — requires approved_public; audit-logged
POST /items/:id/training          toggle training_eligible — audit-logged
```

## Exports / assistant

```text
POST /exports/rag                 run prepare_rag_export (returns counts + excluded levels)
POST /exports/fine-tune           run prepare_finetune_export
POST /exports/public-website      run prepare_public_export (hard-filtered)
POST /assistant/query             private Studio Clippy query (mode: studio_clippy | ed_double; gates sensitive retrieval by mode)
POST /public/assistant/query      public model — separate restricted index, rate-limited, self-identifies as a model
```

## Hard rules

- `/public/*` routes are the ONLY routes a public deployment exposes; everything
  else binds to localhost or sits behind auth.
- No route can set `public_website_visible=true` on non-public confidentiality.
- `POST /diary` cannot accept a confidentiality parameter at all.
