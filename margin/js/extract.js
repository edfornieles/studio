// Layout-aware text assembly from PDF.js text items. Pure functions (no DOM,
// no PDF.js) so they can be unit-tested in Node.
//
// Pipeline per book:
//   pageLines(items, view)  -> ordered lines for one page (handles 2 columns)
//   removeRunningLines(all) -> drops running headers/footers and page numbers
//   linesToText(lines)      -> paragraphs, headings, footnotes moved to the end

export const EXTRACT_VERSION = 2;

const median = xs => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function weightedMedianSize(lines) {
  const s = [...lines].sort((a, b) => a.size - b.size);
  const total = s.reduce((n, l) => n + l.text.length, 0);
  let acc = 0;
  for (const l of s) {
    acc += l.text.length;
    if (acc >= total / 2) return l.size;
  }
  return s[s.length - 1]?.size || 10;
}

// items: PDF.js TextContent items. view: page.view = [x0, y0, x1, y1] in PDF units.
export function pageLines(items, view = [0, 0, 612, 792]) {
  const [vx0, vy0, vx1, vy1] = view;
  const W = vx1 - vx0, H = vy1 - vy0;
  const its = [];
  for (const it of items || []) {
    if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue;
    const t = it.transform;
    const size = Math.hypot(t[2], t[3]) || it.height || 10;
    its.push({ str: it.str, x: t[4] - vx0, y: t[5] - vy0, w: it.width > 0 ? it.width : it.str.length * size * 0.5, size });
  }
  if (!its.length) return [];

  // 1. Rows: items sharing a baseline (tolerant of superscripts).
  its.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const it of its) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(r.y - it.y) <= Math.max(r.size, it.size) * 0.5) {
      r.items.push(it);
      if (it.size > r.size) { r.size = it.size; r.y = it.y; }
    } else rows.push({ y: it.y, size: it.size, items: [it] });
  }

  // 2. Segments: runs within a row, split at wide horizontal gaps (column gutters).
  const segs = [];
  rows.forEach((r, ri) => {
    r.items.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const it of r.items) {
      const gap = cur ? it.x - cur.x1 : 0;
      if (cur && gap <= Math.max(cur.maxSize, it.size) * 1.6) {
        if (gap > Math.min(cur.maxSize, it.size) * 0.12 && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) cur.text += ' ';
        cur.text += it.str;
        cur.x1 = Math.max(cur.x1, it.x + it.w);
        cur.sizeSum += it.size * it.str.length;
        cur.chars += it.str.length;
        cur.maxSize = Math.max(cur.maxSize, it.size);
      } else {
        cur = { x0: it.x, x1: it.x + it.w, y: r.y, row: ri, text: it.str, sizeSum: it.size * it.str.length, chars: it.str.length, maxSize: it.size };
        segs.push(cur);
      }
    }
  });
  for (const s of segs) {
    s.size = s.sizeSum / Math.max(1, s.chars);
    s.text = s.text.replace(/\s+/g, ' ').trim();
  }

  // 3. Column detection.
  const mid = W / 2, tol = W * 0.03;
  let nL = 0, nR = 0;
  for (const s of segs) {
    s.col = s.x1 <= mid + tol && s.x0 < mid ? 'L' : s.x0 >= mid - tol ? 'R' : 'S';
    if (s.col === 'L') nL++; else if (s.col === 'R') nR++;
  }
  const twoCol = nL >= 3 && nR >= 3 && nL + nR >= 0.6 * segs.length;

  let ordered = [];
  if (!twoCol) {
    // Single column: re-join the segments of each row into one line.
    let line = null;
    for (const s of segs) {
      if (line && line.row === s.row) {
        line.text += ' ' + s.text;
        line.x1 = Math.max(line.x1, s.x1);
        line.size = (line.size * line.n + s.size) / (line.n + 1);
        line.n++;
      } else {
        line = { ...s, col: 'S', n: 1 };
        ordered.push(line);
      }
    }
  } else {
    // Two columns: read left column then right, block by block; full-width
    // lines (titles, wide captions) separate the blocks.
    let L = [], R = [];
    const flush = () => { ordered.push(...L, ...R); L = []; R = []; };
    for (const s of segs) {
      if (s.col === 'S') { flush(); ordered.push(s); }
      else (s.col === 'L' ? L : R).push(s);
    }
    flush();
  }

  return ordered.map(s => {
    const yr = s.y / H;
    return { text: s.text, x0: s.x0, x1: s.x1, y: s.y, yr, size: s.size, col: s.col, edge: yr > 0.9 ? 'top' : yr < 0.1 ? 'bottom' : null };
  });
}

const PAGE_NUMBER = /^\s*(?:page\s*)?(?:\d{1,4}|[ivxlcdm]{1,6})\s*$/i;

export function removeRunningLines(pages) {
  const key = t => t.toLowerCase().replace(/\d+/g, '#').replace(/[^\p{L}#]+/gu, ' ').trim();
  const counts = new Map();
  for (const lines of pages) {
    const seen = new Set();
    for (const l of lines) {
      if (!l.edge) continue;
      const k = key(l.text);
      if (k && !seen.has(k)) { seen.add(k); counts.set(k, (counts.get(k) || 0) + 1); }
    }
  }
  const min = Math.max(3, Math.ceil(pages.length * 0.2));
  return pages.map(lines => lines.filter(l => {
    if (!l.edge) return true;
    if (PAGE_NUMBER.test(l.text)) return false;
    const k = key(l.text);
    return !(k && (counts.get(k) || 0) >= min);
  }));
}

const ENDS_SENTENCE = /[.!?:"”’)]$/;

function joinLine(a, b) {
  if (/\p{L}-$/u.test(a) && /^\p{Ll}/u.test(b)) return a.slice(0, -1) + b;
  return a + ' ' + b;
}

export function linesToText(lines) {
  if (!lines?.length) return '';
  const body = weightedMedianSize(lines);
  const isBody = l => Math.abs(l.size - body) <= body * 0.1;
  const bodyLines = lines.filter(isBody);

  const typW = {}, colLeft = {};
  for (const col of ['L', 'R', 'S']) {
    const ls = bodyLines.filter(l => l.col === col);
    if (!ls.length) continue;
    typW[col] = median(ls.map(l => l.x1 - l.x0));
    const xs = ls.map(l => l.x0).sort((a, b) => a - b);
    colLeft[col] = xs[Math.floor(xs.length * 0.1)];
  }
  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i - 1], l = lines[i];
    if (p.col === l.col && isBody(p) && isBody(l) && p.y > l.y && p.y - l.y < body * 3) gaps.push(p.y - l.y);
  }
  const lead = median(gaps) || body * 1.2;

  const isNote = l => l.size < body * 0.86 && l.yr < 0.4 && l.text.length > 2;
  const out = [], notes = [];
  let para = null, note = null;

  for (const l of lines) {
    if (isNote(l)) {
      const startsNote = /^(?:\d{1,3}|[*†‡§])\.?\s?\S/.test(l.text);
      if (!note || startsNote) { if (note) notes.push(note.text); note = { text: l.text }; }
      else note.text = joinLine(note.text, l.text);
      continue;
    }
    const kind = l.size >= body * 1.15 ? 'h' : 'b';
    let brk = !para;
    if (para) {
      const p = para.last;
      const sameCol = p.col === l.col;
      if (kind !== para.kind || Math.abs(l.size - p.size) > body * 0.15) brk = true;
      else if (kind === 'h') brk = p.y - l.y > lead * 2.2;
      else {
        if (sameCol && p.y > l.y && p.y - l.y > lead * 1.5) brk = true;
        else if (sameCol && p.y < l.y) brk = ENDS_SENTENCE.test(p.text);
        if (!brk && ENDS_SENTENCE.test(p.text)) {
          if (p.x1 - p.x0 < (typW[p.col] || typW.S || Infinity) * 0.8) brk = true;
          else if (colLeft[l.col] !== undefined && l.x0 > colLeft[l.col] + l.size * 0.8) brk = true;
        }
      }
    }
    if (brk) {
      if (para) out.push(para.text);
      para = { kind, text: l.text, last: l };
    } else {
      para.text = joinLine(para.text, l.text);
      para.last = l;
    }
  }
  if (para) out.push(para.text);
  if (note) notes.push(note.text);
  return [...out, ...notes.map(n => 'Note: ' + n)].join('\n\n').normalize('NFKC');
}
