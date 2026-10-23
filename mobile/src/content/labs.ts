import type { DomainId } from './types';

// Laptop labs: real broken clusters fixed on the PC with `ckalab`.
// Shared by the app (catalog + claim checks) and the runner in /labs (Node strips the types).

export interface LabMeta {
  id: string;
  title: string;
  domain: DomainId;
  week: number;
  /** Target time; beating it earns a speed badge. */
  minutes: number;
  xp: number;
  summary: string;
  boss?: boolean;
}

export const LABS: LabMeta[] = [
  { id: 'first-deploy', title: 'Ship the frontend', domain: 'workloads', week: 1, minutes: 6, xp: 150, summary: 'Create a labeled 3-replica Deployment from scratch.' },
  { id: 'image-pull', title: 'The typo that took prod down', domain: 'troubleshooting', week: 1, minutes: 5, xp: 150, summary: 'A Deployment is stuck in ImagePullBackOff.' },
  { id: 'crashloop', title: 'Worker in a crash loop', domain: 'troubleshooting', week: 1, minutes: 6, xp: 150, summary: 'A Pod keeps dying right after it starts.' },
  { id: 'configmap-env', title: 'Config from the outside', domain: 'workloads', week: 2, minutes: 8, xp: 200, summary: 'Feed a ConfigMap into a Pod as env vars.' },
  { id: 'secret-volume', title: 'Mount the secret', domain: 'workloads', week: 2, minutes: 8, xp: 200, summary: 'Mount a Secret read-only as files.' },
  { id: 'rollback', title: 'Bad release, roll it back', domain: 'workloads', week: 2, minutes: 5, xp: 200, summary: 'Recover a Deployment stuck on a broken image.' },
  { id: 'pending-cpu', title: 'Stuck in Pending', domain: 'troubleshooting', week: 2, minutes: 7, xp: 200, summary: 'Pods never get scheduled. Find out why.' },
  { id: 'taint-toleration', title: 'Reserved node', domain: 'workloads', week: 3, minutes: 8, xp: 250, summary: 'Place a Pod on a tainted, dedicated node only.' },
  { id: 'drain-node', title: 'Maintenance window', domain: 'architecture', week: 3, minutes: 6, xp: 250, summary: 'Drain a worker without losing capacity.' },
  { id: 'node-notready', title: 'Node down', domain: 'troubleshooting', week: 3, minutes: 12, xp: 400, summary: 'A worker went NotReady. SSH in and fix the kubelet.', boss: true },
  { id: 'broken-scheduler', title: 'Nothing gets scheduled', domain: 'troubleshooting', week: 4, minutes: 12, xp: 400, summary: 'The control plane is sick. Heal it.', boss: true },
  { id: 'cronjob', title: 'Nightly report', domain: 'workloads', week: 4, minutes: 8, xp: 200, summary: 'Build a CronJob and trigger it by hand.' },
];

export const LAB_BY_ID: Record<string, LabMeta> = Object.fromEntries(LABS.map((l) => [l.id, l]));

// Claim QR codes carry a short signature so a typo'd URL can't award XP.
// This keeps honest mistakes out; it is not meant to stop deliberate cheating.
export const CLAIM_SALT = 'ckagram-claim-v1-7f3a91c2';

export function claimPayload(lab: string, seconds: number, completedAt: number, nonce: string) {
  return `${CLAIM_SALT}|${lab}|${seconds}|${completedAt}|${nonce}`;
}
