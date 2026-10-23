import type { SQLiteDatabase } from 'expo-sqlite';

// Bump with a new step whenever the schema changes. Steps run in order, once.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE card_state (
    card_id    TEXT PRIMARY KEY NOT NULL,
    due        INTEGER NOT NULL,          -- epoch ms
    first_seen INTEGER NOT NULL,          -- epoch ms
    fsrs       TEXT NOT NULL              -- serialized ts-fsrs Card
  );
  CREATE INDEX idx_card_state_due ON card_state(due);

  CREATE TABLE reviews (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT NOT NULL,
    ts      INTEGER NOT NULL,
    day     TEXT NOT NULL,            -- local YYYY-MM-DD, for streaks
    correct INTEGER NOT NULL,
    ms      INTEGER NOT NULL,
    xp      INTEGER NOT NULL
  );
  CREATE INDEX idx_reviews_ts ON reviews(ts);
  CREATE INDEX idx_reviews_card ON reviews(card_id);
  CREATE INDEX idx_reviews_day ON reviews(day);

  CREATE TABLE wins (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    ts     INTEGER NOT NULL,
    kind   TEXT NOT NULL,
    emoji  TEXT NOT NULL,
    title  TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_wins_ts ON wins(ts);

  CREATE TABLE meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[version]);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
  // First launch: remember when the study plan started.
  await db.runAsync(`INSERT OR IGNORE INTO meta (key, value) VALUES ('start_date', ?)`, String(Date.now()));
}

export async function getMeta(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(db: SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
