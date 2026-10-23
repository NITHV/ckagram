// Builds the card queue for the feed and for focused sessions.
// Mix: due reviews first (they protect what you already know), new cards woven in,
// and a rare boss card as a surprise reward.
import type { SQLiteDatabase } from 'expo-sqlite';
import { ALL_CARDS, type Card, type DomainId } from '@/content';
import { getMeta } from '@/db/schema';
import { daysBetween, startOfToday } from '@/lib/dates';
import { NEW_PER_DAY, loadStates, unlockedWeek } from './progress';
import { State } from './srs';
import { fsrs } from 'ts-fsrs';

export type FeedMode =
  | { kind: 'home' }
  | { kind: 'domain'; domain: DomainId }
  | { kind: 'labs' }
  | { kind: 'drill' }
  /** Specific cards, in order: saved posts, a search result, a reel quiz. */
  | { kind: 'ids'; ids: string[] };

export interface QueueItem {
  key: string;
  card: Card;
  isNew: boolean;
  /** Bonus drill of already-known cards: half XP. */
  bonus: boolean;
}

const BOSS_CHANCE = 1 / 12;
const retrievability = fsrs();

function matches(mode: FeedMode, card: Card) {
  if (mode.kind === 'domain') return card.domain === mode.domain;
  if (mode.kind === 'labs') return card.type === 'cmd' || card.type === 'yaml';
  return true;
}

let keyCounter = 0;
function item(card: Card, isNew: boolean, bonus = false): QueueItem {
  return { key: `${card.id}#${keyCounter++}`, card, isNew, bonus };
}

export async function buildQueue(
  db: SQLiteDatabase,
  mode: FeedMode,
  exclude: Set<string>,
  size = 15,
  now = new Date()
): Promise<QueueItem[]> {
  const nowMs = now.getTime();
  const states = await loadStates(db);

  if (mode.kind === 'ids') {
    return mode.ids
      .filter((id) => !exclude.has(id))
      .map((id) => ALL_CARDS.find((c) => c.id === id))
      .filter((c): c is Card => !!c)
      .slice(0, size)
      .map((c) => item(c, !states.has(c.id)));
  }

  if (mode.kind === 'drill') {
    // Weakest known cards first.
    return [...states.values()]
      .filter((s) => !exclude.has(s.card_id) && s.due > nowMs && s.card.state !== State.New)
      .map((s) => ({ s, r: retrievability.get_retrievability(s.card, now, false) }))
      .sort((a, b) => a.r - b.r)
      .slice(0, size)
      .map(({ s }) => ALL_CARDS.find((c) => c.id === s.card_id))
      .filter((c): c is Card => !!c)
      .map((c) => item(c, false, true));
  }

  const due = ALL_CARDS.filter((c) => {
    const s = states.get(c.id);
    return s && s.due <= nowMs && !exclude.has(c.id) && matches(mode, c);
  }).sort((a, b) => states.get(a.id)!.due - states.get(b.id)!.due);

  const startDate = Number((await getMeta(db, 'start_date')) ?? nowMs);
  const studyWeek = Math.floor(daysBetween(startDate, nowMs) / 7) + 1;
  const unlocked = unlockedWeek(studyWeek, states);
  const fresh = ALL_CARDS.filter((c) => !states.has(c.id) && !exclude.has(c.id) && c.week <= unlocked && matches(mode, c))
    // Stable sort: earlier weeks first, file order within a week.
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.week - b.c.week || a.i - b.i)
    .map(({ c }) => c);
  const freshNormal = fresh.filter((c) => !c.boss);
  const freshBoss = fresh.filter((c) => c.boss);

  const todayStart = startOfToday(now);
  let introducedToday = 0;
  for (const s of states.values()) if (s.first_seen >= todayStart) introducedToday++;
  // Cards already queued as new this session count against the daily budget too.
  let newBudget = Math.max(0, NEW_PER_DAY - introducedToday - [...exclude].filter((id) => !states.has(id)).length);

  const out: QueueItem[] = [];
  let slot = 0;
  while (out.length < size) {
    const wantNew = slot % 3 === 2; // pattern: review, review, new
    slot++;
    const canNew = newBudget > 0 && (freshNormal.length > 0 || freshBoss.length > 0);
    if ((wantNew || due.length === 0) && canNew) {
      const useBoss = freshBoss.length > 0 && (freshNormal.length === 0 || Math.random() < BOSS_CHANCE);
      out.push(item((useBoss ? freshBoss : freshNormal).shift()!, true));
      newBudget--;
    } else if (due.length > 0) {
      out.push(item(due.shift()!, false));
    } else {
      break;
    }
  }
  return out;
}
