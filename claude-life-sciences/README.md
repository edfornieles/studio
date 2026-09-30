# The Discovery Stack — Claude in the Life Sciences

A single-page scrollytelling site showing the people, technologies, companies and
use cases of Claude in the life sciences, and the future they point toward. The
layout and interaction model follow the reference site
[authoritarian-stack.info](https://www.authoritarian-stack.info/), restyled in the
Claude visual language.

**Campaign goal:** ease the scare stories about AI by showing concrete,
verifiable advances in the life sciences and the exploration they make
possible.

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
| `index.html` | Page structure: 11 sections, in story order |
| `css/style.css` | Design tokens (Claude palette, type, rules) and all component styles |
| `js/main.js` | Narrative sections: hero fade, Explorers graph, before→after rows, research loop, connected-lab flow, frontier cards, world map, safeguards, timeline |
| `js/network.js` | The full-screen network explorer: zones, hover, select, actor card, list/search, legend filter, zoom |
| `data/network.js` | **Network dataset**: 69 organizations and 81 connections, each with public sources |
| `data/story.js` | **Narrative data** for every section (edit copy and figures here) |
| `data/world.js` | Natural Earth 110m countries (world-atlas) |
| `img/spark.svg` | Placeholder spark mark; see branding below |

## Story sections (reference → this site)

1. Hero → **The Discovery Stack**, with a faint render of the network behind it.
2. "The Contract That Changed Everything" → **Twenty-One Hours**: about 950 agents surface a new enzyme family.
3. Kingmakers → **The Explorers**: people and institutions; select one for a card.
4. Personnel pipeline → **From Weeks to Minutes**: animated before→after rows.
5. Loop diagram → **The Research Loop**: six steps that cycle automatically; Test is marked as human-run.
6. Capital flows → **The Connected Lab**: knowledge → lab systems → Claude → outcomes, plus a stats row.
7. Five domains → **Five Frontiers**: an illustration with expandable cards.
8. Europe map → **A Global Effort**: a zoomable world map with place cards.
9. (new) **Responsible by Design**: five safeguards, each with a source.
10. Conclusion → **The Horizon**: a 2024–2026 timeline and the long-term goals from "Machines of Loving Grace".
11. Network explorer → **Explore the Network**, then Sources.

## Editing content

- Add an organization in `data/network.js`: a node needs
  `{ id, name, type, zone, description, sources }`; add `size: "large"` for a
  labelled hub. Zones are `anthropic | pharma | research | tools | builders | partners`.
- Add a connection as `[source, target, type, label, description, sources]`.
  Types are `deploys | connects | research | builds | validates`.
- Descriptions support `**bold**`.

## Editorial rules

- Every claim cites a public source, and all sources are listed in the footer.
- The following were **left out because the research could not verify them**:
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

The chart palette (edge types and map categories) was checked with a colorblind
validator: clay `#D97757`, blue `#3F7FC4`, green `#5E8C3A`, violet `#8A63C9`,
ochre `#B07A14`. The ochre is below 3:1 contrast against the background, so it
always appears with a text label.
