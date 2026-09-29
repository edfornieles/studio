export type ExploreVisual = 'chain' | 'fold' | 'function' | 'mutation' | 'methods' | 'ai';

export interface ExploreSection {
  id: string;
  kicker: string;
  title: string;
  body: string;
  visual: ExploreVisual;
  strandy?: string;
}

export const exploreSections: ExploreSection[] = [
  {
    id: 'chain',
    kicker: '01 · The chain',
    title: 'A protein starts as a string of beads.',
    body: 'Each bead is an amino acid. There are 20 kinds, joined in a precise order written in your DNA.',
    visual: 'chain',
    strandy: 'Tap the chain to add a bead.',
  },
  {
    id: 'fold',
    kicker: '02 · The fold',
    title: 'Then it folds itself into a shape.',
    body: 'Pulls and pushes between the beads crumple the chain into a specific 3D shape, usually in a fraction of a second.',
    visual: 'fold',
    strandy: 'Drag the slider. Watch it fold.',
  },
  {
    id: 'function',
    kicker: '03 · Shape is job',
    title: 'The shape decides what it can do.',
    body: 'A pocket in the right place can grip a sugar, carry oxygen or cut another molecule. Unfolded, the pocket isn’t there.',
    visual: 'function',
  },
  {
    id: 'mutation',
    kicker: '04 · One small change',
    title: 'Swap one bead and everything can shift.',
    body: 'In sickle cell disease, a single amino acid change in haemoglobin makes the proteins stick together and bend red blood cells out of shape.',
    visual: 'mutation',
    strandy: 'Tap the glowing bead to swap it.',
  },
  {
    id: 'methods',
    kicker: '05 · How we know',
    title: 'Scientists see shapes indirectly.',
    body: 'Each method has blind spots (NMR is another), so scientists combine several and trust results that agree.',
    visual: 'methods',
  },
  {
    id: 'ai',
    kicker: '06 · Where AI fits',
    title: 'AI widens the search. People still decide what’s true.',
    body: 'AI models can explore many possibilities quickly. They don’t replace scientific judgement, careful testing or evidence.',
    visual: 'ai',
  },
];

/** The three-way distinction used across the site. */
export const honestyTable = [
  {
    label: 'In this game',
    text: 'You drag a flat toy chain with 4 kinds of bead. The rules are simplified so you can feel the idea.',
  },
  {
    label: 'In real research',
    text: 'Scientists combine lab measurements, physics and AI structure predictors such as AlphaFold, then test the results in experiments.',
  },
  {
    label: 'How Claude can help',
    text: 'Claude is a general AI assistant, not a structure predictor. It can help researchers read papers, write analysis code, pressure-test hypotheses and design controls. People still check the results.',
  },
];
