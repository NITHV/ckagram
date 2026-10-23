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
  { id: 'svc-selector', title: 'Service with no endpoints', domain: 'troubleshooting', week: 5, minutes: 7, xp: 250, summary: 'Traffic to a Service goes nowhere. Find out why.' },
  { id: 'expose-nodeport', title: 'Open the shop', domain: 'networking', week: 5, minutes: 5, xp: 200, summary: 'Expose a Deployment on a fixed NodePort.' },
  { id: 'ingress-rules', title: 'One host, two apps', domain: 'networking', week: 6, minutes: 7, xp: 200, summary: 'Route paths to Services with an Ingress.' },
  { id: 'netpol-db', title: 'Lock down the database', domain: 'networking', week: 6, minutes: 8, xp: 250, summary: 'Only the API may talk to the db.' },
  { id: 'coredns-broken', title: 'Nobody can resolve anything', domain: 'troubleshooting', week: 6, minutes: 10, xp: 400, summary: 'Cluster DNS is down. Bring it back.', boss: true },
  { id: 'pvc-pending', title: 'Claim stuck in Pending', domain: 'storage', week: 7, minutes: 8, xp: 250, summary: 'A Pod waits forever for its volume.' },
  { id: 'static-pv', title: 'Hand-made storage', domain: 'storage', week: 7, minutes: 10, xp: 250, summary: 'Create a PV, bind a PVC, mount it.' },
  { id: 'rbac-sa', title: 'Least privilege for CI', domain: 'architecture', week: 8, minutes: 7, xp: 250, summary: 'A ServiceAccount that can deploy, and nothing more.' },
  { id: 'node-viewer', title: 'Read-only auditor', domain: 'architecture', week: 8, minutes: 5, xp: 200, summary: 'Cluster-wide read access with a ClusterRole.' },
  { id: 'etcd-backup', title: 'Back up etcd', domain: 'architecture', week: 9, minutes: 8, xp: 300, summary: 'Snapshot the cluster database with etcdctl.' },
  { id: 'join-command', title: 'Welcome a new node', domain: 'architecture', week: 9, minutes: 4, xp: 150, summary: 'Generate a fresh kubeadm join command.' },
  { id: 'kustomize-overlay', title: 'Prod overlay', domain: 'architecture', week: 10, minutes: 10, xp: 250, summary: 'Customize a base with Kustomize and apply it.' },
  { id: 'apiserver-down', title: 'The API server is gone', domain: 'troubleshooting', week: 11, minutes: 12, xp: 450, summary: 'kubectl gets connection refused. Fix the control plane.', boss: true },
  { id: 'sidecar-logs', title: 'Logs nobody can see', domain: 'troubleshooting', week: 11, minutes: 8, xp: 250, summary: 'Stream a log file with a sidecar.' },
  { id: 'checkout-down', title: 'Checkout is down', domain: 'troubleshooting', week: 12, minutes: 15, xp: 500, summary: 'Three faults between a client and its Service.', boss: true },
];

export const LAB_BY_ID: Record<string, LabMeta> = Object.fromEntries(LABS.map((l) => [l.id, l]));

// Claim QR codes carry a short signature so a typo'd URL can't award XP.
// This keeps honest mistakes out; it is not meant to stop deliberate cheating.
export const CLAIM_SALT = 'ckagram-claim-v1-7f3a91c2';

/** extra: signed fields beyond the basics (mock exams add score and tasks). */
export function claimPayload(lab: string, seconds: number, completedAt: number, nonce: string, extra?: string) {
  const base = `${CLAIM_SALT}|${lab}|${seconds}|${completedAt}|${nonce}`;
  return extra ? `${base}|${extra}` : base;
}

/** Lab id used by `ckalab mock` claims. */
export const MOCK_LAB_ID = 'mock';
/** The real CKA pass mark. */
export const PASS_SCORE = 66;
