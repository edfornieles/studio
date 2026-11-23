# Margin — PDF Listening Library

Prototype handoff for Claude Code. Uploaded 23 November 2026.

## Location
`margin/index.html` is the complete current prototype, intentionally self-contained. Run with a local development server or host as a static page over HTTPS, not through an iOS Files/ChatGPT HTML preview.

## Product goal
A personal audiobook-style research library: upload PDFs, listen with an appealing voice, save position, annotate passages, and interrupt playback to discuss the text. Designed primarily for iPhone Safari / home-screen use.

## Current implementation
- Single-page HTML/CSS/JS application, no build setup.
- Uses PDF.js from a CDN to extract text from user-selected PDFs.
- Stores extracted page text, reading positions and research annotations in IndexedDB on the local device.
- Browser Web Speech API (`speechSynthesis`) attempts narration; pause/resume, page navigation and speed controls.
- "Mother · Water cooler" is only a preferred *approximate* device voice; **no genuine Water Cooler voice asset or model is included**.
- Text notes and saved page markers can be exported.

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
Open `http://localhost:8000/margin/` on a desktop. For iPhone tests, deploy to an HTTPS host.
