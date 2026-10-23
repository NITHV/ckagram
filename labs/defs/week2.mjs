import { k, q } from '../lib/kube.mjs';

export const configmapEnv = {
  id: 'configmap-env',
  ns: 'config',
  task: `In namespace config:
  1. Create ConfigMap app-config with MODE=production and LOG_LEVEL=debug
  2. Create Pod app (image busybox:1.36, command: sleep 3600) that loads
     every key of app-config as environment variables`,
  hints: [
    'kubectl create configmap app-config -n config --from-literal=MODE=production --from-literal=LOG_LEVEL=debug',
    'Generate the Pod YAML with --dry-run=client -o yaml, then add envFrom: - configMapRef: name: app-config',
  ],
  solution: `kubectl create configmap app-config -n config --from-literal=MODE=production --from-literal=LOG_LEVEL=debug
kubectl run app -n config --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > app.yaml
# under the container add:
#   envFrom:
#   - configMapRef:
#       name: app-config
kubectl apply -f app.yaml
kubectl exec -n config app -- printenv MODE`,
  async setup() {},
  async checks() {
    const cm = k.json('configmap', 'app-config', '-n', 'config');
    const p = q.pod('config', 'app');
    const ready = q.ready(p);
    return [
      ['ConfigMap has MODE=production', cm?.data?.MODE === 'production'],
      ['ConfigMap has LOG_LEVEL=debug', cm?.data?.LOG_LEVEL === 'debug'],
      ['Pod config/app is Running', ready],
      ['MODE is set inside the Pod', ready && q.execIn('config', 'app', 'printenv', 'MODE') === 'production'],
      ['LOG_LEVEL is set inside the Pod', ready && q.execIn('config', 'app', 'printenv', 'LOG_LEVEL') === 'debug'],
    ];
  },
};

export const secretVolume = {
  id: 'secret-volume',
  ns: 'vault',
  task: `In namespace vault:
  1. Create Secret db-creds with username=admin and password=S3cure99
  2. Create Pod db-client (image busybox:1.36, command: sleep 3600) that
     mounts db-creds read-only at /etc/db`,
  hints: [
    'kubectl create secret generic db-creds -n vault --from-literal=username=admin --from-literal=password=S3cure99',
    'Add a volume (secret: secretName: db-creds) and a volumeMount with mountPath /etc/db and readOnly: true',
  ],
  solution: `kubectl create secret generic db-creds -n vault --from-literal=username=admin --from-literal=password=S3cure99
kubectl run db-client -n vault --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > db.yaml
# add to the container:
#   volumeMounts:
#   - name: creds
#     mountPath: /etc/db
#     readOnly: true
# add to spec:
#   volumes:
#   - name: creds
#     secret:
#       secretName: db-creds
kubectl apply -f db.yaml
kubectl exec -n vault db-client -- cat /etc/db/password`,
  async setup() {},
  async checks() {
    const s = k.json('secret', 'db-creds', '-n', 'vault');
    const dec = (v) => (v ? Buffer.from(v, 'base64').toString() : null);
    const p = q.pod('vault', 'db-client');
    const ready = q.ready(p);
    const vols = p?.spec?.volumes ?? [];
    const mount = (p?.spec?.containers?.[0]?.volumeMounts ?? []).find((m) => m.mountPath === '/etc/db');
    const vol = vols.find((v) => v.name === mount?.name);
    return [
      ['Secret has username=admin', dec(s?.data?.username) === 'admin'],
      ['Secret has password=S3cure99', dec(s?.data?.password) === 'S3cure99'],
      ['Pod vault/db-client is Running', ready],
      ['/etc/db comes from Secret db-creds', vol?.secret?.secretName === 'db-creds'],
      ['Mount is read-only', mount?.readOnly === true],
      ['Pod can read /etc/db/password', ready && q.execIn('vault', 'db-client', 'cat', '/etc/db/password') === 'S3cure99'],
    ];
  },
};

export const rollback = {
  id: 'rollback',
  ns: 'store',
  task: `A bad release of Deployment shop in namespace store is stuck.
Roll it back to the last working version. All 3 replicas must be available.
(Don't delete and recreate it. Use the rollout history.)`,
  hints: ['kubectl rollout history deployment/shop -n store', 'kubectl rollout undo deployment/shop -n store'],
  solution: `kubectl rollout status deployment/shop -n store --timeout=5s   # stuck
kubectl rollout history deployment/shop -n store
kubectl rollout undo deployment/shop -n store
kubectl rollout status deployment/shop -n store`,
  async setup() {
    k.run('create', 'deployment', 'shop', '-n', 'store', '--image=nginx:1.26', '--replicas=3');
    k.run('rollout', 'status', 'deployment/shop', '-n', 'store', '--timeout=180s');
    k.run('annotate', 'deployment/shop', '-n', 'store', 'kubernetes.io/change-cause=initial release nginx:1.26');
    k.run('set', 'image', 'deployment/shop', 'nginx=nginx:1.26-broken', '-n', 'store');
    k.run('annotate', 'deployment/shop', '-n', 'store', '--overwrite', 'kubernetes.io/change-cause=release 2 (bad tag)');
  },
  async checks() {
    const d = q.deploy('store', 'shop');
    const rev = Number(d?.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? 0);
    return [
      ['Deployment store/shop exists', !!d],
      ['Rolled back (revision 3 or later, not recreated)', rev >= 3],
      ['Image is back to nginx:1.26', d?.spec?.template?.spec?.containers?.[0]?.image === 'nginx:1.26'],
      ['3 of 3 replicas available', q.available(d) === 3 && (d?.status?.unavailableReplicas ?? 0) === 0],
    ];
  },
};

export const pendingCpu = {
  id: 'pending-cpu',
  ns: 'data',
  task: `Pods of Deployment analytics in namespace data are stuck Pending.
Find out why and fix it. Keep 2 replicas, and set the CPU request to 100m.`,
  hints: [
    'kubectl describe pod -n data -l app=analytics. What does FailedScheduling say?',
    'kubectl set resources deployment/analytics -n data --requests=cpu=100m',
  ],
  solution: `kubectl describe pod -n data -l app=analytics | grep -i insufficient
kubectl set resources deployment/analytics -n data --requests=cpu=100m
kubectl rollout status deployment/analytics -n data`,
  async setup() {
    k.apply(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: analytics
  namespace: data
spec:
  replicas: 2
  selector:
    matchLabels:
      app: analytics
  template:
    metadata:
      labels:
        app: analytics
    spec:
      containers:
      - name: analytics
        image: busybox:1.36
        command: ["sleep", "3600"]
        resources:
          requests:
            cpu: "64"`);
  },
  async checks() {
    const d = q.deploy('data', 'analytics');
    const cpu = d?.spec?.template?.spec?.containers?.[0]?.resources?.requests?.cpu;
    return [
      ['Deployment data/analytics exists', !!d],
      ['Still 2 replicas', d?.spec?.replicas === 2],
      ['CPU request is 100m', cpu === '100m'],
      ['2 of 2 replicas available', q.available(d) === 2],
    ];
  },
};
