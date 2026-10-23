import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { buildQueue, type FeedMode, type QueueItem } from '@/engine/feed';
import { useProgress } from './progress';

/** Set when a focus session answers cards, so the home feed knows to rebuild. */
export const feedSignals = { dirty: false };

/** Card queue with lazy loading, combo tracking and answer recording. */
export function useQueue(mode: FeedMode, batch = 15) {
  const db = useSQLiteContext();
  const { answer } = useProgress();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [combo, setCombo] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const itemsRef = useRef<QueueItem[]>([]);
  const answered = useRef(new Set<string>());
  const comboRef = useRef(0);
  const loading = useRef(false);
  const lastWrite = useRef<Promise<unknown>>(Promise.resolve());
  const modeKey = JSON.stringify(mode);

  const loadMore = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      await lastWrite.current;
      // Skip cards still waiting on screen; answered ones can come back once due again.
      const pending = new Set(itemsRef.current.filter((i) => !answered.current.has(i.key)).map((i) => i.card.id));
      const more = await buildQueue(db, JSON.parse(modeKey) as FeedMode, pending, batch);
      itemsRef.current = [...itemsRef.current, ...more];
      setItems(itemsRef.current);
      setExhausted(more.length === 0);
    } finally {
      loading.current = false;
    }
  }, [db, modeKey, batch]);

  const reset = useCallback(() => {
    itemsRef.current = [];
    answered.current = new Set();
    setItems([]);
    setExhausted(false);
    loadMore();
  }, [loadMore]);

  useEffect(() => {
    reset();
  }, [reset]);

  const onAnswer = useCallback(
    (item: QueueItem, correct: boolean, ms: number) => {
      if (answered.current.has(item.key)) return;
      answered.current.add(item.key);
      if (JSON.parse(modeKey).kind !== 'home') feedSignals.dirty = true;
      comboRef.current = correct ? comboRef.current + 1 : 0;
      setCombo(comboRef.current);
      setAnsweredCount((n) => n + 1);
      if (correct) setCorrectCount((n) => n + 1);
      setBestCombo((b) => Math.max(b, comboRef.current));
      lastWrite.current = answer(item, correct, ms, comboRef.current)
        .then((r) => setSessionXp((x) => x + r.xp.total))
        .catch(() => {});
    },
    [answer, modeKey]
  );

  return { items, exhausted, loadMore, reset, onAnswer, combo, answeredCount, correctCount, bestCombo, sessionXp };
}
