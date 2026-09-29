export interface Quest {
  id: string;
  title: string;
  objective: string;
  why: string;
  action: string;
  reportPrompt: string;
  goal: number; // community target
  seedCount: number;
  acceptsPhoto: boolean;
}

export const quests: Quest[] = [
  {
    id: 'folds',
    title: 'Things that fold themselves',
    objective: 'Find something that folds, twists or organises itself without help.',
    why: 'Self-organisation is how proteins, pine cones and bean tendrils get their shape. Nobody assembles them. Physics does.',
    action: 'Look at a curling leaf, a twisted vine, a seed pod or a coiled phone cord. What does the twisting?',
    reportPrompt: 'What did you find, and what do you think made it fold?',
    goal: 500,
    seedCount: 318,
    acceptsPhoto: true,
  },
  {
    id: 'patterns',
    title: 'Three repeating patterns',
    objective: 'Spot three repeating patterns in the natural world.',
    why: 'Repetition often hints at a simple rule underneath. Spotting the rule is where many discoveries begin.',
    action: 'Try spirals in a sunflower, cells in a leaf, ripples in sand or bark cracks.',
    reportPrompt: 'List your three patterns. Is there a rule behind any of them?',
    goal: 400,
    seedCount: 211,
    acceptsPhoto: true,
  },
  {
    id: 'ask',
    title: 'Ask someone',
    objective: 'Ask one person what they think AI should never decide about living things.',
    why: 'Science happens among people. Their values shape which questions get asked and which experiments get done.',
    action: 'Ask a friend, a relative or a colleague. Listen more than you talk.',
    reportPrompt: 'What did they say? (Don’t include their name.)',
    goal: 300,
    seedCount: 164,
    acceptsPhoto: false,
  },
  {
    id: 'adaptation',
    title: 'Local adaptation',
    objective: 'Find a living thing that seems adapted to exactly where it lives.',
    why: 'Adaptation is evolution you can see: shapes and behaviours tuned to local conditions over many generations.',
    action: 'Moss on one side of a wall? A weed in a pavement crack? A plant that closes at night?',
    reportPrompt: 'What is it adapted to, and what’s your evidence?',
    goal: 400,
    seedCount: 97,
    acceptsPhoto: true,
  },
  {
    id: 'materials',
    title: 'Which is tougher?',
    objective: 'Compare two everyday materials and guess which is more resilient. Then gently test it.',
    why: 'Structure decides strength, in spider silk, bone and proteins alike. Guess first, then test: that’s the scientific method in miniature.',
    action: 'Try paper vs. a leaf, string vs. grass, or a folded vs. a flat sheet. Bend gently and don’t break anything precious.',
    reportPrompt: 'Your prediction, your test, your result.',
    goal: 300,
    seedCount: 140,
    acceptsPhoto: true,
  },
  {
    id: 'census',
    title: 'Tiny census',
    objective: 'Observe one plant, insect or fungus for five quiet minutes.',
    why: 'Patient observation by lots of people builds records that no single lab could collect.',
    action: 'Pick one small thing. Note its colour, what it’s doing and what visits it.',
    reportPrompt: 'What did you notice that you would normally miss?',
    goal: 600,
    seedCount: 402,
    acceptsPhoto: true,
  },
];

/** A different quest leads each week, so returning players find something new. */
export function featuredQuest(date = new Date()): Quest {
  const week = Math.floor(date.getTime() / (7 * 24 * 3600 * 1000));
  return quests[week % quests.length];
}
