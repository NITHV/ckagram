import { k, q, NODES } from '../lib/kube.mjs';

export const taintToleration = {
  id: 'taint-toleration',
  ns: 'infra',
  task: `Node ${NODES.w2} is reserved for infra workloads.
It has the taint dedicated=infra:NoSchedule and the label role=infra.

Create Pod log-agent in namespace infra (image busybox:1.36, command: sleep 3600)
that runs on ${NODES.w2}, and could only ever be scheduled there.`,
  hints: [
    'A toleration lets the Pod onto the node, but does not pull it there.',
    'Add both a toleration for dedicated=infra:NoSchedule and nodeSelector role: infra.',
  ],
  solution: `kubectl run log-agent -n infra --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > la.yaml
# add under spec:
#   nodeSelector:
#     role: infra
#   tolerations:
#   - key: dedicated
#     operator: Equal
#     value: infra
#     effect: NoSchedule
kubectl apply -f la.yaml
kubectl get pod log-agent -n infra -o wide`,
  async setup() {
    k.run('label', 'node', NODES.w2, 'role=infra', '--overwrite');
    k.run('taint', 'nodes', NODES.w2, 'dedicated=infra:NoSchedule', '--overwrite');
  },
  async cleanup() {
    k.try('taint', 'nodes', NODES.w2, 'dedicated=infra:NoSchedule-');
    k.try('label', 'node', NODES.w2, 'role-');
  },
  async checks() {
    const p = q.pod('infra', 'log-agent');
    const tol = (p?.spec?.tolerations ?? []).some(
      (t) => t.key === 'dedicated' && (t.operator === 'Exists' || t.value === 'infra') && (!t.effect || t.effect === 'NoSchedule')
    );
    const sel = p?.spec?.nodeSelector?.role === 'infra';
    const aff = JSON.stringify(p?.spec?.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution ?? {}).includes('infra');
    return [
      ['Pod infra/log-agent is Running', q.ready(p)],
      [`It runs on ${NODES.w2}`, p?.spec?.nodeName === NODES.w2],
      ['It tolerates dedicated=infra:NoSchedule', tol],
      ['It is pinned to role=infra (nodeSelector or required affinity)', sel || aff],
    ];
  },
};

export const drainNode = {
  id: 'drain-node',
  ns: 'ops',
  task: `Node ${NODES.w1} needs maintenance.
Evict its workloads safely and make sure nothing new gets scheduled there.
Deployment api in namespace ops must keep all 4 replicas available.`,
  hints: ['kubectl drain does cordon + evict.', 'DaemonSet Pods (kube-proxy, kindnet) block a plain drain: add --ignore-daemonsets.'],
  solution: `kubectl drain ${NODES.w1} --ignore-daemonsets
kubectl get pods -n ops -o wide
# after maintenance: kubectl uncordon ${NODES.w1}`,
  async setup() {
    k.run('create', 'deployment', 'api', '-n', 'ops', '--image=nginx:1.27', '--replicas=4');
    k.run('rollout', 'status', 'deployment/api', '-n', 'ops', '--timeout=180s');
  },
  async cleanup() {
    k.try('uncordon', NODES.w1);
  },
  async checks() {
    const n = q.node(NODES.w1);
    const left = q
      .podsOn(NODES.w1)
      .filter((p) => !(p.metadata.ownerReferences ?? []).some((o) => o.kind === 'DaemonSet'))
      .filter((p) => p.status?.phase !== 'Succeeded' && p.status?.phase !== 'Failed');
    return [
      [`${NODES.w1} is cordoned (unschedulable)`, n?.spec?.unschedulable === true],
      ['No regular Pods left on it (DaemonSets are fine)', left.length === 0],
      ['ops/api has 4 of 4 replicas available', q.available(q.deploy('ops', 'api')) === 4],
    ];
  },
};

const KUBELET_CFG = '/var/lib/kubelet/config.yaml';
const KUBELET_BAK = '/root/.ckagram-kubelet-config.bak';

export const nodeNotReady = {
  id: 'node-notready',
  ns: null,
  task: `Node ${NODES.w2} is NotReady. Bring it back to Ready.

In the exam you would ssh to the node. Here, use:
  docker exec -it ${NODES.w2} bash`,
  hints: [
    'On the node: systemctl status kubelet, then journalctl -u kubelet --no-pager | tail -30',
    `The kubelet config file is ${KUBELET_CFG}. Check every path in it actually exists.`,
  ],
  solution: `docker exec -it ${NODES.w2} bash
journalctl -u kubelet --no-pager | tail -20     # open /etc/kubernetes/pki/ca-wrong.crt: no such file
grep -n clientCAFile ${KUBELET_CFG}
sed -i 's#ca-wrong.crt#ca.crt#' ${KUBELET_CFG}
systemctl restart kubelet
exit
kubectl get nodes -w`,
  async setup() {
    k.node(NODES.w2, `cp -n ${KUBELET_CFG} ${KUBELET_BAK}; sed -i 's#/etc/kubernetes/pki/ca.crt#/etc/kubernetes/pki/ca-wrong.crt#' ${KUBELET_CFG}; systemctl restart kubelet`);
    console.log('  … waiting for the node to go NotReady (about 40s)');
    await k.waitFor(() => !q.nodeReady(q.node(NODES.w2)), 120_000);
  },
  async cleanup() {
    k.node(NODES.w2, `[ -f ${KUBELET_BAK} ] && cp ${KUBELET_BAK} ${KUBELET_CFG} && rm ${KUBELET_BAK}; systemctl restart kubelet`);
  },
  async checks() {
    const active = k.node(NODES.w2, 'systemctl is-active kubelet').out === 'active';
    return [
      ['kubelet is active on the node', active],
      [`${NODES.w2} is Ready`, q.nodeReady(q.node(NODES.w2))],
    ];
  },
};

const SCHED = '/etc/kubernetes/manifests/kube-scheduler.yaml';
const SCHED_BAK = '/root/.ckagram-kube-scheduler.yaml.bak';

export const brokenScheduler = {
  id: 'broken-scheduler',
  ns: 'sched',
  task: `New Pods in the cluster stay Pending. Find the cause and fix it.
Deployment test in namespace sched must end up with its Pod Running.

Control-plane node: docker exec -it ${NODES.cp} bash`,
  hints: [
    'kubectl get pods -n kube-system. Is every control-plane component healthy?',
    `Control-plane components are static Pods. Their manifests live in /etc/kubernetes/manifests on ${NODES.cp}.`,
  ],
  solution: `kubectl get pods -n kube-system | grep scheduler     # CrashLoopBackOff
kubectl logs -n kube-system kube-scheduler-${NODES.cp}   # or describe: "kube-schedulerr" not found
docker exec -it ${NODES.cp} bash
sed -i 's/- kube-schedulerr$/- kube-scheduler/' ${SCHED}   # kubelet restarts it automatically
exit
kubectl get pods -n sched -w`,
  async setup() {
    k.node(NODES.cp, `cp -n ${SCHED} ${SCHED_BAK}; sed -i 's/^    - kube-scheduler$/    - kube-schedulerr/' ${SCHED}`);
    console.log('  … waiting for the scheduler to go down');
    await k.waitFor(() => {
      const p = k.json('pods', '-n', 'kube-system', '-l', 'component=kube-scheduler')?.items?.[0];
      return !p || !q.ready(p);
    }, 120_000);
    k.run('create', 'deployment', 'test', '-n', 'sched', '--image=nginx:1.27');
  },
  async cleanup() {
    k.node(NODES.cp, `[ -f ${SCHED_BAK} ] && cp ${SCHED_BAK} ${SCHED} && rm ${SCHED_BAK}`);
  },
  async checks() {
    const s = k.json('pods', '-n', 'kube-system', '-l', 'component=kube-scheduler')?.items?.[0];
    return [
      ['kube-scheduler is Running and Ready', q.ready(s)],
      ['sched/test has its Pod available', q.available(q.deploy('sched', 'test')) === 1],
    ];
  },
};

export const cronjob = {
  id: 'cronjob',
  ns: 'batch',
  task: `In namespace batch, create CronJob report:
  • runs every 10 minutes
  • image busybox:1.36, command: date
  • never runs two at once (concurrencyPolicy Forbid)
  • keeps 2 successful Jobs in history
Then trigger it by hand as Job report-now and let it complete.`,
  hints: [
    'kubectl create cronjob report -n batch --image=busybox:1.36 --schedule="*/10 * * * *" --dry-run=client -o yaml -- date > cj.yaml',
    'Add concurrencyPolicy and successfulJobsHistoryLimit under spec, apply, then: kubectl create job report-now --from=cronjob/report -n batch',
  ],
  solution: `kubectl create cronjob report -n batch --image=busybox:1.36 --schedule="*/10 * * * *" --dry-run=client -o yaml -- date > cj.yaml
# under spec add:
#   concurrencyPolicy: Forbid
#   successfulJobsHistoryLimit: 2
kubectl apply -f cj.yaml
kubectl create job report-now --from=cronjob/report -n batch
kubectl get jobs -n batch`,
  async setup() {},
  async checks() {
    const cj = k.json('cronjob', 'report', '-n', 'batch');
    const c = cj?.spec?.jobTemplate?.spec?.template?.spec?.containers?.[0];
    const cmd = [...(c?.command ?? []), ...(c?.args ?? [])].join(' ');
    const job = k.json('job', 'report-now', '-n', 'batch');
    return [
      ['CronJob batch/report exists', !!cj],
      ['Schedule is every 10 minutes', /^\*\/10 \* \* \* \*$/.test(cj?.spec?.schedule ?? '')],
      ['Image busybox:1.36 running date', c?.image === 'busybox:1.36' && /(^|\s)date$/.test(cmd)],
      ['concurrencyPolicy is Forbid', cj?.spec?.concurrencyPolicy === 'Forbid'],
      ['Keeps 2 successful Jobs', cj?.spec?.successfulJobsHistoryLimit === 2],
      ['Job report-now was created from it and succeeded', (job?.status?.succeeded ?? 0) >= 1],
    ];
  },
};
