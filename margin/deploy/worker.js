// Serves the Margin/Jabber static files from Workers KV (binding: FILES).
// Supports HTTP Range requests, which iOS Safari needs for <audio>.
const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', webmanifest: 'application/manifest+json', mp3: 'audio/mpeg',
  png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf', md: 'text/markdown; charset=utf-8', svg: 'image/svg+xml',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const MAX_PDF = 24 * 1024 * 1024; // KV values are limited to 25 MB

// Inbox: links and PDFs waiting to be turned into books. Items live in KV as
// library/_inbox/<id>.json (+ <id>.pdf). generator/process-inbox.py picks them
// up, updates their status, and publishes the finished book to the library.
async function inbox(req, env, url) {
  const prefix = 'library/_inbox/';
  const id = url.pathname.split('/')[3];
  if (req.method === 'GET') {
    const list = await env.FILES.list({ prefix });
    const items = await Promise.all(list.keys.filter(k => k.name.endsWith('.json')).map(k => env.FILES.get(k.name, 'json')));
    return json({ items: items.filter(Boolean).sort((a, b) => b.created - a.created) });
  }
  if (req.method === 'DELETE' && id) {
    await env.FILES.delete(prefix + id + '.json');
    await env.FILES.delete(prefix + id + '.pdf');
    return json({ ok: true });
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const type = req.headers.get('content-type') || '';
  let item;
  if (type.startsWith('application/pdf')) {
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_PDF) return json({ error: 'That PDF is over 24 MB, too big for now.' }, 413);
    if (new TextDecoder().decode(body.slice(0, 5)) !== '%PDF-') return json({ error: 'That file is not a PDF.' }, 400);
    await env.FILES.put(prefix + newId + '.pdf', body);
    item = { id: newId, kind: 'pdf', name: (url.searchParams.get('name') || 'Untitled.pdf').slice(0, 200), size: body.byteLength };
  } else {
    const { url: link } = await req.json().catch(() => ({}));
    let u;
    try { u = new URL(link); } catch { return json({ error: 'That doesn’t look like a link.' }, 400); }
    if (!/^https?:$/.test(u.protocol)) return json({ error: 'Only http(s) links work.' }, 400);
    item = { id: newId, kind: 'url', name: u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''), url: u.href };
  }
  Object.assign(item, { status: 'queued', detail: 'Waiting for the narrator', created: Date.now() });
  await env.FILES.put(prefix + newId + '.json', JSON.stringify(item));
  return json(item, 201);
}

let keysCache = null, keysAt = 0;
async function listenerFor(env, key) {
  if (!key) return null;
  if (env.ACCESS_KEY && key === env.ACCESS_KEY) return 'owner';
  if (!keysCache || Date.now() - keysAt > 60000) { keysCache = (await env.FILES.get('library/_keys.json', 'json')) || {}; keysAt = Date.now(); }
  const name = keysCache[key];
  return name ? String(name).replace(/[^a-z0-9-]/gi, '').toLowerCase() || null : null;
}

// Listening progress, one JSON document per listener and book:
// library/_progress/<listener>/<book>.json. The app merges it with what the
// device has, so phone, Home Screen app and laptop resume at the same place.
async function progress(req, env, path, listener) {
  const book = path.split('/')[3]?.replace(/\.json$/, '');
  if (!book || !/^[a-z0-9-]+$/i.test(book)) return json({ error: 'book' }, 400);
  const key = `library/_progress/${listener}/${book}.json`;
  if (req.method === 'GET') return json((await env.FILES.get(key, 'json')) || {});
  if (req.method === 'PUT') {
    const body = await req.text();
    if (body.length > 400000) return json({ error: 'too large' }, 413);
    try { JSON.parse(body); } catch { return json({ error: 'json' }, 400); }
    await env.FILES.put(key, body);
    return json({ ok: true });
  }
  return json({ error: 'method' }, 405);
}

// Settings (owner only). The Anthropic API key is write-only: it is checked
// against Anthropic, stored in KV under library/_secrets/ (never served), and
// only "set / last 4 characters" is ever returned. A Worker secret named
// ANTHROPIC_API_KEY, if present, takes precedence.
const SECRET_KEY = 'library/_secrets/anthropic_api_key';
async function anthropicKey(env) {
  return env.ANTHROPIC_API_KEY || (await env.FILES.get(SECRET_KEY)) || null;
}
async function settings(req, env, listener) {
  if (listener !== 'owner') return json({ error: 'Only the library owner can change settings.' }, 403);
  if (req.method === 'GET') {
    const k = await anthropicKey(env);
    return json({ anthropic: k ? { set: true, last4: k.slice(-4), source: env.ANTHROPIC_API_KEY ? 'worker secret' : 'settings' } : { set: false } });
  }
  if (req.method === 'DELETE') { await env.FILES.delete(SECRET_KEY); return json({ ok: true }); }
  if (req.method !== 'PUT') return json({ error: 'method' }, 405);
  const { anthropicKey: k } = await req.json().catch(() => ({}));
  if (!k || !/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k.trim())) return json({ error: 'That doesn’t look like an Anthropic API key (it starts with sk-ant-).' }, 400);
  const check = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': k.trim(), 'anthropic-version': '2026-10-21' } });
  if (check.status === 401 || check.status === 403) return json({ error: 'Anthropic rejected that key. Check it was copied in full and is active.' }, 400);
  if (!check.ok) return json({ error: `Couldn’t verify the key right now (Anthropic returned ${check.status}). Try again in a minute.` }, 502);
  await env.FILES.put(SECRET_KEY, k.trim());
  return json({ ok: true, last4: k.trim().slice(-4) });
}

// ---------- AI: chapter summaries, book overview, Reflect conversations, notes ----------
// Claude is called from here with the owner's key, so it works from any device.
// Chapter text comes from library/<book>/text/<sid>.txt (small, so it stays
// cheap to read); summaries are cached in library/_summaries/<book>/.
const MODEL = 'claude-opus-5-5';

async function claude(env, body) {
  const key = await anthropicKey(env);
  if (!key) throw Object.assign(new Error('No Anthropic API key yet. Add one in Settings.'), { status: 412 });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2026-10-21',
      'anthropic-beta': 'server-side-fallback-2026-07-01', // if a safety classifier declines, retry on a fallback model
    },
    body: JSON.stringify({ model: MODEL, fallbacks: 'default', ...body }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data?.error?.message || `Claude returned ${r.status}`), { status: r.status === 429 ? 429 : 502 });
  if (data.stop_reason === 'refusal') throw Object.assign(new Error('Claude declined this request.'), { status: 422 });
  return data;
}
const textOf = data => (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
const jsonOut = schema => ({ format: { type: 'json_schema', schema } });

async function chapterText(env, book, sid) {
  return env.FILES.get(`library/${book}/text/${sid}.txt`);
}
async function bookInfo(env, book) {
  const idx = (await env.FILES.get('library/index.json', 'json')) || { books: [] };
  return idx.books.find(b => b.id === book) || { title: book, author: '' };
}

const SUMMARY_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['line', 'summary', 'ideas'],
  properties: {
    line: { type: 'string', description: 'One sentence, at most 22 words, saying what this chapter is.' },
    summary: { type: 'string', description: '3-4 plain sentences: what the chapter argues, describes or proposes.' },
    ideas: { type: 'array', items: { type: 'string' }, description: '3 key ideas, one short sentence each.' },
  },
};

async function summary(env, book, sid, force) {
  const cacheKey = `library/_summaries/${book}/${sid}.json`;
  if (!force) { const hit = await env.FILES.get(cacheKey, 'json'); if (hit) return hit; }
  const text = await chapterText(env, book, sid);
  if (!text) throw Object.assign(new Error('No text for this chapter yet.'), { status: 404 });
  const info = await bookInfo(env, book);
  const data = await claude(env, {
    max_tokens: 4000,
    output_config: { effort: 'low', ...jsonOut(SUMMARY_SCHEMA) },
    system: 'You write short, accurate summaries of book chapters for someone who is listening to the audiobook. Describe what the text itself says, in plain language, without praise or padding. If the chapter is mostly a score, instructions, a list or a letter, say so plainly.',
    messages: [{ role: 'user', content: `Book: ${info.title}${info.author ? ' (' + info.author + ')' : ''}\n\nChapter text:\n<chapter>\n${text.slice(0, 180000)}\n</chapter>` }],
  });
  const out = { ...JSON.parse(textOf(data)), sid, made: Date.now() };
  await env.FILES.put(cacheKey, JSON.stringify(out));
  return out;
}

const OVERVIEW_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['overview', 'themes', 'map'],
  properties: {
    overview: { type: 'string', description: 'One paragraph (5-7 sentences) on what the book is and does.' },
    themes: { type: 'array', items: { type: 'string' }, description: '4-6 recurring themes, a short phrase each.' },
    map: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['part', 'line'], properties: { part: { type: 'string' }, line: { type: 'string' } } }, description: 'The book in 3-8 parts: which chapters, and one line on each part.' },
  },
};

async function overview(env, book, force) {
  const cacheKey = `library/_summaries/${book}/_overview.json`;
  if (!force) { const hit = await env.FILES.get(cacheKey, 'json'); if (hit) return hit; }
  const man = await env.FILES.get(`library/${book}/manifest.json`, 'json');
  if (!man) throw Object.assign(new Error('Unknown book'), { status: 404 });
  const lines = [];
  for (const s of man.sections) {
    const sm = await env.FILES.get(`library/_summaries/${book}/${s.id}.json`, 'json');
    lines.push(`${s.id} · ${s.title}${sm ? ': ' + sm.summary : ''}`);
  }
  const data = await claude(env, {
    max_tokens: 6000,
    output_config: { effort: 'low', ...jsonOut(OVERVIEW_SCHEMA) },
    system: 'You write a clear overview of a book for someone listening to it as an audiobook, from its chapter list and chapter summaries. Plain language, no praise.',
    messages: [{ role: 'user', content: `Book: ${man.title}${man.author ? ' (' + man.author + ')' : ''}\n\nChapters and summaries:\n${lines.join('\n')}` }],
  });
  const out = { ...JSON.parse(textOf(data)), made: Date.now() };
  await env.FILES.put(cacheKey, JSON.stringify(out));
  return out;
}

const MODES = {
  discuss: 'Discuss the ideas with them as a thoughtful, challenging partner. Ask what they made of it, offer counter-readings and tensions, and press on vague claims. Keep turns short (under 120 words) and end with one question.',
  rephrase: 'They will try to explain the chapter in their own words. Respond like a good tutor: say briefly what they captured well, what they missed, blurred or misread, and point them back to the specific passage (quote it). Never rewrite their explanation for them; invite them to try again. Under 150 words.',
  quiz: 'Help them learn the chapter. Ask one question at a time about its key ideas (not trivia). After each answer, say what was right or missing in a sentence or two, then ask the next question. Under 100 words per turn.',
};

async function chat(env, listener, body) {
  const { book, sid, mode = 'discuss', messages = [] } = body;
  if (!book || !sid || !Array.isArray(messages)) throw Object.assign(new Error('bad request'), { status: 400 });
  const [text, info, sm] = await Promise.all([chapterText(env, book, sid), bookInfo(env, book), env.FILES.get(`library/_summaries/${book}/${sid}.json`, 'json')]);
  if (!text) throw Object.assign(new Error('No text for this chapter yet.'), { status: 404 });
  const msgs = messages.slice(-30).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 8000) }));
  if (!msgs.length || msgs[0].role !== 'user') msgs.unshift({ role: 'user', content: 'I just finished listening to this chapter.' });
  const data = await claude(env, {
    max_tokens: 3000,
    system: [
      { type: 'text', text: `You are a reading companion inside Jabber, an app where someone listens to books and then reflects on what they heard. ${MODES[mode] || MODES.discuss}\n\nGround everything in the chapter text below. When you refer to the text, quote it exactly in “curly quotes” so the app can link the quote back to the audio. Keep the source's ideas distinct from your own views and from theirs. Plain text only, no markdown headings.` },
      { type: 'text', text: `Book: ${info.title}${info.author ? ' (' + info.author + ')' : ''}\n${sm ? 'Chapter summary: ' + sm.summary + '\n' : ''}\nChapter text:\n<chapter>\n${text.slice(0, 180000)}\n</chapter>`, cache_control: { type: 'ephemeral' } },
    ],
    messages: msgs,
  });
  return { reply: textOf(data) };
}

const NOTE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'yourWords', 'ideas', 'questions', 'quotes'],
  properties: {
    title: { type: 'string', description: 'A short title for the note (max 8 words).' },
    yourWords: { type: 'array', items: { type: 'string' }, description: "The person's own best articulations, quoted from their messages (lightly trimmed, never rewritten)." },
    ideas: { type: 'array', items: { type: 'string' }, description: 'Key ideas that came out of the conversation, one sentence each.' },
    questions: { type: 'array', items: { type: 'string' }, description: 'Open questions worth returning to.' },
    quotes: { type: 'array', items: { type: 'string' }, description: 'Exact quotes from the chapter text that were discussed.' },
  },
};

async function makeNote(env, listener, body) {
  const { book, sid, mode = 'discuss', messages = [], chapter = '' } = body;
  if (!messages.some(m => m.role === 'user')) throw Object.assign(new Error('Nothing to make a note from yet.'), { status: 400 });
  const transcript = messages.map(m => `${m.role === 'assistant' ? 'AI' : 'ME'}: ${m.content}`).join('\n\n').slice(0, 60000);
  const data = await claude(env, {
    max_tokens: 4000,
    output_config: { effort: 'low', ...jsonOut(NOTE_SCHEMA) },
    system: 'Turn a reflection conversation about a book chapter into a concise study note. Keep the person\'s own words as theirs: quote them, never paraphrase them into yours. Only include quotes that appear in the conversation.',
    messages: [{ role: 'user', content: `Chapter: ${chapter}\n\nConversation:\n${transcript}` }],
  });
  const note = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), book, sid, chapter, mode, date: new Date().toISOString(), ...JSON.parse(textOf(data)), transcript: messages.slice(-60) };
  const key = `library/_notes/${listener}/${book}.json`;
  const all = (await env.FILES.get(key, 'json')) || [];
  all.push(note);
  await env.FILES.put(key, JSON.stringify(all));
  return note;
}

async function ai(req, env, path, listener, url) {
  const parts = path.split('/').slice(3); // ['summary', book, sid] etc.
  try {
    if (parts[0] === 'summary' && req.method === 'GET') return json(await summary(env, parts[1], parts[2], url.searchParams.get('force') && listener === 'owner'));
    if (parts[0] === 'overview' && req.method === 'GET') return json(await overview(env, parts[1], url.searchParams.get('force') && listener === 'owner'));
    if (parts[0] === 'summaries' && req.method === 'GET') { // all cached chapter summaries for a book (for the chapter list)
      const list = await env.FILES.list({ prefix: `library/_summaries/${parts[1]}/` });
      const out = {};
      await Promise.all(list.keys.filter(k => !k.name.endsWith('_overview.json')).map(async k => { const v = await env.FILES.get(k.name, 'json'); if (v) out[v.sid] = { line: v.line }; }));
      return json(out);
    }
    if (parts[0] === 'chat' && req.method === 'POST') return json(await chat(env, listener, await req.json()));
    if (parts[0] === 'note' && req.method === 'POST') return json(await makeNote(env, listener, await req.json()));
    if (parts[0] === 'notes' && req.method === 'GET') return json((await env.FILES.get(`library/_notes/${listener}/${parts[1]}.json`, 'json')) || []);
    if (parts[0] === 'notes' && req.method === 'DELETE' && parts[2]) {
      const key = `library/_notes/${listener}/${parts[1]}.json`;
      const all = ((await env.FILES.get(key, 'json')) || []).filter(n => n.id !== parts[2]);
      await env.FILES.put(key, JSON.stringify(all));
      return json({ ok: true });
    }
    return json({ error: 'unknown' }, 404);
  } catch (e) {
    return json({ error: e.message }, e.status || 500);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    const isInbox = path === '/library/_inbox' || path.startsWith('/library/_inbox/');
    const isProgress = path.startsWith('/library/_progress/');
    const isSettings = path === '/library/_settings';
    const isAI = path.startsWith('/library/_ai/');
    if (!isInbox && !isProgress && !isSettings && !isAI && req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

    // Private library: books are copyrighted, so library/* needs an access
    // key, either as ?key= (kept in the Home Screen link) or a cookie.
    // ACCESS_KEY (Worker secret) is the owner; extra listeners can be added
    // in library/_keys.json ({"<key>": "<name>"}) with deploy.py --add-listener.
    let setCookie = null;
    if (path.startsWith('/library/')) {
      const given = url.searchParams.get('key') || (req.headers.get('cookie') || '').match(/(?:^|;\s*)jk=([^;]+)/)?.[1];
      const listener = await listenerFor(env, given);
      if (!listener) {
        return new Response('Private', { status: 401, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
      }
      if (url.searchParams.get('key')) setCookie = `jk=${given}; Path=/library/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`;
      if (isInbox) return inbox(req, env, url);
      if (isProgress) return progress(req, env, path, listener);
      if (isSettings) return settings(req, env, listener);
      if (isAI) return ai(req, env, path, listener, url);
      // Internal files (keys, inbox, progress) are never served directly.
      if (path.startsWith('/library/_')) return new Response('Not found', { status: 404 });
    }
    if (path.endsWith('/')) path += 'index.html';
    // Keys are stored without the leading slash, e.g. "lab/index.html".
    const key = path.replace(/^\/+/, '');
    let body = await env.FILES.get(key, 'arrayBuffer');
    if (!body && !key.split('/').pop().includes('.')) {
      if (await env.FILES.get(key + '/index.html', 'arrayBuffer')) return Response.redirect(url.origin + url.pathname + '/', 301);
    }
    if (!body) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });

    const ext = path.split('.').pop();
    const headers = new Headers({
      'content-type': TYPES[ext] || 'application/octet-stream',
      'accept-ranges': 'bytes',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'cache-control': path.startsWith('/library/') ? (ext === 'mp3' ? 'private, max-age=86400' : 'no-cache, private')
        : ext === 'mp3' || ext === 'png' ? 'public, max-age=86400' : 'no-cache',
      'x-robots-tag': 'noindex',
    });
    if (setCookie) headers.set('set-cookie', setCookie);
    const size = body.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? +m[1] : size - +m[2];
      let end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
      if (start >= size || start > end) {
        headers.set('content-range', `bytes */${size}`);
        return new Response(null, { status: 416, headers });
      }
      headers.set('content-range', `bytes ${start}-${end}/${size}`);
      headers.set('content-length', String(end - start + 1));
      return new Response(req.method === 'HEAD' ? null : body.slice(start, end + 1), { status: 206, headers });
    }
    headers.set('content-length', String(size));
    return new Response(req.method === 'HEAD' ? null : body, { status: 200, headers });
  },
};
