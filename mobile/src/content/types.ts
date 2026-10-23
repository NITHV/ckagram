// Card content model. Cards are plain data so they can be checked in CI
// (scripts/check-content.ts) and later verified against a real cluster.

export type DomainId = 'troubleshooting' | 'architecture' | 'networking' | 'workloads' | 'storage';

export interface Domain {
  id: DomainId;
  name: string;
  short: string;
  /** Exam weight from the CKA v1.37 curriculum, 0–1. */
  weight: number;
  emoji: string;
  color: string;
}

interface BaseCard {
  id: string;
  domain: DomainId;
  /** Short topic label shown on the card, e.g. "Pods". */
  topic: string;
  /** Study-plan week this card is introduced in. */
  week: number;
  /** Rare "boss" card: harder, worth 5x XP. */
  boss?: boolean;
  /** Shown after answering, right or wrong. */
  explain: string;
  /** kubernetes.io page worth bookmarking for the exam. */
  docs?: string;
}

export interface Question {
  q: string;
  options: string[];
  /** Index into options. */
  answer: number;
}

/** Teaches an idea, then checks it with one question. */
export interface ConceptCard extends BaseCard {
  type: 'concept';
  title: string;
  body: string;
  check: Question;
}

/** Straight recall question. */
export interface McqCard extends BaseCard, Question {
  type: 'mcq';
}

/** Build the kubectl command by tapping tokens in order. */
export interface CmdCard extends BaseCard {
  type: 'cmd';
  task: string;
  /** Canonical command; its space-separated tokens become the tiles. */
  answer: string;
  /** Other accepted orderings of the same tokens. */
  alts?: string[];
  /** Extra wrong tiles mixed in. */
  distractors?: string[];
}

/** Tap the broken line in a manifest. */
export interface YamlCard extends BaseCard {
  type: 'yaml';
  task: string;
  yaml: string;
  /** 0-based index of the broken line. */
  bugLine: number;
  /** What the broken line should be. */
  fixLine: string;
}

export type Card = ConceptCard | McqCard | CmdCard | YamlCard;
