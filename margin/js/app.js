import { openStore, newId, normalizeBook } from './store.js';
import { makeChunks, speakable, chunkAt } from './chunks.js';
import { extractPdf } from './pdf.js';
import { DeviceVoice, RemoteVoice, unlockAudioSession } from './narrator.js';
import { wavBlob } from './audio-util.js';
import * as diag from './diagnostics.js';

const $ = id => document.getElementById(id);
const log = diag.log;

const WELCOME_ID = 'welcome-margin';
const WELCOME_PAGES = [
  'Welcome to Margin. This is your listening room. Add a PDF below and it will be read to you one sentence at a time. The sentence being read is highlighted, and you can tap any sentence to jump there.\n\nWhen something catches your attention, tap Pause and discuss. Margin keeps the exact sentence with your note, so you can come back to it later.',
  'If you hear nothing on an iPhone, open Playback diagnostics at the bottom of the page. Play the test tone first, then the device voice. The report will show where the sound stops.',
];

// ---------- settings (per device convenience) ----------
const DEFAULTS = { engine: 'device', narrator: 'mother', voiceURI: '', rate: 0.95, endpoint: '', remoteVoice: '', lastBook: WELCOME_ID };
const settings = (() => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('margin-settings') || '{}') }; } catch { return { ...DEFAULTS }; }
})();
const saveSettings = () => { try { localStorage.setItem('margin-settings', JSON.stringify(settings)); } catch { /* private mode */ } };

// ---------- state ----------
let store = null;
let book = null;
let pos = { page: 0, chunk: 0 };
const chunkCache = new Map();
let state = 'idle'; // idle | playing | paused
let session = 0;
let noteKind = 'note';

const device = new DeviceVoice(log);
const remote = new RemoteVoice(log, () => store);
const engine = () => (settings.engine === 'remote' ? remote : device);

const pages = () => book?.pages || [];
function chunksFor(page) {
  if (!chunkCache.has(page)) chunkCache.set(page, makeChunks(pages()[page] || ''));
  return chunkCache.get(page);
}
const currentChunk = () => chunksFor(pos.page)[pos.chunk] || null;

// ---------- persistence ----------
let saveTimer = 0;
function saveSoon(delay = 800) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, delay);
}
async function saveNow() {
  clearTimeout(saveTimer);
  if (!book || !store) return;
  book.position = { ...pos };
  book.updated = Date.now();
  try { await store.put(book); } catch (e) { setLibStatus('Saving failed (' + e.message + '). Export your notes to keep them safe.'); }
}
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { log('page', 'visibility ' + document.visibilityState); if (document.hidden) saveNow(); });

// ---------- voices ----------
function populateVoices() {
  const vs = device.voices().filter(v => /^en/i.test(v.lang));
  const sel = $('voice');
  sel.replaceChildren(new Option('Automatic', ''));
  for (const v of vs) sel.append(new Option(`${v.name} (${v.lang})`, v.voiceURI));
  sel.value = vs.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : '';
  log('speech', `voices: ${device.voices().length} (${vs.length} English)`);
  renderEnv();
}
function chooseVoice() {
  const voices = device.voices();
  const picked = voices.find(v => v.voiceURI === settings.voiceURI);
  if (picked) return picked;
  const en = voices.filter(v => /^en/i.test(v.lang));
  if (settings.narrator === 'mother') {
    return en.find(v => /^en-GB/i.test(v.lang) && /serena|kate|martha|stephanie|female|siri/i.test(v.name))
      || en.find(v => /^en-GB/i.test(v.lang)) || en.find(v => v.default) || en[0] || null;
  }
  return en.find(v => v.default) || en[0] || null;
}
const voiceOpts = () => ({
  voice: chooseVoice(),
  rate: Number(settings.rate) || 1,
  pitch: settings.narrator === 'mother' ? 0.92 : 1,
});

// ---------- player ----------
function setState(s) {
  state = s;
  const playing = s === 'playing';
  $('play').textContent = playing ? 'Ⅱ Pause' : '▶ Listen';
  $('miniPlay').textContent = playing ? 'Ⅱ' : '▶';
  $('miniPlay').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : s === 'paused' ? 'paused' : 'none';
}

function play() {
  // Everything up to the first engine.speak() must run synchronously inside
  // the tap: iOS only allows audio that starts from a user gesture.
  if (!book) return;
  unlockAudioSession(log);
  const eng = engine();
  if (eng === remote && !remote.available) { setStatus('Add a narrator server URL in Narrator settings, or switch to Device voice.'); return; }
  eng.unlock();
  if (state === 'paused' && eng.supportsPause && eng.midChunk) {
    eng.resume()?.catch?.(e => fail(e));
    setState('playing');
    setStatus(where());
    return;
  }
  const id = ++session;
  setState('playing');
  run(id);
}

async function run(id) {
  const eng = engine();
  while (id === session) {
    const chunks = chunksFor(pos.page);
    if (pos.chunk >= chunks.length) {
      if (pos.page >= pages().length - 1) {
        stopPlayback();
        setStatus('Finished. That was the last page.');
        saveNow();
        return;
      }
      pos = { page: pos.page + 1, chunk: 0 };
      renderPage();
      saveSoon();
      continue;
    }
    const c = chunks[pos.chunk];
    if (!speakable(c.text)) { pos.chunk++; continue; }
    highlight();
    updateMediaSession();
    setStatus(where());
    for (const next of upcoming(2)) eng.prepare(next.text);
    let result;
    try {
      result = await eng.speak(c.text, voiceOpts());
    } catch (e) {
      if (id === session) fail(e);
      return;
    }
    if (id !== session || result === 'cancelled') return;
    pos.chunk++;
    saveSoon(1500);
  }
}

function upcoming(n) {
  const out = [];
  let p = pos.page, i = pos.chunk + 1;
  while (out.length < n && p < pages().length) {
    const cs = chunksFor(p);
    if (i < cs.length) { if (speakable(cs[i].text)) out.push(cs[i]); i++; } else { p++; i = 0; }
  }
  return out;
}

function fail(e) {
  const msg = e?.message || String(e);
  log('player', 'failed: ' + msg);
  stopPlayback();
  if (msg === 'silent') {
    setStatus('The device voice accepted the text but never started speaking. Check the silent switch and volume, try another voice, or open Playback diagnostics.');
  } else if (msg.startsWith('device-voice:')) {
    setStatus('Device voice error (' + msg.slice(13) + '). Try another voice in Narrator settings.');
  } else {
    setStatus('Playback stopped: ' + msg);
  }
}

function pause() {
  const eng = engine();
  if (eng.supportsPause && eng.midChunk) eng.pause();
  else { session++; eng.stop(); }
  setState('paused');
  setStatus('Paused · ' + where() + '. Listen resumes from this sentence.');
  saveNow();
}

function stopPlayback() {
  session++;
  device.stop();
  remote.stop();
  setState('idle');
}

function toggle() { if (state === 'playing') pause(); else play(); }

// Jump to a position; keeps playing if we were playing.
function seek(page, chunk = 0) {
  const wasPlaying = state === 'playing';
  stopPlayback();
  const n = pages().length;
  page = Math.max(0, Math.min(n - 1, page));
  const cs = chunksFor(page);
  pos = { page, chunk: Math.max(0, Math.min(Math.max(0, cs.length - 1), chunk)) };
  renderPage();
  saveSoon();
  if (wasPlaying) play();
  else setStatus('Ready · ' + where());
}

function step(delta) {
  let { page, chunk } = pos;
  chunk += delta;
  while (chunk < 0 && page > 0) { page--; chunk += chunksFor(page).length; }
  while (chunk >= chunksFor(page).length && page < pages().length - 1) { chunk -= chunksFor(page).length; page++; }
  seek(page, Math.max(0, chunk));
}

function where() {
  const n = chunksFor(pos.page).length;
  return `page ${pos.page + 1} of ${pages().length}` + (n ? ` · sentence ${Math.min(pos.chunk + 1, n)} of ${n}` : '');
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !book) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: `${book.title} · p. ${pos.page + 1}`, artist: 'Margin', album: book.title });
  } catch { /* older Safari */ }
}
function bindMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch { /* unsupported action */ } };
  set('play', () => play());
  set('pause', () => pause());
  set('stop', () => { stopPlayback(); saveNow(); });
  set('previoustrack', () => step(-1));
  set('nexttrack', () => step(1));
  set('seekbackward', () => step(-1));
  set('seekforward', () => step(1));
}

// ---------- rendering ----------
const setStatus = t => { $('status').textContent = t; };
const setLibStatus = t => { $('libraryStatus').textContent = t; };

async function renderLibrary() {
  const all = (await store.all()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const lib = $('library');
  lib.replaceChildren();
  for (const b of all) {
    const el = document.createElement('button');
    el.className = 'book' + (book?.id === b.id ? ' active' : '');
    el.setAttribute('aria-current', book?.id === b.id ? 'true' : 'false');
    const cover = document.createElement('div');
    cover.className = 'cover';
    cover.textContent = b.id === WELCOME_ID ? 'MARGIN' : 'PDF';
    const info = document.createElement('div');
    info.className = 'info';
    const title = document.createElement('strong');
    title.textContent = b.title;
    const sub = document.createElement('small');
    sub.textContent = `${b.pages.length} pages · at page ${(b.position?.page || 0) + 1} · ${b.marks.length} marks`;
    info.append(title, sub);
    const arrow = document.createElement('span');
    arrow.textContent = '›';
    el.append(cover, info, arrow);
    el.onclick = () => selectBook(b.id);
    lib.append(el);
  }
  setLibStatus(all.length + ' book' + (all.length === 1 ? '' : 's') + ' in your library' + (store.memory ? '. Private browsing: nothing will be saved after you close this tab.' : ''));
}

function renderPage() {
  if (!book) return;
  const n = pages().length;
  $('bookTitle').textContent = book.title;
  $('where').textContent = `PDF page ${pos.page + 1} / ${n}` + (book.emptyPages?.includes(pos.page + 1) ? ' · no selectable text (scanned?)' : '');
  $('progress').max = Math.max(1, n);
  $('progress').value = pos.page + 1;
  $('miniTitle').textContent = book.title;
  const text = pages()[pos.page] || '';
  const box = $('passage');
  box.replaceChildren();
  if (!text.trim()) {
    box.textContent = '[No selectable text on this page. Scanned pages need OCR, which isn\'t supported yet.]';
  } else {
    const markedChunks = new Set(book.marks.filter(m => m.page === pos.page).map(m => m.chunk));
    let at = 0;
    chunksFor(pos.page).forEach((c, i) => {
      if (c.start > at) box.append(text.slice(at, c.start));
      const s = document.createElement('span');
      s.className = 'c' + (markedChunks.has(i) ? ' marked' : '');
      s.dataset.i = i;
      s.textContent = text.slice(c.start, c.end);
      box.append(s);
      at = c.end;
    });
    if (at < text.length) box.append(text.slice(at));
  }
  ['reextract', 'deleteBook'].forEach(id => { $(id).hidden = book.id === WELCOME_ID; });
  $('reextract').disabled = !book.hasFile;
  highlight();
  renderMarks();
}

function highlight() {
  const box = $('passage');
  box.querySelector('.c.now')?.classList.remove('now');
  const el = box.querySelector(`.c[data-i="${pos.chunk}"]`);
  if (el) {
    el.classList.add('now');
    const top = el.offsetTop - box.clientHeight / 3;
    if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTo({ top, behavior: 'smooth' });
  }
  $('miniWhere').textContent = where();
}

function renderMarks() {
  const list = $('marks');
  list.replaceChildren();
  const label = { mark: 'Marked', note: 'Note', discuss: 'Discussion' };
  for (const m of [...book.marks].reverse()) {
    const el = document.createElement('div');
    el.className = 'mark';
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `p. ${m.page + 1} · ${label[m.kind] || 'Note'} · ${new Date(m.date).toLocaleDateString()}`;
    const q = document.createElement('blockquote');
    q.className = 'quote';
    q.textContent = m.excerpt;
    el.append(meta, q);
    if (m.note) {
      const p = document.createElement('p');
      p.className = 'yours';
      p.textContent = m.note;
      el.append(p);
    }
    const row = document.createElement('div');
    row.className = 'row';
    const go = document.createElement('button');
    go.textContent = 'Listen from here';
    go.onclick = () => { seek(m.page, m.chunk); $('nowPanel').scrollIntoView({ behavior: 'smooth' }); };
    const del = document.createElement('button');
    del.className = 'ghost danger';
    del.textContent = 'Delete';
    del.onclick = () => {
      if (!confirm('Delete this mark?')) return;
      book.marks = book.marks.filter(x => x.id !== m.id);
      renderPage();
      saveNow();
    };
    row.append(go, del);
    el.append(row);
    list.append(el);
  }
}

// ---------- library actions ----------
function welcomeBook(existing) {
  return { marks: [], position: { page: 0, chunk: 0 }, created: Date.now(), ...existing, id: WELCOME_ID, title: 'Welcome to Margin', pages: WELCOME_PAGES, updated: existing?.updated || Date.now() };
}

async function selectBook(id) {
  if (book?.id === id) return;
  stopPlayback();
  await saveNow();
  const b = await store.get(id);
  if (!b) return;
  book = b;
  chunkCache.clear();
  const page = Math.min(b.position.page, Math.max(0, b.pages.length - 1));
  pos = { page, chunk: Math.min(b.position.chunk, Math.max(0, chunksFor(page).length - 1)) };
  settings.lastBook = id;
  saveSettings();
  renderPage();
  await renderLibrary();
  $('noteBox').classList.remove('open');
  setStatus('Ready · ' + where() + '. Tap Listen.');
}

async function importPdf(file) {
  stopPlayback();
  setLibStatus('Reading PDF…');
  try {
    const r = await extractPdf(file, (i, n) => { if (i % 5 === 0 || i === n) setLibStatus(`Extracting text · page ${i} of ${n}`); });
    const id = newId('book');
    const b = {
      id,
      title: r.title && r.title.length > 3 && !/^untitled|microsoft word/i.test(r.title) ? r.title : file.name.replace(/\.pdf$/i, ''),
      fileName: file.name,
      pages: r.pages.length ? r.pages : [''],
      emptyPages: r.emptyPages,
      extractVersion: r.version,
      position: { page: 0, chunk: 0 },
      marks: [],
      created: Date.now(),
      updated: Date.now(),
      hasFile: false,
    };
    try { await store.putFile(id, file); b.hasFile = true; } catch (e) { log('storage', 'could not keep original PDF: ' + e.message); }
    await store.put(b);
    await selectBook(id);
    const scanned = r.emptyPages.length;
    setLibStatus(`Added “${b.title}” · ${r.pages.length} pages` + (scanned ? ` · ${scanned} page${scanned === 1 ? ' has' : 's have'} no selectable text (scanned pages need OCR)` : ''));
  } catch (err) {
    log('pdf', 'import failed: ' + err.message);
    setLibStatus('PDF import failed: ' + err.message);
  }
}

async function reextract() {
  if (!book?.hasFile) return;
  const blob = await store.getFile(book.id);
  if (!blob) { setLibStatus('The original PDF is no longer stored. Add it again.'); return; }
  stopPlayback();
  try {
    const r = await extractPdf(blob, (i, n) => setStatus(`Re-reading text · page ${i} of ${n}`));
    book.pages = r.pages;
    book.emptyPages = r.emptyPages;
    book.extractVersion = r.version;
    chunkCache.clear();
    pos.chunk = Math.min(pos.chunk, Math.max(0, chunksFor(pos.page).length - 1));
    await saveNow();
    renderPage();
    setStatus('Text re-read · ' + where());
  } catch (e) { setStatus('Re-reading failed: ' + e.message); }
}

async function deleteBook() {
  if (!book || book.id === WELCOME_ID) return;
  if (!confirm(`Remove “${book.title}” and its ${book.marks.length} marks from this device?`)) return;
  stopPlayback();
  const id = book.id;
  book = null;
  await store.remove(id);
  await selectBook(WELCOME_ID);
}

// ---------- notebook ----------
function addMark(kind, note = '') {
  const c = currentChunk();
  book.marks.push({
    id: newId('m'), kind, page: pos.page, chunk: pos.chunk,
    excerpt: c ? c.text : (pages()[pos.page] || '').slice(0, 220),
    note, date: new Date().toISOString(),
  });
  renderPage();
  saveNow();
}

function openNote(kind) {
  noteKind = kind;
  $('noteContext').textContent = currentChunk()?.text || '';
  $('noteBox').classList.add('open');
  $('continue').hidden = kind !== 'discuss';
  $('note').focus();
}

function passageForDiscussion() {
  const cs = chunksFor(pos.page);
  const around = cs.slice(Math.max(0, pos.chunk - 1), pos.chunk + 2).map(c => c.text).join(' ');
  return `From “${book.title}”, PDF page ${pos.page + 1}:\n\n“${around}”\n\n`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.append(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'book';

function exportMarkdown() {
  const label = { mark: 'Marked', note: 'Note', discuss: 'Discussion' };
  const parts = [`# Margin notes: ${book.title}`, '', `Exported ${new Date().toLocaleString()}`, ''];
  for (const m of [...book.marks].sort((a, b) => a.page - b.page || a.chunk - b.chunk)) {
    parts.push(`## p. ${m.page + 1} · ${label[m.kind] || 'Note'}`, '', `> ${m.excerpt.replace(/\n/g, ' ')}`, `>`, `> ${book.title}, PDF p. ${m.page + 1}`, '');
    if (m.note) parts.push(m.note, '');
    parts.push(`<sub>${m.date}</sub>`, '');
  }
  download(`margin-${slug(book.title)}.md`, parts.join('\n'), 'text/markdown');
}

async function exportJson() {
  const all = await store.all();
  const data = {
    app: 'margin', format: 1, exported: new Date().toISOString(),
    // Book text is left out on purpose: backups hold your marks, not copies of the PDFs.
    books: all.map(b => ({ id: b.id, title: b.title, fileName: b.fileName, pageCount: b.pages.length, position: b.position, marks: b.marks })),
  };
  download('margin-backup.json', JSON.stringify(data, null, 2), 'application/json');
}

// ---------- search ----------
let searchTimer = 0;
function search(q) {
  const out = $('results');
  out.replaceChildren();
  q = q.trim();
  if (q.length < 3 || !book) return;
  const needle = q.toLowerCase();
  let hits = 0;
  for (let p = 0; p < pages().length && hits < 50; p++) {
    const text = pages()[p];
    const hay = text.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1 && hits < 50) {
      const b = document.createElement('button');
      b.className = 'hit';
      const s = Math.max(0, i - 60), e = Math.min(text.length, i + q.length + 60);
      const m = document.createElement('mark');
      m.textContent = text.slice(i, i + q.length);
      const pg = document.createElement('small');
      pg.textContent = `p. ${p + 1} · `;
      b.append(pg, (s > 0 ? '…' : '') + text.slice(s, i), m, text.slice(i + q.length, e) + (e < text.length ? '…' : ''));
      const page = p, offset = i;
      b.onclick = () => { seek(page, chunkAt(chunksFor(page), offset)); $('nowPanel').scrollIntoView({ behavior: 'smooth' }); };
      out.append(b);
      hits++;
      i = hay.indexOf(needle, i + needle.length);
    }
  }
  if (!hits) out.textContent = 'No matches in this book.';
}

// ---------- diagnostics ----------
function renderEnv() {
  const env = diag.environment(device);
  $('envSummary').textContent = `Speech: ${env.speechSynthesis ? 'yes' : 'no'} · voices: ${env.voices} · audio session API: ${env.audioSessionApi} · lock-screen controls: ${env.mediaSession ? 'yes' : 'no'} · home-screen app: ${env.standalone ? 'yes' : 'no'} · HTTPS: ${env.secureContext ? 'yes' : 'no'}`;
}

let toneUrl = null;
function testTone() {
  stopPlayback();
  unlockAudioSession(log);
  toneUrl ||= URL.createObjectURL(wavBlob(0.8, 440));
  const a = new Audio(toneUrl);
  a.setAttribute('playsinline', '');
  a.onended = () => log('test', 'tone ended');
  a.play().then(() => { log('test', 'tone playing'); setStatus('Playing a test tone. Did you hear a beep?'); })
    .catch(e => { log('test', 'tone failed: ' + e.message); setStatus('Even a plain audio file could not play: ' + e.message); });
}

function testVoice() {
  stopPlayback();
  unlockAudioSession(log);
  const o = voiceOpts();
  log('test', 'device voice: ' + (o.voice ? `${o.voice.name} ${o.voice.lang}` : 'browser default'));
  device.speak('Hello. This is your listening room. Can you hear me?', o)
    .then(r => { log('test', 'device voice ' + r); setStatus('Device voice test finished. Did you hear it?'); })
    .catch(e => fail(e));
  setStatus('Speaking a test sentence…');
}

function testRemote() {
  stopPlayback();
  unlockAudioSession(log);
  if (!settings.endpoint) { setStatus('Enter a narrator server URL first.'); return; }
  remote.unlock();
  setStatus('Asking the narrator server for a test sentence…');
  remote.speak('Hello. This is your listening room, read by the narrator server.', { rate: Number(settings.rate) || 1 })
    .then(r => { log('test', 'remote ' + r); setStatus('Narrator server test finished.'); })
    .catch(e => fail(e));
}

// ---------- wiring ----------
function bind() {
  $('play').onclick = toggle;
  $('miniPlay').onclick = toggle;
  $('back').onclick = () => step(-1);
  $('fwd').onclick = () => step(1);
  $('prevPage').onclick = () => seek(pos.page - 1);
  $('nextPage').onclick = () => seek(pos.page + 1);
  $('progress').oninput = e => { $('where').textContent = `PDF page ${e.target.value} / ${pages().length}`; };
  $('progress').onchange = e => seek(Number(e.target.value) - 1);
  $('passage').onclick = e => {
    const c = e.target.closest('.c');
    if (!c) return;
    const wasPlaying = state === 'playing';
    seek(pos.page, Number(c.dataset.i));
    if (!wasPlaying) play();
  };

  $('speed').value = String(settings.rate);
  if (!$('speed').value) $('speed').value = '0.95';
  $('speed').onchange = e => {
    settings.rate = Number(e.target.value); saveSettings();
    if (remote.el) remote.el.playbackRate = settings.rate;
  };
  const showEngine = () => {
    $('deviceSettings').hidden = settings.engine !== 'device';
    $('remoteSettings').hidden = settings.engine !== 'remote';
  };
  $('engine').value = settings.engine;
  $('engine').onchange = e => { stopPlayback(); settings.engine = e.target.value; saveSettings(); showEngine(); setStatus('Narrator: ' + e.target.selectedOptions[0].textContent); };
  showEngine();
  $('narrator').value = settings.narrator;
  $('narrator').onchange = e => { settings.narrator = e.target.value; saveSettings(); };
  $('voice').onchange = e => { settings.voiceURI = e.target.value; saveSettings(); };
  $('endpoint').value = settings.endpoint;
  $('remoteVoice').value = settings.remoteVoice;
  const cfgRemote = () => remote.configure({ endpoint: settings.endpoint, voice: settings.remoteVoice });
  $('endpoint').onchange = e => { settings.endpoint = e.target.value.trim(); saveSettings(); cfgRemote(); };
  $('remoteVoice').onchange = e => { settings.remoteVoice = e.target.value.trim(); saveSettings(); cfgRemote(); };
  cfgRemote();

  $('upload').onchange = async e => { const f = e.target.files?.[0]; if (f) await importPdf(f); e.target.value = ''; };
  $('reextract').onclick = reextract;
  $('deleteBook').onclick = deleteBook;

  $('mark').onclick = () => { addMark('mark'); setStatus('Marked: page ' + (pos.page + 1) + ', sentence ' + (pos.chunk + 1)); };
  $('discuss').onclick = () => { if (state === 'playing') pause(); openNote('discuss'); };
  $('copyPassage').onclick = async () => setStatus((await copyText(passageForDiscussion())) ? 'Passage copied with its page reference.' : 'Copy failed.');
  $('saveNote').onclick = () => {
    const t = $('note').value.trim();
    if (!t) return;
    addMark(noteKind, t);
    $('note').value = '';
    $('noteBox').classList.remove('open');
    setStatus('Note saved at page ' + (pos.page + 1) + '.');
  };
  $('continue').onclick = () => { $('noteBox').classList.remove('open'); play(); };
  $('exportMd').onclick = exportMarkdown;
  $('exportJson').onclick = exportJson;
  $('search').oninput = e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => search(e.target.value), 250); };

  $('testTone').onclick = testTone;
  $('testVoice').onclick = testVoice;
  $('testRemote').onclick = testRemote;
  $('copyDiag').onclick = async () => setStatus((await copyText(diag.report(device, { engine: settings.engine, endpointSet: !!settings.endpoint }))) ? 'Diagnostics copied.' : 'Copy failed.');
  diag.onLog(entries => { $('log').textContent = entries.slice(-60).map(e => `${e.t}s [${e.cat}] ${e.msg}`).join('\n'); });

  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });

  if (device.available) {
    populateVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', populateVoices);
  }
  remote.el.addEventListener('pause', () => { if (state === 'playing' && remote.midChunk && !remote.el.ended) { log('remote', 'paused externally'); setState('paused'); } });
  remote.el.addEventListener('play', () => { if (state === 'paused' && remote.midChunk) setState('playing'); });
  bindMediaSession();
}

async function init() {
  log('page', 'Margin 0.3 start');
  bind();
  renderEnv();
  store = await openStore(log);
  const existing = await store.get(WELCOME_ID);
  await store.put(welcomeBook(existing));
  const all = await store.all();
  const last = all.find(b => b.id === settings.lastBook) || all.sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
  await selectBook(last.id);
}

// Expose a tiny hook for automated tests.
window.__margin = { get state() { return state; }, get pos() { return { ...pos }; }, get book() { return book && normalizeBook(book); } };

init().catch(e => { log('page', 'init failed: ' + e.message); setLibStatus('Margin failed to start: ' + e.message); });
