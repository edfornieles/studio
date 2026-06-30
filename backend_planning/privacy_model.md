# Privacy Model (backend planning)

How the four confidentiality levels behave across the whole stack. The levels
are defined in `confidentiality_rules.md`; this maps them to system behaviour.

## The flow of material

```text
raw_private_vault ──(human distillation)──> sensitive_distilled ──(never)──> public
       │                                            │
   vault only,                              private assistant
   never indexed,                           retrieval-gated by mode
   never exported
                     studio_private ──(explicit approval + review)──> public_website_visible
```

Arrows only point one way. Nothing is promoted automatically.

## Per-level system behaviour

| | storage | index/search | private assistant | training export | public site |
|---|---|---|---|---|---|
| `raw_private_vault` | git-ignored vault, outside repo | metadata only, never body | ✗ (may know it *exists*) | ✗ hard-blocked | ✗ |
| `sensitive_distilled` | repo | yes | gated (studio/double modes only) | separate `private_*` files, opt-in flag | ✗ |
| `studio_private` | repo | yes | yes | yes if `training_eligible` | only via explicit approval |
| `public` | repo | yes | yes | yes if `training_eligible` | only if `public_website_visible` + approved |

## Third parties

- Person cards default to aliases (`real_name_allowed: false`).
- Distillation strips third-party names and private facts about others.
- A "do-not-surface" list (from person-card Boundaries) is checked at assistant
  retrieval time, both private and public.
- Public exports run a redaction check against the alias table before shipping.

## Defence in depth (what enforces this)

1. `.gitignore` — raw folders can't be committed.
2. Folder layout — vault lives outside the repo entirely.
3. Frontmatter flags — every record self-describes.
4. `validate_dataset.py` — fails on private-marked-public, raw material in the
   repo, and `raw_private_vault` in any export file.
5. Export scripts — filter by level + flags; raw vault is excluded by
   construction, not by configuration.
6. (future) DB constraints + audit log — diary rows physically can't be public.
7. (future) Public deployment ships ONLY `exports/public_website/` — the private
   dataset never reaches the public server at all.

The principle behind all seven: **a mistake should require defeating several
independent layers, not one forgotten checkbox.**
