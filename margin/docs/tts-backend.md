# Narrator server contract

Margin's "Narrator server" engine (`js/narrator.js`, `RemoteVoice`) needs one HTTPS endpoint. The client sends **one sentence at a time** and plays what comes back through a single `<audio>` element. That gives iOS lock-screen controls and lets playback continue in the background, which the device voice can't do.

## Request

```
POST <endpoint URL set in Narrator settings>
Content-Type: application/json
Accept: audio/mpeg, audio/*

{ "text": "One sentence of the book.", "voice": "<optional voice id>", "format": "mp3" }
```

## Response

- `200` with an `audio/*` body (MP3 recommended; iOS Safari plays `audio/mpeg`, `audio/mp4`/AAC and `audio/wav`).
- Any non-2xx status stops playback, and the response text appears in the status line and diagnostics.
- CORS: if the server is on a different origin from the app, allow `POST` and `Content-Type` from the app's origin.

## Requirements for the server

- **Keep provider API keys on the server.** The browser never sees them.
- **Authenticate callers** (session cookie, or a per-user token entered once), so the endpoint can't be used as a free TTS proxy.
- Don't log or keep sentence text beyond what's needed for caching. The text comes from private, possibly copyrighted PDFs.
- Optionally cache by `hash(voice + text)` on the server. The client also caches audio in IndexedDB (`audio` store), so re-listening costs nothing.
- Return quickly. The client prefetches the next two sentences, so roughly 1 s per sentence keeps playback seamless.

## About the "Mother · Water Cooler" voice

Only use a cloned or custom voice built from a sample you're authorised to use, or a voice you hold a licence for. The device-voice "Mother" preset is a pitch and voice-choice approximation and should keep being labelled that way.

## Open decisions

- Which TTS provider (and therefore cost, voice quality, latency and voice-cloning terms).
- Where it's hosted (a serverless function next to the static site is enough).
- Whether to move from per-sentence requests to per-page streaming with word timings for finer highlighting.
