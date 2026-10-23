// Mock exams: a timed, domain-weighted test with no feedback until the end,
// like the real CKA. Taken on the phone, or on the laptop with `ckalab mock` (claimed by QR).
import type { SQLiteDatabase } from 'expo-sqlite';
import { ALL_CARDS, DOMAINS, type Card, type DomainId } from '@/content';
import { PASS_SCORE } from '@/content/labs';
import { dayKey } from '@/lib/dates';
import { loadStats, type Stats } from './progress';
import type { Celebration } from './record';

export const MOCK_SIZE = 25;
export const MOCK_MINUTES = 30;
const XP_PER_CORRECT = 10;
const PHONE_PASS_BONUS = 100;
const LAPTOP_PASS_BONUS = 250;

/** Earliest week a mock can draw from, so the first mock isn't all kubectl basics. */
const MIN_POOL_WEEK = 4;

/**
 * Picks questions weighted by exam domain, from every week you've unlocked.
 * Domains without cards yet give their share to the others.
 */
export function buildMock(unlockedWeek: number, size = MOCK_SIZE, rand = Math.random): Card[] {
  const week = Math.max(unlockedWeek, MIN_POOL_WEEK);
  const shuffle = <T,>(a: T[]) => {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const pools = new Map<DomainId, Card[]>(DOMAINS.map((d) => [d.id, shuffle(ALL_CARDS.filter((c) => c.domain === d.id && c.week <= week))]));
  const active = DOMAINS.filter((d) => pools.get(d.id)!.length > 0);
  const weightSum = active.reduce((n, d) => n + d.weight, 0);

  const picked: Card[] = [];
  for (const d of active) {
    const want = Math.round((size * d.weight) / weightSum);
    picked.push(...pools.get(d.id)!.splice(0, want));
  }
  // Rounding and small domains: top up from whatever is left, trim any excess.
  const rest = shuffle(active.flatMap((d) => pools.get(d.id)!));
  while (picked.length < size && rest.length) picked.push(rest.shift()!);
  return shuffle(picked.slice(0, size));
}

export interface MockAnswer {
  cardId: string;
  correct: boolean;
}

export interface DomainScore {
  correct: number;
  total: number;
}

export interface MockResult {
  id: number;
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  seconds: number;
  xp: number;
  byDomain: Partial<Record<DomainId, DomainScore>>;
  missed: string[];
  bestBefore: number | null;
  celebrations: Celebration[];
  stats: Stats;
}

export function scoreMock(questions: Card[], answers: MockAnswer[]) {
  const byId = new Map(answers.map((a) => [a.cardId, a.correct]));
  const byDomain: Partial<Record<DomainId, DomainScore>> = {};
  const missed: string[] = [];
  let correct = 0;
  for (const q of questions) {
    const ok = byId.get(q.id) === true; // unanswered counts as wrong
    const d = (byDomain[q.domain] ??= { correct: 0, total: 0 });
    d.total++;
    if (ok) {
      d.correct++;
      correct++;
    } else missed.push(q.id);
  }
  const total = questions.length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, score, passed: score >= PASS_SCORE, byDomain, missed };
}

async function bestScore(db: SQLiteDatabase, kind: 'phone' | 'laptop') {
  const row = await db.getFirstAsync<{ best: number | null }>('SELECT MAX(score) AS best FROM mock_runs WHERE kind = ?', kind);
  return row?.best ?? null;
}

async function mockWins(db: SQLiteDatabase, kind: 'phone' | 'laptop', score: number, passed: boolean, bestBefore: number | null, before: Stats, after: Stats, now: Date) {
  const label = kind === 'phone' ? 'Mock exam' : 'Laptop mock';
  const wins: Celebration[] = [];
  wins.push(
    passed
      ? { kind: 'mock', emoji: '🎓', title: `${label} passed: ${score}%`, detail: `Pass mark is ${PASS_SCORE}%`, big: true }
      : { kind: 'mock', emoji: '📝', title: `${label}: ${score}%`, detail: `${PASS_SCORE - score} points to the pass mark`, big: false }
  );
  if (bestBefore !== null && score > bestBefore) wins.push({ kind: 'pb', emoji: '📈', title: `New best mock score: ${score}%`, detail: `Was ${bestBefore}%`, big: true });
  if (after.level > before.level) wins.push({ kind: 'level', emoji: '⬆️', title: `Level ${after.level}`, detail: after.title, big: true });
  if (before.todayXp < before.dailyGoal && after.todayXp >= after.dailyGoal) {
    wins.push({ kind: 'goal', emoji: '🎯', title: 'Daily goal smashed', detail: `${after.todayXp} XP today`, big: true });
  }
  for (const w of wins) {
    if (!w.big && w.kind !== 'mock') continue;
    await db.runAsync('INSERT INTO wins (ts, kind, emoji, title, detail) VALUES (?, ?, ?, ?, ?)', now.getTime(), w.kind, w.emoji, w.title, w.detail ?? '');
  }
  return wins;
}

/** Saves a finished phone mock. Missed cards you've studied come back due right away. */
export async function recordMock(db: SQLiteDatabase, questions: Card[], answers: MockAnswer[], seconds: number, before: Stats): Promise<MockResult> {
  const now = new Date();
  const s = scoreMock(questions, answers);
  const xp = s.correct * XP_PER_CORRECT + (s.passed ? PHONE_PASS_BONUS : 0);
  const bestBefore = await bestScore(db, 'phone');

  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      'INSERT INTO mock_runs (kind, score, correct, total, seconds, passed, xp, nonce, detail, ts, day) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)',
      'phone',
      s.score,
      s.correct,
      s.total,
      Math.round(seconds),
      s.passed ? 1 : 0,
      xp,
      JSON.stringify({ byDomain: s.byDomain, missed: s.missed }),
      now.getTime(),
      dayKey(now)
    );
    id = Number(r.lastInsertRowId);
    for (const cardId of s.missed) {
      await db.runAsync('UPDATE card_state SET due = ? WHERE card_id = ? AND due > ?', now.getTime(), cardId, now.getTime());
    }
  });

  const after = await loadStats(db, now);
  const celebrations = await mockWins(db, 'phone', s.score, s.passed, bestBefore, before, after, now);
  return { id, ...s, seconds, xp, bestBefore, celebrations, stats: after };
}

export interface LaptopMock {
  score: number;
  passedTasks: number;
  totalTasks: number;
  seconds: number;
  completedAt: number;
  nonce: string;
}

export function laptopMockXp(score: number) {
  return score * XP_PER_CORRECT + (score >= PASS_SCORE ? LAPTOP_PASS_BONUS : 0);
}

/** Records a `ckalab mock` claim. The caller has already verified the signature and nonce. */
export async function recordLaptopMock(db: SQLiteDatabase, m: LaptopMock, before: Stats) {
  const now = new Date();
  const passed = m.score >= PASS_SCORE;
  const xp = laptopMockXp(m.score);
  const bestBefore = await bestScore(db, 'laptop');
  await db.runAsync(
    'INSERT INTO mock_runs (kind, score, correct, total, seconds, passed, xp, nonce, detail, ts, day) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    'laptop',
    m.score,
    m.passedTasks,
    m.totalTasks,
    m.seconds,
    passed ? 1 : 0,
    xp,
    m.nonce,
    JSON.stringify({ completedAt: m.completedAt }),
    now.getTime(),
    dayKey(now)
  );
  const after = await loadStats(db, now);
  const celebrations = await mockWins(db, 'laptop', m.score, passed, bestBefore, before, after, now);
  return { xp, passed, bestBefore, celebrations, stats: after };
}

export interface MockRun {
  id: number;
  kind: 'phone' | 'laptop';
  score: number;
  correct: number;
  total: number;
  seconds: number;
  passed: boolean;
  xp: number;
  ts: number;
  byDomain: Partial<Record<DomainId, DomainScore>>;
  missed: string[];
}

export async function loadMockRuns(db: SQLiteDatabase, limit = 20): Promise<MockRun[]> {
  const rows = await db.getAllAsync<{ id: number; kind: 'phone' | 'laptop'; score: number; correct: number; total: number; seconds: number; passed: number; xp: number; ts: number; detail: string }>(
    'SELECT id, kind, score, correct, total, seconds, passed, xp, ts, detail FROM mock_runs ORDER BY ts DESC LIMIT ?',
    limit
  );
  return rows.map((r) => {
    let detail: { byDomain?: MockRun['byDomain']; missed?: string[] } = {};
    try {
      detail = JSON.parse(r.detail);
    } catch {}
    return { ...r, passed: !!r.passed, byDomain: detail.byDomain ?? {}, missed: detail.missed ?? [] };
  });
}
