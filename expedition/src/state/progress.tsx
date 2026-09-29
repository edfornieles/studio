import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { readJSON, writeJSON } from '../lib/storage';

const KEY = 'expedition.progress.v1';

export interface LevelResult {
  completed: boolean;
  bestStability: number;
  seconds: number;
}

export interface Progress {
  seenOpening: boolean;
  exploreDone: boolean;
  levels: Record<string, LevelResult>;
  hypothesisCount: number;
  fieldworkCount: number;
  labSolved: boolean;
}

const initial: Progress = {
  seenOpening: false,
  exploreDone: false,
  levels: {},
  hypothesisCount: 0,
  fieldworkCount: 0,
  labSolved: false,
};

interface Ctx {
  progress: Progress;
  update: (patch: Partial<Progress> | ((p: Progress) => Partial<Progress>)) => void;
  completeLevel: (id: string, r: LevelResult) => void;
  resetGame: () => void;
  resetAll: () => void;
  percent: number;
}

const ProgressContext = createContext<Ctx | null>(null);

export function ProgressProvider({ children, levelIds }: { children: ReactNode; levelIds: string[] }) {
  const [progress, setProgress] = useState<Progress>(() => readJSON(KEY, initial));

  const commit = useCallback((next: Progress) => {
    writeJSON(KEY, next);
    return next;
  }, []);

  const update = useCallback<Ctx['update']>(
    (patch) => setProgress((p) => commit({ ...p, ...(typeof patch === 'function' ? patch(p) : patch) })),
    [commit],
  );

  const completeLevel = useCallback(
    (id: string, r: LevelResult) =>
      setProgress((p) => {
        const prev = p.levels[id];
        const best = prev ? { ...r, bestStability: Math.max(prev.bestStability, r.bestStability), seconds: Math.min(prev.seconds, r.seconds) } : r;
        return commit({ ...p, levels: { ...p.levels, [id]: best } });
      }),
    [commit],
  );

  const resetGame = useCallback(() => setProgress((p) => commit({ ...p, levels: {} })), [commit]);
  const resetAll = useCallback(() => setProgress(commit({ ...initial })), [commit]);

  // Expedition steps: opening, explore, each level, a hypothesis, a field contribution.
  const percent = useMemo(() => {
    const steps = [progress.seenOpening, progress.exploreDone, ...levelIds.map((id) => !!progress.levels[id]?.completed), progress.hypothesisCount > 0, progress.fieldworkCount > 0];
    return steps.filter(Boolean).length / steps.length;
  }, [progress, levelIds]);

  const value = useMemo(() => ({ progress, update, completeLevel, resetGame, resetAll, percent }), [progress, update, completeLevel, resetGame, resetAll, percent]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress outside provider');
  return ctx;
}
