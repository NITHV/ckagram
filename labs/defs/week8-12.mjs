import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { k, q, NODES, policies, policyAllows } from '../lib/kube.mjs';

const SSH_CP = `docker exec -it ${NODES.cp} bash`;
const sa = (ns, name) => `system:serviceaccount:${ns}:${name}`;

export const rbacSa = {
  id: 'rbac-sa',
  ns: 'ci',
  task: `In namespace ci:
  1. Create ServiceAccount deployer
  2. Create Role deploy-manager that can get, list, create, update, patch and delete Deployments
  3. Bind it to deployer with RoleBinding deployer-binding

Least privilege: deployer must not be able to touch Pods directly, or anything in other namespaces.`,
  hints: ['kubectl create role --help. Deployments are in API group apps; --resource=deployments handles that.', 'Verify: kubectl auth can-i create deployments -n ci --as=system:serviceaccount:ci:deployer'],
  solution: `kubectl create sa deployer -n ci
kubectl create role deploy-manager -n ci --verb=get,list,create,update,patch,delete --resource=deployments
kubectl create rolebinding deployer-binding -n ci --role=deploy-manager --serviceaccount=ci:deployer
kubectl auth can-i delete pods -n ci --as=system:serviceaccount:ci:deployer    # no`,
  async setup() {},
  async checks() {
    const who = sa('ci', 'deployer');
    const rb = k.json('rolebinding', 'deployer-binding', '-n', 'ci');
    return [
      ['ServiceAccount ci/deployer exists', !!k.json('serviceaccount', 'deployer', '-n', 'ci')],
      ['Role ci/deploy-manager exists', !!k.json('role', 'deploy-manager', '-n', 'ci')],
      ['RoleBinding deployer-binding binds that Role', rb?.roleRef?.kind === 'Role' && rb?.roleRef?.name === 'deploy-manager'],
      ['deployer can create, patch and delete Deployments in ci', ['create', 'patch', 'delete', 'list'].every((v) => q.canI(who, v, 'deployments.apps', 'ci'))],
      ['deployer cannot delete Pods', !q.canI(who, 'delete', 'pods', 'ci')],
      ['deployer cannot create Deployments in default', !q.canI(who, 'create', 'deployments.apps', 'default')],
    ];
  },
};

export const nodeViewer = {
  id: 'node-viewer',
  task: `User auditor needs read-only access to Nodes and PersistentVolumes, cluster-wide.
Create ClusterRole node-viewer (get, list, watch on nodes and persistentvolumes)
and ClusterRoleBinding auditor-node-viewer that grants it to user auditor.`,
  hints: ['Nodes and PVs are cluster-scoped, so a Role can\'t grant them.', 'kubectl create clusterrole node-viewer --verb=get,list,watch --resource=nodes,persistentvolumes'],
  solution: `kubectl create clusterrole node-viewer --verb=get,list,watch --resource=nodes,persistentvolumes
kubectl create clusterrolebinding auditor-node-viewer --clusterrole=node-viewer --user=auditor
kubectl auth can-i list nodes --as=auditor`,
  async setup() {
    k.try('delete', 'clusterrolebinding', 'auditor-node-viewer');
    k.try('delete', 'clusterrole', 'node-viewer');
  },
  async cleanup() {
    k.try('delete', 'clusterrolebinding', 'auditor-node-viewer');
    k.try('delete', 'clusterrole', 'node-viewer');
  },
  async checks() {
    const crb = k.json('clusterrolebinding', 'auditor-node-viewer');
    return [
      ['ClusterRole node-viewer exists', !!k.json('clusterrole', 'node-viewer')],
      ['ClusterRoleBinding grants it to user auditor', crb?.roleRef?.name === 'node-viewer' && (crb?.subjects ?? []).some((s) => s.kind === 'User' && s.name === 'auditor')],
      ['auditor can list and watch nodes', q.canI('auditor', 'list', 'nodes') && q.canI('auditor', 'watch', 'nodes')],
      ['auditor can get persistentvolumes', q.canI('auditor', 'get', 'persistentvolumes')],
      ['auditor cannot delete nodes', !q.canI('auditor', 'delete', 'nodes')],
      ['auditor cannot list Pods', !q.canI('auditor', 'list', 'pods', '*')],
    ];
  },
};

const ETCD_BIN = `P=$(pgrep -x etcd | head -1); for b in etcdctl etcdutl; do [ -x /usr/local/bin/$b ] || cp /proc/$P/root/usr/local/bin/$b /usr/local/bin/$b; done`;

export const etcdBackup = {
  id: 'etcd-backup',
  task: `Back up the cluster: save an etcd snapshot to /opt/etcd-backup.db on the control plane node.
  ${SSH_CP}        (the lab's "ssh controlplane")

etcd serves clients on https://127.0.0.1:2379. Find the certificate paths yourself.`,
  hints: [
    'grep -E "cert|key|trusted" /etc/kubernetes/manifests/etcd.yaml',
    'etcdctl snapshot save /opt/etcd-backup.db --endpoints=https://127.0.0.1:2379 --cacert=… --cert=… --key=…',
  ],
  solution: `${SSH_CP}
ETCDCTL_API=3 etcdctl snapshot save /opt/etcd-backup.db \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key
etcdutl snapshot status /opt/etcd-backup.db -w table`,
  async setup() {
    const r = k.node(NODES.cp, `${ETCD_BIN}; rm -f /opt/etcd-backup.db`);
    if (!r.ok) throw new Error(`could not prepare etcdctl on the control plane: ${r.err}`);
  },
  async cleanup() {
    k.node(NODES.cp, 'rm -f /opt/etcd-backup.db');
  },
  async checks() {
    const size = Number(k.node(NODES.cp, 'stat -c %s /opt/etcd-backup.db 2>/dev/null || echo 0').out);
    const status = k.node(NODES.cp, 'etcdutl snapshot status /opt/etcd-backup.db -w json 2>/dev/null');
    let keys = 0;
    try {
      keys = JSON.parse(status.out).totalKey ?? 0;
    } catch {}
    return [
      ['/opt/etcd-backup.db exists on the control plane', size > 0],
      ['It is a valid etcd snapshot', status.ok && keys > 0],
      ['It holds the cluster (hundreds of keys)', keys > 100],
    ];
  },
};

export const joinCommand = {
  id: 'join-command',
  task: `A new worker is ready to join. On the control plane node, create a fresh join command
and save the whole "kubeadm join …" line to /opt/join.sh.
  ${SSH_CP}`,
  hints: ['kubeadm token --help', 'kubeadm token create --print-join-command > /opt/join.sh'],
  solution: `${SSH_CP}
kubeadm token create --print-join-command > /opt/join.sh
cat /opt/join.sh
kubeadm token list`,
  async setup() {
    k.node(NODES.cp, 'rm -f /opt/join.sh');
  },
  async cleanup() {
    k.node(NODES.cp, 'T=$(grep -o "\\-\\-token [a-z0-9.]*" /opt/join.sh 2>/dev/null | cut -d" " -f2); [ -n "$T" ] && kubeadm token delete "$T" >/dev/null 2>&1; rm -f /opt/join.sh');
  },
  async checks() {
    const file = k.node(NODES.cp, 'cat /opt/join.sh 2>/dev/null').out;
    const token = file.match(/--token\s+([a-z0-9]{6}\.[a-z0-9]{16})/)?.[1];
    const tokens = k.node(NODES.cp, 'kubeadm token list -o jsonpath="{.token} "').out;
    return [
      ['/opt/join.sh contains a kubeadm join command', /kubeadm join \S+:6443/.test(file)],
      ['It includes --discovery-token-ca-cert-hash', /--discovery-token-ca-cert-hash sha256:[0-9a-f]{64}/.test(file)],
      ['Its token is valid on the cluster', !!token && tokens.includes(token)],
    ];
  },
};

const KUS_DIR = join(homedir(), '.ckagram', 'labs', 'kustomize');
const KUS_BASE = join(KUS_DIR, 'base');
const KUS_PROD = join(KUS_DIR, 'prod');

export const kustomizeOverlay = {
  id: 'kustomize-overlay',
  ns: 'prod-app',
  task: `A Kustomize base (Deployment web + Service web) is in:
  ${KUS_BASE}
Create an overlay in:
  ${KUS_PROD}
that puts everything in namespace prod-app, prefixes every name with prod-,
runs 3 replicas and uses image nginx:1.27. Apply it with kubectl apply -k.
Don't edit the base.`,
  hints: [
    'The overlay is a kustomization.yaml with resources: [../base] plus namespace:, namePrefix:, images: and replicas: fields.',
    'kubectl kustomize <dir> prints the result. Check it before kubectl apply -k <dir>.',
  ],
  solution: `mkdir ${KUS_PROD}
# ${join(KUS_PROD, 'kustomization.yaml')}:
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../base
namespace: prod-app
namePrefix: prod-
replicas:
- name: web
  count: 3
images:
- name: nginx
  newTag: "1.27"

kubectl kustomize ${KUS_PROD}
kubectl apply -k ${KUS_PROD}`,
  async setup() {
    rmSync(KUS_DIR, { recursive: true, force: true });
    mkdirSync(KUS_BASE, { recursive: true });
    writeFileSync(
      join(KUS_BASE, 'deployment.yaml'),
      `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.26
`
    );
    writeFileSync(
      join(KUS_BASE, 'service.yaml'),
      `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
  - port: 80
`
    );
    writeFileSync(join(KUS_BASE, 'kustomization.yaml'), 'resources:\n- deployment.yaml\n- service.yaml\n');
  },
  async cleanup() {
    rmSync(KUS_DIR, { recursive: true, force: true });
  },
  async checks() {
    const d = q.deploy('prod-app', 'prod-web');
    const overlay = existsSync(join(KUS_PROD, 'kustomization.yaml')) ? readFileSync(join(KUS_PROD, 'kustomization.yaml'), 'utf8') : '';
    const base = existsSync(join(KUS_BASE, 'deployment.yaml')) ? readFileSync(join(KUS_BASE, 'deployment.yaml'), 'utf8') : '';
    return [
      ['Overlay kustomization.yaml exists and uses ../base', /\.\.\/base/.test(overlay)],
      ['Base is untouched (still nginx:1.26, 1 replica)', base.includes('nginx:1.26') && base.includes('replicas: 1')],
      ['Deployment prod-web runs in prod-app', !!d],
      ['3 of 3 replicas available', d?.spec?.replicas === 3 && q.available(d) === 3],
      ['Image is nginx:1.27', d?.spec?.template?.spec?.containers?.[0]?.image === 'nginx:1.27'],
      ['Service prod-web exists in prod-app', !!k.json('service', 'prod-web', '-n', 'prod-app')],
    ];
  },
};

// API server lab: the original manifest is backed up on the node, outside the manifests dir.
const APISERVER = '/etc/kubernetes/manifests/kube-apiserver.yaml';
const APISERVER_BAK = '/root/.ckagram-kube-apiserver.yaml.bak';
const apiUp = () => k.try('get', '--raw', '/readyz').ok;

export const apiserverDown = {
  id: 'apiserver-down',
  mock: 'breaker',
  task: `kubectl suddenly gets "connection refused". Bring the API server back.
Control plane node:  ${SSH_CP}`,
  hints: [
    'kubectl can\'t help while the API server is down. On the node: crictl ps -a | grep kube-apiserver, then crictl logs <id>.',
    'It can\'t reach etcd. Compare --etcd-servers in kube-apiserver.yaml with --listen-client-urls in etcd.yaml.',
  ],
  solution: `${SSH_CP}
crictl ps -a | grep kube-apiserver          # Exited, restarting
crictl logs <container-id>                  # dial tcp 127.0.0.1:2378: connection refused
grep etcd-servers ${APISERVER}
sed -i 's#127.0.0.1:2378#127.0.0.1:2379#' ${APISERVER}
# wait ~1 min, then from your laptop: kubectl get nodes`,
  async setup() {
    const r = k.node(NODES.cp, `[ -f ${APISERVER_BAK} ] || cp ${APISERVER} ${APISERVER_BAK}; sed -i 's#--etcd-servers=https://127.0.0.1:2379#--etcd-servers=https://127.0.0.1:2378#' ${APISERVER}`);
    if (!r.ok) throw new Error(r.err);
    await k.waitFor(() => !apiUp(), 150_000, 3_000);
  },
  async cleanup() {
    k.node(NODES.cp, `[ -f ${APISERVER_BAK} ] && cp ${APISERVER_BAK} ${APISERVER} && rm -f ${APISERVER_BAK}`);
    await k.waitFor(apiUp, 240_000, 3_000);
  },
  async checks() {
    const manifest = k.node(NODES.cp, `cat ${APISERVER}`).out;
    const up = apiUp();
    return [
      ['kube-apiserver points at etcd on 127.0.0.1:2379', manifest.includes('--etcd-servers=https://127.0.0.1:2379')],
      ['The API server answers /readyz', up],
      ['The control plane node is Ready', up && q.nodeReady(q.node(NODES.cp))],
    ];
  },
};

export const sidecarLogs = {
  id: 'sidecar-logs',
  ns: 'audit',
  task: `Pod app in namespace audit writes its log to /var/log/app.log, so kubectl logs shows nothing.
Add a sidecar container named log-tail (image busybox:1.36) that streams that file to stdout:
  kubectl logs app -n audit -c log-tail     must show the "tick" lines.
Keep the app container exactly as it is. (A Pod's containers can't be edited in place.)`,
  hints: [
    'kubectl get pod app -n audit -o yaml > app.yaml, add the container, then kubectl replace --force -f app.yaml',
    'The sidecar mounts the same volume and runs: tail -n+1 -F /var/log/app.log',
  ],
  solution: `kubectl get pod app -n audit -o yaml > app.yaml
# under containers add:
#  - name: log-tail
#    image: busybox:1.36
#    command: ["sh", "-c", "tail -n+1 -F /var/log/app.log"]
#    volumeMounts:
#    - name: logs
#      mountPath: /var/log
kubectl replace --force -f app.yaml
kubectl logs app -n audit -c log-tail`,
  async setup() {
    k.apply(appPod(false));
  },
  async checks() {
    const pod = q.pod('audit', 'app');
    const all = [...(pod?.spec?.containers ?? []), ...(pod?.spec?.initContainers ?? []).filter((c) => c.restartPolicy === 'Always')];
    const app = all.find((c) => c.name === 'app');
    const tail = all.find((c) => c.name === 'log-tail');
    const statuses = [...(pod?.status?.containerStatuses ?? []), ...(pod?.status?.initContainerStatuses ?? [])];
    const running = pod?.status?.phase === 'Running' && statuses.filter((s) => s.name === 'app' || s.name === 'log-tail').every((s) => s.ready || s.started);
    const logs = tail ? k.try('logs', 'app', '-n', 'audit', '-c', 'log-tail', '--tail=20').out : '';
    return [
      ['Pod audit/app is Running', !!running],
      ['Container app is unchanged', !!app && app.image === 'busybox:1.36' && (app.command ?? []).join(' ').includes('/var/log/app.log')],
      ['Sidecar log-tail exists (busybox:1.36)', tail?.image === 'busybox:1.36'],
      ['kubectl logs -c log-tail shows the ticks', /tick \d+/.test(logs)],
    ];
  },
};

function appPod(withSidecar) {
  return `apiVersion: v1
kind: Pod
metadata: { name: app, namespace: audit }
spec:
  containers:
  - name: app
    image: busybox:1.36
    command: ["sh", "-c", "i=0; while true; do echo \\"tick $i\\" >> /var/log/app.log; i=$((i+1)); sleep 2; done"]
    volumeMounts: [ { name: logs, mountPath: /var/log } ]
${
  withSidecar
    ? `  - name: log-tail
    image: busybox:1.36
    command: ["sh", "-c", "tail -n+1 -F /var/log/app.log"]
    volumeMounts: [ { name: logs, mountPath: /var/log } ]
`
    : ''
}  volumes:
  - name: logs
    emptyDir: {}
`;
}
export const appPodWithSidecar = () => appPod(true);

export const checkoutDown = {
  id: 'checkout-down',
  ns: 'checkout',
  task: `Pod client in namespace checkout must be able to reach http://checkout.
It can't:  kubectl exec -n checkout client -- wget -qO- -T 3 http://checkout

Fix everything between the client and the app. Rules:
  - keep NetworkPolicy default-deny (add an allow policy instead)
  - keep 2 replicas and the nginx:1.27 image`,
  hints: [
    'Go hop by hop: are the Pods Ready? Does the Service have endpoints? Is traffic allowed?',
    'There are three separate faults: a readiness probe, a Service selector, and a NetworkPolicy.',
  ],
  solution: `kubectl get pods -n checkout                       # 0/1 Ready: probe fails
kubectl describe pod -n checkout -l app=checkout   # GET /healthz 404
kubectl edit deploy checkout -n checkout           # readinessProbe path: /
kubectl get endpointslices -n checkout             # none: selector app=checkout-api
kubectl edit svc checkout -n checkout              # selector app: checkout
kubectl get netpol -n checkout                     # default-deny blocks ingress
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-client, namespace: checkout }
spec:
  podSelector: { matchLabels: { app: checkout } }
  ingress:
  - from: [ { podSelector: { matchLabels: { app: client } } } ]
    ports: [ { port: 80 } ]
EOF`,
  async setup() {
    k.apply(`apiVersion: apps/v1
kind: Deployment
metadata: { name: checkout, namespace: checkout }
spec:
  replicas: 2
  selector: { matchLabels: { app: checkout } }
  template:
    metadata: { labels: { app: checkout } }
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
        readinessProbe:
          httpGet: { path: /healthz, port: 80 }
          periodSeconds: 3
---
apiVersion: v1
kind: Service
metadata: { name: checkout, namespace: checkout }
spec:
  selector: { app: checkout-api }
  ports: [ { port: 80, targetPort: 80 } ]
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: checkout }
spec:
  podSelector: {}
  policyTypes: [Ingress]
---
apiVersion: v1
kind: Pod
metadata: { name: client, namespace: checkout, labels: { app: client } }
spec:
  containers:
  - name: client
    image: busybox:1.36
    command: ["sleep", "3600"]`);
    k.run('wait', '--for=condition=Ready', 'pod/client', '-n', 'checkout', '--timeout=180s');
  },
  async checks() {
    const d = q.deploy('checkout', 'checkout');
    const all = policies('checkout');
    const deny = all.find((p) => p.metadata.name === 'default-deny');
    return [
      ['Deployment keeps 2 replicas of nginx:1.27', d?.spec?.replicas === 2 && d?.spec?.template?.spec?.containers?.[0]?.image === 'nginx:1.27'],
      ['Both Pods are Ready', (d?.status?.readyReplicas ?? 0) === 2],
      ['Service checkout has 2 ready endpoints', q.readyEndpoints('checkout', 'checkout').length === 2],
      ['NetworkPolicy default-deny is still in place', !!deny && JSON.stringify(deny.spec.podSelector ?? {}) === '{}'],
      ['client → checkout:80 is allowed by policy', policyAllows(all, { app: 'checkout' }, { app: 'client' }, 80)],
      ['client gets the page from http://checkout', (q.wget('checkout', 'client', 'http://checkout') ?? '').includes('nginx')],
    ];
  },
};
