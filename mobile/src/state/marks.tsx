// Likes and saves, kept in memory and mirrored to SQLite.
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadMarks, toggleMark, type MarkKind } from '@/db/marks';
import { haptic } from '@/lib/haptics';

interface MarksValue {
  liked: Set<string>;
  saved: Set<string>;
  toggle: (itemId: string, kind: MarkKind) => void;
}

const MarksContext = createContext<MarksValue | null>(null);

export function MarksProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMarks(db, 'like').then(setLiked);
    loadMarks(db, 'save').then(setSaved);
  }, [db]);

  const toggle = useCallback(
    (itemId: string, kind: MarkKind) => {
      haptic.tap();
      const set = kind === 'like' ? setLiked : setSaved;
      // Optimistic: flip now, persist in the background.
      set((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      });
      toggleMark(db, itemId, kind).catch(() => {});
    },
    [db]
  );

  const value = useMemo(() => ({ liked, saved, toggle }), [liked, saved, toggle]);
  return <MarksContext.Provider value={value}>{children}</MarksContext.Provider>;
}

export function useMarks() {
  const ctx = useContext(MarksContext);
  if (!ctx) throw new Error('useMarks must be used inside MarksProvider');
  return ctx;
}
