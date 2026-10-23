import type { DomainId } from './types';

// Reels: 30–60s animated explainers. Frames auto-advance with narration,
// and every reel ends with a quiz card (a normal card id, so it feeds the same
// spaced repetition and XP as the feed).

export type ReelFrame = (
  | { kind: 'hook'; text: string; sub?: string; emoji?: string }
  | { kind: 'say'; text: string }
  | { kind: 'code'; lines: string[]; caption?: string }
  | { kind: 'flow'; nodes: string[]; caption?: string }
  | { kind: 'list'; title: string; items: string[] }
  | { kind: 'versus'; left: { title: string; text: string }; right: { title: string; text: string } }
) & {
  /** Narration override; defaults to the frame's text. */
  voice?: string;
};

export interface Reel {
  id: string;
  title: string;
  domain: DomainId;
  week: number;
  caption: string;
  frames: ReelFrame[];
  /** Card id asked at the end. */
  quiz: string;
}

export const REELS: Reel[] = [
  {
    id: 'pod-basics',
    title: 'What a Pod actually is',
    domain: 'workloads',
    week: 1,
    caption: 'The smallest thing Kubernetes runs is not a container. #pods',
    quiz: 'pod-01',
    frames: [
      { kind: 'hook', emoji: '📦', text: 'Kubernetes never runs a container.', sub: 'Wait, what?' },
      { kind: 'say', text: 'It runs **Pods**. A Pod wraps one or more containers.' },
      { kind: 'list', title: 'Containers in a Pod share…', items: ['One IP address', 'localhost between them', 'Volumes you mount'] },
      { kind: 'code', lines: ['$ kubectl run nginx --image=nginx', 'pod/nginx created', '$ kubectl get pod nginx -o wide'], caption: 'One command, one Pod' },
      { kind: 'say', text: 'Containers in a Pod talk over **localhost**.' },
    ],
  },
  {
    id: 'dry-run',
    title: 'The 3-second YAML trick',
    domain: 'workloads',
    week: 1,
    caption: "Never type a manifest from scratch in the exam. #speed",
    quiz: 'pod-03',
    frames: [
      { kind: 'hook', emoji: '⚡', text: 'Stop writing YAML by hand.', sub: 'The exam is a race' },
      { kind: 'code', lines: ['$ kubectl run web --image=nginx \\', '    --dry-run=client -o yaml > web.yaml'], caption: 'Generate, don\'t type' },
      { kind: 'say', text: '`--dry-run=client` builds the object **without creating it**.' },
      { kind: 'list', title: 'Then', items: ['Edit web.yaml (probes, volumes, labels)', 'kubectl apply -f web.yaml', 'Done in seconds'] },
      { kind: 'code', lines: ['$ export do="--dry-run=client -o yaml"', '$ k create deploy api --image=nginx $do'], caption: 'Pro move: an alias' },
    ],
  },
  {
    id: 'deploy-chain',
    title: 'Deployment → ReplicaSet → Pod',
    domain: 'workloads',
    week: 2,
    caption: 'Who actually restarts your Pods? #deployments',
    quiz: 'dep-01',
    frames: [
      { kind: 'hook', emoji: '🔗', text: 'You delete a Pod. It comes back.', sub: 'Who brought it back?' },
      { kind: 'flow', nodes: ['Deployment', 'ReplicaSet', 'Pod × 3'], caption: 'Each layer owns the next' },
      { kind: 'say', text: 'The **ReplicaSet** keeps the Pod count at the desired number.' },
      { kind: 'say', text: 'The **Deployment** manages ReplicaSets, one per version of your Pod template.' },
      { kind: 'code', lines: ['$ kubectl get deploy,rs,pods', 'deployment.apps/web   3/3', 'replicaset.apps/web-7d4b9   3', 'pod/web-7d4b9-x2kq   Running'] },
    ],
  },
  {
    id: 'rolling-update',
    title: 'Rolling updates in 30 seconds',
    domain: 'workloads',
    week: 2,
    caption: 'Zero downtime is a setting. #rollout',
    quiz: 'dep-10',
    frames: [
      { kind: 'hook', emoji: '🔄', text: 'Update the app without dropping a single request.' },
      { kind: 'code', lines: ['$ kubectl set image deploy/web nginx=nginx:1.27', '$ kubectl rollout status deploy/web'] },
      { kind: 'flow', nodes: ['New ReplicaSet scales up', 'Old ReplicaSet scales down', 'Repeat until done'] },
      { kind: 'versus', left: { title: 'maxSurge', text: 'extra Pods allowed above desired' }, right: { title: 'maxUnavailable', text: 'Pods allowed to be down' } },
      { kind: 'say', text: 'Both default to **25%**.' },
    ],
  },
  {
    id: 'rollback',
    title: 'Rollback saves your exam',
    domain: 'workloads',
    week: 2,
    caption: 'Bad image? One command. #rollback',
    quiz: 'dep-06',
    frames: [
      { kind: 'hook', emoji: '⏪', text: 'You shipped a typo.', sub: 'ImagePullBackOff everywhere' },
      { kind: 'say', text: 'Old Pods keep serving during a failed rolling update. **Stay calm.**' },
      { kind: 'code', lines: ['$ kubectl rollout history deploy/web', '$ kubectl rollout undo deploy/web', 'deployment.apps/web rolled back'] },
      { kind: 'say', text: 'Need an older one? Add `--to-revision=2`.' },
    ],
  },
  {
    id: 'probes',
    title: 'Three probes, three jobs',
    domain: 'workloads',
    week: 2,
    caption: 'Liveness vs readiness, finally clear. #probes',
    quiz: 'dep-15',
    frames: [
      { kind: 'hook', emoji: '🩺', text: 'Your Pod is Running. Why gets it no traffic?' },
      { kind: 'list', title: 'The three probes', items: ['Liveness → stuck? restart it', 'Readiness → not ready? no traffic', 'Startup → still booting? wait'] },
      { kind: 'say', text: '0/1 READY with no restarts means the **readiness** probe is failing.' },
      { kind: 'say', text: 'Lots of restarts means **liveness** is failing. Check its port and path.' },
    ],
  },
  {
    id: 'secrets',
    title: 'Secrets are not encrypted',
    domain: 'workloads',
    week: 2,
    caption: 'base64 is not security. #secrets',
    quiz: 'cfg-06',
    frames: [
      { kind: 'hook', emoji: '🔓', text: 'Your Kubernetes Secret is readable by anyone who can get it.' },
      { kind: 'code', lines: ["$ kubectl get secret db -o jsonpath='{.data.password}' | base64 -d", 's3cret'] },
      { kind: 'say', text: 'Values are **base64-encoded**. Encoding is not encryption.' },
      { kind: 'list', title: 'Real protection', items: ['RBAC on get/list secrets', 'Encryption at rest for etcd', 'Never commit them to git'] },
    ],
  },
  {
    id: 'configmap-env-vs-volume',
    title: 'ConfigMap: env vs volume',
    domain: 'workloads',
    week: 2,
    caption: 'Why your config change did nothing. #configmap',
    quiz: 'cfg-01',
    frames: [
      { kind: 'hook', emoji: '⚙️', text: 'You updated the ConfigMap. The app ignored it.' },
      { kind: 'versus', left: { title: 'As env vars', text: 'read once at start: restart needed' }, right: { title: 'As a volume', text: 'files refresh after a short delay' } },
      { kind: 'code', lines: ['$ kubectl rollout restart deploy/web'], caption: 'The env-var fix' },
      { kind: 'say', text: 'Catch: **subPath** mounts never refresh.' },
    ],
  },
  {
    id: 'debug-ladder',
    title: 'The debug ladder',
    domain: 'troubleshooting',
    week: 1,
    caption: '30% of the exam is troubleshooting. Climb in order. #debug',
    quiz: 'dbg-01',
    frames: [
      { kind: 'hook', emoji: '🪜', text: '30% of the CKA is troubleshooting.', sub: 'Here is the ladder' },
      { kind: 'flow', nodes: ['kubectl get', 'kubectl describe', 'kubectl logs', 'kubectl logs --previous'], caption: 'Climb in this order' },
      { kind: 'say', text: '**describe** shows Events: scheduling, image pulls, probe failures.' },
      { kind: 'say', text: 'Crashed container? `--previous` shows the run that died.' },
    ],
  },
  {
    id: 'exit-codes',
    title: 'Exit codes decoded',
    domain: 'troubleshooting',
    week: 1,
    caption: '1, 137, 143: know them cold. #crashloop',
    quiz: 'dbg-06',
    frames: [
      { kind: 'hook', emoji: '🔢', text: 'Exit code 137. What happened?' },
      { kind: 'list', title: 'Cheat sheet', items: ['1 → the app failed', '137 → killed (often OOMKilled)', '143 → SIGTERM, a graceful stop', '127 → command not found'] },
      { kind: 'say', text: '137 is 128 + 9: **SIGKILL**. With reason OOMKilled, raise the memory limit.' },
    ],
  },
  {
    id: 'requests-limits',
    title: 'Requests vs limits',
    domain: 'workloads',
    week: 1,
    caption: 'One schedules, one enforces. #resources',
    quiz: 'pod-12',
    frames: [
      { kind: 'hook', emoji: '⚖️', text: 'Requests and limits are not the same thing.' },
      { kind: 'versus', left: { title: 'Requests', text: 'what the scheduler reserves' }, right: { title: 'Limits', text: 'the runtime ceiling' } },
      { kind: 'versus', left: { title: 'Over CPU limit', text: 'throttled' }, right: { title: 'Over memory limit', text: 'OOMKilled' } },
      { kind: 'say', text: 'A Pod stuck Pending with **Insufficient cpu**? Its request is too big.' },
    ],
  },
  {
    id: 'static-pods',
    title: "The control plane's secret",
    domain: 'architecture',
    week: 1,
    caption: 'How does the API server start before the API server exists? #staticpods',
    quiz: 'pod-09',
    frames: [
      { kind: 'hook', emoji: '🧩', text: 'Who starts the API server?', sub: 'It cannot schedule itself' },
      { kind: 'say', text: 'The **kubelet** runs any manifest found in its static Pod folder.' },
      { kind: 'code', lines: ['$ ls /etc/kubernetes/manifests', 'etcd.yaml  kube-apiserver.yaml', 'kube-controller-manager.yaml  kube-scheduler.yaml'] },
      { kind: 'say', text: 'Broken control plane in the exam? **Edit these files.** The kubelet restarts the Pod.' },
    ],
  },
  {
    id: 'taints',
    title: 'Taints vs tolerations',
    domain: 'workloads',
    week: 3,
    caption: 'Repel vs permit. Not attract. #scheduling',
    quiz: 'sch-06',
    frames: [
      { kind: 'hook', emoji: '🚧', text: 'A toleration does not send your Pod to a node.' },
      { kind: 'versus', left: { title: 'Taint (node)', text: 'keeps Pods away' }, right: { title: 'Toleration (Pod)', text: 'allowed past the taint' } },
      { kind: 'code', lines: ['$ kubectl taint nodes node01 gpu=true:NoSchedule'] },
      { kind: 'say', text: 'To pin a Pod there, add **nodeSelector or affinity** too.' },
    ],
  },
  {
    id: 'hpa',
    title: 'Autoscaling in 40 seconds',
    domain: 'workloads',
    week: 4,
    caption: '<unknown>/70%? Here is why. #hpa',
    quiz: 'hpa-01',
    frames: [
      { kind: 'hook', emoji: '📈', text: 'Traffic spikes. Replicas follow.' },
      { kind: 'code', lines: ['$ kubectl autoscale deploy web --min=2 --max=10 --cpu-percent=70', '$ kubectl get hpa'] },
      { kind: 'flow', nodes: ['metrics-server', 'HPA compares usage ÷ request', 'Deployment replicas'] },
      { kind: 'say', text: 'No CPU **requests** means no percentage, so the HPA shows unknown.' },
    ],
  },
  {
    id: 'services',
    title: 'Why Services exist',
    domain: 'networking',
    week: 5,
    caption: 'Pod IPs are temporary. Services are not. #services',
    quiz: 'svc-01',
    frames: [
      { kind: 'hook', emoji: '🚪', text: 'Never connect to a Pod IP.', sub: 'It changes every restart' },
      { kind: 'flow', nodes: ['Client', 'Service (stable IP + DNS)', 'Ready Pods matching the selector'] },
      { kind: 'code', lines: ['$ kubectl expose deploy web --port=80 --target-port=8080', '$ kubectl get endpointslices -l kubernetes.io/service-name=web'], caption: 'expose copies the selector' },
      { kind: 'say', text: 'No endpoints? The **selector** matches no **ready** Pods.' },
    ],
  },
  {
    id: 'service-types',
    title: 'ClusterIP, NodePort, LoadBalancer',
    domain: 'networking',
    week: 5,
    caption: 'Three types, each built on the one before. #networking',
    quiz: 'svc-02',
    frames: [
      { kind: 'hook', emoji: '🪜', text: 'Service types are a staircase.' },
      { kind: 'list', title: 'Each adds one layer', items: ['ClusterIP: inside the cluster only', 'NodePort: + a port 30000–32767 on every node', 'LoadBalancer: + a cloud load balancer'] },
      { kind: 'versus', left: { title: 'port', text: 'what clients hit' }, right: { title: 'targetPort', text: 'what the container listens on' } },
      { kind: 'say', text: 'The default type is **ClusterIP**.' },
    ],
  },
  {
    id: 'netpol',
    title: 'NetworkPolicy: the AND/OR trap',
    domain: 'networking',
    week: 6,
    caption: 'One dash changes everything. #networkpolicy',
    quiz: 'np-03',
    frames: [
      { kind: 'hook', emoji: '🧱', text: 'All Pods can talk to all Pods.', sub: 'Until a policy selects them' },
      { kind: 'code', lines: ['spec:', '  podSelector: {}', '  policyTypes: [Ingress]'], caption: 'Default deny, whole namespace' },
      { kind: 'versus', left: { title: 'Same list item', text: 'namespace AND pod' }, right: { title: 'Two dashes', text: 'namespace OR pod' } },
      { kind: 'say', text: 'Deny egress? Allow **DNS on port 53** or nothing resolves.' },
    ],
  },
  {
    id: 'gateway-api',
    title: 'Gateway API in 45 seconds',
    domain: 'networking',
    week: 6,
    caption: 'The successor to Ingress, and it is on the exam. #gatewayapi',
    quiz: 'gw-01',
    frames: [
      { kind: 'hook', emoji: '🛣️', text: 'Ingress did too much in one object.' },
      { kind: 'flow', nodes: ['GatewayClass (which implementation)', 'Gateway (listeners: port, host)', 'HTTPRoute (paths → Services)'] },
      { kind: 'code', lines: ['parentRefs:', '- name: main', 'backendRefs:', '- name: api', '  port: 8080'], caption: 'Route attaches to the Gateway' },
      { kind: 'say', text: 'Traffic splits are built in: two backendRefs with **weights**.' },
    ],
  },
  {
    id: 'pv-pvc',
    title: 'PV, PVC, StorageClass',
    domain: 'storage',
    week: 7,
    caption: 'The disk, the request, the factory. #storage',
    quiz: 'sto-01',
    frames: [
      { kind: 'hook', emoji: '💾', text: 'Pods never mount a PersistentVolume.', sub: 'They mount a claim' },
      { kind: 'flow', nodes: ['Pod', 'PVC (namespaced request)', 'PV (cluster-wide disk)', 'StorageClass provisions it'] },
      { kind: 'list', title: 'Binding must match', items: ['storageClassName', 'access modes', 'size (bigger PV is fine)'] },
      { kind: 'say', text: 'There is **no kubectl create pvc**. Copy the YAML from the docs.' },
    ],
  },
  {
    id: 'rbac',
    title: 'RBAC in four objects',
    domain: 'architecture',
    week: 8,
    caption: 'Role says what. Binding says who. #rbac',
    quiz: 'rbac-01',
    frames: [
      { kind: 'hook', emoji: '🔐', text: 'Forbidden. Again.', sub: "Let's fix that" },
      { kind: 'versus', left: { title: 'Role / ClusterRole', text: 'verbs on resources' }, right: { title: '(Cluster)RoleBinding', text: 'grants it to subjects' } },
      { kind: 'code', lines: ['$ k create role pod-reader --verb=get,list --resource=pods', '$ k create rolebinding jane-read --role=pod-reader --user=jane', '$ k auth can-i list pods --as=jane'] },
      { kind: 'say', text: 'Deployments live in API group **apps**, not the core group.' },
    ],
  },
  {
    id: 'etcd-backup',
    title: 'etcd backup and restore',
    domain: 'architecture',
    week: 9,
    caption: 'Guaranteed exam task. Practice until boring. #etcd',
    quiz: 'etcd-01',
    frames: [
      { kind: 'hook', emoji: '🗄️', text: 'Lose etcd, lose the cluster.' },
      { kind: 'code', lines: ['$ etcdctl snapshot save /opt/backup.db \\', '  --endpoints=https://127.0.0.1:2379 \\', '  --cacert=… --cert=… --key=…'], caption: 'Paths come from etcd.yaml' },
      { kind: 'code', lines: ['$ etcdutl snapshot restore /opt/backup.db \\', '  --data-dir /var/lib/etcd-restore'], caption: 'Restore to a NEW directory' },
      { kind: 'say', text: "Then point the etcd static Pod's **hostPath** at the new directory." },
    ],
  },
  {
    id: 'kubeadm-upgrade',
    title: 'kubeadm upgrade, in order',
    domain: 'architecture',
    week: 9,
    caption: 'Control plane first. One minor at a time. #kubeadm',
    quiz: 'kadm-04',
    frames: [
      { kind: 'hook', emoji: '⬆️', text: 'Upgrading a cluster is a recipe.', sub: 'Order matters' },
      { kind: 'list', title: 'First control plane', items: ['Upgrade the kubeadm package', 'kubeadm upgrade plan', 'kubeadm upgrade apply v1.x.y', 'Upgrade kubelet + kubectl, restart kubelet'] },
      { kind: 'list', title: 'Each worker', items: ['kubectl drain', 'kubeadm upgrade node', 'Upgrade kubelet, restart it', 'kubectl uncordon'] },
      { kind: 'say', text: 'The kubelet may be older than the API server, **never newer**.' },
    ],
  },
  {
    id: 'apiserver-down',
    title: 'When kubectl stops answering',
    domain: 'troubleshooting',
    week: 11,
    caption: 'connection refused on 6443? Go to the node. #troubleshooting',
    quiz: 'tsh-03',
    frames: [
      { kind: 'hook', emoji: '🚨', text: 'The connection to the server was refused.' },
      { kind: 'say', text: 'kubectl needs the API server. So skip kubectl, **SSH to the control plane**.' },
      { kind: 'code', lines: ['$ crictl ps -a | grep apiserver', '$ crictl logs <container-id>', '$ journalctl -u kubelet | tail'] },
      { kind: 'say', text: 'Fix **/etc/kubernetes/manifests/kube-apiserver.yaml** and wait. The kubelet restarts it.' },
    ],
  },
  {
    id: 'service-debug',
    title: 'Debug any Service in 4 hops',
    domain: 'troubleshooting',
    week: 12,
    caption: 'Find the first hop that fails. #debugging',
    quiz: 'tsh-11',
    frames: [
      { kind: 'hook', emoji: '🔎', text: 'curl times out. Now what?' },
      { kind: 'list', title: 'Hop by hop', items: ['DNS: nslookup web', 'Endpoints: get endpointslices', 'Pod IP on targetPort: curl it', 'NetworkPolicy in the way?'] },
      { kind: 'say', text: 'Endpoints empty means the **selector** or **readiness** is wrong.' },
    ],
  },
];

export const REEL_BY_ID: Record<string, Reel> = Object.fromEntries(REELS.map((r) => [r.id, r]));

const strip = (s: string) => s.replace(/[`*]/g, '').replace(/\\$/gm, '');

export function frameVoice(f: ReelFrame): string {
  if (f.voice) return f.voice;
  switch (f.kind) {
    case 'hook':
      return [f.text, f.sub].filter(Boolean).join(' ');
    case 'say':
      return strip(f.text);
    case 'code':
      return f.caption ?? '';
    case 'flow':
      return [f.caption, f.nodes.join(', then ')].filter(Boolean).join('. ');
    case 'list':
      return `${f.title}: ${f.items.join('. ')}`;
    case 'versus':
      return `${f.left.title}: ${f.left.text}. ${f.right.title}: ${f.right.text}.`;
  }
}

/** How long a frame stays up, in ms: enough to read (or hear) it. */
export function frameDuration(f: ReelFrame): number {
  const words = frameVoice(f).split(/\s+/).filter(Boolean).length;
  const extra = f.kind === 'code' ? f.lines.join(' ').length * 28 : f.kind === 'list' ? f.items.length * 500 : 0;
  return Math.max(2600, 1200 + words * 380 + extra);
}
