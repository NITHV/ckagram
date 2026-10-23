import type { SQLiteDatabase } from 'expo-sqlite';
import { ALL_CARDS, DOMAINS, type Card, type DomainId } from '@/content';
import { LABS } from '@/content/labs';
import { getMeta } from '@/db/schema';
import { dayKey, daysBetween, previousDayKey, startOfToday } from '@/lib/dates';
import { DAILY_XP_GOAL, levelForXp, titleForLevel, xpForLevel } from './rewards';
import { deserialize, readiness } from './srs';
import type { Card as FsrsCard } from 'ts-fsrs';

/** New cards introduced per day. Keeps reviews from piling up later. */
export const NEW_PER_DAY = 20;
export const DEFAULT_EXAM_DATE = '2027-01-28';
/** Hands-on labs the plan aims for by exam day; readiness compares against this. */
export const TARGET_LABS = 40;
/** The exam is hands-on, so labs carry a quarter of the readiness score. */
const HANDS_ON_WEIGHT = 0.25;

// Readiness compares against the full curriculum, not just the cards shipped so far,
// so the score can't hit 100% after one week of content.
const TARGET_CARDS: Record<DomainId, number> = {
  troubleshooting: 120,
  architecture: 100,
  networking: 80,
  workloads: 60,
  storage: 40,
};

export interface DomainStats {
  id: DomainId;
  due: number;
  fresh: number;
  learned: number;
  total: number;
  /** 0–1 against the full curriculum. */
  mastery: number;
}

export interface TopicStats {
  topic: string;
  domain: DomainId;
  total: number;
  learned: number;
  /** 0–1 over the cards that exist for this topic. */
  mastery: number;
}

export interface Stats {
  xp: number;
  level: number;
  title: string;
  levelProgress: number;
  xpToNext: number;
  todayXp: number;
  dailyGoal: number;
  streak: number;
  /** Streak exists but nothing correct yet today. */
  streakAtRisk: boolean;
  bestStreak: number;
  /** Overall: knowledge (cards) blended with hands-on (labs). */
  readiness: number;
  knowledge: number;
  handsOn: number;
  labsDone: number;
  labBest: Record<string, number>;
  /** Wins since the Activity tab was last opened. */
  newWins: number;
  mockCount: number;
  /** Best mock score (0–100) on phone or laptop, or null before the first mock. */
  mockBest: number | null;
  mockLast: { score: number; passed: boolean; kind: 'phone' | 'laptop'; ts: number } | null;
  dueTotal: number;
  freshTotal: number;
  learnedTotal: number;
  newToday: number;
  studyWeek: number;
  unlockedWeek: number;
  examDate: string;
  daysToExam: number;
  domains: Record<DomainId, DomainStats>;
  topics: TopicStats[];
}

export interface StateRow {
  card_id: string;
  due: number;
  first_seen: number;
  fsrs: string;
}

export async function loadStates(db: SQLiteDatabase): Promise<Map<string, StateRow & { card: FsrsCard }>> {
  const rows = await db.getAllAsync<StateRow>('SELECT card_id, due, first_seen, fsrs FROM card_state');
  return new Map(rows.map((r) => [r.card_id, { ...r, card: deserialize(r.fsrs) }]));
}

export function unlockedWeek(studyWeek: number, states: Map<string, unknown>) {
  // If you've seen everything up to this week, the next week's cards open early.
  const unseen = ALL_CARDS.filter((c) => !states.has(c.id)).map((c) => c.week);
  const minUnseen = unseen.length ? Math.min(...unseen) : studyWeek;
  return Math.max(studyWeek, minUnseen);
}

function computeStreak(days: string[], today: string) {
  const set = new Set(days);
  let cursor = set.has(today) ? today : previousDayKey(today);
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    cursor = previousDayKey(cursor);
  }
  // Longest run ever.
  const sorted = [...set].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev !== null && previousDayKey(d) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { streak, best };
}

export async function loadStats(db: SQLiteDatabase, now = new Date()): Promise<Stats> {
  const nowMs = now.getTime();
  const states = await loadStates(db);

  const totals = await db.getFirstAsync<{ xp: number | null }>(
    'SELECT (SELECT IFNULL(SUM(xp), 0) FROM reviews) + (SELECT IFNULL(SUM(xp), 0) FROM lab_runs) + (SELECT IFNULL(SUM(xp), 0) FROM mock_runs) AS xp'
  );
  const today = await db.getFirstAsync<{ xp: number | null; correct: number | null }>(
    `SELECT (SELECT IFNULL(SUM(xp), 0) FROM reviews WHERE day = $d) + (SELECT IFNULL(SUM(xp), 0) FROM lab_runs WHERE day = $d)
              + (SELECT IFNULL(SUM(xp), 0) FROM mock_runs WHERE day = $d) AS xp,
            (SELECT IFNULL(SUM(correct), 0) FROM reviews WHERE day = $d) + (SELECT COUNT(*) FROM lab_runs WHERE day = $d)
              + (SELECT IFNULL(SUM(correct), 0) FROM mock_runs WHERE day = $d) AS correct`,
    { $d: dayKey(now) }
  );
  // A day counts for the streak if you got a card right, cleared a lab or scored in a mock.
  const dayRows = await db.getAllAsync<{ day: string }>(
    'SELECT DISTINCT day FROM reviews WHERE correct = 1 UNION SELECT DISTINCT day FROM lab_runs UNION SELECT DISTINCT day FROM mock_runs WHERE correct > 0'
  );
  const mockAgg = await db.getFirstAsync<{ n: number; best: number | null }>('SELECT COUNT(*) AS n, MAX(score) AS best FROM mock_runs');
  const mockLastRow = await db.getFirstAsync<{ score: number; passed: number; kind: 'phone' | 'laptop'; ts: number }>(
    'SELECT score, passed, kind, ts FROM mock_runs ORDER BY ts DESC LIMIT 1'
  );
  const labRows = await db.getAllAsync<{ lab_id: string; best: number }>('SELECT lab_id, MIN(seconds) AS best FROM lab_runs GROUP BY lab_id');
  const labBest = Object.fromEntries(labRows.map((r) => [r.lab_id, r.best]));
  const lastSeenWins = Number((await getMeta(db, 'wins_seen_at')) ?? 0);
  const newWinsRow = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM wins WHERE ts > ?', lastSeenWins);
  const startDate = Number((await getMeta(db, 'start_date')) ?? nowMs);
  const examDate = (await getMeta(db, 'exam_date')) ?? DEFAULT_EXAM_DATE;

  const xp = totals?.xp ?? 0;
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const { streak, best } = computeStreak(
    dayRows.map((r) => r.day),
    dayKey(now)
  );

  const studyWeek = Math.min(14, Math.floor(daysBetween(startDate, nowMs) / 7) + 1);
  const unlocked = unlockedWeek(studyWeek, states);
  const todayStart = startOfToday(now);
  let newToday = 0;
  for (const s of states.values()) if (s.first_seen >= todayStart) newToday++;

  const domains = Object.fromEntries(
    DOMAINS.map((d) => [d.id, { id: d.id, due: 0, fresh: 0, learned: 0, total: 0, mastery: 0 }])
  ) as Record<DomainId, DomainStats>;
  const topicMap = new Map<string, TopicStats>();
  const readySum: Record<DomainId, number> = { troubleshooting: 0, architecture: 0, networking: 0, workloads: 0, storage: 0 };

  for (const c of ALL_CARDS) {
    const d = domains[c.domain];
    d.total++;
    const key = `${c.domain}:${c.topic}`;
    const t = topicMap.get(key) ?? { topic: c.topic, domain: c.domain, total: 0, learned: 0, mastery: 0 };
    t.total++;
    const s = states.get(c.id);
    if (s) {
      d.learned++;
      t.learned++;
      const r = readiness(s.card);
      readySum[c.domain] += r;
      t.mastery += r;
      if (s.due <= nowMs) d.due++;
    } else if (c.week <= unlocked) {
      d.fresh++;
    }
    topicMap.set(key, t);
  }

  let knowledge = 0;
  for (const dom of DOMAINS) {
    const d = domains[dom.id];
    d.mastery = readySum[dom.id] / Math.max(TARGET_CARDS[dom.id], d.total);
    knowledge += dom.weight * d.mastery;
  }
  const labsDone = labRows.filter((r) => LABS.some((l) => l.id === r.lab_id)).length;
  const handsOn = Math.min(1, labsDone / TARGET_LABS);
  const topics = [...topicMap.values()].map((t) => ({ ...t, mastery: t.mastery / t.total }));

  return {
    xp,
    level,
    title: titleForLevel(level),
    levelProgress: (xp - floor) / (ceil - floor),
    xpToNext: ceil - xp,
    todayXp: today?.xp ?? 0,
    dailyGoal: DAILY_XP_GOAL,
    streak,
    streakAtRisk: streak > 0 && !(today?.correct ?? 0),
    bestStreak: best,
    readiness: knowledge * (1 - HANDS_ON_WEIGHT) + handsOn * HANDS_ON_WEIGHT,
    knowledge,
    handsOn,
    labsDone,
    labBest,
    newWins: newWinsRow?.n ?? 0,
    mockCount: mockAgg?.n ?? 0,
    mockBest: mockAgg?.best ?? null,
    mockLast: mockLastRow ? { ...mockLastRow, passed: !!mockLastRow.passed } : null,
    dueTotal: DOMAINS.reduce((n, d) => n + domains[d.id].due, 0),
    freshTotal: DOMAINS.reduce((n, d) => n + domains[d.id].fresh, 0),
    learnedTotal: states.size,
    newToday,
    studyWeek,
    unlockedWeek: unlocked,
    examDate,
    daysToExam: daysBetween(nowMs, new Date(examDate + 'T09:00:00').getTime()),
    domains,
    topics,
  };
}

export function cardsForTopic(topic: string, domain: DomainId): Card[] {
  return ALL_CARDS.filter((c) => c.topic === topic && c.domain === domain);
}
