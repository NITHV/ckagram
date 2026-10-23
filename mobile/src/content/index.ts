import { cards as config } from './cards/config';
import { cards as debugPods } from './cards/debug-pods';
import { cards as deployments } from './cards/deployments';
import { cards as kubectl } from './cards/kubectl';
import { cards as pods } from './cards/pods';
import type { Card, DomainId } from './types';

// Order matters: new cards are introduced in this order within a week.
export const ALL_CARDS: Card[] = [...kubectl, ...pods, ...debugPods, ...deployments, ...config];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

export function cardsInDomain(domain: DomainId): Card[] {
  return ALL_CARDS.filter((c) => c.domain === domain);
}

export * from './types';
export * from './domains';
