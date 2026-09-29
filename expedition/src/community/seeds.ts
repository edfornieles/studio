import type { FieldNote, Hypothesis } from './types';

const HOUR = 3600 * 1000;
const now = Date.now();

const h = (id: string, levelId: string, text: string, author: string, hoursAgo: number, interesting: number, testable: number): Hypothesis => ({
  id, levelId, text, author, createdAt: now - hoursAgo * HOUR, votes: { interesting, testable },
});

export const seedHypotheses: Hypothesis[] = [
  h('s1', 'p1', 'If both ends are the same charge, the chain stays straighter. Could you measure that as length?', 'Folder #2193', 2, 41, 57),
  h('s2', 'p1', 'Swapping one charge leaves one bond, but maybe it forms faster because there’s less choice?', 'Folder #0877', 5, 63, 22),
  h('s3', 'p2', 'Crowding might actually help: less room means fewer wrong shapes to explore.', 'Folder #3310', 9, 88, 34),
  h('s4', 'p2', 'Put the sticky beads closer together along the chain and it folds around obstacles more easily.', 'Folder #1204', 20, 19, 48),
  h('s5', 'p3', 'The decoy + wins because it’s closer along the chain. Local contacts form first, then block the global fold.', 'Folder #4521', 1, 102, 71),
  h('s6', 'p3', 'Charging the core beads would kill the fold. The core would repel itself.', 'Folder #0042', 30, 37, 60),
  h('s7', 'p3', 'A longer loop at the turn gives more freedom, but also more ways to go wrong. Maybe there’s a best length?', 'Folder #2766', 50, 55, 44),
  h('s8', 'p1', 'Temperature as a slider: at some point the jiggle should break the bonds. Where is that point?', 'Folder #3907', 70, 74, 81),
];

const n = (id: string, category: FieldNote['category'], text: string, author: string, hoursAgo: number, questId?: string): FieldNote => ({
  id, category, text, author, createdAt: now - hoursAgo * HOUR, questId,
});

export const seedNotes: FieldNote[] = [
  n('n1', 'fold', 'Fern fronds uncurl from a tight spiral. The inside grows slower than the outside?', 'Observer 0412', 3, 'folds'),
  n('n2', 'pattern', 'Pine cone scales: 8 spirals one way, 13 the other. Both Fibonacci numbers.', 'Observer 2210', 6, 'patterns'),
  n('n3', 'adaptation', 'Moss grows only on the shaded side of the wall. Same wall, two climates.', 'Observer 1033', 10, 'adaptation'),
  n('n4', 'material', 'A folded paper strip held 4 coins, flat held 1. Shape beat material.', 'Observer 0999', 14, 'materials'),
  n('n5', 'growth', 'Bracket fungus on a dead birch, layered like shelves. Each layer a season?', 'Observer 3141', 20, 'census'),
  n('n6', 'fold', 'Pea tendril coiled one way, then switched direction halfway. Why?', 'Observer 0271', 26, 'folds'),
  n('n7', 'pattern', 'Dried mud cracks into rough hexagons, like the giraffe’s pattern.', 'Observer 1618', 33, 'patterns'),
  n('n8', 'adaptation', 'Pavement dandelion is half the height of the ones in the park.', 'Observer 0707', 40, 'adaptation'),
  n('n9', 'growth', 'Five minutes with an ant trail: they reroute around a leaf in about 20 seconds.', 'Observer 2048', 52, 'census'),
  n('n10', 'other', 'My grandmother said AI should never decide who gets a transplant.', 'Observer 0555', 60, 'ask'),
  n('n11', 'material', 'A spider web survived the rain. The grass stem next to it bent flat.', 'Observer 1729', 75, 'materials'),
  n('n12', 'pattern', 'Honeycomb from the market: six sides. A wax bubble packing problem?', 'Observer 0360', 90, 'patterns'),
];
