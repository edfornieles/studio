/**
 * All words for the protein world live here, apart from the game rules.
 * Every debrief separates three things: what the player did in the game, what
 * happens in real research, and where Claude can honestly help.
 */

export interface Debrief {
  headline: string;
  strandy: string;
  inGame: string;
  inResearch: string;
  claudeHelps: string;
  whyItMatters: string;
  simplified: string[];
  hypothesis: { prompt: string; options: string[] };
}

export const debriefs: Record<string, Debrief> = {
  p1: {
    headline: 'You felt a force you can’t see',
    strandy:
      'Did you notice the like charges shoving each other away? You weren’t drawing a shape. You were negotiating with pulls and pushes.',
    inGame: 'You dragged a chain until opposite charges locked together, and like charges pushed apart.',
    inResearch:
      'Real proteins fold by themselves, in water, in millionths of a second. Charged amino acids really do attract and repel, and those pairings (called salt bridges) help hold some folds together.',
    claudeHelps:
      'Claude can explain the chemistry, suggest what to measure and help write the code that analyses a real structure file. It doesn’t fold proteins itself.',
    whyItMatters:
      'Almost everything a cell does, from digesting food to fighting infection, is done by folded proteins. The forces you just played with decide whether they hold their shape.',
    simplified: [
      'Real proteins fold in 3D, not on a flat screen.',
      'Our chain has 4 kinds of bead. Real proteins use 20 amino acids.',
      'Water, temperature and thousands of weak forces matter a great deal and aren’t modelled here.',
      'Nobody drags a real protein into shape. It finds its fold by itself.',
    ],
    hypothesis: {
      prompt: 'What would happen if we swapped the last − for a +?',
      options: [
        'Only one bond could form. The fold gets weaker.',
        'The ends would repel and the chain would stretch out.',
        'Nothing much. The other bond would compensate.',
      ],
    },
  },
  p2: {
    headline: 'Space is a constraint too',
    strandy:
      'A cell is packed. Your chain had to find a route around its neighbours. Sticky green beads hide together, a bit like oil drops in water.',
    inGame: 'You folded around fixed obstacles and clustered the green “sticky” beads into a small core.',
    inResearch:
      'The inside of a cell is crowded with other molecules. Water-avoiding (hydrophobic) amino acids tend to bury themselves in a protein’s core, and that is one of the main forces behind folding. Some proteins also get help from “chaperone” proteins.',
    claudeHelps:
      'A researcher might ask Claude to summarise studies on crowding, compare how a simulation was set up with lab conditions, or spot a bug in a script.',
    whyItMatters:
      'Folds that work in a test tube can fail inside a crowded cell. Misfolded, clumped proteins are involved in diseases such as Alzheimer’s and Parkinson’s.',
    simplified: [
      'Our crowders are fixed walls. Real neighbours move, bump and sometimes help.',
      '“Sticky” is shorthand for the hydrophobic effect, which is really about how water arranges itself.',
      'We count bonds. Real stability comes from many small, subtle energies adding up.',
    ],
    hypothesis: {
      prompt: 'What if the crowder in the middle were twice as big?',
      options: [
        'The chain would need a longer route, so some bonds couldn’t form.',
        'Crowding might push the chain together and help it fold.',
        'It would trap the chain in a wrong fold.',
      ],
    },
  },
  p3: {
    headline: 'Not just stable: the right kind of stable',
    strandy:
      'Some bonds felt right but blocked the real fold. That’s the heart of the folding problem. The shapes that are possible vastly outnumber the right one.',
    inGame:
      'You had to find one specific fold. Tempting wrong bonds (misfolds) could lock the chain up, and you had to break them to move on.',
    inResearch:
      'A real protein can fold in an astronomical number of ways. Scientists measure structures with methods such as X-ray crystallography and cryo-electron microscopy. AI models such as AlphaFold can now predict many structures, but predictions still need checking against experiments.',
    claudeHelps:
      'Claude can help researchers read up on a protein, plan controls, and question whether a predicted model fits the evidence. It can also be wrong, so its suggestions need checking.',
    whyItMatters:
      'Getting the shape right helps with drug design, enzymes that break down plastic, and understanding disease. A “stable” wrong shape can be worse than no shape at all.',
    simplified: [
      'We showed you the target pairs. Real researchers don’t know them in advance.',
      'Real misfolding is shaped by folding speed, the cell’s helpers and chance.',
      'Energy in our game is a score, not a physical measurement.',
    ],
    hypothesis: {
      prompt: 'Which change would most likely stop the right fold from forming?',
      options: [
        'Make the two green core beads charged instead.',
        'Add another + near the middle as a decoy.',
        'Lengthen the loop at the turn.',
      ],
    },
  },
};

export const finale = {
  title: 'Fold complete',
  body: 'You worked through attraction, crowding and the difference between stable and right. Real researchers face the same questions with 20 amino acids, three dimensions and a lot of uncertainty.',
};
