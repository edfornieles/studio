export interface Tension {
  id: string;
  question: string;
  context: string;
  positions: { id: string; label: string; consider: string }[];
  seedTallies: Record<string, number>;
}

/** No answer is marked correct. Each position gets its strongest counterpoint. */
export const tensions: Tension[] = [
  {
    id: 'experiment',
    question: 'Should this experiment be performed?',
    context:
      'A team could make a protein fold faster, which might help medicine. The same change might also make a harmful protein more stable.',
    positions: [
      { id: 'yes', label: 'Yes, with oversight', consider: 'Oversight is only as good as the people doing it. Who reviews the reviewers?' },
      { id: 'wait', label: 'Not yet: study the risks first', consider: 'Waiting has costs too. Patients who might have been helped are not a hypothetical.' },
      { id: 'no', label: 'No. Some knowledge is too risky', consider: 'Someone else may do it with less care. Does refusing make the world safer?' },
    ],
    seedTallies: { yes: 412, wait: 538, no: 121 },
  },
  {
    id: 'access',
    question: 'Who gets access to a discovery?',
    context: 'An AI-assisted project finds a promising enzyme. It cost a lot to develop.',
    positions: [
      { id: 'open', label: 'Publish everything openly', consider: 'Open access can also mean open misuse, and funders may stop paying for the next discovery.' },
      { id: 'licensed', label: 'License it, cheaply for those in need', consider: 'Who decides who is “in need”, and how quickly?' },
      { id: 'owner', label: 'Whoever paid should decide', consider: 'Public money and public data often helped. Did they pay for all of it?' },
    ],
    seedTallies: { open: 602, licensed: 377, owner: 88 },
  },
  {
    id: 'control',
    question: 'What should stay under human control?',
    context: 'An automated lab could design, run and interpret its own experiments overnight.',
    positions: [
      { id: 'design', label: 'Choosing which questions to ask', consider: 'People have blind spots too. AI might find important questions we’d never think of.' },
      { id: 'approve', label: 'Approving each experiment', consider: 'At a thousand experiments a night, can anyone meaningfully approve each one?' },
      { id: 'interpret', label: 'Deciding what results mean', consider: 'Interpretation is where our biases hide. Could a second, AI reading actually help?' },
    ],
    seedTallies: { design: 310, approve: 290, interpret: 455 },
  },
  {
    id: 'faster',
    question: 'Is a faster answer always better?',
    context: 'A model gives a structure prediction in minutes. The lab experiment would take months.',
    positions: [
      { id: 'speed', label: 'Yes. Speed saves lives', consider: 'A confident wrong answer can send years of work in the wrong direction.' },
      { id: 'both', label: 'Use the fast answer to choose what to test', consider: 'Only testing what the model suggests might make us miss what it can’t see.' },
      { id: 'slow', label: 'Evidence first, speed second', consider: 'Some decisions can’t wait months. Is certainty a luxury?' },
    ],
    seedTallies: { speed: 140, both: 820, slow: 205 },
  },
  {
    id: 'uncertain',
    question: 'What should happen when an AI model is unsure?',
    context: 'A model is 60% confident a mutation is harmless.',
    positions: [
      { id: 'say', label: 'Show the uncertainty prominently', consider: 'People often ignore probabilities, or read 60% as “probably fine”.' },
      { id: 'defer', label: 'Refuse to answer below a threshold', consider: 'A cautious “I don’t know” might hide useful information from experts.' },
      { id: 'test', label: 'Flag it for a lab test automatically', consider: 'Lab time is limited. Testing everything uncertain could crowd out other work.' },
    ],
    seedTallies: { say: 530, defer: 180, test: 402 },
  },
];
