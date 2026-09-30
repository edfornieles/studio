import { RAY_PATHS_FOR_SHARE } from './sparkPaths';

export interface ShareInput {
  title: string;
  lines: string[];
  footer: string;
}

/** Draw a portrait share card, then share it, or return it for display. */
export interface ShareResult {
  status: 'shared' | 'show' | 'failed';
  url?: string;
  text: string;
}

export async function shareCard(input: ShareInput): Promise<ShareResult> {
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 1350);
  g.addColorStop(0, '#07101a');
  g.addColorStop(1, '#030507');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = 'rgba(160,190,220,0.12)';
  for (let x = 40; x < 1080; x += 60) for (let y = 40; y < 1350; y += 60) ctx.fillRect(x, y, 3, 3);

  // folded chain motif
  const pts = [[300, 520], [360, 460], [440, 450], [500, 510], [480, 590], [400, 620], [340, 690], [380, 770], [470, 780], [540, 720], [600, 650], [680, 640], [740, 700]];
  ctx.strokeStyle = 'rgba(150,180,220,0.6)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  const cols = ['#ff8a5b', '#4f5d74', '#6fe3a1', '#4f5d74', '#5cc8ff'];
  pts.forEach(([x, y], i) => {
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = '#ffc46b';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(300, 520);
  ctx.lineTo(400, 620);
  ctx.stroke();

  // Strandy spark
  ctx.save();
  ctx.translate(860, 300);
  ctx.scale(0.62, 0.62);
  ctx.fillStyle = '#D97757';
  for (const d of RAY_PATHS_FOR_SHARE) ctx.fill(new Path2D(d));
  ctx.beginPath();
  ctx.arc(0, 0, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141413';
  for (const x of [-27, 25]) {
    ctx.beginPath();
    ctx.ellipse(x, -6, 9, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#9fb0c3';
  ctx.font = '500 30px "IBM Plex Mono", monospace';
  ctx.fillText('CLAUDE FIELD SCIENCE · EP.01', 80, 120);
  ctx.fillStyle = '#e8eef5';
  ctx.font = '600 76px Fraunces, Georgia, serif';
  wrap(ctx, input.title, 80, 930, 920, 88);
  ctx.font = '400 36px system-ui, sans-serif';
  ctx.fillStyle = '#c5d2e0';
  input.lines.forEach((l, i) => ctx.fillText(l, 80, 1130 + i * 52));
  ctx.fillStyle = '#ffc46b';
  ctx.font = '500 28px "IBM Plex Mono", monospace';
  ctx.fillText(input.footer, 80, 1290);

  const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/png'));
  const text = `${input.title}\n${input.lines.join('\n')}\n${input.footer}`;
  if (!blob) return { status: 'failed', text };
  const url = URL.createObjectURL(blob);
  const file = new File([blob], 'folding-expedition.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return { status: 'shared', url, text };
    }
  } catch {
    /* share refused or cancelled: fall through to showing the card */
  }
  // Show the card in the page; people save it with a long-press or right-click.
  return { status: 'show', url, text };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = '';
  let yy = y;
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}
