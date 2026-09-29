import type { LevelDef } from '../../game/types';

const arena = { w: 360, h: 480 };

export const proteinLevels: LevelDef[] = [
  {
    id: 'p1',
    number: 1,
    title: 'Opposites attract',
    goal: 'Drag the chain so + meets −. Make 2 bonds.',
    chain: ['+', 'P', 'P', '-', 'P', 'P', '+', 'P', 'P', '-'],
    requiredBonds: 2,
    targetEnergy: -3,
    arena,
    hint: [0, 3],
  },
  {
    id: 'p2',
    number: 2,
    title: 'A crowded cell',
    goal: 'Fold around the crowders. Make 3 bonds.',
    chain: ['H', 'P', '+', 'P', 'P', 'H', 'P', 'P', '-', 'P', 'P', 'H'],
    obstacles: [
      { x: 180, y: 222, r: 56, label: 'crowder' },
      { x: 66, y: 96, r: 30 },
      { x: 300, y: 118, r: 34 },
    ],
    requiredBonds: 3,
    targetEnergy: -3.5,
    arena,
    hint: [2, 8],
  },
  {
    id: 'p3',
    number: 3,
    title: 'The one true fold',
    goal: 'Join each matching pair of shapes. Beware tempting wrong bonds.',
    chain: ['P', '+', 'P', 'H', 'P', '-', 'P', 'P', '+', 'P', 'H', '+', '-', 'P'],
    targetContacts: [
      [5, 8],
      [3, 10],
      [1, 12],
    ],
    // the right fold keeps a little charge strain, so full marks sit below the bond total
    targetEnergy: -2.4,
    arena,
    hint: [5, 8],
  },
];
