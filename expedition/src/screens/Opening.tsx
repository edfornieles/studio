import { useCallback, useEffect, useRef, useState } from 'react';
import { Strandy } from '../components/Strandy';
import { RESIDUE_COLORS } from '../game/FoldCanvas';
import type { Residue } from '../game/types';

/**
 * Cinematic opening: a leaf → its cells → a single protein chain assembling and
 * folding → Strandy arrives. Tap anywhere to move on; Skip is always available.
 */

const STAGE_TIMES = [0, 2800, 6400, 9400, 15200];

const CHAIN: Residue[] = ['+', 'P', 'H', 'P', '-', 'H', 'P', '+', 'H', 'P', '-', 'H'];
const STRAIGHT = CHAIN.map((_, i) => [30 + i * 26, 150] as const);
const FOLDED: readonly (readonly [number, number])[] = [
  [150, 92], [178, 80], [206, 92], [218, 120], [206, 148], [178, 158],
  [152, 150], [136, 176], [152, 204], [182, 210], [210, 198], [236, 184],
];

export function Opening({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const [folded, setFolded] = useState(false);
  const k = useTween(folded ? 1 : 0, 1400);
  const e = k * k * (3 - 2 * k);
  const pos = STRAIGHT.map(([x, y], i) => [x + (FOLDED[i][0] - x) * e, y + (FOLDED[i][1] - y) * e] as const);

  useEffect(() => {
    const timers = STAGE_TIMES.slice(1).map((t, i) => window.setTimeout(() => setStage((s) => Math.max(s, i + 1)), t));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (stage !== 3) return;
    const t = window.setTimeout(() => setFolded(true), 2600);
    return () => clearTimeout(t);
  }, [stage]);

  const advance = useCallback(() => {
    setStage((s) => {
      if (s === 3 && !folded) {
        setFolded(true);
        return s;
      }
      return Math.min(4, s + 1);
    });
  }, [folded]);

  return (
    <div className={`opening stage-${stage}`} onClick={stage < 4 ? advance : undefined}>
      <div className="letterbox letterbox--top" aria-hidden />
      <div className="letterbox letterbox--bottom" aria-hidden />
      <div className="tv-bug" aria-hidden>
        <span className="rec-dot" /> CLAUDE FIELD SCIENCE
      </div>
      <div className="tv-ep" aria-hidden>
        EP.01
      </div>
      {stage < 4 && (
      <button
        className="skip"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Skip intro
      </button>
      )}

      <div className="opening__stage" aria-hidden>
        <svg className="op-leaf" viewBox="0 0 300 300">
          <path className="draw" d="M150 270 C 60 220 40 120 150 30 C 260 120 240 220 150 270 Z" />
          <path className="draw d2" d="M150 270 L150 40" />
          {[70, 110, 150, 190].map((y, i) => (
            <g key={y}>
              <path className={`draw d${3 + i}`} d={`M150 ${y + 40} Q ${110 - i * 4} ${y + 20} ${88 + i * 3} ${y - 5}`} />
              <path className={`draw d${3 + i}`} d={`M150 ${y + 40} Q ${190 + i * 4} ${y + 20} ${212 - i * 3} ${y - 5}`} />
            </g>
          ))}
        </svg>

        <svg className="op-cells" viewBox="0 0 300 300">
          {[
            [70, 80, 44], [160, 60, 50], [240, 100, 40], [100, 170, 52], [200, 180, 48], [60, 250, 38], [150, 255, 44], [250, 250, 42],
          ].map(([x, y, r], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={r} ry={r * 0.82} className="cell" />
              <circle cx={x + r * 0.2} cy={y - r * 0.1} r={r * 0.28} className="nucleus" />
              {[0, 1, 2].map((k) => (
                <circle key={k} cx={x - r * 0.4 + k * 9} cy={y + r * 0.35} r={2.2} className="speck" />
              ))}
            </g>
          ))}
        </svg>

        <svg className={`op-molecule ${folded ? 'is-folded' : ''}`} viewBox="0 0 360 300">
          {k > 0.98 && (
            <g className="bonds-glow">
              <line x1={pos[0][0]} y1={pos[0][1]} x2={pos[4][0]} y2={pos[4][1]} />
              <line x1={pos[2][0]} y1={pos[2][1]} x2={pos[5][0]} y2={pos[5][1]} />
              <line x1={pos[7][0]} y1={pos[7][1]} x2={pos[10][0]} y2={pos[10][1]} />
            </g>
          )}
          {pos.slice(0, -1).map(([x, y], i) => (
            <line key={i} className="backbone" x1={x} y1={y} x2={pos[i + 1][0]} y2={pos[i + 1][1]} style={{ animationDelay: `${i * 0.16 + 0.1}s` }} />
          ))}
          {pos.map(([x, y], i) => (
            <circle key={i} className="bead" cx={x} cy={y} r={10} fill={RESIDUE_COLORS[CHAIN[i]]} style={{ animationDelay: `${i * 0.16}s` }} />
          ))}
        </svg>

        <div className="op-strandy">
          <Strandy pose="wave" mood="happy" size={180} />
        </div>
      </div>

      <div className="opening__captions">
        <p className="cap cap-0">Inside every living thing</p>
        <p className="cap cap-1">is a world too complex to see.</p>
        <p className="cap cap-3">
          Proteins: billions of tiny machines,
          <br />
          each folded into a precise shape.
        </p>
        <div className="cap cap-4">
          <p className="cap-4__title">I’m Strandy.</p>
          <p className="cap-4__body">I’ll be your guide, built on Claude. Let’s find out how nature folds, and what AI can and can’t help us see.</p>
          <button className="btn btn--primary btn--lg" onClick={onDone}>
            Begin the expedition
          </button>
        </div>
      </div>

      <div className="lower-third" aria-hidden>
        <span>EPISODE 01</span>
        <strong>The Folding Problem</strong>
      </div>
      {stage < 4 && (
        <p className="tap-hint" aria-hidden>
          Tap to continue
        </p>
      )}
    </div>
  );
}

/** Animate a number towards `target` over `ms`. */
function useTween(target: number, ms: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const v0 = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const next = v0 + (target - v0) * t;
      from.current = next;
      setV(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
