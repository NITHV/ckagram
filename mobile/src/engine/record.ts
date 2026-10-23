// Saves an answer and works out which wins to celebrate.
import type { SQLiteDatabase } from 'expo-sqlite';
import { DOMAIN_BY_ID, DOMAINS } from '@/content';
import { dayKey } from '@/lib/dates';
import { deserialize, grade, serialize } from './srs';
import { loadStats, type Stats } from './progress';
import { comboMultiplier, isFast, xpFor, type XpBreakdown } from './rewards';
import type { QueueItem } from './feed';

export interface Celebration {
  kind: 'level' | 'streak' | 'goal' | 'boss' | 'combo' | 'domain' | 'readiness' | 'pb' | 'lab' | 'reel' | 'mock';
  emoji: string;
  title: string;
  detail?: string;
  /** Big wins get confetti and a strong haptic. */
  big: boolean;
}

export interface AnswerResult {
  xp: XpBreakdown;
  celebrations: Celebration[];
  stats: Stats;
}

const COMBO_MILESTONES = [5, 10, 20, 30, 50];

export async function recordAnswer(
  db: SQLiteDatabase,
  entry: QueueItem,
  correct: boolean,
  ms: number,
  combo: number,
  before: Stats
): Promise<AnswerResult> {
  const now = new Date();
  const { card } = entry;
  const prevRow = await db.getFirstAsync<{ fsrs: string; first_seen: number }>(
    'SELECT fsrs, first_seen FROM card_state WHERE card_id = ?',
    card.id
  );
  const prev = prevRow ? deserialize(prevRow.fsrs) : null;
  const next = grade(prev, correct, isFast(card, ms), now);
  const bestRow = await db.getFirstAsync<{ best: number | null; n: number }>(
    'SELECT MIN(ms) AS best, COUNT(*) AS n FROM reviews WHERE card_id = ? AND correct = 1',
    card.id
  );
  const firstClear = (bestRow?.n ?? 0) === 0;
  const xp = xpFor(card, correct, ms, combo, entry.bonus, firstClear);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO card_state (card_id, due, first_seen, fsrs) VALUES (?, ?, ?, ?)
       ON CONFLICT(card_id) DO UPDATE SET due = excluded.due, fsrs = excluded.fsrs`,
      card.id,
      next.due.getTime(),
      prevRow?.first_seen ?? now.getTime(),
      serialize(next)
    );
    await db.runAsync(
      'INSERT INTO reviews (card_id, ts, day, correct, ms, xp) VALUES (?, ?, ?, ?, ?, ?)',
      card.id,
      now.getTime(),
      dayKey(now),
      correct ? 1 : 0,
      Math.round(ms),
      xp.total
    );
  });

  const after = await loadStats(db, now);
  const wins: Celebration[] = [];

  if (correct) {
    if (before.todayXp === 0 && after.streak >= 1) {
      wins.push(
        after.streak === 1
          ? { kind: 'streak', emoji: '🔥', title: 'Streak started', detail: 'Come back tomorrow to keep it alive', big: false }
          : { kind: 'streak', emoji: '🔥', title: `${after.streak}-day streak`, detail: after.streak > before.bestStreak ? 'New personal record!' : 'Kept it alive', big: true }
      );
    }
    if (after.level > before.level) {
      wins.push({ kind: 'level', emoji: '⬆️', title: `Level ${after.level}`, detail: after.title, big: true });
    }
    if (before.todayXp < before.dailyGoal && after.todayXp >= after.dailyGoal) {
      wins.push({ kind: 'goal', emoji: '🎯', title: 'Daily goal smashed', detail: `${after.todayXp} XP today`, big: true });
    }
    if (card.boss && firstClear) {
      wins.push({ kind: 'boss', emoji: '👑', title: 'Boss card cleared', detail: card.topic, big: true });
    }
    if (COMBO_MILESTONES.includes(combo)) {
      wins.push({ kind: 'combo', emoji: '⚡', title: `${combo} in a row`, detail: `XP ×${comboMultiplier(combo)}`, big: combo >= 10 });
    }
    if (bestRow && bestRow.n >= 1 && bestRow.best !== null && ms < bestRow.best) {
      wins.push({ kind: 'pb', emoji: '⏱️', title: `Personal best: ${(ms / 1000).toFixed(1)}s`, detail: card.topic, big: false });
    }
    for (const d of DOMAINS) {
      const b = Math.floor(before.domains[d.id].mastery * 10);
      const a = Math.floor(after.domains[d.id].mastery * 10);
      if (a > b) {
        wins.push({ kind: 'domain', emoji: d.emoji, title: `${DOMAIN_BY_ID[d.id].short} ${a * 10}% mastered`, big: true });
      }
    }
    if (Math.floor(after.readiness * 20) > Math.floor(before.readiness * 20)) {
      wins.push({ kind: 'readiness', emoji: '📈', title: `Exam readiness ${Math.round(after.readiness * 100)}%`, big: true });
    }
  }

  // Keep the meaningful ones for the Activity tab.
  const keep = wins.filter((w) => w.kind !== 'pb' && !(w.kind === 'combo' && combo < 10) && !(w.kind === 'streak' && after.streak === 1));
  for (const w of keep) {
    await db.runAsync(
      'INSERT INTO wins (ts, kind, emoji, title, detail) VALUES (?, ?, ?, ?, ?)',
      now.getTime(),
      w.kind,
      w.emoji,
      w.title,
      w.detail ?? ''
    );
  }

  return { xp, celebrations: wins, stats: after };
}
