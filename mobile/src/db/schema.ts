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
  // v2: laptop labs, reels, likes/saves.
  `
  CREATE TABLE lab_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    lab_id       TEXT NOT NULL,
    seconds      INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,          -- when the lab was solved on the laptop
    nonce        TEXT NOT NULL UNIQUE,      -- each QR can be claimed once
    xp           INTEGER NOT NULL,
    ts           INTEGER NOT NULL,          -- when it was claimed on the phone
    day          TEXT NOT NULL
  );
  CREATE INDEX idx_lab_runs_lab ON lab_runs(lab_id);
  CREATE INDEX idx_lab_runs_day ON lab_runs(day);

  CREATE TABLE reel_views (
    reel_id     TEXT PRIMARY KEY NOT NULL,
    first_seen  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    completions INTEGER NOT NULL DEFAULT 0
  );

  -- Likes and saves for cards and reels (id like "pod-01" or "reel:pods").
  CREATE TABLE marks (
    item_id TEXT NOT NULL,
    kind    TEXT NOT NULL,                 -- 'like' | 'save'
    ts      INTEGER NOT NULL,
    PRIMARY KEY (item_id, kind)
  );
  `,
  // v3: mock exams, taken on the phone or on the laptop (claimed by QR).
  `
  CREATE TABLE mock_runs (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    kind     TEXT NOT NULL,              -- 'phone' | 'laptop'
    score    INTEGER NOT NULL,           -- 0–100
    correct  INTEGER NOT NULL,           -- questions (phone) or tasks (laptop) passed
    total    INTEGER NOT NULL,
    seconds  INTEGER NOT NULL,
    passed   INTEGER NOT NULL,
    xp       INTEGER NOT NULL,
    nonce    TEXT UNIQUE,                -- laptop claims only
    detail   TEXT NOT NULL DEFAULT '{}', -- JSON: per-domain results, missed card ids
    ts       INTEGER NOT NULL,
    day      TEXT NOT NULL
  );
  CREATE INDEX idx_mock_runs_day ON mock_runs(day);
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
