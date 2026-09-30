export type VoteKind = 'interesting' | 'testable';

export interface Hypothesis {
  id: string;
  levelId: string;
  text: string;
  author: string; // anonymous handle only
  createdAt: number;
  votes: Record<VoteKind, number>;
  mine?: boolean;
}

export type NoteCategory = 'pattern' | 'fold' | 'adaptation' | 'growth' | 'material' | 'other';

export interface FieldNote {
  id: string;
  category: NoteCategory;
  text: string;
  photo?: string; // data URL (local) or remote URL (future)
  questId?: string;
  author: string;
  createdAt: number;
  mine?: boolean;
}

export interface QuestProgress {
  count: number;
  goal: number;
  mineCount: number;
}

/**
 * The only way screens reach community data. Today it's backed by localStorage
 * plus seeded examples; a server implementation can replace it without touching the UI.
 */
export interface CommunityRepository {
  listHypotheses(): Promise<Hypothesis[]>;
  addHypothesis(levelId: string, text: string): Promise<Hypothesis>;
  vote(id: string, kind: VoteKind): Promise<void>;
  myVotes(): Promise<Record<string, VoteKind[]>>;

  listFieldNotes(): Promise<FieldNote[]>;
  addFieldNote(note: Omit<FieldNote, 'id' | 'author' | 'createdAt' | 'mine'>): Promise<FieldNote>;

  questProgress(questId: string, goal: number, seed: number): Promise<QuestProgress>;

  stanceTallies(tensionId: string, seed: Record<string, number>): Promise<Record<string, number>>;
  recordStance(tensionId: string, positionId: string): Promise<void>;
  myStance(tensionId: string): Promise<string | undefined>;
}
