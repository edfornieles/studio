# Public Model Interface (planning)

The `/model` page: visitors talk to a public version of Studio Clippy / the Ed
Model. This is the most exposed surface of the whole system and the most
artwork-like. It must be generous to visitors and absolutely sealed against
private material.

## What the public model can do

- Discuss the public works, ideas, references and the logic of the practice —
  grounded in the public RAG index, with citations to `/archive` pages.
- Explain the system itself ("how were you made?" is an expected and welcome
  question — the answer is part of the work).
- Generate project mutations or commentary for visitors ("what would Animal
  House look like in your country / in 2040 / as a government programme?").
- Run the critique rubric on a visitor's own idea — Studio Clippy as a public
  tool, performing the studio's way of thinking.

## What it must never do

- Claim to be Ed, speak as Ed in first person, or give "Ed's opinion" on
  things outside the archive.
- Reveal or paraphrase diary, self-knowledge, person-card or any non-public
  material. **Enforced structurally:** the public model retrieves from a
  separate index built ONLY from `exports/public_website/` — the private
  material is not absent by instruction, it is absent from the machine.
- Discuss private people. Public figures only in their public, sourced capacity.
- Offer therapy, diagnosis or personal advice; deflect gracefully to the work.

## Framing (always visible, part of the piece)

> "You are talking to a model — an artwork trained on the public archive of
> Ed Fornieles' studio. It is not Ed. It does not know his private life. What
> it knows, you can browse: [/archive]."

The disclosure isn't a legal footnote; it's the conceptual frame. The visitor
should *feel* the difference between an archive-grounded answer and the model
speculating — so the interface labels archive / inference / speculation, just
as the private assistant does.

## Practical guards

- Separate system prompt, separate restricted index, separate API key/quota.
- Rate limiting + session caps (it's an artwork, not a free helpdesk).
- Logging of public conversations (disclosed), reviewed periodically — both as
  safety audit and as material: public conversations are residue, and residue
  becomes work.
- A red-team pass with the boundary eval set before launch and after any change.
