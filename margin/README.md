# Margin — PDF Listening Library

Prototype handoff for Claude Code. Uploaded 23 November 2026.

## Location
`margin/index.html` is the complete current prototype, intentionally self-contained. Run with a local development server or host as a static page over HTTPS, not through an iOS Files/ChatGPT HTML preview.

## Product goal
A personal audiobook-style research library: upload PDFs, listen with an appealing voice, save position, annotate passages, and interrupt playback to discuss the text. Designed primarily for iPhone Safari / home-screen use.

## Current implementation (0.3)
A static web app with no build step. Files:

| File | Role |
|---|---|
| `index.html`, `app.css` | UI: library, now-listening reader with sentence highlighting, notebook, search, settings and diagnostics, fixed mini-player |
| `js/app.js` | Controller: library, player loop, positions, marks, search, export, Media Session |
| `js/narrator.js` | Narration engines: `DeviceVoice` (Web Speech) and `RemoteVoice` (narrator server through one `<audio>` element) |
| `js/extract.js` | Layout-aware text assembly: two columns, running headers and page numbers, de-hyphenation, paragraphs, headings, footnotes |
| `js/pdf.js` | Loads PDF.js 3.11.174 from cdnjs and runs extraction |
| `js/chunks.js` | Sentence chunker with character offsets (aware of abbreviations and initials) |
| `js/store.js` | IndexedDB (`books`, original `files`, `audio` cache), with an in-memory fallback. Migrates 0.2 libraries in place |
| `js/diagnostics.js` | Event log and environment report ("Copy diagnostics report") |
| `docs/tts-backend.md` | Contract for the narrator server |

What changed from 0.2:
- **Positions are saved per sentence** (page plus chunk) and restored after a reload. Pausing no longer throws you back to the start of the page.
- **iPhone playback hardening** (still to be confirmed on a real device):
  - Sets `navigator.audioSession.type = "playback"` and plays a silent `<audio>` inside the tap, so iOS treats the page's audio as media. The aim is that the ring/silent switch no longer mutes speech.
  - The first `speak()` call now runs synchronously inside the tap.
  - Only calls `cancel()` when something is actually queued (on iOS, `cancel()` straight before `speak()` can swallow the utterance).
  - Keeps a reference to the current utterance so Safari can't garbage-collect it mid-sentence.
  - Watchdogs catch "never started" (reported as `silent`) and "finished but `onend` never fired".
- **Narrator server engine:** prefetches the next two sentences, caches audio in IndexedDB, pauses mid-sentence, and supports Media Session lock-screen play/pause/next/previous.
- **Diagnostics panel:** a test tone through an HTMLAudioElement, a device-voice test, a narrator-server test, plus an environment summary and a copyable log.
- **Notebook:** marks are tied to the exact sentence. "Pause & discuss" quotes the sentence and keeps your words separate from the source, then "Continue listening" picks up where you were. "Copy passage" copies the passage with its page reference. Exports are Markdown with citations, and a JSON backup that holds marks and positions but no book text.
- **Search** within a book. Tap a sentence to listen from it. The original PDF is kept on the device so its text can be re-read when extraction improves.

## Confirmed limitations / critical priorities
1. **Playback is not confirmed to work on iPhone.** Earlier downloaded versions failed to play for the user. Hosting removes the file-preview restriction, but doesn't solve iOS speech/background limitations. Diagnose on real iPhone Safari and replace Web Speech API with a robust audio player and an authorised TTS service for generated/streamed or cached narration. Handle lock screen, route changes, interruptions, seek and resume.
2. The public website version intentionally **does not bundle the copyrighted Source book**. Despite an older prototype saying otherwise, this branch starts with a welcome item and the user must upload a PDF personally.
3. Text extraction is naive (`PDF.js` text item join). Improve reading order (especially two-column academic PDFs), headings, footnotes and graphic scores. OCR for image-only pages is not implemented.
4. IndexedDB means data is tied to a browser/device. Add account-based synced library later, with private access control and secure file storage; do not publish uploads as public web assets.
5. Support chunk-level audio positions, persistent resume, bookmarks linked to text spans, search, export, and conversational commentary distinct from source text.
6. Actual "Mother / Water Cooler" narrator requires user-supplied/authorised sample or an available licensed voice; don't claim the current preset reproduces it.
7. PDFs may be copyrighted; design for private user uploads and authorised audio processing rather than including or distributing book contents.

## Suggested Claude Code next steps
- Create a proper small web app from this prototype, keeping the library-first design.
- Reproduce the iPhone failure first. Add explicit diagnostics and test using a one-line generated audio sample through an HTMLAudioElement.
- Design a backend TTS job/stream endpoint (keys remain server-side), audio chunk caching, progress persistence, and Media Session API controls; consider a native/PWA wrapper if iOS background audio requires it.
- Make a smoke-test deployment behind an isolated path or subdomain before attempting `edfornieles.com/margin`. Don't alter the existing website without checking hosting and routes.
- Preserve the user's *Mother* research flow: save marks, notes, structured page citations, and "discuss/continue" behaviour.

## Run
From the repository root:
```sh
python3 -m http.server 8000
```
Open `http://localhost:8000/margin/` on a desktop. The app uses ES modules, so it must be served over HTTP; opening it as a `file://` path or in a Files preview won't work. For iPhone tests, deploy `margin/` to an HTTPS host and open it in Safari.

## Milestone 1: lock-screen test (`lab/`)
`lab/index.html` is a standalone page that answers one question: does pre-generated narration keep playing on an iPhone with the screen locked, including the hand-over from one section file to the next?

- One `<audio>` element, one MP3 per section, Media Session lock-screen controls (play/pause, ±15/30 s, seek, previous/next). No Web Audio.
- Three sections of Thoreau's *Walking* (1862, public domain), about 4–5 minutes each, generated with Kyutai Pocket TTS (voice `alba`). The manifest has per-sentence timings, so the current sentence is shown.
- A persistent log records every play, pause, stall, error and hand-over, plus a verdict each time you return to the page ("back after 14:10 · audio advanced 14:05 · kept playing ✓"). Copy it from "Test instructions and log".

### Regenerate or make new audio (`generator/`)
```sh
python3 -m venv .venv
.venv/bin/pip install pocket-tts --extra-index-url https://download.pytorch.org/whl/cpu   # Linux; plain pip on macOS
.venv/bin/python generator/generate.py book.json --out lab/audio --voice alba
```
`book.json` is `{"title", "author", "sections": [{"title", "text"}]}`. Needs `ffmpeg`. Pocket TTS runs on an ordinary CPU at about twice real-time speed (this container) and is free. Voices are listed in the [Pocket TTS README](https://github.com/kyutai-labs/pocket-tts); `--voice` also accepts a `.wav` sample you're authorised to clone.

## Deploy: jabber.edfornieles.com (Cloudflare Pages)
1. Cloudflare dashboard › Workers & Pages › Create › Pages › Connect to Git › `edfornieles/studio`.
2. Production branch: `claude/margin-prototype-as2x2q` for now. Framework preset: None. Build command: *(empty)*. Build output directory: `margin`.
3. After the first deploy: Custom domains › add `jabber.edfornieles.com`. The DNS record is created automatically because the domain is already on Cloudflare. This doesn't touch the main site.
4. Test page: `https://jabber.edfornieles.com/lab/`

`_headers` sets the MP3 content type and caching.

## Tests
From `margin/`:
```sh
node --test tests/unit.test.js   # chunker and PDF layout (no browser)
node tests/e2e.mjs               # headless Chromium: real two-column PDF upload, playback with
                                 # simulated speech, pause/reload/resume, notes, search,
                                 # narrator server against a mocked endpoint (needs network for cdnjs)
```

## Still open
- **Confirm on a real iPhone.** Open Playback diagnostics, run tests 1–3 and copy the report. The headless tests simulate `speechSynthesis` and can't prove real iOS audio.
- Choose a TTS provider and stand up the endpoint in `docs/tts-backend.md`. Lock-screen and background listening depend on it.
- OCR for scanned pages; more extraction work on complex layouts (three columns, tables, graphic scores).
- Accounts and sync; offline service worker; importing JSON backups.
