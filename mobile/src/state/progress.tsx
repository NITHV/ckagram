import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { QueueItem } from '@/engine/feed';
import { loadStats, type Stats } from '@/engine/progress';
import { recordAnswer, type AnswerResult } from '@/engine/record';
import { haptic } from '@/lib/haptics';
import { useCelebrate } from './celebrate';

interface ProgressContextValue {
  stats: Stats | null;
  refresh: () => Promise<void>;
  /** Saves an answer, updates stats and fires celebrations. */
  answer: (entry: QueueItem, correct: boolean, ms: number, combo: number) => Promise<AnswerResult>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const celebrate = useCelebrate();
  const [stats, setStats] = useState<Stats | null>(null);
  const statsRef = useRef<Stats | null>(null);
  // Answers are saved one at a time so "before" stats are always accurate.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const refresh = useCallback(async () => {
    const s = await loadStats(db);
    statsRef.current = s;
    setStats(s);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const answer = useCallback(
    (entry: QueueItem, correct: boolean, ms: number, combo: number) => {
      if (correct) haptic.success();
      else haptic.error();
      const run = chain.current.then(async () => {
        const before = statsRef.current ?? (await loadStats(db));
        const result = await recordAnswer(db, entry, correct, ms, combo, before);
        statsRef.current = result.stats;
        setStats(result.stats);
        celebrate(result);
        return result;
      });
      chain.current = run.catch(() => {});
      return run;
    },
    [db, celebrate]
  );

  const value = useMemo(() => ({ stats, refresh, answer }), [stats, refresh, answer]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
