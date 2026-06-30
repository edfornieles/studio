# Artist Website Structure (planning)

The public-facing site. It is both an artist website and an exhibition of the
Studio Clippy system itself: visitors should be able to see *that the archive
produces the assistant*, and experience that production as an artwork.

## Site map

```text
/             Introduction — Ed Fornieles / Studio Clippy. What this site is:
              an artist's archive that trains a model, presented as a living work.

/archive      Curated public archive. Browsable by project, year, theme, type
              (images, texts, press, PDFs). Only approved public records.

/projects     Public project pages — built from each card's "Public-facing
              summary" + approved images. NOT the full internal card.

/training-set The dataset as artwork: selected public chunks, example Q→A pairs,
              the schemas themselves, counts and maps of the corpus. Shows how
              an artwork becomes training data.

/model        Public interaction with Studio Clippy / Ed Model. Clearly framed
              as a model and an artwork, not the person. See
              public_model_interface.md.

/about        Explanation of the whole system: the five parts, the
              confidentiality architecture (described, not exposed), the
              constitution, why this is a work.

/sources      Selected public references and documentation — reference cards,
              press links, bibliography. Everything credited and linked out.
```

## Content pipeline

The site is built **exclusively** from `exports/public_website/` — a filtered
export (`prepare_public_export.py`) that admits only records with
`confidentiality: public` AND `public_website_visible: true`. The private
dataset never reaches the public server. Updating the site = re-approving +
re-exporting + redeploying; there is no live connection to the studio archive.

## Form

Static site (Astro/Eleventy/Next-static) for everything except `/model`, which
needs one small API endpoint backed by its own restricted index. Design
register: the archive's own aesthetics — manifest tables, card layouts, the
admin-console-as-artwork — rather than a conventional portfolio.

## Launch gates (all must pass before going live)

1. Permissions model working end-to-end (approve → export → site).
2. Zero `needs_review` records in the public export.
3. Rights verified for every published image (no "verify before reuse" remaining).
4. Public model passes the boundary eval set (no private leakage, no Ed-impersonation).
