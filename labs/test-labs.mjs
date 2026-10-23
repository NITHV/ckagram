// End-to-end test for every lab: setup → checks must fail → apply the solution → checks must pass → cleanup.
// Run against the kind cluster:  node labs/test-labs.mjs [lab-id ...] [--mock]
// --mock also sets up several labs at once plus a cluster breaker (like ckalab mock) and solves them.
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { k, q, NODES } from './lib/kube.mjs';
import { gradeMock, resetMock, setupMock } from './lib/mock.mjs';
import { IMPL as LABS } from './defs/index.mjs';
import { appPodWithSidecar } from './defs/week8-12.mjs';

const busybox = (name, ns, extra = '') => `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${ns}
spec:
${extra}  containers:
  - name: ${name}
    image: busybox:1.36
    command: ["sleep", "3600"]
`;

// Automated "player" for each lab, doing what the solution describes.
const SOLVE = {
  'first-deploy': () =>
    k.apply(`apiVersion: apps/v1
kind: Deployment
metadata: { name: frontend, namespace: web }
spec:
  replicas: 3
  selector: { matchLabels: { app: frontend } }
  template:
    metadata: { labels: { app: frontend, tier: frontend } }
    spec: { containers: [ { name: nginx, image: "nginx:1.27" } ] }`),
  'image-pull': () => k.run('set', 'image', 'deployment/api', 'nginx=nginx:1.27-alpine', '-n', 'shop'),
  crashloop: () => {
    k.run('delete', 'pod', 'worker', '-n', 'jobs', '--force', '--grace-period=0');
    k.apply(busybox('worker', 'jobs'));
  },
  'configmap-env': () => {
    k.run('create', 'configmap', 'app-config', '-n', 'config', '--from-literal=MODE=production', '--from-literal=LOG_LEVEL=debug');
    k.apply(
      busybox('app', 'config').replace('    command: ["sleep", "3600"]\n', '    command: ["sleep", "3600"]\n    envFrom:\n    - configMapRef:\n        name: app-config\n')
    );
  },
  'secret-volume': () => {
    k.run('create', 'secret', 'generic', 'db-creds', '-n', 'vault', '--from-literal=username=admin', '--from-literal=password=S3cure99');
    k.apply(
      busybox('db-client', 'vault', '  volumes:\n  - name: creds\n    secret:\n      secretName: db-creds\n').replace(
        '    command: ["sleep", "3600"]\n',
        '    command: ["sleep", "3600"]\n    volumeMounts:\n    - name: creds\n      mountPath: /etc/db\n      readOnly: true\n'
      )
    );
  },
  rollback: () => k.run('rollout', 'undo', 'deployment/shop', '-n', 'store'),
  'pending-cpu': () => k.run('set', 'resources', 'deployment/analytics', '-n', 'data', '--requests=cpu=100m'),
  'taint-toleration': () =>
    k.apply(
      busybox(
        'log-agent',
        'infra',
        '  nodeSelector:\n    role: infra\n  tolerations:\n  - key: dedicated\n    operator: Equal\n    value: infra\n    effect: NoSchedule\n'
      )
    ),
  'drain-node': () => k.run('drain', NODES.w1, '--ignore-daemonsets', '--delete-emptydir-data', '--timeout=120s'),
  'node-notready': () => k.node(NODES.w2, "sed -i 's#ca-wrong.crt#ca.crt#' /var/lib/kubelet/config.yaml && systemctl restart kubelet"),
  'broken-scheduler': () => k.node(NODES.cp, "sed -i 's/- kube-schedulerr$/- kube-scheduler/' /etc/kubernetes/manifests/kube-scheduler.yaml"),
  cronjob: () => {
    k.apply(`apiVersion: batch/v1
kind: CronJob
metadata: { name: report, namespace: batch }
spec:
  schedule: "*/10 * * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 2
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers: [ { name: report, image: "busybox:1.36", command: ["date"] } ]`);
    k.run('create', 'job', 'report-now', '--from=cronjob/report', '-n', 'batch');
  },
  'svc-selector': () => k.run('patch', 'svc', 'web', '-n', 'net', '-p', JSON.stringify({ spec: { selector: { app: 'web' }, ports: [{ port: 80, targetPort: 80 }] } })),
  'expose-nodeport': () =>
    k.apply(`apiVersion: v1
kind: Service
metadata: { name: shop, namespace: front }
spec:
  type: NodePort
  selector: { app: shop }
  ports: [ { port: 80, targetPort: 80, nodePort: 30080 } ]`),
  'ingress-rules': () => k.run('create', 'ingress', 'shop', '-n', 'edge', '--class=nginx', '--rule=shop.example.com/api*=api:80', '--rule=shop.example.com/*=web:80'),
  'netpol-db': () =>
    k.apply(`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: db-allow-api, namespace: secure }
spec:
  podSelector: { matchLabels: { app: db } }
  policyTypes: [Ingress]
  ingress:
  - from: [ { podSelector: { matchLabels: { app: api } } } ]
    ports: [ { protocol: TCP, port: 80 } ]`),
  'coredns-broken': () => {
    const cf = k.json('configmap', 'coredns', '-n', 'kube-system').data.Corefile.replace('forwardd .', 'forward .');
    k.run('patch', 'configmap', 'coredns', '-n', 'kube-system', '--type=merge', '-p', JSON.stringify({ data: { Corefile: cf } }));
    k.run('rollout', 'restart', 'deployment/coredns', '-n', 'kube-system');
  },
  'pvc-pending': () => {
    const pod = q.pod('files', 'writer');
    k.run('delete', 'pod', 'writer', '-n', 'files', '--force', '--grace-period=0', '--wait=true');
    k.run('delete', 'pvc', 'data', '-n', 'files', '--wait=true');
    k.apply(
      JSON.stringify({
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: { name: 'data', namespace: 'files' },
        spec: { storageClassName: q.defaultStorageClass(), accessModes: ['ReadWriteOnce'], resources: { requests: { storage: '1Gi' } } },
      })
    );
    const c = pod.spec.containers[0];
    k.apply(
      JSON.stringify({
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'writer', namespace: 'files' },
        spec: {
          containers: [{ name: c.name, image: c.image, command: c.command, volumeMounts: [{ name: 'data', mountPath: '/data' }] }],
          volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'data' } }],
        },
      })
    );
  },
  'static-pv': () =>
    k.apply(`apiVersion: v1
kind: PersistentVolume
metadata: { name: logs-pv }
spec:
  capacity: { storage: 512Mi }
  accessModes: [ReadWriteOnce]
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath: { path: /mnt/logs, type: DirectoryOrCreate }
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: logs, namespace: logs }
spec:
  storageClassName: manual
  accessModes: [ReadWriteOnce]
  resources: { requests: { storage: 512Mi } }
---
apiVersion: v1
kind: Pod
metadata: { name: logger, namespace: logs }
spec:
  containers:
  - name: logger
    image: busybox:1.36
    command: ["sleep", "3600"]
    volumeMounts: [ { name: logs, mountPath: /var/log/app } ]
  volumes: [ { name: logs, persistentVolumeClaim: { claimName: logs } } ]`),
  'rbac-sa': () => {
    k.run('create', 'sa', 'deployer', '-n', 'ci');
    k.run('create', 'role', 'deploy-manager', '-n', 'ci', '--verb=get,list,create,update,patch,delete', '--resource=deployments');
    k.run('create', 'rolebinding', 'deployer-binding', '-n', 'ci', '--role=deploy-manager', '--serviceaccount=ci:deployer');
  },
  'node-viewer': () => {
    k.run('create', 'clusterrole', 'node-viewer', '--verb=get,list,watch', '--resource=nodes,persistentvolumes');
    k.run('create', 'clusterrolebinding', 'auditor-node-viewer', '--clusterrole=node-viewer', '--user=auditor');
  },
  'etcd-backup': () => {
    const r = k.node(
      NODES.cp,
      'etcdctl snapshot save /opt/etcd-backup.db --endpoints=https://127.0.0.1:2379 --cacert=/etc/kubernetes/pki/etcd/ca.crt --cert=/etc/kubernetes/pki/etcd/server.crt --key=/etc/kubernetes/pki/etcd/server.key'
    );
    if (!r.ok) throw new Error(r.err);
  },
  'join-command': () => k.node(NODES.cp, 'kubeadm token create --print-join-command > /opt/join.sh'),
  'kustomize-overlay': () => {
    const dir = join(homedir(), '.ckagram', 'labs', 'kustomize', 'prod');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'kustomization.yaml'), ['resources:', '- ../base', 'namespace: prod-app', 'namePrefix: prod-', 'replicas:', '- name: web', '  count: 3', 'images:', '- name: nginx', '  newTag: "1.27"', ''].join('\n'));
    k.run('apply', '-k', dir);
  },
  'apiserver-down': () => k.node(NODES.cp, "sed -i 's#127.0.0.1:2378#127.0.0.1:2379#' /etc/kubernetes/manifests/kube-apiserver.yaml"),
  'sidecar-logs': () => {
    k.run('delete', 'pod', 'app', '-n', 'audit', '--force', '--grace-period=0', '--wait=true');
    k.apply(appPodWithSidecar());
  },
  'checkout-down': () => {
    k.run('patch', 'deployment', 'checkout', '-n', 'checkout', '--type=json', '-p', JSON.stringify([{ op: 'replace', path: '/spec/template/spec/containers/0/readinessProbe/httpGet/path', value: '/' }]));
    k.run('patch', 'svc', 'checkout', '-n', 'checkout', '-p', JSON.stringify({ spec: { selector: { app: 'checkout' } } }));
    k.apply(`apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-client, namespace: checkout }
spec:
  podSelector: { matchLabels: { app: checkout } }
  ingress:
  - from: [ { podSelector: { matchLabels: { app: client } } } ]
    ports: [ { port: 80 } ]`);
  },
};

async function reset(lab) {
  if (lab.cleanup) await lab.cleanup();
  if (lab.ns) k.try('delete', 'namespace', lab.ns, '--wait=true', '--timeout=120s');
}

const allPass = (r) => r.every(([, ok]) => ok);
const args = process.argv.slice(2);
const withMock = args.includes('--mock');
const named = args.filter((a) => !a.startsWith('--'));
// --mock alone runs just the mock; no args runs every lab.
const ids = named.length ? named : withMock && args.length === 1 ? [] : Object.keys(LABS);
const missing = Object.keys(LABS).filter((id) => !SOLVE[id]);
if (missing.length) throw new Error(`no solver for: ${missing.join(', ')}`);
let failed = 0;

await k.waitFor(() => Object.values(NODES).every((n) => q.nodeReady(q.node(n))), 180_000);

for (const id of ids) {
  const lab = LABS[id];
  const t0 = Date.now();
  process.stdout.write(`${id.padEnd(18)} `);
  try {
    await reset(lab);
    if (lab.ns) await k.createNamespace(lab.ns);
    await lab.setup();
    const before = await lab.checks();
    if (allPass(before)) throw new Error('checks already pass before solving');
    await SOLVE[id]();
    let last = [];
    const ok = await k.waitFor(async () => allPass((last = await lab.checks())), 240_000, 3_000);
    if (!ok) throw new Error('still failing: ' + last.filter(([, ok]) => !ok).map(([l]) => l).join('; '));
    console.log(`✓ (${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) {
    failed++;
    console.log(`✗ ${e.message.split('\n').slice(0, 3).join(' | ')}`);
  } finally {
    await reset(lab).catch(() => {});
  }
}
// Mock exam: regular labs set up side by side, then a cluster breaker, all solved together.
if (withMock) {
  const mockIds = ['svc-selector', 'rbac-sa', 'pvc-pending', 'sidecar-logs', 'coredns-broken'];
  const t0 = Date.now();
  process.stdout.write(`${'mock (5 tasks)'.padEnd(18)} `);
  try {
    await resetMock(mockIds);
    await setupMock(mockIds);
    const before = await gradeMock(mockIds);
    if (before.passed) throw new Error(`mock already passes before solving (${before.score}%)`);
    // Breaker first, like on exam day once you notice DNS is down.
    for (const id of [...mockIds].reverse()) await SOLVE[id]();
    let g;
    const ok = await k.waitFor(async () => (g = await gradeMock(mockIds)).score === 100, 300_000, 5_000);
    if (!ok) throw new Error(`score ${g.score}%: ${g.tasks.filter((t) => t.fraction < 1).map((t) => t.id).join(', ')}`);
    console.log(`✓ (${before.score}% → 100%, ${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) {
    failed++;
    console.log(`✗ ${e.message.split('\n').slice(0, 3).join(' | ')}`);
  } finally {
    await resetMock(mockIds).catch(() => {});
  }
}

console.log(failed ? `\n${failed} lab(s) failed` : '\nall labs pass');
process.exit(failed ? 1 : 0);
