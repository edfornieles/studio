# The Discovery Stack — AI in the Life Sciences

A single-page scrollytelling site covering **sixty years of AI in the life
sciences**, from DENDRAL (1965) to today's AI collaborators, and mapping the
field as it stands in September 2026. **Claude is the through-line**: each era
ends with a "thread to Claude", and the present-day sections show where Claude
fits in a much larger field.

The layout and interaction model follow
[authoritarian-stack.info](https://www.authoritarian-stack.info/), restyled in
the Claude visual language.

**Campaign goal:** ease the scare stories about AI by showing a long, credible
history of steady progress, the hard lessons the field learned, and the real
advances and exploration it makes possible today.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```sh
cd claude-life-sciences && python3 -m http.server 8000
```

d3, topojson-client and the world map are stored in `vendor/` and `data/`, so the
site works offline except for Google Fonts, which fall back to system serif and
sans fonts. It can be hosted on any static host, such as GitHub Pages or Netlify.

## Structure

| Path | What it holds |
|---|---|
| `index.html` | Page structure: 14 sections in story order |
| `css/style.css` | Design tokens (Claude palette, type, rules) and all component styles |
| `js/main.js` | Narrative components: history strip and era cards, Explorers across time, before→after rows, medicines pipeline, research loop, connected-lab flow, frontier cards, world map, safeguards, timeline |
| `js/network.js` | The full-screen network explorer: zones, hover, select, actor card, list/search, legend filter, zoom |
| `data/story.js` | **Narrative data**: 6 eras and 66 milestones, 19 explorers, 11 medicines, 5 frontiers, 28 places, safeguards, horizon |
| `data/network.js` | **Network dataset**: 96 organizations and 109 connections across the field, each with public sources |
| `data/world.js` | Natural Earth 110m countries (world-atlas) |
| `img/spark.svg`, `img/spark-white.svg` | Placeholder spark marks; see branding below |

## Story sections

1. **Hero:** The Discovery Stack, 1962–2026.
2. **From One Program to 950 Agents:** DENDRAL in 1965, then Claude agents in 2026.
3. **Sixty Years of Progress:** an era strip with 66 milestones (including "lessons learned") and a "thread to Claude" for each era.
4. **The Explorers:** people from Dayhoff to Jumper, placed by year, with lineage threads leading to Claude.
5. **From Weeks to Minutes:** animated before→after rows.
6. **Medicines in the Clinic:** a pipeline of AI-discovered and AI-assisted drugs by trial phase, colored by approach, including discontinued ones, plus success-rate stats.
7. **The Research Loop:** six steps; the Test step is marked as run by human scientists.
8. **The Connected Lab:** open data → the field's models → Claude → outcomes.
9. **Five Frontiers:** protein design, the virtual cell, reading genomes, AI scientists and labs, medicines. Each card covers where it started, where it is now, Claude's part, and what's next.
10. **A Global Field:** a zoomable world map of 28 sites.
11. **Responsible by Design:** six field-wide safeguards.
12. **The Horizon:** the 2026 timeline, items expected next, and "Machines of Loving Grace" goals.
13. **The Field Today:** the network explorer.
14. **Sources.**

## Editing content

- Add an organization in `data/network.js` as a row in `N`:
  `[id, name, type, zone, description, sources, large?]`. Zones are
  `anthropic | labs | biotech | pharma | research | tools | policy`.
- Add a connection as `[source, target, type, label, description, sources]`.
  Types are `uses | data | research | builds | invests | deal`.
- Add a milestone in `data/story.js` → `milestones`, as `{ y, era, kind?, t, who, what, why, src }`.
  `kind` is `"lesson"` or `"claude"`.
- Add a medicine to `pipeline.drugs` as `{ name, org, stage 0–5, approach, stopped?, note, src }`.
- Descriptions support `**bold**`.

## Editorial rules

- Every claim cites a public source, and all sources are listed in the footer.
- **No AI-discovered drug has FDA approval as a new molecule** (as of Sept 2026), and the site says so.
  Zasocitinib is labelled "physics-based computation", not generative AI. Baricitinib is an
  AI-suggested *repurposing* that was proven in large trials.
- Setbacks are shown alongside successes as "lessons learned": Watson for Oncology,
  the sepsis model, Valo's Phase 2 failure, and DSP-1181.
- The following were **left out because the research could not verify them**:
  - GSK's reported acquisition of Noetik; funding rounds still "in talks" (Lila, Periodic)
  - the Eli Lilly partnership (aggregator coverage only)
  - the Coefficient Bio acquisition (not officially confirmed)
  - whether Kosmos runs on Claude
  - any Claude link for Elicit or the Arc Institute
- Figures are presented as reported. Novo Nordisk's "~10 min" is the time for a
  first draft, not the whole review cycle.
- The enzyme discovery is described as "Anthropic reports…" because its novelty
  has been publicly questioned.
- "Machines of Loving Grace" goals are labelled as aspirations, not forecasts.
- The research date is **30 September 2026**. Re-check figures before launch.

## Branding: before launch

This build uses the Claude palette (ivory `#FAF9F5`, pampas `#F0EEE6`, slate
`#141413`, clay `#D97757`), with free stand-in fonts: **Source Serif 4** for the
serif and **DM Sans** for the sans. For an official release:

- Replace `img/spark.svg` with the official Claude logo and wordmark from the brand team.
- Swap the font stacks in `css/style.css` (`--f-serif` and `--f-sans`) for the
  licensed brand typefaces.
- Have legal and comms review the named individuals in "The Explorers" and all
  customer mentions.

The six-color chart palette (connection types, map categories, pipeline approaches)
passes a colorblind validator: clay `#D97757`, blue `#3F7FC4`, green `#5E8C3A`,
violet `#8A63C9`, ochre `#B07A14`, magenta `#C2477F`.

## Link check

Many history sources are doi.org links that were written from memory during
research, and not all were opened individually. Run a link checker before launch.
