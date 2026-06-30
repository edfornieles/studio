# Project Overview

Studio Clippy is a long-term studio infrastructure project for Ed Fornieles —
not just a chatbot and not an "AI clone." It has **five connected parts**:

1. **A living training set** — a structured dataset, updated over time, exported
   for RAG and eventually for fine-tuning future models.
2. **An artistic archive** — old works, unrealised ideas, essays, interviews,
   notes, references, images, PDFs, talks, documentation, ongoing thoughts.
3. **A reasoning system / model interface** — an AI studio assistant that
   understands the practice and helps develop, critique, mutate and realise work.
4. **A backend + public-facing artist website** — a private input/organisation
   interface for Ed, and a public site where visitors browse curated archive
   material and interact with a public Studio Clippy / Ed Model.
5. **A private personal documentation system** — diary, emotional patterns,
   relationships, people, fears, desires, life events — distillable into
   self-knowledge cards but never automatically exposed.

The whole system is also a **future artwork**: the archive produces the
assistant, and that production is part of what visitors encounter.

## The five layers, kept separate but interoperable

| layer | what it is | where it lives |
|---|---|---|
| **A. Archive** | raw material: docs, images, videos, PDFs, press, interviews, notes, diaries, transcripts | `archive/` + `studio-clippy-assets/` (large/raw files, git-ignored) |
| **B. Dataset** | the structured version: project/idea/self-knowledge/person/reference cards, manifests, dialogue examples | `project_cards/`, `idea_cards/`, `self_knowledge_cards/`, `personal_maps/`, `reference_cards/`, `*_manifests/`, `dialogue_examples/` |
| **C. Training set** | exports from the dataset: RAG chunks, fine-tune examples, public extracts | `exports/` |
| **D. Backend** | how Ed inputs/edits/tags/approves material | `app/` (working v0 console) + `backend_planning/` |
| **E. Frontend website** | public encounter with the curated archive + public model | `frontend_planning/` (planning), `exports/public_website/` (filtered content) |

The discipline that holds it together: **the archive can be broad and messy;
the training set must be structured, reviewed and permissioned.** Movement
between layers is always an explicit, filtered step — never automatic.

## What the system knows the practice is about

Identity as performance; inherited narratives; role-play; social systems; staged
institutions; online archetypes; fiction/reality bleed; family structures; life
stages; governance; AI direction; care and control; audience implication; the
residue of social events becoming material; the aggregation of many
people/images/posts into characters, types or systems.

(See `studio_constitution.md` for the working principles, and
`dangers_and_safeguards.md` for what this system must never become.)
