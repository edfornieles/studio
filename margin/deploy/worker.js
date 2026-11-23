// Serves the Margin/Jabber static files from Workers KV (binding: FILES).
// Supports HTTP Range requests, which iOS Safari needs for <audio>.
const TYPES = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', webmanifest: 'application/manifest+json', mp3: 'audio/mpeg',
  png: 'image/png', jpg: 'image/jpeg', md: 'text/markdown; charset=utf-8', svg: 'image/svg+xml',
};

export default {
  async fetch(req, env) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const url = new URL(req.url);
    let path = decodeURIComponent(url.pathname);

    // Private library: books are copyrighted, so library/* needs the access
    // key, either as ?key= (kept in the Home Screen link) or a cookie.
    let setCookie = null;
    if (path.startsWith('/library/')) {
      const given = url.searchParams.get('key') || (req.headers.get('cookie') || '').match(/(?:^|;\s*)jk=([^;]+)/)?.[1];
      if (!env.ACCESS_KEY || given !== env.ACCESS_KEY) {
        return new Response('Private', { status: 401, headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' } });
      }
      if (url.searchParams.get('key')) setCookie = `jk=${env.ACCESS_KEY}; Path=/library/; Max-Age=31536000; Secure; HttpOnly; SameSite=Lax`;
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
