import { useEffect, useRef } from 'react';
import { FoldSim, LINK, NODE_R, affinity } from './sim';
import type { GameEvent, LevelDef, Residue, Snapshot } from './types';

export const RESIDUE_COLORS: Record<Residue, string> = {
  '+': '#ff8a5b',
  '-': '#5cc8ff',
  H: '#6fe3a1',
  P: '#4f5d74',
};

const TARGET_SHAPES = ['circle', 'diamond', 'triangle', 'square'] as const;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
}

interface Props {
  level: LevelDef;
  resetKey: number;
  hint: [number, number] | null;
  onSnapshot: (s: Snapshot) => void;
  onEvent: (e: GameEvent) => void;
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function FoldCanvas({ level, resetKey, hint, onSnapshot, onEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<FoldSim | null>(null);
  const hintRef = useRef<{ pair: [number, number]; t: number } | null>(null);
  const cbRef = useRef({ onSnapshot, onEvent });
  cbRef.current = { onSnapshot, onEvent };

  useEffect(() => {
    if (hint) hintRef.current = { pair: hint, t: 0 };
  }, [hint]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const sim = new FoldSim(level);
    simRef.current = sim;
    if (location.search.includes('debug')) (window as unknown as { __fold: FoldSim }).__fold = sim;
    const particles: Particle[] = [];
    const pulses: { x: number; y: number; t: number; color: string }[] = [];
    const lowMotion = reducedMotion();
    let completeFlash = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let snapTimer = 0;
    let view = { s: 1, ox: 0, oy: 0, dpr: 1 };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const s = Math.min(rect.width / level.arena.w, rect.height / level.arena.h);
      view = { s, ox: (rect.width - level.arena.w * s) / 2, oy: (rect.height - level.arena.h * s) / 2, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const toWorld = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left - view.ox) / view.s, y: (e.clientY - rect.top - view.oy) / view.s };
    };

    const burst = (x: number, y: number, color: string, count: number, speed = 2.2) => {
      if (lowMotion) count = Math.ceil(count / 4);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random());
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.6 + Math.random() * 0.6, color });
      }
    };

    const down = (e: PointerEvent) => {
      if (sim.complete) return;
      const p = toWorld(e);
      // generous hit radius for fingers: ~34px on a typical phone
      const i = sim.pick(p, Math.max(30, 34 / view.s));
      if (i >= 0) {
        sim.grab(i, p);
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };
    const move = (e: PointerEvent) => {
      if (sim.dragged >= 0) sim.moveTo(toWorld(e));
    };
    const up = (e: PointerEvent) => {
      if (sim.dragged >= 0) {
        sim.release();
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      }
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 3) {
        sim.step(1 / 60);
        acc -= 1 / 60;
        steps++;
      }
      if (steps === 3) acc = 0;

      for (const ev of sim.drainEvents()) {
        const a = ev.a !== undefined ? sim.nodes[ev.a] : null;
        const b = ev.b !== undefined ? sim.nodes[ev.b] : null;
        const mid = a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
        if (ev.kind === 'bond' && mid) {
          pulses.push({ ...mid, t: 0, color: '#ffc46b' });
          burst(mid.x, mid.y, '#ffc46b', 14);
          navigator.vibrate?.(12);
        } else if (ev.kind === 'misfold' && mid) {
          pulses.push({ ...mid, t: 0, color: '#ff6b6b' });
        } else if (ev.kind === 'complete') {
          completeFlash = 1;
          sim.nodes.forEach((n) => burst(n.x, n.y, RESIDUE_COLORS[sim.types[sim.nodes.indexOf(n)]], 6, 3));
          navigator.vibrate?.([20, 40, 30]);
        }
        cbRef.current.onEvent(ev);
      }

      snapTimer -= dt;
      if (snapTimer <= 0) {
        cbRef.current.onSnapshot(sim.snapshot());
        snapTimer = 0.1;
      }

      for (const p of particles) {
        p.life += dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life > particles[i].max) particles.splice(i, 1);
      for (const p of pulses) p.t += dt;
      for (let i = pulses.length - 1; i >= 0; i--) if (pulses[i].t > 0.7) pulses.splice(i, 1);
      if (hintRef.current) {
        hintRef.current.t += dt;
        if (hintRef.current.t > 4) hintRef.current = null;
      }
      completeFlash = Math.max(0, completeFlash - dt * 0.8);

      draw(ctx, sim, view, particles, pulses, hintRef.current, completeFlash, now / 1000);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
  }, [level, resetKey]);

  return <canvas ref={canvasRef} className="fold-canvas" aria-label={`Folding arena: ${level.goal}`} role="img" />;
}

function draw(
  ctx: CanvasRenderingContext2D,
  sim: FoldSim,
  view: { s: number; ox: number; oy: number; dpr: number },
  particles: Particle[],
  pulses: { x: number; y: number; t: number; color: string }[],
  hint: { pair: [number, number]; t: number } | null,
  flash: number,
  t: number,
) {
  const { s, ox, oy, dpr } = view;
  const { w, h } = sim.level.arena;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);

  // arena: faint measurement grid, like a microscope slide
  ctx.fillStyle = 'rgba(111, 227, 161, 0.025)';
  roundRect(ctx, 0, 0, w, h, 18);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 190, 220, 0.16)';
  for (let x = 20; x < w; x += 30) for (let y = 20; y < h; y += 30) ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
  ctx.strokeStyle = 'rgba(160, 190, 220, 0.14)';
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 18);
  ctx.stroke();

  // obstacles
  for (const o of sim.level.obstacles ?? []) {
    const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, o.r * 0.1, o.x, o.y, o.r);
    g.addColorStop(0, '#1d2a3d');
    g.addColorStop(1, '#0b121c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = 'rgba(140, 170, 210, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    if (o.label) {
      ctx.fillStyle = 'rgba(190, 210, 235, 0.75)';
      ctx.font = '500 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(o.label.toUpperCase(), o.x, o.y + 4);
    }
  }

  const n = sim.nodes;
  const types = sim.types;
  const bonded = new Set(sim.bonds.map((b) => `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`));

  // attraction hints: faint dotted "pull" lines between compatible residues
  ctx.lineWidth = 1.5;
  for (let i = 0; i < n.length; i++)
    for (let j = i + 3; j < n.length; j++) {
      if (affinity(types[i], types[j]) <= 0 || bonded.has(`${i}-${j}`)) continue;
      const r = Math.hypot(n[i].x - n[j].x, n[i].y - n[j].y);
      const range = LINK * 3.2;
      if (r > range) continue;
      const a = (1 - r / range) * 0.6;
      ctx.strokeStyle = `rgba(255, 196, 107, ${a})`;
      ctx.setLineDash([2, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.moveTo(n[i].x, n[i].y);
      ctx.lineTo(n[j].x, n[j].y);
      ctx.stroke();
    }
  ctx.setLineDash([]);

  // repulsion: pulsing red ripples between like charges
  for (const [key, fall] of sim.repulsions) {
    if (fall < 0.25) continue;
    const [i, j] = key.split('-').map(Number);
    const mx = (n[i].x + n[j].x) / 2;
    const my = (n[i].y + n[j].y) / 2;
    const ph = (t * 2.4) % 1;
    ctx.strokeStyle = `rgba(255, 107, 107, ${fall * (1 - ph) * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 6 + ph * 16, 0, Math.PI * 2);
    ctx.stroke();
  }

  // backbone
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1f2d42';
  ctx.lineWidth = 9;
  path(ctx, n);
  ctx.stroke();
  ctx.strokeStyle = flash > 0 ? `rgba(255, 196, 107, ${0.4 + flash * 0.6})` : 'rgba(150, 180, 220, 0.55)';
  ctx.lineWidth = 2.5;
  path(ctx, n);
  ctx.stroke();

  // bonds
  for (const b of sim.bonds) {
    const A = n[b.a];
    const B = n[b.b];
    const wrong = !sim.isTarget(b.a, b.b);
    const col = wrong ? '255, 107, 107' : types[b.a] === 'H' ? '111, 227, 161' : '255, 196, 107';
    const glow = 0.25 + 0.15 * Math.sin(t * 4 + b.a);
    ctx.strokeStyle = `rgba(${col}, ${glow})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${col}, 0.95)`;
    ctx.lineWidth = 3;
    if (wrong) ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const p of pulses) {
    const k = p.t / 0.7;
    ctx.strokeStyle = hexA(p.color, 1 - k);
    ctx.lineWidth = 3 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8 + k * 42, 0, Math.PI * 2);
    ctx.stroke();
  }

  // hint rings
  if (hint) {
    const a = 0.5 + 0.5 * Math.sin(hint.t * 6);
    for (const i of hint.pair) {
      ctx.strokeStyle = `rgba(255, 196, 107, ${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(n[i].x, n[i].y, NODE_R + 10 + a * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // target contact markers (level 3)
  (sim.level.targetContacts ?? []).forEach(([a, b], k) => {
    const done = bonded.has(`${Math.min(a, b)}-${Math.max(a, b)}`);
    for (const i of [a, b]) {
      ctx.strokeStyle = done ? '#ffc46b' : 'rgba(235, 242, 250, 0.85)';
      ctx.lineWidth = 2;
      shape(ctx, TARGET_SHAPES[k % TARGET_SHAPES.length], n[i].x, n[i].y, NODE_R + 8);
      ctx.stroke();
    }
  });

  // residues
  n.forEach((p, i) => {
    const c = RESIDUE_COLORS[types[i]];
    const r = NODE_R * (i === sim.dragged ? 1.15 : 1);
    if (types[i] !== 'P') {
      ctx.fillStyle = hexA(c, 0.16 + flash * 0.3);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, lighten(c));
    g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    glyph(ctx, types[i], p.x, p.y);
    if (i === sim.dragged) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  for (const p of particles) {
    const k = 1 - p.life / p.max;
    ctx.fillStyle = hexA(p.color, k);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2 * k + 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function glyph(ctx: CanvasRenderingContext2D, type: Residue, x: number, y: number) {
  ctx.strokeStyle = '#0a0f16';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (type === '+' || type === '-') {
    ctx.moveTo(x - 5.5, y);
    ctx.lineTo(x + 5.5, y);
    if (type === '+') {
      ctx.moveTo(x, y - 5.5);
      ctx.lineTo(x, y + 5.5);
    }
    ctx.stroke();
  } else if (type === 'H') {
    // small hexagon: the "oily" residue
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6;
      const px = x + Math.cos(a) * 5.5;
      const py = y + Math.sin(a) * 5.5;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(200, 215, 235, 0.35)';
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shape(ctx: CanvasRenderingContext2D, kind: (typeof TARGET_SHAPES)[number], x: number, y: number, r: number) {
  ctx.beginPath();
  if (kind === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else {
    const sides = kind === 'triangle' ? 3 : 4;
    const rot = kind === 'square' ? Math.PI / 4 : -Math.PI / 2;
    const rr = kind === 'triangle' ? r * 1.25 : r * 1.12;
    for (let k = 0; k <= sides; k++) {
      const a = rot + (Math.PI * 2 * k) / sides;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
}

function path(ctx: CanvasRenderingContext2D, n: { x: number; y: number }[]) {
  ctx.beginPath();
  ctx.moveTo(n[0].x, n[0].y);
  for (let i = 1; i < n.length - 1; i++) {
    const mx = (n[i].x + n[i + 1].x) / 2;
    const my = (n[i].y + n[i + 1].y) / 2;
    ctx.quadraticCurveTo(n[i].x, n[i].y, mx, my);
  }
  ctx.lineTo(n[n.length - 1].x, n[n.length - 1].y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex: string, a: number) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${Math.max(0, Math.min(1, a))})`;
}

function lighten(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const m = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.45));
  return `rgb(${m((v >> 16) & 255)}, ${m((v >> 8) & 255)}, ${m(v & 255)})`;
}
