// Claiming laptop-lab completions scanned from the `ckalab check` QR code.
import type { SQLiteDatabase } from 'expo-sqlite';
import { LAB_BY_ID, claimPayload, type LabMeta } from '@/content/labs';
import { dayKey } from '@/lib/dates';
import { loadStats, type Stats } from './progress';
import type { Celebration } from './record';
import type { XpBreakdown } from './rewards';

export interface ClaimParams {
  l?: string;
  s?: string;
  t?: string;
  n?: string;
  h?: string;
}

export interface Claim {
  lab: LabMeta;
  seconds: number;
  completedAt: number;
  nonce: string;
}

export type Sha256 = (text: string) => Promise<string>;

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 10 * 60 * 1000;

/** Parses "ckagram://claim?l=..&s=.." (or just its query) into params. */
export function parseClaimUrl(url: string): ClaimParams | null {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  if (!url.startsWith('ckagram://claim') || !query) return null;
  const out: Record<string, string> = {};
  for (const part of query.split('&')) {
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

export async function verifyClaim(p: ClaimParams, sha256: Sha256, now = Date.now()): Promise<{ ok: true; claim: Claim } | { ok: false; reason: string }> {
  const lab = p.l ? LAB_BY_ID[p.l] : undefined;
  if (!lab) return { ok: false, reason: "This QR code isn't for a lab this version of the app knows. Update the app?" };
  const seconds = Number(p.s);
  const completedAt = Number(p.t);
  if (!Number.isFinite(seconds) || !Number.isFinite(completedAt) || !p.n || !p.h) return { ok: false, reason: 'The QR code is incomplete.' };
  const expected = (await sha256(claimPayload(lab.id, seconds, completedAt, p.n))).toLowerCase().slice(0, 20);
  if (expected !== p.h.toLowerCase()) return { ok: false, reason: "The QR code's signature doesn't match. Run ckalab check again." };
  if (completedAt > now + CLOCK_SKEW_MS) return { ok: false, reason: "This claim is from the future. Check your laptop's clock." };
  if (now - completedAt > MAX_AGE_MS) return { ok: false, reason: 'This claim is more than a week old.' };
  return { ok: true, claim: { lab, seconds, completedAt, nonce: p.n } };
}

export interface ClaimResult {
  xp: XpBreakdown;
  celebrations: Celebration[];
  stats: Stats;
  firstClear: boolean;
  personalBest: boolean;
  underTarget: boolean;
}

export class AlreadyClaimedError extends Error {}

export async function recordClaim(db: SQLiteDatabase, claim: Claim, before: Stats): Promise<ClaimResult> {
  const now = new Date();
  const dup = await db.getFirstAsync('SELECT 1 FROM lab_runs WHERE nonce = ?', claim.nonce);
  if (dup) throw new AlreadyClaimedError('You already claimed this one. Clear the lab again for another round.');

  const prev = await db.getFirstAsync<{ n: number; best: number | null }>('SELECT COUNT(*) AS n, MIN(seconds) AS best FROM lab_runs WHERE lab_id = ?', claim.lab.id);
  const firstClear = (prev?.n ?? 0) === 0;
  const personalBest = !firstClear && prev?.best !== null && claim.seconds < (prev?.best ?? Infinity);
  const underTarget = claim.seconds <= claim.lab.minutes * 60;

  // Full XP the first time; repeats still pay, and speed is rewarded.
  let multiplier = firstClear ? 1 : 0.3;
  if (underTarget) multiplier += 0.25;
  if (personalBest) multiplier += 0.25;
  const total = Math.round(claim.lab.xp * multiplier);

  await db.runAsync(
    'INSERT INTO lab_runs (lab_id, seconds, completed_at, nonce, xp, ts, day) VALUES (?, ?, ?, ?, ?, ?, ?)',
    claim.lab.id,
    claim.seconds,
    claim.completedAt,
    claim.nonce,
    total,
    now.getTime(),
    dayKey(now)
  );

  const after = await loadStats(db, now);
  const mins = `${Math.floor(claim.seconds / 60)}m ${claim.seconds % 60}s`;
  const wins: Celebration[] = [];
  if (before.labsDone === 0 && firstClear) wins.push({ kind: 'lab', emoji: '💻', title: 'First hands-on lab!', detail: 'This is what the exam feels like', big: true });
  wins.push({ kind: 'lab', emoji: claim.lab.boss ? '👑' : '🧪', title: `Lab cleared: ${claim.lab.title}`, detail: mins, big: true });
  if (personalBest) wins.push({ kind: 'pb', emoji: '⏱️', title: `Lab personal best: ${mins}`, detail: claim.lab.title, big: true });
  if (underTarget) wins.push({ kind: 'lab', emoji: '⚡', title: 'Beat the target time', detail: `Target was ${claim.lab.minutes} min`, big: false });
  if (after.level > before.level) wins.push({ kind: 'level', emoji: '⬆️', title: `Level ${after.level}`, detail: after.title, big: true });
  if (before.todayXp < before.dailyGoal && after.todayXp >= after.dailyGoal) {
    wins.push({ kind: 'goal', emoji: '🎯', title: 'Daily goal smashed', detail: `${after.todayXp} XP today`, big: true });
  }

  for (const w of wins.filter((w) => w.big)) {
    await db.runAsync('INSERT INTO wins (ts, kind, emoji, title, detail) VALUES (?, ?, ?, ?, ?)', now.getTime(), w.kind, w.emoji, w.title, w.detail ?? '');
  }
  return { xp: { total, fast: underTarget, multiplier }, celebrations: wins, stats: after, firstClear, personalBest, underTarget };
}
