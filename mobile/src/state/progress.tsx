import * as Crypto from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setMeta } from '@/db/schema';
import type { QueueItem } from '@/engine/feed';
import { recordClaim, verifyClaim, type ClaimParams, type ClaimResult } from '@/engine/labs';
import { loadStats, type Stats } from '@/engine/progress';
import { recordAnswer, type AnswerResult } from '@/engine/record';
import { haptic } from '@/lib/haptics';
import { useCelebrate } from './celebrate';

interface ProgressContextValue {
  stats: Stats | null;
  refresh: () => Promise<void>;
  /** Saves an answer, updates stats and fires celebrations. */
  answer: (entry: QueueItem, correct: boolean, ms: number, combo: number) => Promise<AnswerResult>;
  /** Verifies and records a laptop-lab QR claim. Throws with a readable message on failure. */
  claim: (params: ClaimParams) => Promise<ClaimResult>;
  markWinsSeen: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

const sha256 = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const celebrate = useCelebrate();
  const [stats, setStats] = useState<Stats | null>(null);
  const statsRef = useRef<Stats | null>(null);
  // Writes run one at a time so "before" stats are always accurate.
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const refresh = useCallback(async () => {
    const s = await loadStats(db);
    statsRef.current = s;
    setStats(s);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const serial = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = chain.current.then(task);
    chain.current = run.catch(() => {});
    return run;
  }, []);

  const answer = useCallback(
    (entry: QueueItem, correct: boolean, ms: number, combo: number) => {
      if (correct) haptic.success();
      else haptic.error();
      return serial(async () => {
        const before = statsRef.current ?? (await loadStats(db));
        const result = await recordAnswer(db, entry, correct, ms, combo, before);
        statsRef.current = result.stats;
        setStats(result.stats);
        celebrate(result);
        return result;
      });
    },
    [db, celebrate, serial]
  );

  const claim = useCallback(
    (params: ClaimParams) =>
      serial(async () => {
        const verified = await verifyClaim(params, sha256);
        if (!verified.ok) throw new Error(verified.reason);
        const before = statsRef.current ?? (await loadStats(db));
        const result = await recordClaim(db, verified.claim, before);
        statsRef.current = result.stats;
        setStats(result.stats);
        haptic.success();
        celebrate(result);
        return result;
      }),
    [db, celebrate, serial]
  );

  const markWinsSeen = useCallback(async () => {
    await setMeta(db, 'wins_seen_at', String(Date.now()));
    await refresh();
  }, [db, refresh]);

  const value = useMemo(() => ({ stats, refresh, answer, claim, markWinsSeen }), [stats, refresh, answer, claim, markWinsSeen]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside ProgressProvider');
  return ctx;
}
