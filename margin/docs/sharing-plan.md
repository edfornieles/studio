# Sharing Jabber with friends: plan (on hold)

Status: **parked on purpose**. Ed wants to use Jabber himself for a while first. This records the decisions so far so a later session can pick it up directly.

## Decisions made
- **Group size:** 20–30 people, inside Cloudflare Access's free 50-user tier.
- **Login:** Google sign-in through Cloudflare Access (Zero Trust). This replaces the personal `?key=` links. The Worker reads the verified email from the Access JWT (`Cf-Access-Jwt-Assertion`) on every request.
- **Narration:** stays on people's own devices. No always-on server.

## Design
- **Ownership and visibility:** every text has an owner and a visibility setting: `private` (the default), `friends` (the whole group), or `people` (listed emails). Visibility is chosen at upload and can be changed later.
- **Library:** two sections, "Mine" and "Shared with me" (showing who added each text).
- **Per-person data:** progress, bookmarks, history, Reflect conversations and notes always belong to each person. This already exists as `library/_progress/<listener>/…`; the listener becomes the email.
- **Copyright:** the share screen carries a one-line reminder to share only what you have the right to share (open-access articles, your own writing, public domain). Copyrighted books such as *Source* stay private.
- **Migration:** Ed's existing texts become his, `private`.

## Infrastructure changes
- **D1 (SQLite):** users, texts, visibility, sharing. KV listings lag up to about 60 s, which is fine for one person but not for permissions.
- **R2:** audio, covers and PDFs. Free up to 10 GB, no 25 MiB-per-file limit, native range requests. Book audio currently lives in KV.
- **Limits:** per-person limits on uploads and AI usage, so one person can't run up the bill.

## Narration on people's own devices
1. **Default:** in-browser narration on a laptop. A "Narrate my uploads" page runs Pocket TTS client-side (its README lists in-browser implementations), narrates the person's queued texts while the tab is open, and uploads the chapters.
2. **Phones:** short texts (articles) only, while the app is open. iOS suspends background work.
3. **Fallback:** any trusted laptop runs `generator/process-inbox.py` and works through everyone's queue.

## Build order
1. Google login through Cloudflare Access, per-person progress.
2. Ownership, visibility, Mine / Shared with me.
3. Move to D1 + R2.
4. In-browser narrator page.
5. Reflect (discuss / rearticulate / learn, then notes) per person. Needs `ANTHROPIC_API_KEY` as a Worker secret.
