// Checks the lock-screen test page in headless Chromium: manifest loads,
// playback starts, the sentence display follows, and the ended → next-section
// hand-over happens without a user gesture. Usage: node tests/lab.e2e.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  let p = new URL(req.url, 'http://x').pathname;
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = await readFile(join(root, p));
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    if (range) {
      const s = +range[1], e = range[2] ? +range[2] : body.length - 1;
      res.writeHead(206, { 'Content-Type': types[extname(p)], 'Content-Range': `bytes ${s}-${e}/${body.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - s + 1 });
      return res.end(body.subarray(s, e + 1));
    }
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let ok = false;
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/lab/`);
  await page.waitForFunction(() => document.querySelector('#title').textContent !== 'Loading…');
  assert.equal(await page.textContent('#title'), 'Walking');
  assert.equal(await page.locator('#sections li').count(), 3);
  await page.click('#play');
  await page.waitForFunction(() => !document.querySelector('#audio').paused && document.querySelector('#audio').currentTime > 0.5);
  assert.ok((await page.textContent('#now')).length > 10, 'sentence shown');
  // Jump to 1.5 s before the end of section 1 and wait for the automatic hand-over.
  await page.evaluate(() => { const a = document.querySelector('#audio'); a.currentTime = a.duration - 1.5; });
  await page.waitForFunction(() => document.querySelector('#section').textContent.startsWith('2 /') && !document.querySelector('#audio').paused, null, { timeout: 15000 });
  const log = await page.textContent('#log');
  assert.match(log, /hand-over → s02/);
  assert.deepEqual(errors, []);
  console.log('lab page: load, play, sentence display, section hand-over … ok');
  ok = true;
} catch (e) { console.log('FAILED', e); }
await browser.close(); server.close();
process.exit(ok ? 0 : 1);
