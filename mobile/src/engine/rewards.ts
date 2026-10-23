import type { Card } from '@/content';

/** About 20 focused minutes. */
export const DAILY_XP_GOAL = 300;

const BASE_XP: Record<Card['type'], number> = { concept: 10, mcq: 10, yaml: 15, cmd: 20 };
/** Answering within this many seconds earns the speed bonus. The exam is a race. */
const FAST_SECONDS: Record<Card['type'], number> = { concept: 8, mcq: 8, yaml: 15, cmd: 20 };

export function isFast(card: Card, ms: number) {
  return ms <= FAST_SECONDS[card.type] * 1000;
}

export function comboMultiplier(combo: number) {
  if (combo >= 10) return 2;
  if (combo >= 5) return 1.5;
  return 1;
}

export interface XpBreakdown {
  total: number;
  fast: boolean;
  multiplier: number;
}

/**
 * combo = streak of correct answers in this session, including this one.
 * Boss cards pay 5x the first time you clear them, 2x on later reviews.
 */
export function xpFor(card: Card, correct: boolean, ms: number, combo: number, bonusRound: boolean, firstClear: boolean): XpBreakdown {
  if (!correct) return { total: 0, fast: false, multiplier: 1 };
  const fast = isFast(card, ms);
  let xp = BASE_XP[card.type] * (fast ? 1.5 : 1);
  const multiplier = comboMultiplier(combo) * (card.boss ? (firstClear ? 5 : 2) : 1) * (bonusRound ? 0.5 : 1);
  xp *= multiplier;
  return { total: Math.round(xp), fast, multiplier };
}

// Level L needs 150·L·(L−1) total XP: 300 for L2, 900 for L3, 1800 for L4…
// Tuned so a steady hour a day lands around level 25 by exam day.
const LEVEL_FACTOR = 150;

export function levelForXp(xp: number) {
  return Math.floor((1 + Math.sqrt(1 + (4 * xp) / LEVEL_FACTOR)) / 2);
}

export function xpForLevel(level: number) {
  return LEVEL_FACTOR * level * (level - 1);
}

const TITLES: [number, string][] = [
  [1, 'Pod Rookie'],
  [3, 'Container Wrangler'],
  [5, 'ReplicaSet Rider'],
  [8, 'Deployment Pilot'],
  [12, 'Node Whisperer'],
  [16, 'Cluster Captain'],
  [20, 'etcd Guardian'],
  [25, 'Control Plane Legend'],
];

export function titleForLevel(level: number) {
  let title = TITLES[0][1];
  for (const [min, t] of TITLES) if (level >= min) title = t;
  return title;
}
