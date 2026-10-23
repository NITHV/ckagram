// End-to-end test for every lab: setup → checks must fail → apply the solution → checks must pass → cleanup.
// Run against the kind cluster:  node labs/test-labs.mjs [lab-id ...]
import { k, q, NODES } from './lib/kube.mjs';
import * as w1 from './defs/week1.mjs';
import * as w2 from './defs/week2.mjs';
import * as w34 from './defs/week3-4.mjs';

const LABS = Object.fromEntries([...Object.values(w1), ...Object.values(w2), ...Object.values(w34)].map((l) => [l.id, l]));

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
};

async function reset(lab) {
  if (lab.cleanup) await lab.cleanup();
  if (lab.ns) k.try('delete', 'namespace', lab.ns, '--wait=true', '--timeout=120s');
}

const allPass = (r) => r.every(([, ok]) => ok);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LABS);
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
console.log(failed ? `\n${failed} lab(s) failed` : '\nall labs pass');
process.exit(failed ? 1 : 0);
