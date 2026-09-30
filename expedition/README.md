# The Folding Problem: a Claude field expedition

A mobile-first prototype: a cinematic opening, a short interactive story about
proteins, a three-level folding game, and a "Fieldwork" layer that sends curiosity
back out into the world. Strandy, the guide, is built from the Claude spark.

```bash
cd expedition
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/ (served offline via sw.js)
npm run preview
```

Add `?debug` to the URL to expose the running simulation as `window.__fold` (used for automated play-testing).

## Structure

| Folder | What lives there |
| --- | --- |
| `src/game/` | Folding engine: `sim.ts` (verlet chain, forces, bonds, energy; no React) and `FoldCanvas.tsx` (canvas rendering + touch input) |
| `src/worlds/` | Scientific worlds. `proteins/` holds level data, story sections and all debrief copy. Add a new world here and register it in `worlds/index.ts` |
| `src/content/` | Fieldwork content: quests, ethical tensions, the Community Lab puzzle |
| `src/community/` | `CommunityRepository` interface plus a localStorage implementation seeded with example entries. Replace `community/index.ts` with an API-backed version to go live |
| `src/state/` | Player progress (localStorage), reset and replay |
| `src/components/` | Strandy, sheets, meters, disclosures, explore visuals |
| `src/screens/` | Opening, Explore, Play, Fieldwork, Community |

## Honesty rules the copy follows

Every debrief separates **what you did in the game**, **what happens in real
research**, and **how Claude can help**. Claude is described as a general
assistant (reading, coding, reasoning about hypotheses), not as a structure
predictor. Each level has a "What is simplified here?" list. Community content
is labelled as examples plus the player's own entries, stored on the device.

## Privacy

No accounts, names, analytics or location tracking. Photos are downscaled and
re-encoded in the browser, which strips EXIF metadata including GPS, and they are
kept in localStorage only.
