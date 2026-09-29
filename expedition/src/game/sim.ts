import type { Bond, GameEvent, LevelDef, Residue, Snapshot, Vec } from './types';

/**
 * A deliberately simple 2D chain model:
 *  - verlet integration with fixed-length links (the backbone)
 *  - a bond-angle limit (i, i+2 can't overlap) and excluded volume
 *  - opposite charges attract, like charges repel, hydrophobic residues cluster
 *  - close complementary pairs "snap" into bonds that hold until pulled apart
 * It is a toy, not a molecular dynamics engine — see the "What is simplified" copy.
 */

export const LINK = 34; // backbone link length (world units)
export const NODE_R = 13;
const MIN_SEQ_GAP = 3; // residues this far apart along the chain can interact
const ATTRACT_RANGE = LINK * 3.2;
const REPEL_RANGE = LINK * 2.4;
const BOND_FORM = LINK * 1.3;
const BOND_BREAK = LINK * 2.3;
const DAMPING = 0.86;
const COMPLETE_HOLD = 1.1; // seconds the goal must hold

const capacity: Record<Residue, number> = { H: 2, P: 0, '+': 1, '-': 1 };

export function affinity(a: Residue, b: Residue): number {
  if ((a === '+' && b === '-') || (a === '-' && b === '+')) return 1;
  if (a === 'H' && b === 'H') return 0.7;
  if ((a === '+' && b === '+') || (a === '-' && b === '-')) return -1;
  return 0;
}

export function bondEnergy(a: Residue): number {
  return a === 'H' ? -1 : -1.5;
}

interface Node extends Vec {
  px: number;
  py: number;
}

export class FoldSim {
  readonly level: LevelDef;
  readonly types: Residue[];
  nodes: Node[] = [];
  bonds: Bond[] = [];
  dragged = -1;
  dragTarget: Vec = { x: 0, y: 0 };
  holdTime = 0;
  complete = false;
  time = 0;
  /** Recent repulsion strength per pair key, for drawing. */
  repulsions = new Map<string, number>();
  private events: GameEvent[] = [];
  private repelCooldown = 0;

  constructor(level: LevelDef) {
    this.level = level;
    this.types = level.chain;
    this.reset();
  }

  reset() {
    this.nodes = initialLayout(this.level).map((p) => ({ x: p.x, y: p.y, px: p.x, py: p.y }));
    this.bonds = [];
    this.dragged = -1;
    this.holdTime = 0;
    this.complete = false;
    this.time = 0;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  pick(p: Vec, radius: number): number {
    let best = -1;
    let bestD = radius * radius;
    this.nodes.forEach((n, i) => {
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  grab(i: number, p: Vec) {
    this.dragged = i;
    this.dragTarget = { ...p };
  }

  moveTo(p: Vec) {
    this.dragTarget = { ...p };
  }

  release() {
    this.dragged = -1;
  }

  bondedTo(i: number): number[] {
    const out: number[] = [];
    for (const b of this.bonds) {
      if (b.a === i) out.push(b.b);
      else if (b.b === i) out.push(b.a);
    }
    return out;
  }

  isTarget(a: number, b: number): boolean {
    const t = this.level.targetContacts;
    if (!t) return true;
    return t.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  }

  step(dt: number) {
    if (dt <= 0) return;
    this.time += dt;
    const n = this.nodes;
    const { w, h } = this.level.arena;
    const settle = this.complete ? 0.4 : 1;

    // 1. integrate with forces
    const fx = new Float32Array(n.length);
    const fy = new Float32Array(n.length);
    this.repulsions.clear();
    for (let i = 0; i < n.length; i++) {
      for (let j = i + MIN_SEQ_GAP - 1; j < n.length; j++) {
        if (j - i < 2) continue;
        const aff = affinity(this.types[i], this.types[j]);
        if (aff === 0) continue;
        if (aff > 0 && j - i < MIN_SEQ_GAP) continue;
        const dx = n[j].x - n[i].x;
        const dy = n[j].y - n[i].y;
        const r = Math.hypot(dx, dy) || 1;
        const range = aff > 0 ? ATTRACT_RANGE : REPEL_RANGE;
        if (r > range) continue;
        const fall = 1 - r / range;
        // attraction pulls together, repulsion pushes apart
        const k = aff > 0 ? 0.55 * aff * fall : -0.9 * fall * fall;
        const ux = dx / r;
        const uy = dy / r;
        fx[i] += ux * k;
        fy[i] += uy * k;
        fx[j] -= ux * k;
        fy[j] -= uy * k;
        if (aff < 0) this.repulsions.set(`${i}-${j}`, fall);
      }
    }

    for (let i = 0; i < n.length; i++) {
      const p = n[i];
      if (i === this.dragged) {
        p.px = p.x;
        p.py = p.y;
        p.x += (this.dragTarget.x - p.x) * 0.55;
        p.y += (this.dragTarget.y - p.y) * 0.55;
        continue;
      }
      const vx = (p.x - p.px) * DAMPING;
      const vy = (p.y - p.py) * DAMPING;
      p.px = p.x;
      p.py = p.y;
      // gentle thermal motion keeps the chain feeling alive
      const jitter = this.complete ? 0.02 : 0.08;
      p.x += vx + fx[i] * settle + (Math.random() - 0.5) * jitter;
      p.y += vy + fy[i] * settle + (Math.random() - 0.5) * jitter;
    }

    // 2. constraints
    for (let iter = 0; iter < 10; iter++) {
      for (let i = 0; i < n.length - 1; i++) this.solveDistance(i, i + 1, LINK, 1, 'exact');
      for (let i = 0; i < n.length - 2; i++) this.solveDistance(i, i + 2, LINK * 1.15, 0.6, 'min');
      for (let i = 0; i < n.length; i++)
        for (let j = i + 3; j < n.length; j++) this.solveDistance(i, j, NODE_R * 2.1, 0.8, 'min');
      for (const b of this.bonds) this.solveDistance(b.a, b.b, LINK * 0.95, 0.25, 'exact');
      for (const o of this.level.obstacles ?? []) {
        for (let i = 0; i < n.length; i++) {
          const dx = n[i].x - o.x;
          const dy = n[i].y - o.y;
          const r = Math.hypot(dx, dy) || 1;
          const min = o.r + NODE_R;
          if (r < min) {
            n[i].x = o.x + (dx / r) * min;
            n[i].y = o.y + (dy / r) * min;
          }
        }
      }
      for (const p of n) {
        p.x = Math.min(w - NODE_R, Math.max(NODE_R, p.x));
        p.y = Math.min(h - NODE_R, Math.max(NODE_R, p.y));
      }
    }

    // 3. bonds form and break
    for (const b of this.bonds) b.age += dt;
    this.bonds = this.bonds.filter((b) => {
      const r = dist(n[b.a], n[b.b]);
      if (r > BOND_BREAK) {
        this.events.push({ kind: 'break', a: b.a, b: b.b });
        return false;
      }
      return true;
    });
    for (let i = 0; i < n.length; i++) {
      for (let j = i + MIN_SEQ_GAP; j < n.length; j++) {
        if (affinity(this.types[i], this.types[j]) <= 0) continue;
        if (this.bonds.some((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i))) continue;
        if (this.bondedTo(i).length >= capacity[this.types[i]]) continue;
        if (this.bondedTo(j).length >= capacity[this.types[j]]) continue;
        if (dist(n[i], n[j]) < BOND_FORM) {
          this.bonds.push({ a: i, b: j, age: 0 });
          const target = this.isTarget(i, j);
          this.events.push({ kind: target ? 'bond' : 'misfold', a: i, b: j });
        }
      }
    }

    this.repelCooldown -= dt;
    if (this.repelCooldown <= 0) {
      for (const [key, s] of this.repulsions) {
        if (s > 0.55) {
          const [a, b] = key.split('-').map(Number);
          this.events.push({ kind: 'repel', a, b });
          this.repelCooldown = 1.2;
          break;
        }
      }
    }

    // 4. completion
    const snap = this.snapshot();
    if (!this.complete) {
      this.holdTime = snap.goalMet && this.dragged < 0 ? this.holdTime + dt : 0;
      if (this.holdTime >= COMPLETE_HOLD) {
        this.complete = true;
        this.events.push({ kind: 'complete' });
      }
    }
  }

  snapshot(): Snapshot {
    const n = this.nodes;
    let energy = 0;
    let matched = 0;
    let misfolds = 0;
    for (const b of this.bonds) {
      energy += bondEnergy(this.types[b.a]);
      if (this.level.targetContacts) {
        if (this.isTarget(b.a, b.b)) matched++;
        else misfolds++;
      }
    }
    // like charges held close together cost energy
    for (let i = 0; i < n.length; i++)
      for (let j = i + 2; j < n.length; j++) {
        if (affinity(this.types[i], this.types[j]) >= 0) continue;
        const r = dist(n[i], n[j]);
        if (r < LINK * 2) energy += 1.2 * (1 - r / (LINK * 2));
      }
    const stability = Math.max(0, Math.min(1, energy / this.level.targetEnergy));
    const goalMet = this.level.targetContacts
      ? matched === this.level.targetContacts.length
      : this.bonds.length >= (this.level.requiredBonds ?? 1);
    return { energy, stability, bonds: this.bonds.length, matched, misfolds, goalMet, complete: this.complete };
  }

  private solveDistance(i: number, j: number, target: number, stiffness: number, mode: 'exact' | 'min') {
    const a = this.nodes[i];
    const b = this.nodes[j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const r = Math.hypot(dx, dy) || 0.0001;
    if (mode === 'min' && r >= target) return;
    const diff = ((r - target) / r) * stiffness;
    const wa = i === this.dragged ? 0 : j === this.dragged ? 1 : 0.5;
    const wb = j === this.dragged ? 0 : i === this.dragged ? 1 : 0.5;
    a.x += dx * diff * wa;
    a.y += dy * diff * wa;
    b.x -= dx * diff * wb;
    b.y -= dy * diff * wb;
  }
}

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Lay the chain out along an open sine wave that spans the arena width, so it
 * starts untangled with no accidental contacts. Longer chains get a taller wave.
 */
export function initialLayout(level: LevelDef): Vec[] {
  const { w, h } = level.arena;
  const count = level.chain.length;
  const span = w - 64;
  const k = (2 * Math.PI) / 150;
  const place = (amp: number): Vec[] => {
    const pts: Vec[] = [{ x: 0, y: 0 }];
    let x = 0;
    let y = 0;
    let travelled = 0;
    while (pts.length < count && x < span * 3) {
      const nx = x + 0.5;
      const ny = amp * Math.sin(k * nx);
      travelled += Math.hypot(nx - x, ny - y);
      x = nx;
      y = ny;
      if (travelled >= LINK) {
        pts.push({ x, y });
        travelled = 0;
      }
    }
    return pts;
  };
  let lo = 0;
  let hi = 90;
  let pts = place(hi);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const cand = place(mid);
    if (cand[cand.length - 1].x > span) lo = mid;
    else {
      hi = mid;
      pts = cand;
    }
  }
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const oy = h * (level.obstacles?.length ? 0.8 : 0.58);
  const ox = (w - (maxX - minX)) / 2 - minX;
  return pts.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}
