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
  const check = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': k.trim(), 'anthropic-version': '2023-06-01' } });
  if (check.status === 401 || check.status === 403) return json({ error: 'Anthropic rejected that key. Check it was copied in full and is active.' }, 400);
  if (!check.ok) return json({ error: `Couldn’t verify the key right now (Anthropic returned ${check.status}). Try again in a minute.` }, 502);
  await env.FILES.put(SECRET_KEY, k.trim());
  return json({ ok: true, last4: k.trim().slice(-4) });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);
    const isInbox = path === '/library/_inbox' || path.startsWith('/library/_inbox/');
    const isProgress = path.startsWith('/library/_progress/');
    const isSettings = path === '/library/_settings';
    if (!isInbox && !isProgress && !isSettings && req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });

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
