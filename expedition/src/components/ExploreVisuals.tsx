import { useState } from 'react';
import { RESIDUE_COLORS } from '../game/FoldCanvas';
import type { Residue } from '../game/types';
import type { ExploreVisual } from '../worlds/proteins/explore';
import { Icon } from './Icon';

const PALETTE: Residue[] = ['+', 'P', 'H', '-', 'P', 'H', '+', 'P', '-', 'H', 'P', '+', 'H', '-'];

function Bead({ x, y, type, r = 11, glow = false }: { x: number; y: number; type: Residue; r?: number; glow?: boolean }) {
  return (
    <g className="ev-bead" style={{ transform: `translate(${x}px, ${y}px)` }}>
      {glow && <circle r={r * 2} fill={RESIDUE_COLORS[type]} opacity={0.22} className="ev-pulse" />}
      <circle r={r} fill={RESIDUE_COLORS[type]} />
    </g>
  );
}

function Backbone({ pts }: { pts: [number, number][] }) {
  return <polyline points={pts.map((p) => p.join(',')).join(' ')} className="ev-backbone" />;
}

/** 01 — tap to grow the chain */
function ChainVisual() {
  const [count, setCount] = useState(5);
  const pts: [number, number][] = Array.from({ length: count }, (_, i) => [24 + i * 22, 70 + Math.sin(i * 0.9) * 16]);
  return (
    <button className="ev-frame ev-tap" onClick={() => setCount((c) => (c >= 14 ? 5 : c + 1))} aria-label={`Chain of ${count} amino acids. Tap to add one.`}>
      <svg viewBox="0 0 330 140">
        <Backbone pts={pts} />
        {pts.map(([x, y], i) => (
          <Bead key={i} x={x} y={y} type={PALETTE[i]} />
        ))}
      </svg>
      <span className="ev-caption">{count} amino acids · real proteins often have hundreds</span>
    </button>
  );
}

const STRAIGHT: [number, number][] = Array.from({ length: 12 }, (_, i) => [30 + i * 25, 90]);
const FOLD: [number, number][] = [
  [120, 40], [146, 30], [172, 42], [182, 68], [168, 92], [142, 98],
  [118, 110], [106, 134], [124, 154], [152, 156], [178, 146], [196, 126],
];
const lerp = (a: [number, number][], b: [number, number][], t: number): [number, number][] => a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);

/** 02 — slider folds the chain */
function FoldVisual() {
  const [t, setT] = useState(0.1);
  const pts = lerp(STRAIGHT, FOLD, t);
  return (
    <div className="ev-frame">
      <svg viewBox="0 0 330 180">
        <Backbone pts={pts} />
        {t > 0.95 && <line x1={pts[2][0]} y1={pts[2][1]} x2={pts[5][0]} y2={pts[5][1]} className="ev-bond" />}
        {pts.map(([x, y], i) => (
          <Bead key={i} x={x} y={y} type={PALETTE[i]} />
        ))}
      </svg>
      <label className="ev-slider">
        <span>Unfolded</span>
        <input type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => setT(Number(e.target.value))} aria-label="Fold the chain" />
        <span>Folded</span>
      </label>
    </div>
  );
}

/** 03 — only the folded shape has a pocket that fits the molecule */
function FunctionVisual() {
  const [folded, setFolded] = useState(true);
  return (
    <div className="ev-frame">
      <svg viewBox="0 0 330 180">
        <path
          className={`ev-blob ${folded ? '' : 'is-loose'}`}
          d={folded ? 'M90 40 Q 170 10 230 50 Q 262 90 232 138 Q 200 170 150 158 L 150 110 Q 150 92 132 92 L 118 92 Q 100 92 100 110 L 100 150 Q 64 130 66 90 Q 66 56 90 40 Z' : 'M40 90 Q 90 60 140 92 Q 190 124 240 88 Q 270 70 300 96 Q 270 120 240 112 Q 190 150 140 118 Q 90 86 40 110 Z'}
        />
        <g className={`ev-ligand ${folded ? 'is-docked' : ''}`}>
          <polygon points="0,-12 10,-6 10,6 0,12 -10,6 -10,-6" />
        </g>
      </svg>
      <button className="btn btn--ghost" onClick={() => setFolded((f) => !f)}>
        {folded ? 'Unfold it' : 'Fold it'}
      </button>
      <span className="ev-caption">{folded ? 'Folded: the pocket grips its partner molecule.' : 'Unfolded: no pocket, no job.'}</span>
    </div>
  );
}

const HEALTHY: [number, number][] = [[80, 50], [110, 40], [140, 50], [150, 80], [130, 104], [100, 100], [84, 124], [100, 148], [130, 150], [158, 136]];
const MUTANT: [number, number][] = [[80, 50], [110, 40], [140, 50], [160, 72], [178, 96], [200, 90], [214, 66], [240, 60], [262, 78], [270, 104]];

/** 04 — one swapped bead changes the fold */
function MutationVisual() {
  const [mutant, setMutant] = useState(false);
  const pts = mutant ? MUTANT : HEALTHY;
  const types: Residue[] = ['+', 'P', 'H', '-', 'P', mutant ? 'H' : '-', 'H', 'P', '+', 'H'];
  return (
    <div className="ev-frame">
      <svg viewBox="0 0 330 180">
        <Backbone pts={pts} />
        {pts.map(([x, y], i) => (
          <Bead key={i} x={x} y={y} type={types[i]} glow={i === 5} />
        ))}
        {mutant && (
          <g className="ev-clump">
            <circle cx={290} cy={140} r={14} />
            <circle cx={266} cy={152} r={12} />
            <text x={200} y={172}>sticky patch exposed</text>
          </g>
        )}
      </svg>
      <button className="btn btn--ghost" onClick={() => setMutant((m) => !m)} aria-pressed={mutant}>
        {mutant ? 'Undo the swap' : 'Swap the glowing bead'}
      </button>
      <span className="ev-caption">{mutant ? 'One change: − became sticky. The fold opens up.' : 'Healthy fold. The glowing bead holds a charge.'}</span>
    </div>
  );
}

function MethodsVisual() {
  const items = [
    { t: 'X-ray crystallography', d: 'Crystals scatter X-rays into patterns that reveal atom positions.', icon: 'M4 4h16v16H4zM4 12h16M12 4v16M4 4l16 16' },
    { t: 'Cryo-electron microscopy', d: 'Flash-frozen molecules imaged many thousands of times, then combined.', icon: 'M12 3v8M8 11h8l-2 5h-4l-2-5ZM6 21h12' },
    { t: 'Computer models', d: 'Physics and AI predict shapes that experiments can then test.', icon: 'M4 18l5-6 4 3 7-9M4 6h.01M20 18h.01' },
  ];
  return (
    <ul className="ev-methods">
      {items.map((m) => (
        <li key={m.t}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d={m.icon} />
          </svg>
          <div>
            <strong>{m.t}</strong>
            <span>{m.d}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 06 — AI fans out possibilities; people choose what to test */
function AIVisual() {
  const [tested, setTested] = useState(false);
  const branches = Array.from({ length: 13 }, (_, i) => {
    const a = -70 + i * (140 / 12);
    const r = (a * Math.PI) / 180;
    return { x: 40 + Math.cos(r) * 230, y: 95 + Math.sin(r) * 80, keep: i === 3 || i === 7 || i === 10 };
  });
  return (
    <div className="ev-frame">
      <svg viewBox="0 0 330 190">
        {branches.map((b, i) => (
          <g key={i}>
            <line x1={40} y1={95} x2={b.x} y2={b.y} className={b.keep ? 'ev-branch is-keep' : 'ev-branch'} />
            <circle cx={b.x} cy={b.y} r={b.keep ? 7 : 4} className={b.keep ? 'ev-cand is-keep' : 'ev-cand'} />
          </g>
        ))}
        {tested && (
          <g className="ev-tested">
            <circle cx={branches[7].x} cy={branches[7].y} r={16} />
            <text x={branches[7].x - 44} y={branches[7].y + 36}>
              tested in the lab
            </text>
          </g>
        )}
        <circle cx={40} cy={95} r={12} className="ev-root" />
      </svg>
      <button className="btn btn--ghost" onClick={() => setTested((x) => !x)} aria-pressed={tested}>
        <Icon name="flask" size={18} /> {tested ? 'Evidence in' : 'Run the experiment'}
      </button>
      <span className="ev-caption">AI suggests many options. People pick which to test, and evidence settles it.</span>
    </div>
  );
}

export function ExploreVisualView({ kind }: { kind: ExploreVisual }) {
  switch (kind) {
    case 'chain':
      return <ChainVisual />;
    case 'fold':
      return <FoldVisual />;
    case 'function':
      return <FunctionVisual />;
    case 'mutation':
      return <MutationVisual />;
    case 'methods':
      return <MethodsVisual />;
    case 'ai':
      return <AIVisual />;
  }
}
