// Splits page text into speakable chunks (roughly one sentence each).
// Each chunk keeps its character offsets so the reader can highlight it and
// so positions/bookmarks can point at an exact text span.

const ABBR = /^(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|vs|etc|e\.g|i\.e|cf|al|ed|eds|trans|vol|vols|no|nos|pp?|ch|chap|fig|figs|op|cit|ibid|ca|c|approx|Inc|Ltd|Co|Mt|ff|Nr|repr|rev|esp)\.$/i;
const BOUNDARY = /[.!?…]+["'”’)\]]*(?=\s+["'“‘(\[]?[\p{Lu}\p{N}])/gu;

export const MAX_CHUNK = 240;

export function makeChunks(text, max = MAX_CHUNK) {
  const out = [];
  if (!text) return out;
  const para = /[^\n]+/g;
  let m;
  while ((m = para.exec(text))) splitParagraph(m[0], m.index, out, max);
  return out;
}

export function speakable(text) {
  return /[\p{L}\p{N}]/u.test(text || '');
}

function splitParagraph(p, base, out, max) {
  let start = 0;
  BOUNDARY.lastIndex = 0;
  let m;
  while ((m = BOUNDARY.exec(p))) {
    const end = m.index + m[0].length;
    const lastWord = (p.slice(start, end).match(/(\S+)$/)?.[1] || '').replace(/^[("'“‘\[]+/, '');
    // Don't split after abbreviations ("e.g.", "p.") or initials ("J. Cage").
    if (ABBR.test(lastWord) || /^\p{Lu}\.$/u.test(lastWord)) continue;
    pushSized(p, start, end, base, out, max);
    start = end;
  }
  if (start < p.length) pushSized(p, start, p.length, base, out, max);
}

function pushSized(p, s, e, base, out, max) {
  const ws = i => /\s/.test(p[i]);
  while (s < e && ws(s)) s++;
  while (e > s && ws(e - 1)) e--;
  const push = (a, b) => {
    while (b > a && ws(b - 1)) b--;
    if (b > a) out.push({ start: base + a, end: base + b, text: p.slice(a, b) });
  };
  while (e - s > max) {
    const seg = p.slice(s, s + max);
    let cut = Math.max(seg.lastIndexOf(', '), seg.lastIndexOf('; '), seg.lastIndexOf(': '), seg.lastIndexOf(' — '));
    if (cut < max * 0.4) cut = seg.lastIndexOf(' ');
    cut = cut <= 0 ? max : cut + 1;
    push(s, s + cut);
    s += cut;
    while (s < e && ws(s)) s++;
  }
  push(s, e);
}

// Index of the chunk containing character offset `offset` (or the next one after it).
export function chunkAt(chunks, offset) {
  for (let i = 0; i < chunks.length; i++) if (chunks[i].end > offset) return i;
  return Math.max(0, chunks.length - 1);
}
