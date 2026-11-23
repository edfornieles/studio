import test from 'node:test';
import assert from 'node:assert/strict';
import { makeChunks, chunkAt } from '../js/chunks.js';
import { pageLines, removeRunningLines, linesToText } from '../js/extract.js';

// Build a fake PDF.js text item.
const item = (str, x, y, size = 10, width = str.length * size * 0.5) => ({ str, transform: [size, 0, 0, size, x, y], width, height: size });

test('chunks split sentences but not abbreviations or initials', () => {
  const t = 'See p. 12 and e.g. Dr. Smith. J. Cage wrote Silence. It was 1961!\nNew paragraph here.';
  const c = makeChunks(t).map(x => x.text);
  assert.deepEqual(c, ['See p. 12 and e.g. Dr. Smith.', 'J. Cage wrote Silence.', 'It was 1961!', 'New paragraph here.']);
});

test('chunk offsets map back into the source text', () => {
  const t = 'One. Two two.\n\nThree three three.';
  for (const c of makeChunks(t)) assert.equal(t.slice(c.start, c.end), c.text);
  assert.equal(chunkAt(makeChunks(t), t.indexOf('Three')), 2);
});

test('long sentences are split near a comma', () => {
  const t = ('word '.repeat(30) + ', ' + 'more '.repeat(40)).trim() + '.';
  const c = makeChunks(t, 240);
  assert.ok(c.length >= 2);
  assert.ok(c.every(x => x.text.length <= 240));
});

test('two-column page reads left column before right column', () => {
  const items = [item('A Title Across The Page', 150, 740, 16, 300)];
  let y = 700;
  for (let i = 0; i < 8; i++, y -= 12) {
    items.push(item(`left ${i} text`, 50, y, 10, 230));
    items.push(item(`right ${i} text`, 320, y, 10, 230));
  }
  const text = linesToText(pageLines(items, [0, 0, 612, 792]));
  assert.ok(text.startsWith('A Title Across The Page'));
  assert.ok(text.indexOf('left 7') < text.indexOf('right 0'), text);
});

test('single-column lines join into paragraphs with de-hyphenation', () => {
  const items = [
    item('The composer described the experi-', 72, 700, 10, 460),
    item('ence of listening as an act of atten-', 72, 688, 10, 460),
    item('tion to sound itself.', 72, 676, 10, 100),
    item('A second paragraph starts after a gap.', 72, 650, 10, 460),
  ];
  const text = linesToText(pageLines(items));
  assert.equal(text, 'The composer described the experience of listening as an act of attention to sound itself.\n\nA second paragraph starts after a gap.');
});

test('running headers and page numbers are removed', () => {
  const page = n => pageLines([
    item('MUSIC OF THE AVANT-GARDE ' + n, 72, 760, 9, 300),
    item('Body text on page ' + n + ' continues.', 72, 600, 10, 460),
    item(String(n), 300, 40, 9, 10),
  ]);
  const pages = removeRunningLines([1, 2, 3, 4].map(page)).map(linesToText);
  assert.deepEqual(pages, [1, 2, 3, 4].map(n => `Body text on page ${n} continues.`));
});

test('small text at the bottom becomes a note after the body', () => {
  const items = [
    item('Main body sentence one is here and long enough.', 72, 700, 10, 460),
    item('Main body sentence two continues the paragraph.', 72, 688, 10, 460),
    item('1 A footnote in smaller type.', 72, 120, 7, 200),
  ];
  const text = linesToText(pageLines(items));
  assert.ok(text.endsWith('Note: 1 A footnote in smaller type.'), text);
});
