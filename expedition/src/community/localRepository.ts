import { readJSON, writeJSON } from '../lib/storage';
import { seedHypotheses, seedNotes } from './seeds';
import type { CommunityRepository, FieldNote, Hypothesis, QuestProgress, VoteKind } from './types';

const KEY = 'expedition.community.v1';

interface LocalData {
  hypotheses: Hypothesis[];
  notes: FieldNote[];
  votes: Record<string, VoteKind[]>;
  stances: Record<string, string>;
  handle: string;
}

function load(): LocalData {
  return readJSON<LocalData>(KEY, {
    hypotheses: [],
    notes: [],
    votes: {},
    stances: {},
    handle: String(Math.floor(1000 + Math.random() * 8999)),
  });
}

function save(d: LocalData): boolean {
  return writeJSON(KEY, d);
}

const uid = () => Math.random().toString(36).slice(2, 10);

export class LocalCommunityRepository implements CommunityRepository {
  async listHypotheses() {
    const d = load();
    const all = [...d.hypotheses.map((x) => ({ ...x, mine: true })), ...seedHypotheses];
    return all.map((x) => {
      const mine = d.votes[x.id] ?? [];
      return {
        ...x,
        votes: {
          interesting: x.votes.interesting + (mine.includes('interesting') ? 1 : 0),
          testable: x.votes.testable + (mine.includes('testable') ? 1 : 0),
        },
      };
    });
  }

  async addHypothesis(levelId: string, text: string) {
    const d = load();
    const hyp: Hypothesis = {
      id: `h-${uid()}`,
      levelId,
      text: text.trim().slice(0, 280),
      author: `Folder #${d.handle}`,
      createdAt: Date.now(),
      votes: { interesting: 0, testable: 0 },
    };
    d.hypotheses.unshift(hyp);
    save(d);
    return { ...hyp, mine: true };
  }

  async vote(id: string, kind: VoteKind) {
    const d = load();
    const cur = new Set(d.votes[id] ?? []);
    if (cur.has(kind)) cur.delete(kind);
    else cur.add(kind);
    d.votes[id] = [...cur];
    save(d);
  }

  async myVotes() {
    return load().votes;
  }

  async listFieldNotes() {
    const d = load();
    return [...d.notes.map((x) => ({ ...x, mine: true })), ...seedNotes];
  }

  async addFieldNote(note: Omit<FieldNote, 'id' | 'author' | 'createdAt' | 'mine'>) {
    const d = load();
    const full: FieldNote = {
      ...note,
      text: note.text.trim().slice(0, 400),
      id: `n-${uid()}`,
      author: `Observer ${d.handle}`,
      createdAt: Date.now(),
    };
    d.notes.unshift(full);
    // photos are large: if storage is full, keep the note without its photo
    if (!save(d)) {
      d.notes[0] = { ...full, photo: undefined };
      save(d);
    }
    return { ...full, mine: true };
  }

  async questProgress(questId: string, goal: number, seed: number): Promise<QuestProgress> {
    const mineCount = load().notes.filter((x) => x.questId === questId).length;
    return { count: seed + mineCount, goal, mineCount };
  }

  async stanceTallies(tensionId: string, seed: Record<string, number>) {
    const mine = load().stances[tensionId];
    const out = { ...seed };
    if (mine) out[mine] = (out[mine] ?? 0) + 1;
    return out;
  }

  async recordStance(tensionId: string, positionId: string) {
    const d = load();
    d.stances[tensionId] = positionId;
    save(d);
  }

  async myStance(tensionId: string) {
    return load().stances[tensionId];
  }
}

export function clearCommunity() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
