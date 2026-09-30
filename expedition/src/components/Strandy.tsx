import { memo } from 'react';

/**
 * Strandy — the expedition guide, built from the Claude spark: six tapered rays
 * plus two ray-arms with gloved hands. Motion is CSS-only: the body bobs, each
 * arm swings on its own rhythm and the eyes blink.
 */

export type StrandyPose = 'idle' | 'wave' | 'point' | 'cheer' | 'think';
export type StrandyMood = 'open' | 'happy' | 'wide';

const CLAY = '#D97757';
const DEEP = '#B85A38';
const INK = '#141413';
const GLOVE = '#FFFFFF';

const RAYS: [number, number][] = [
  [-84, 150],
  [-40, 136],
  [0, 146],
  [94, 152],
  [180, 134],
  [-128, 138],
];

type P = [number, number];
const pol = (a: number, r: number): P => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
const f = (n: number) => n.toFixed(1);

function tube(p0: P, p1: P, p2: P, w0: number, w1: number, n = 12) {
  const L: P[] = [];
  const R: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const m = Math.hypot(dx, dy) || 1;
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push([x - (dy / m) * w, y + (dx / m) * w]);
    R.push([x + (dy / m) * w, y - (dx / m) * w]);
  }
  const last = R[R.length - 1];
  const d =
    'M ' +
    L.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L ') +
    ` A ${f(w1 / 2)} ${f(w1 / 2)} 0 0 0 ${f(last[0])} ${f(last[1])} L ` +
    [...R].reverse().map((p) => `${f(p[0])} ${f(p[1])}`).join(' L ') +
    ' Z';
  const tang = (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI;
  return { d, tang, tip: p2 };
}

export const RAY_PATHS = RAYS.map(([a, L]) => tube([0, 0], pol(a, L * 0.5), pol(a, L), 34, 50, 6).d);

type HandKind = 'point' | 'open' | 'fist';
type Part = ['e', number, number, number, number] | ['c', number, number, number, number, number];

const HANDS: Record<HandKind, { parts: Part[]; lines: string[] }> = {
  point: {
    parts: [['e', 0, 0, 19, 16], ['c', 6, -9, 40, -9, 12], ['c', -6, -10, -2, -30, 12]],
    lines: ['M 4 1 Q 12 1 14 5', 'M 2 9 Q 10 10 12 13'],
  },
  open: {
    parts: [
      ['e', 0, 0, 19, 17],
      ...([
        [-118, 30],
        [-98, 34],
        [-78, 32],
        [-58, 27],
      ] as P[]).map(([a, l]): Part => {
        const [x1, y1] = pol(a, 8);
        const [x2, y2] = pol(a, l);
        return ['c', x1, y1, x2, y2, 11];
      }),
      ['c', -8, 4, -28, -4, 12],
    ],
    lines: ['M -6 6 Q 2 10 10 4'],
  },
  fist: {
    parts: [['e', 0, 0, 19, 17], ['c', -8, -6, -10, -24, 12]],
    lines: ['M -4 -4 L 12 -4', 'M -2 5 L 13 5'],
  },
};

function Hand({ kind }: { kind: HandKind }) {
  const { parts, lines } = HANDS[kind];
  const draw = (fill: string, grow: number) =>
    parts.map((p, i) =>
      p[0] === 'e' ? (
        <ellipse key={i} cx={p[1]} cy={p[2]} rx={p[3] + grow} ry={p[4] + grow} fill={fill} />
      ) : (
        <path key={i} d={`M ${f(p[1])} ${f(p[2])} L ${f(p[3])} ${f(p[4])}`} stroke={fill} strokeWidth={p[5] + grow * 2} strokeLinecap="round" fill="none" />
      ),
    );
  return (
    <g>
      {draw(DEEP, 3.5)}
      {draw(GLOVE, 0)}
      {lines.map((d, i) => (
        <path key={i} d={d} stroke={DEEP} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
      ))}
    </g>
  );
}

// arm: control angle, control distance, tip angle, tip distance, hand, wrist rotation
type ArmSpec = [number, number, number, number, HandKind, number];
const POSES: Record<StrandyPose, [ArmSpec, ArmSpec]> = {
  idle: [[148, 165, 122, 132, 'point', -15], [50, 165, 26, 150, 'open', -10]],
  wave: [[150, 160, 128, 125, 'fist', 0], [-5, 172, -38, 162, 'open', 0]],
  point: [[150, 160, 128, 125, 'fist', 0], [14, 110, 4, 195, 'point', 0]],
  cheer: [[-175, 160, -140, 165, 'fist', -10], [-5, 160, -40, 165, 'fist', 10]],
  think: [[125, 160, 70, 82, 'point', -60], [55, 170, 38, 150, 'fist', 55]],
};

const armGeometry = (spec: ArmSpec) => {
  const [ca, cd, ta, td, kind, wrist] = spec;
  const { d, tang, tip } = tube([0, 0], pol(ca, cd), pol(ta, td), 38, 28, 12);
  const dx = Math.cos((tang * Math.PI) / 180);
  const dy = Math.sin((tang * Math.PI) / 180);
  const off = kind === 'open' ? 90 : 0;
  return { d, kind, hx: tip[0] + dx * 16, hy: tip[1] + dy * 16, rot: tang + off + wrist };
};

const GEOMETRY = Object.fromEntries(
  Object.entries(POSES).map(([k, [l, r]]) => [k, [armGeometry(l), armGeometry(r)]]),
) as Record<StrandyPose, ReturnType<typeof armGeometry>[]>;

function Face({ mood }: { mood: StrandyMood }) {
  const eyes: [number, number][] = [
    [-21, -4],
    [19, -6],
  ];
  return (
    <g transform="scale(1.3)">
      <g className="st-eyes">
        {eyes.map(([x, y], i) =>
          mood === 'happy' ? (
            <path key={i} d={`M ${x - 8} ${y + 3} Q ${x} ${y - 9} ${x + 8} ${y + 3}`} stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" />
          ) : (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={mood === 'wide' ? 9 : 7.5} ry={mood === 'wide' ? 12 : 11} fill={INK} />
              <ellipse cx={x + 2} cy={y - 4} rx={2.6} ry={3.2} fill="#FAF9F5" />
            </g>
          ),
        )}
      </g>
      {mood !== 'happy' && (
        <g stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round">
          <path d={mood === 'wide' ? 'M -30 -28 Q -22 -34 -13 -30' : 'M -29 -24 Q -22 -29 -14 -26'} />
          <path d={mood === 'wide' ? 'M 11 -33 Q 19 -38 28 -32' : 'M 12 -29 Q 19 -33 27 -28'} />
        </g>
      )}
      {mood === 'wide' ? (
        <ellipse cx={2} cy={20} rx={6} ry={7.5} fill={INK} />
      ) : mood === 'happy' ? (
        <path d="M -8 15 Q 3 15 13 13 Q 12 28 3 28 Q -6 28 -8 15 Z" fill={INK} />
      ) : (
        <path d="M -6 18 Q 3 25 12 16" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
}

interface Props {
  pose?: StrandyPose;
  mood?: StrandyMood;
  size?: number;
  className?: string;
  still?: boolean;
  label?: string;
}

function StrandyBase({ pose = 'idle', mood = 'open', size = 120, className = '', still = false, label = 'Strandy, your guide' }: Props) {
  const [left, right] = GEOMETRY[pose];
  return (
    <svg
      className={`strandy strandy--${pose} ${still ? 'strandy--still' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="-215 -215 430 430"
      role="img"
      aria-label={label}
    >
      <g className="st-bob">
        <path className="st-arm st-arm--l" d={left.d} fill={CLAY} />
        <path className="st-arm st-arm--r" d={right.d} fill={CLAY} />
        {RAY_PATHS.map((d, i) => (
          <path key={i} d={d} fill={CLAY} />
        ))}
        <circle r={42} fill={CLAY} />
        <Face mood={mood} />
        <g className="st-arm st-arm--l">
          <g transform={`translate(${f(left.hx)} ${f(left.hy)}) rotate(${f(left.rot)}) scale(1.3)`}>
            <Hand kind={left.kind} />
          </g>
        </g>
        <g className="st-arm st-arm--r">
          <g transform={`translate(${f(right.hx)} ${f(right.hy)}) rotate(${f(right.rot)}) scale(1.3)`}>
            <g className="st-wrist">
              <Hand kind={right.kind} />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

export const Strandy = memo(StrandyBase);
