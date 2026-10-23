// Spaced repetition with FSRS (the algorithm modern Anki uses).
// Cards come back right before you'd forget them, so reviews stay short and stick.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FsrsCard } from 'ts-fsrs';

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }));

export type StoredFsrs = Omit<FsrsCard, 'due' | 'last_review'> & { due: string; last_review?: string };

export function serialize(card: FsrsCard): string {
  return JSON.stringify(card);
}

export function deserialize(json: string): FsrsCard {
  const raw = JSON.parse(json) as StoredFsrs;
  return { ...raw, due: new Date(raw.due), last_review: raw.last_review ? new Date(raw.last_review) : undefined };
}

export function grade(previous: FsrsCard | null, correct: boolean, fast: boolean, now: Date): FsrsCard {
  const card: FsrsCard = previous ?? createEmptyCard<FsrsCard>(now);
  let rating = correct ? Rating.Good : Rating.Again;
  // A fast correct answer on a card you already know well counts as Easy.
  if (correct && fast && card.state === State.Review && card.reps >= 2) rating = Rating.Easy;
  return scheduler.next(card, now, rating).card;
}

/** A card counts as exam-ready once FSRS expects you to remember it for 3+ weeks. */
export const READY_STABILITY_DAYS = 21;

export function readiness(card: FsrsCard): number {
  if (card.state !== State.Review) return 0;
  return Math.min(1, card.stability / READY_STABILITY_DAYS);
}

export { State };
