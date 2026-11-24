// Turns a PDF into the generator's book JSON, using the PDF's bookmarks
// (outline) as sections and Margin's layout-aware text extraction.
//
//   node generator/pdf-to-book.mjs book.pdf out.json [--from "Preface"] [--skip "Appendix,Credits"]
//
// Needs pdfjs-dist@3.11.174 resolvable from the current directory
// (npm i pdfjs-dist@3.11.174). PDF annotations (sticky notes) are collected
// as notes with their page numbers.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { pageLines, removeRunningLines, linesToText } from '../js/extract.js';

const require = createRequire(pathToFileURL(process.cwd() + '/').href);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const [, , input, output, ...rest] = process.argv;
const opt = (name, dflt) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : dflt; };
const from = opt('--from', '');
const skip = opt('--skip', '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const maxDepth = Number(opt('--depth', '1')); // outline levels kept as separate sections

const doc = await pdfjs.getDocument({ url: input, verbosity: 0 }).promise;
const info = (await doc.getMetadata()).info || {};

// 1. Text per page.
const lines = [];
for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  lines.push(pageLines((await page.getTextContent()).items, page.view));
}
const pages = removeRunningLines(lines).map(linesToText);

// 2. Notes from annotations (one per note, deduplicated by text).
const notes = [];
const seen = new Set();
for (let i = 1; i <= doc.numPages; i++) {
  for (const a of await (await doc.getPage(i)).getAnnotations()) {
    const text = (a.contentsObj?.str || a.contents || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    notes.push({ page: i, text });
  }
}

// 3. Sections from the outline.
const flat = [];
async function walk(items, depth) {
  for (const it of items || []) {
    let page = null;
    try {
      const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest;
      if (dest) page = (await doc.getPageIndex(dest[0])) + 1;
    } catch { /* external or broken link */ }
    flat.push({ title: it.title.trim(), page, depth });
    await walk(it.items, depth + 1);
  }
}
await walk(await doc.getOutline(), 0);

let starts = flat
  .filter(s => s.page && s.depth <= maxDepth)
  .filter(s => !/^(reading position|mother\b|m\d\d\s*\|)/i.test(s.title))
  .sort((a, b) => a.page - b.page);
// One section per start page (first title wins).
starts = starts.filter((s, i) => i === 0 || s.page !== starts[i - 1].page);
// No bookmarks: use numbered section headings ("1. Introduction") if the
// document has them (articles, papers); otherwise parts of ~15 minutes.
// The reference list (and anything after it) isn't worth hearing. Its heading may run
// straight into the first entry: "References Agamben, Giorgio. 2009 …".
const STOP = /^(?:\d{1,2}\.?\s+)?(references|bibliography|works cited|literature cited)(?:$|\s+\p{Lu}[\p{L}'’-]+,)/iu;
let headingSections = null;
if (!starts.length) {
  const paras = [];
  pages.forEach((t, i) => t.split(/\n\n+/).forEach(x => { if (x.trim()) paras.push({ page: i + 1, text: x.trim() }); }));
  const isHeading = x => /^\d{1,2}\.\s+\p{Lu}/u.test(x) && x.length < 160 && !/[.:;,]$/.test(x) && x.split(/\s+/).length <= 20;
  const marks = paras.map((x, i) => (isHeading(x.text) ? i : -1)).filter(i => i >= 0);
  const nums = marks.map(i => parseInt(paras[i].text, 10));
  // Need headings numbered upwards (1, 2, 3 …), not stray numbered list items.
  if (marks.length >= 2 && nums[0] <= 1 && nums.every((n, k) => k === 0 || n === nums[k - 1] + 1)) {
    headingSections = [];
    const bounds = [{ title: 'Title and abstract', at: 0 }, ...marks.map(i => ({ title: paras[i].text.replace(/\s+/g, ' '), at: i }))];
    let stopAt = paras.findIndex((x, i) => i > marks[marks.length - 1] && STOP.test(x.text));
    if (stopAt < 0) stopAt = paras.length;
    bounds.forEach((b, k) => {
      const end = Math.min(k + 1 < bounds.length ? bounds[k + 1].at : paras.length, stopAt);
      const chunk = paras.slice(b.at, end).filter((x, j) => !(j === 0 && k > 0)); // heading becomes the spoken title
      if (!chunk.length && k > 0) return;
      headingSections.push({ title: b.title, chunk });
    });
  }
}
if (!starts.length && !headingSections) {
  let chars = Infinity, n = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    if (chars > 13000 && pages[p - 1].trim()) { starts.push({ title: `Part ${++n}`, page: p, depth: 0 }); chars = 0; }
    chars += pages[p - 1].length;
  }
}
const firstIdx = from ? Math.max(0, starts.findIndex(s => s.title.toLowerCase().startsWith(from.toLowerCase()))) : 0;

// Small caps often extract as "PrefaCe" / "DoUglas": fix words whose
// capitals appear after lower-case letters (leaves "McLuhan"-style names alone
// only when the capital follows "Mc"/"Mac").
const fixCaps = t => t.replace(/\b(\p{Lu}?)(\p{Ll}+(?:\p{Lu}+\p{Ll}*)+)\b/gu, (w, first, rest) =>
  /^(Mc|Mac|De|Di|Le|La|Van|Von)/.test(w) && rest.length > 3 ? w : first + rest.toLowerCase());
// Drop paragraphs that are mostly not words (graphic scores, diagrams, tables of numbers).
const wordy = p => {
  const letters = (p.match(/\p{L}/gu) || []).length;
  const words = p.split(/\s+/).filter(Boolean);
  const longWords = words.filter(w => /\p{L}{3,}/u.test(w)).length;
  return letters / Math.max(1, p.length) > 0.6 && longWords / Math.max(1, words.length) > 0.45;
};
const clean = t => t.split(/\n\n+/).map(p => fixCaps(p.trim())).filter(p => p && wordy(p)).join('\n\n');

const sections = [];
let carry = '';
if (headingSections) {
  for (const h of headingSections) {
    const parts = [];
    for (const x of h.chunk) {
      const t = clean(x.text);
      if (!t) continue;
      if (parts.length && parts[parts.length - 1].page === x.page) parts[parts.length - 1].text += '\n\n' + t;
      else parts.push({ page: x.page, text: t });
    }
    if (!parts.length) continue;
    const body = parts.map(x => x.text).join('\n\n');
    sections.push({ title: h.title, pages: [parts[0].page, parts[parts.length - 1].page], intro: h.title + '.', parts, text: h.title + '.\n\n' + body });
  }
}
for (let i = firstIdx; i < starts.length; i++) {
  const s = starts[i];
  if (skip.some(k => s.title.toLowerCase().startsWith(k))) continue;
  const end = (starts[i + 1]?.page || doc.numPages + 1) - 1;
  // Keep the cleaned text page by page, so cues (e.g. image descriptions) can be
  // inserted where a page starts.
  const parts = [];
  for (let p = s.page; p <= end; p++) parts.push({ page: p, text: clean(pages[p - 1] || '') });
  const body = parts.map(x => x.text).filter(Boolean).join('\n\n');
  if (body.length < 400 && i < starts.length - 1) { carry += s.title + '.\n\n'; continue; } // e.g. issue title pages
  const title = s.title.replace(/\s+/g, ' ');
  sections.push({ title, pages: [s.page, end], intro: carry + title + '.', parts, text: carry + title + '.\n\n' + body });
  carry = '';
}

// Metadata titles are often junk ("Title", "Microsoft Word - draft.docx"); then
// read the title (largest type on page 1) and the line after it (authors).
const junkTitle = t => !t || t.trim().length < 4 || /^(title|untitled|document|slide \d+)$/i.test(t.trim()) || /microsoft word|\.docx?$|\.pdf$|^untitled/i.test(t);
let title = info.Title, author = info.Author || '';
if (junkTitle(title)) {
  author = '';
  title = '';
  const first = lines[0] || [];
  if (first.length) {
    const max = Math.max(...first.map(l => l.size));
    const k = first.findIndex(l => l.size >= max * 0.95);
    let j = k;
    const parts = [];
    while (j < first.length && first[j].size >= max * 0.9 && parts.join(' ').length < 220) parts.push(first[j++].text);
    title = parts.join(' ').replace(/\s+/g, ' ').replace(/(\p{L})- (\p{Ll})/gu, '$1$2').trim();
    const next = first[j];
    if (next && next.text.length < 120 && !/^abstract/i.test(next.text)) author = next.text.replace(/\s+/g, ' ').trim();
  }
}
const book = {
  title: title || (rest.includes('--no-filename-title') ? '' : input.replace(/^.*\//, '').replace(/\.pdf$/i, '')),
  author,
  pageCount: doc.numPages,
  sections,
  notes,
};
writeFileSync(output, JSON.stringify(book, null, 1));
const chars = sections.reduce((n, s) => n + s.text.length, 0);
console.log(`${sections.length} sections, ${notes.length} notes, ${chars} characters (~${Math.round(chars / 15 / 60)} min of audio)`);
