/** Simplified residue classes used by the folding game. */
export type Residue =
  | 'H' // hydrophobic: "sticky", clusters with other H
  | 'P' // polar: neutral in this model
  | '+' // positively charged
  | '-'; // negatively charged

export interface Vec {
  x: number;
  y: number;
}

export interface Obstacle extends Vec {
  r: number;
  label?: string;
}

export interface LevelDef {
  id: string;
  number: number;
  title: string;
  /** One-line instruction shown during play. */
  goal: string;
  chain: Residue[];
  obstacles?: Obstacle[];
  /** Level 3 style: specific residue pairs that define the target fold. */
  targetContacts?: [number, number][];
  /** Levels 1–2: number of stabilising bonds needed. */
  requiredBonds?: number;
  /** Energy that counts as a "fully stable" meter reading. */
  targetEnergy: number;
  /** Arena size in world units (portrait). */
  arena: { w: number; h: number };
  /** Pair to suggest when the player asks for a hint. */
  hint: [number, number];
}

export interface Bond {
  a: number;
  b: number;
  /** Seconds since the bond formed, for the snap pulse. */
  age: number;
}

export interface GameEvent {
  kind: 'bond' | 'break' | 'repel' | 'complete' | 'misfold';
  a?: number;
  b?: number;
}

export interface Snapshot {
  energy: number;
  stability: number; // 0..1
  bonds: number;
  matched: number; // target contacts formed (level 3)
  misfolds: number; // bonds that are not target contacts (level 3)
  goalMet: boolean;
  complete: boolean;
}
