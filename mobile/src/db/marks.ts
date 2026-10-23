import type { SQLiteDatabase } from 'expo-sqlite';

export type MarkKind = 'like' | 'save';

export async function loadMarks(db: SQLiteDatabase, kind: MarkKind): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ item_id: string }>('SELECT item_id FROM marks WHERE kind = ? ORDER BY ts DESC', kind);
  return new Set(rows.map((r) => r.item_id));
}

/** Flips a like/save and returns the new state. */
export async function toggleMark(db: SQLiteDatabase, itemId: string, kind: MarkKind): Promise<boolean> {
  const existing = await db.getFirstAsync('SELECT 1 FROM marks WHERE item_id = ? AND kind = ?', itemId, kind);
  if (existing) {
    await db.runAsync('DELETE FROM marks WHERE item_id = ? AND kind = ?', itemId, kind);
    return false;
  }
  await db.runAsync('INSERT INTO marks (item_id, kind, ts) VALUES (?, ?, ?)', itemId, kind, Date.now());
  return true;
}
