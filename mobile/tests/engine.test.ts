// Engine test: simulates days of study against real SQLite (node:sqlite) and checks
// scheduling, streaks, XP, lab claims and anti-double-claim. Run: npm run test:engine
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { claimPayload } from '@/content/labs';
import { migrate } from '@/db/schema';
import { buildQueue } from '@/engine/feed';
import { AlreadyClaimedError, parseClaimUrl, recordClaim, verifyClaim } from '@/engine/labs';
import { loadStats } from '@/engine/progress';
import { recordAnswer } from '@/engine/record';

// --- expo-sqlite's async API on top of node:sqlite -------------------------------------------
function wrap(d: DatabaseSync): any {
  const norm = (p: any[]) => (p.length === 1 && Array.isArray(p[0]) ? p[0] : p);
  const db: any = {
    execAsync: async (sql: string) => d.exec(sql),
    runAsync: async (sql: string, ...p: any[]) => d.prepare(sql).run(...norm(p)),
    getAllAsync: async (sql: string, ...p: any[]) => d.prepare(sql).all(...norm(p)),
    getFirstAsync: async (sql: string, ...p: any[]) => d.prepare(sql).get(...norm(p)) ?? null,
    withTransactionAsync: async (fn: () => Promise<void>) => {
      d.exec('BEGIN');
      try {
        await fn();
        d.exec('COMMIT');
      } catch (e) {
        d.exec('ROLLBACK');
        throw e;
      }
    },
    withExclusiveTransactionAsync: async (fn: (tx: any) => Promise<void>) => db.withTransactionAsync(() => fn(db)),
  };
  return db;
}

// --- controllable clock -----------------------------------------------------------------------
const realNow = Date.now;
let offsetDays = 0;
const RealDate = Date;
(globalThis as any).Date = class extends RealDate {
  constructor(...a: any[]) {
    if (a.length === 0) super(realNow() + offsetDays * 86400000);
    else super(...(a as []));
  }
  static now() {
    return realNow() + offsetDays * 86400000;
  }
};

let failures = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} - ${msg}`);
  if (!cond) failures++;
};

// Deterministic "player": right 80% of the time.
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const db = wrap(new DatabaseSync(':memory:'));
await migrate(db);

for (let day = 0; day < 9; day++) {
  offsetDays = day;
  if (day === 6) continue; // skip a day to break the streak
  let stats = await loadStats(db);
  let combo = 0;
  for (let round = 0; round < 4; round++) {
    const q = await buildQueue(db, { kind: 'home' }, new Set(), 15);
    if (!q.length) break;
    for (const item of q) {
      const correct = rand() < 0.8;
      combo = correct ? combo + 1 : 0;
      stats = (await recordAnswer(db, item, correct, correct ? 5000 : 12000, combo, stats)).stats;
    }
  }
  if (day === 0) {
    check(stats.newToday <= 20, `daily new-card cap respected (${stats.newToday})`);
    check(stats.streak === 1, 'streak is 1 after the first day');
    check(stats.level >= 2, `levels up on day one (level ${stats.level})`);
  }
  if (day === 5) check(stats.streak === 6, 'streak is 6 after six straight days');
  if (day === 7) check(stats.streak === 1, 'streak resets after a skipped day');
  if (day === 8) {
    check(stats.bestStreak === 6, 'best streak is remembered');
    check(stats.level >= 5 && stats.level <= 12, `leveling pace is sane after 9 days (level ${stats.level})`);
    check(stats.knowledge > 0, 'knowledge readiness grows');
  }
}

const drill = await buildQueue(db, { kind: 'drill' }, new Set(), 10);
check(drill.length > 0 && drill.every((i) => i.bonus), 'drill returns half-XP bonus cards');
const labs = await buildQueue(db, { kind: 'labs' }, new Set(), 10);
check(labs.every((i) => i.card.type === 'cmd' || i.card.type === 'yaml'), 'mini-labs mode only has cmd/yaml cards');
const ids = await buildQueue(db, { kind: 'ids', ids: ['pod-01', 'dep-02'] }, new Set(), 10);
check(ids.map((i) => i.card.id).join() === 'pod-01,dep-02', 'explicit ids mode keeps order');

// --- lab claims, exactly as `ckalab check` creates them --------------------------------------
const sha256 = async (t: string) => createHash('sha256').update(t).digest('hex');
const t = Date.now();
const sig = (await sha256(claimPayload('image-pull', 200, t, 'abc123'))).slice(0, 20);
const url = `ckagram://claim?l=image-pull&s=200&t=${t}&n=abc123&h=${sig}`;
const params = parseClaimUrl(url)!;
const v = await verifyClaim(params, sha256);
check(v.ok, 'a ckalab claim URL verifies');
check(!(await verifyClaim({ ...params, s: '1' }, sha256)).ok, 'a tampered claim is rejected');
check(!(await verifyClaim({ ...params, l: 'nope' }, sha256)).ok, 'an unknown lab is rejected');
check(parseClaimUrl('https://example.com/?l=x') === null, 'non-CKAgram QR codes are ignored');
if (v.ok) {
  const before = await loadStats(db);
  const r = await recordClaim(db, v.claim, before);
  check(r.firstClear && r.underTarget && r.xp.total === Math.round(150 * 1.25), `first clear under target pays ${r.xp.total} XP`);
  check(r.stats.xp === before.xp + r.xp.total, 'lab XP adds to total XP');
  check(r.stats.labsDone === before.labsDone + 1 && r.stats.handsOn > before.handsOn, 'hands-on readiness grows');
  let blocked = false;
  try {
    await recordClaim(db, v.claim, r.stats);
  } catch (e) {
    blocked = e instanceof AlreadyClaimedError;
  }
  check(blocked, 'the same QR cannot be claimed twice');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall engine checks pass');
process.exit(failures ? 1 : 0);
