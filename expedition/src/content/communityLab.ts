/**
 * Community Lab: three fictional contributors each hold part of a puzzle.
 * The player combines their findings to choose the best variant.
 */
export interface Clue {
  id: string;
  who: string;
  role: string;
  when: string;
  finding: string;
  detail: string;
}

export interface Variant {
  id: string;
  name: string;
  change: string;
  correct: boolean;
  feedback: string;
}

export const labPuzzle = {
  protein: 'Luma-7',
  brief:
    'Luma-7 is a made-up glowing protein that has to survive in a hot, acidic pond. Three contributors each found one piece of the puzzle. Combine what they found to pick the most stable variant.',
  clues: [
    {
      id: 'structure',
      who: 'Contributor 0417',
      role: 'Structure watcher',
      when: '3h ago',
      finding: 'Position 17 is buried deep in the core.',
      detail: 'The core is packed with sticky (hydrophobic) residues. There’s a small gap near position 17.',
    },
    {
      id: 'environment',
      who: 'Contributor 1182',
      role: 'Environment logger',
      when: '1h ago',
      finding: 'The pond reaches 45 °C and is acidic.',
      detail: 'Heat shakes folds loose. Acid changes the charges on surface residues. The loop at position 50 has to flex to let light out.',
    },
    {
      id: 'mutations',
      who: 'Contributor 0093',
      role: 'Mutation scout',
      when: '20m ago',
      finding: 'Four candidate changes.',
      detail: 'V17D adds a charge. V17I adds a slightly larger sticky side-chain. K30E flips a surface charge. G50P stiffens the loop.',
    },
  ] satisfies Clue[],
  variants: [
    {
      id: 'V17I',
      name: 'V17I',
      change: 'Bigger sticky residue in the core',
      correct: true,
      feedback:
        'It fills the gap in the core (structure clue), holds together better in heat (environment clue), and it’s a real option on the list (mutation clue). Every clue points the same way.',
    },
    {
      id: 'V17D',
      name: 'V17D',
      change: 'Charged residue in the core',
      correct: false,
      feedback: 'A charge buried in a sticky core is like water in oil. The structure clue says position 17 is buried, so this would destabilise it.',
    },
    {
      id: 'K30E',
      name: 'K30E',
      change: 'Flip a surface charge',
      correct: false,
      feedback: 'Reasonable, but in acid its effect is hard to predict (environment clue), and it does nothing for the core gap.',
    },
    {
      id: 'G50P',
      name: 'G50P',
      change: 'Stiffen the loop',
      correct: false,
      feedback: 'Stiffer might mean more stable, but the environment log says that loop has to flex to let light out. It would be stable and useless.',
    },
  ] satisfies Variant[],
  realWorld:
    'In real research you’d now test V17I in the lab. A good answer on paper is a hypothesis, not a result.',
};
