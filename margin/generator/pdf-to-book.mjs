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

const book = {
  title: info.Title || input.replace(/^.*\//, '').replace(/\.pdf$/i, ''),
  author: info.Author || '',
  pageCount: doc.numPages,
  sections,
  notes,
};
writeFileSync(output, JSON.stringify(book, null, 1));
const chars = sections.reduce((n, s) => n + s.text.length, 0);
console.log(`${sections.length} sections, ${notes.length} notes, ${chars} characters (~${Math.round(chars / 15 / 60)} min of audio)`);
