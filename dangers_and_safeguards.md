# Dangers and Safeguards

The twelve ways this system could go wrong, and what guards against each.
Safeguards marked ✅ are already implemented; ◻ are designed but pending.

## 1. Collapsing archive, artwork, diary and training set into one blob

The archive can contain everything; the training set only selected, structured,
reviewed material.
**Safeguard ✅** Layered folders + explicit export scripts. Nothing enters
`exports/` except through `prepare_rag_export.py` / `prepare_finetune_export.py`,
which filter on confidentiality and `training_eligible`.

## 2. Accidentally exposing private material

Diaries, therapy-derived notes, sex/love documentation and private people are in
the system.
**Safeguard ✅** Every record carries `confidentiality`, `training_eligible`,
`public_website_visible`. Raw material lives only in git-ignored vault folders.
`validate_dataset.py` fails on private-looking material marked public and on any
export containing `raw_private_vault`.

## 3. Turning therapy into bad AI psychology

The model must not diagnose Ed, explain everything through wounds, or quote
therapy material as truth.
**Safeguard ✅** Therapy/diary material reaches the assistant only as distilled
self-knowledge cards, each carrying a "Useful Studio Clippy response" and a
"Forbidden Studio Clippy response". The boundary dialogue examples train the
refusals explicitly.

## 4. Third-party privacy

Diaries and relationship notes include people who never consented to being in a
dataset or model.
**Safeguard ✅/◻** Distilled cards name no third parties (verified). Person cards
(`personal_maps/people/`) use aliases by default (`real_name_allowed: false`)
with explicit `Boundaries` and `Do-not-surface notes`. ◻ A redaction pass should
run before any export ever includes person material.

## 5. Self-parody

The assistant may learn surface patterns and produce generic "Ed-like" ideas —
role-play, AI, identity — without life.
**Safeguard ✅** Critique examples that attack genericness (questions 8/9 of the
rubric), "What failed" sections on every card, and eval scoring for "avoid
generic AI language" and "help Ed grow rather than repeat himself."

## 6. Overfitting to the past

The system should help Ed grow, not trap him in earlier work.
**Safeguard ✅** Every project card carries "What failed or remained unresolved"
and "Possible mutations"; the rubric's final question is about growth.

## 7. Public model confusion

Visitors may think the model is Ed or speaks for him.
**Safeguard ◻** The public interface must state plainly that it is a
model/interface/artwork, not the person (`frontend_planning/public_model_interface.md`).
The system prompts already forbid claiming to be Ed; boundary examples train it.

## 8. Rights and image use

Gallery images, photographer documentation and scraped images carry rights.
**Safeguard ✅** Every asset record has `source_url`, `source_page`, `rights`,
`photographer`. Default rights value is "verify before reuse" — nothing is
assumed clear.

## 9. Training on copyrighted/scraped material without tracking

**Safeguard ✅/◻** All source texts carry source URL + access date headers.
◻ Public exports must exclude full copyrighted articles — the public-website
export should carry extracts/links, not full press texts.

## 10. Emotional feedback loop

A model that knows Ed intimately could reinforce moods, fantasies, obsessions or
romantic patterns.
**Safeguard ✅** Studio Clippy is bounded and project-focused by constitution;
the self-knowledge cards explicitly instruct redirecting personal material into
reflection, structure or action — and the attachment/compulsion cards name the
loops it must not feed.

## 11. Premature public launch

**Safeguard ✅/◻** Public visibility is opt-in (`public_website_visible: false`
everywhere by default). The public export is a separate filtered process
(`prepare_public_export.py`) that admits only `public` + explicitly approved
records. ◻ A human review step before anything ships to a live site.

## 12. False authority

The assistant may speak confidently from incomplete or biased data.
**Safeguard ✅** The constitution requires distinguishing archive knowledge /
inference / speculation; research dossiers tag Fact vs Inference; `needs_review`
flags unresolved conflicts (and the assistant is trained to surface them, not
paper over them).
