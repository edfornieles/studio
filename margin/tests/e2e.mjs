// End-to-end smoke test in headless Chromium:
//  - generates a real two-column PDF, uploads it, checks reading order
//  - plays with a simulated speechSynthesis, pauses, reloads, checks resume
//  - marks a sentence, searches
//  - plays through the "narrator server" engine against a mocked endpoint
// Usage: node tests/e2e.mjs   (needs network for PDF.js from cdnjs)
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { wavBlob } from '../js/audio-util.js';

const { chromium } = createRequire(import.meta.url)('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  try {
    const body = await readFile(join(root, p.endsWith('/') ? p + 'index.html' : p));
    res.writeHead(200, { 'Content-Type': types[extname(p)] || (p.endsWith('/') ? 'text/html' : 'application/octet-stream') });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const fakeSpeech = () => {
  window.__spoken = [];
  class U { constructor(t) { this.text = t; } }
  const synth = {
    speaking: false, pending: false, cur: null,
    getVoices: () => [{ name: 'Test Voice', lang: 'en-GB', voiceURI: 'test', default: true, localService: true }],
    speak(u) {
      this.cur = u; this.speaking = true; window.__spoken.push(u.text);
      setTimeout(() => { if (this.cur === u) u.onstart?.(); }, 10);
      u._t = setTimeout(() => { if (this.cur !== u) return; this.cur = null; this.speaking = false; u.onend?.(); }, 60);
    },
    cancel() { const u = this.cur; this.cur = null; this.speaking = false; if (u) { clearTimeout(u._t); u.onerror?.({ error: 'interrupted' }); } },
    pause() {}, resume() {}, addEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = U;
};

const step = async (name, fn) => { process.stdout.write(`• ${name} … `); await fn(); console.log('ok'); };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let failed = false;
try {
  // Make a two-column PDF with a running header.
  const maker = await browser.newPage();
  const para = (who, n) => Array.from({ length: n }, (_, i) => `${who} sentence number ${i + 1} sits in this column.`).join(' ');
  await maker.setContent(`<style>body{font:11pt Georgia;margin:0}h1{font-size:20pt}.cols{column-count:2;column-gap:40px}.pg{page-break-after:always}</style>
    <div class="pg"><h1>Listening Test Paper</h1><div class="cols"><p>${para('Leftside', 14)}</p><p>${para('Rightside', 14)}</p></div></div>
    <div class="pg"><p>Second page mentions Cornelius Cardew and the Scratch Orchestra.</p></div>`);
  const pdf = await maker.pdf({ format: 'A4', margin: { top: '60px', bottom: '60px', left: '50px', right: '50px' } });
  await maker.close();

  const ctx = await browser.newContext();
  await ctx.addInitScript(fakeSpeech);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (process.env.DEBUG) console.log('[console]', m.text()); if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => { if (process.env.DEBUG) console.log('[reqfail]', r.url(), r.failure()?.errorText); });
  await page.goto(base);
  await page.waitForFunction(() => window.__margin?.book);

  await step('welcome book loads', async () => {
    assert.equal(await page.textContent('#bookTitle'), 'Welcome to Margin');
    assert.ok((await page.locator('#passage .c').count()) > 2);
  });

  await step('upload two-column PDF', async () => {
    await page.setInputFiles('#upload', { name: 'listening-test.pdf', mimeType: 'application/pdf', buffer: pdf });
    await page.waitForFunction(() => /^(Added|PDF import failed)/.test(document.querySelector('#libraryStatus').textContent), null, { timeout: 30000 }).catch(async e => { console.log(await page.textContent('#libraryStatus'), await page.textContent('#log')); throw e; });
    assert.match(await page.textContent('#libraryStatus'), /^Added/);
    const text = await page.textContent('#passage');
    assert.ok(text.startsWith('Listening Test Paper'), text.slice(0, 80));
    assert.ok(text.indexOf('Leftside sentence number 14') < text.indexOf('Rightside sentence number 1 '), 'left column first');
    assert.equal(await page.locator('#library .book').count(), 2);
  });

  await step('play advances sentence by sentence', async () => {
    await page.click('#play');
    await page.waitForFunction(() => window.__margin.pos.chunk >= 3);
    assert.equal(await page.evaluate(() => window.__margin.state), 'playing');
    const spoken = await page.evaluate(() => window.__spoken);
    assert.equal(spoken[0], 'Listening Test Paper');
    assert.equal(await page.locator('#passage .c.now').count(), 1);
  });

  let saved;
  await step('pause, reload, resume at same sentence', async () => {
    await page.click('#play');
    saved = await page.evaluate(() => window.__margin.pos);
    assert.equal(await page.evaluate(() => window.__margin.state), 'paused');
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForFunction(() => window.__margin?.book?.title === 'listening-test');
    assert.deepEqual(await page.evaluate(() => window.__margin.pos), saved);
    await page.click('#miniPlay');
    await page.waitForFunction(() => window.__spoken.length > 0);
    const spoken = await page.evaluate(() => window.__spoken[0]);
    const expected = await page.evaluate(i => document.querySelector(`#passage .c[data-i="${i}"]`).textContent, saved.chunk);
    assert.equal(spoken, expected);
    await page.click('#miniPlay');
  });

  await step('mark sentence and discuss note', async () => {
    await page.click('#mark');
    await page.click('#discuss');
    await page.fill('#note', 'Ask about the column order.');
    await page.click('#saveNote');
    const marks = await page.evaluate(() => window.__margin.book.marks);
    assert.equal(marks.length, 2);
    assert.equal(marks[1].kind, 'discuss');
    assert.ok(marks[0].excerpt.length > 5);
  });

  await step('search jumps to page 2', async () => {
    await page.fill('#search', 'scratch orch');
    await page.waitForSelector('#results .hit');
    await page.click('#results .hit');
    assert.equal((await page.evaluate(() => window.__margin.pos)).page, 1);
  });

  await step('narrator server engine plays mocked audio', async () => {
    const wav = Buffer.from(await wavBlob(0.15, 300).arrayBuffer());
    let calls = 0;
    await page.route('**/fake-tts', async r => { calls++; const body = JSON.parse(r.request().postData()); assert.ok(body.text); await r.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); });
    await page.selectOption('#engine', 'remote');
    await page.fill('#endpoint', base + 'fake-tts');
    await page.dispatchEvent('#endpoint', 'change');
    await page.evaluate(() => { document.querySelector('#nowPanel').scrollIntoView(); });
    await page.click('#passage .c[data-i="0"]');
    await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Finished'), null, { timeout: 15000 });
    assert.ok(calls >= 1, 'server was called');
  });

  await step('no page errors', async () => { assert.deepEqual(errors, []); });
  await page.screenshot({ path: process.env.SHOT || '/dev/null', fullPage: false }).catch(() => {});
} catch (e) {
  failed = true;
  console.log('FAILED\n', e);
} finally {
  await browser.close();
  server.close();
}
process.exit(failed ? 1 : 0);
