import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { k, q, NODES, policies, policyAllows } from '../lib/kube.mjs';

const client = (ns, labels = 'app: client') => `apiVersion: v1
kind: Pod
metadata:
  name: client
  namespace: ${ns}
  labels: { ${labels} }
spec:
  containers:
  - name: client
    image: busybox:1.36
    command: ["sleep", "3600"]
`;

const nginxDeploy = (ns, name, replicas = 2, extra = '') => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  replicas: ${replicas}
  selector:
    matchLabels: { app: ${name} }
  template:
    metadata:
      labels: { app: ${name} }
    spec:
      containers:
      - name: nginx
        image: nginx:1.27
${extra}`;

const waitReady = (ns, what) => k.run('wait', '--for=condition=Ready', what, '-n', ns, '--timeout=180s');

export const svcSelector = {
  id: 'svc-selector',
  ns: 'net',
  task: `Service web in namespace net should load-balance to Deployment web (nginx, port 80).
Pod client gets nothing:  kubectl exec -n net client -- wget -qO- -T 3 http://web

Fix the Service. Don't change the Deployment.`,
  hints: [
    'kubectl get endpointslices -n net -l kubernetes.io/service-name=web. Empty? Compare the Service selector with the Pod labels.',
    'Endpoints fixed but still no answer? Check targetPort against the port nginx listens on.',
  ],
  solution: `kubectl get svc web -n net -o wide          # SELECTOR app=webapp
kubectl get pods -n net --show-labels        # Pods are app=web
kubectl edit svc web -n net                  # selector app: web, targetPort: 80
kubectl exec -n net client -- wget -qO- -T 3 http://web`,
  async setup() {
    k.apply(nginxDeploy('net', 'web'));
    k.apply(`apiVersion: v1
kind: Service
metadata: { name: web, namespace: net }
spec:
  selector: { app: webapp }
  ports:
  - port: 80
    targetPort: 8080`);
    k.apply(client('net'));
    k.run('rollout', 'status', 'deployment/web', '-n', 'net', '--timeout=180s');
    waitReady('net', 'pod/client');
  },
  async checks() {
    const d = q.deploy('net', 'web');
    const svc = k.json('service', 'web', '-n', 'net');
    const eps = q.readyEndpoints('net', 'web');
    return [
      ['Deployment web unchanged (2 replicas, label app=web)', d?.spec?.replicas === 2 && d?.spec?.template?.metadata?.labels?.app === 'web'],
      ['Service web still listens on port 80', svc?.spec?.ports?.some((p) => p.port === 80)],
      ['Service has 2 ready endpoints', eps.length === 2],
      ['client gets the nginx page from http://web', (q.wget('net', 'client', 'http://web') ?? '').includes('nginx')],
    ];
  },
};

export const exposeNodeport = {
  id: 'expose-nodeport',
  ns: 'front',
  task: `Expose Deployment shop in namespace front as Service shop, type NodePort:
port 80 → container port 80, on node port 30080.
It must answer on every node's IP at port 30080.`,
  hints: ['kubectl expose deployment shop -n front --type=NodePort --port=80', 'expose can\'t pick the node port: kubectl edit svc shop -n front and set nodePort: 30080.'],
  solution: `kubectl expose deployment shop -n front --type=NodePort --port=80 --dry-run=client -o yaml > svc.yaml
# add under the port:  nodePort: 30080
kubectl apply -f svc.yaml
kubectl get svc shop -n front`,
  async setup() {
    k.apply(nginxDeploy('front', 'shop'));
    k.apply(client('front'));
    k.run('rollout', 'status', 'deployment/shop', '-n', 'front', '--timeout=180s');
    waitReady('front', 'pod/client');
  },
  async checks() {
    const svc = k.json('service', 'shop', '-n', 'front');
    const port = svc?.spec?.ports?.[0];
    const ip = q.nodeIP(NODES.w1);
    return [
      ['Service front/shop is type NodePort', svc?.spec?.type === 'NodePort'],
      ['Port 80 → 80, node port 30080', port?.port === 80 && String(port?.targetPort) === '80' && port?.nodePort === 30080],
      ['It has ready endpoints', q.readyEndpoints('front', 'shop').length >= 1],
      [`nginx answers on ${NODES.w1}:30080`, !!ip && (q.wget('front', 'client', `http://${ip}:30080`) ?? '').includes('nginx')],
    ];
  },
};

export const ingressRules = {
  id: 'ingress-rules',
  ns: 'edge',
  task: `Services web and api (port 80) run in namespace edge.
Create Ingress shop in namespace edge:
  - ingressClassName nginx, host shop.example.com
  - /api  (Prefix) → Service api, port 80
  - /     (Prefix) → Service web, port 80

This cluster has no Ingress controller, so the checker grades the object itself.`,
  hints: ['kubectl create ingress --help shows the --rule syntax: host/path=service:port', 'A path ending in * becomes pathType Prefix: --rule="shop.example.com/api*=api:80"'],
  solution: `kubectl create ingress shop -n edge --class=nginx \\
  --rule="shop.example.com/api*=api:80" \\
  --rule="shop.example.com/*=web:80"
kubectl describe ingress shop -n edge`,
  async setup() {
    k.apply(nginxDeploy('edge', 'web', 1));
    k.apply(nginxDeploy('edge', 'api', 1));
    k.run('expose', 'deployment', 'web', '-n', 'edge', '--port=80');
    k.run('expose', 'deployment', 'api', '-n', 'edge', '--port=80');
  },
  async checks() {
    const ing = k.json('ingress', 'shop', '-n', 'edge');
    const rule = ing?.spec?.rules?.find((r) => r.host === 'shop.example.com');
    const path = (p) => rule?.http?.paths?.find((x) => x.path === p);
    const to = (x, svc) => x?.pathType === 'Prefix' && x?.backend?.service?.name === svc && x?.backend?.service?.port?.number === 80;
    return [
      ['Ingress edge/shop exists with class nginx', ing?.spec?.ingressClassName === 'nginx'],
      ['It has a rule for host shop.example.com', !!rule],
      ['/api (Prefix) → api:80', to(path('/api'), 'api')],
      ['/ (Prefix) → web:80', to(path('/'), 'web')],
    ];
  },
};

export const netpolDb = {
  id: 'netpol-db',
  ns: 'secure',
  task: `Namespace secure has Pods db (app=db, nginx on port 80), api (app=api) and intruder (app=intruder).
Create NetworkPolicy db-allow-api so that only Pods labeled app=api can reach
the db Pods, and only on TCP port 80. Don't change the Pods.

Test:  kubectl exec -n secure api -- wget -qO- -T 3 http://db`,
  hints: [
    'Select the db Pods with spec.podSelector, then allow ingress from a podSelector for app=api.',
    'Copy the example from the NetworkPolicy docs page and trim it. Add ports: - protocol: TCP, port: 80.',
  ],
  solution: `cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-allow-api
  namespace: secure
spec:
  podSelector:
    matchLabels: { app: db }
  policyTypes: [Ingress]
  ingress:
  - from:
    - podSelector:
        matchLabels: { app: api }
    ports:
    - protocol: TCP
      port: 80
EOF`,
  async setup() {
    k.run('run', 'db', '-n', 'secure', '--image=nginx:1.27', '--labels=app=db');
    k.run('expose', 'pod', 'db', '-n', 'secure', '--port=80');
    k.run('run', 'api', '-n', 'secure', '--image=busybox:1.36', '--labels=app=api', '--', 'sleep', '3600');
    k.run('run', 'intruder', '-n', 'secure', '--image=busybox:1.36', '--labels=app=intruder', '--', 'sleep', '3600');
    waitReady('secure', 'pod/db');
    waitReady('secure', 'pod/api');
    waitReady('secure', 'pod/intruder');
  },
  async checks() {
    const np = k.json('networkpolicy', 'db-allow-api', '-n', 'secure');
    const all = policies('secure');
    const db = { app: 'db' };
    return [
      ['NetworkPolicy secure/db-allow-api exists', !!np],
      ['It selects the db Pods', np?.spec?.podSelector?.matchLabels?.app === 'db'],
      ['api → db:80 is allowed', policyAllows(all, db, { app: 'api' }, 80)],
      ['intruder → db is blocked', !policyAllows(all, db, { app: 'intruder' }, 80)],
      ['api → db on another port (8080) is blocked', !policyAllows(all, db, { app: 'api' }, 8080)],
      ['api really reaches db over the network', (q.wget('secure', 'api', 'http://db') ?? '').includes('nginx')],
    ];
  },
};

// CoreDNS lab: the original Corefile is kept on this machine so cleanup always restores it.
const COREFILE_BACKUP = join(homedir(), '.ckagram', 'coredns-Corefile.bak');
function restartCoreDNS() {
  k.run('rollout', 'restart', 'deployment/coredns', '-n', 'kube-system');
  k.try('rollout', 'status', 'deployment/coredns', '-n', 'kube-system', '--timeout=120s');
}

export const corednsBroken = {
  id: 'coredns-broken',
  ns: 'dns-test',
  mock: 'breaker',
  task: `Pods can't resolve any names. Try:
  kubectl exec -n dns-test client -- nslookup kubernetes.default

Find out why and fix cluster DNS for everyone.`,
  hints: [
    'kubectl get pods -n kube-system -l k8s-app=kube-dns. Then read their logs.',
    'The config lives in ConfigMap coredns (kube-system). After fixing it: kubectl rollout restart deploy coredns -n kube-system',
  ],
  solution: `kubectl get pods -n kube-system -l k8s-app=kube-dns         # CrashLoopBackOff
kubectl logs -n kube-system -l k8s-app=kube-dns --previous    # Unknown directive 'forwardd'
kubectl edit cm coredns -n kube-system                        # forwardd → forward
kubectl rollout restart deploy coredns -n kube-system
kubectl exec -n dns-test client -- nslookup kubernetes.default`,
  async setup() {
    k.apply(client('dns-test'));
    waitReady('dns-test', 'pod/client');
    const cm = k.json('configmap', 'coredns', '-n', 'kube-system');
    const corefile = cm.data.Corefile;
    mkdirSync(join(homedir(), '.ckagram'), { recursive: true });
    if (!existsSync(COREFILE_BACKUP)) writeFileSync(COREFILE_BACKUP, corefile);
    const broken = readFileSync(COREFILE_BACKUP, 'utf8').replace(/^(\s*)forward \./m, '$1forwardd .');
    k.run('patch', 'configmap', 'coredns', '-n', 'kube-system', '--type=merge', '-p', JSON.stringify({ data: { Corefile: broken } }));
    k.run('delete', 'pod', '-n', 'kube-system', '-l', 'k8s-app=kube-dns', '--wait=false');
    await k.waitFor(() => (q.deploy('kube-system', 'coredns')?.status?.readyReplicas ?? 0) === 0, 90_000, 2_000);
  },
  async cleanup() {
    if (!existsSync(COREFILE_BACKUP)) return;
    const original = readFileSync(COREFILE_BACKUP, 'utf8');
    const current = k.json('configmap', 'coredns', '-n', 'kube-system')?.data?.Corefile;
    if (current !== original) {
      k.run('patch', 'configmap', 'coredns', '-n', 'kube-system', '--type=merge', '-p', JSON.stringify({ data: { Corefile: original } }));
      restartCoreDNS();
    }
    rmSync(COREFILE_BACKUP);
  },
  async checks() {
    const d = q.deploy('kube-system', 'coredns');
    const out = q.execIn('dns-test', 'client', 'nslookup', 'kubernetes.default.svc.cluster.local') ?? '';
    const ip = k.json('service', 'kubernetes', '-n', 'default')?.spec?.clusterIP;
    const answer = out.split(/Name:/)[1] ?? '';
    return [
      ['All CoreDNS replicas are ready', !!d && (d.status?.readyReplicas ?? 0) === d.spec.replicas],
      ['client resolves kubernetes.default', !!ip && answer.includes(ip)],
    ];
  },
};

export const pvcPending = {
  id: 'pvc-pending',
  ns: 'files',
  task: `Pod writer in namespace files is stuck in Pending.
Make it run, with its data on a 1Gi PVC named data that uses the cluster's
default StorageClass. Keep the Pod name, image and mount path (/data).`,
  hints: [
    'kubectl describe pvc data -n files. Which StorageClass does it ask for? Does it exist? (kubectl get sc)',
    'A PVC\'s storageClassName can\'t be changed. Save both YAMLs, delete the Pod and the PVC, fix, re-apply.',
  ],
  solution: `kubectl describe pvc data -n files            # storageclass "fast" not found
kubectl get sc                                 # default is "standard"
kubectl get pvc data -n files -o yaml > pvc.yaml
kubectl get pod writer -n files -o yaml > pod.yaml
kubectl delete pod writer -n files --force
kubectl delete pvc data -n files
# pvc.yaml: storageClassName: standard (and drop status/uid/resourceVersion)
kubectl apply -f pvc.yaml -f pod.yaml`,
  async setup() {
    k.apply(`apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: data, namespace: files }
spec:
  storageClassName: fast
  accessModes: [ReadWriteOnce]
  resources: { requests: { storage: 1Gi } }
---
apiVersion: v1
kind: Pod
metadata: { name: writer, namespace: files }
spec:
  containers:
  - name: writer
    image: busybox:1.36
    command: ["sh", "-c", "date > /data/hello && sleep 3600"]
    volumeMounts: [ { name: data, mountPath: /data } ]
  volumes:
  - name: data
    persistentVolumeClaim: { claimName: data }`);
  },
  async checks() {
    const pvc = k.json('pvc', 'data', '-n', 'files');
    const pod = q.pod('files', 'writer');
    const ready = q.ready(pod);
    const def = q.defaultStorageClass();
    return [
      ['PVC files/data is Bound', pvc?.status?.phase === 'Bound'],
      [`It uses the default StorageClass (${def})`, !!def && pvc?.spec?.storageClassName === def],
      ['It requests 1Gi', pvc?.spec?.resources?.requests?.storage === '1Gi'],
      ['Pod writer is Running and mounts PVC data', ready && pod.spec.volumes.some((v) => v.persistentVolumeClaim?.claimName === 'data')],
      ['/data/hello was written', ready && !!q.execIn('files', 'writer', 'cat', '/data/hello')],
    ];
  },
};

export const staticPv = {
  id: 'static-pv',
  ns: 'logs',
  task: `1. Create PersistentVolume logs-pv: 512Mi, ReadWriteOnce, reclaim policy Retain,
   storageClassName manual, hostPath /mnt/logs
2. In namespace logs, create PVC logs (storageClassName manual, 512Mi, RWO)
   that binds to logs-pv
3. Create Pod logger in namespace logs (image busybox:1.36, command: sleep 3600)
   that mounts the PVC at /var/log/app`,
  hints: [
    'There is no kubectl create pv. Copy the hostPath PV example from the "Configure a Pod to Use a PersistentVolume" docs page.',
    'PV and PVC must agree on storageClassName, access mode and size. kubectl get pv shows STATUS Bound and CLAIM logs/logs.',
  ],
  solution: `cat <<EOF | kubectl apply -f -
apiVersion: v1
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
EOF
kubectl run logger -n logs --image=busybox:1.36 --dry-run=client -o yaml -- sleep 3600 > logger.yaml
# add the volume (persistentVolumeClaim: claimName: logs) and volumeMount /var/log/app
kubectl apply -f logger.yaml`,
  async setup() {
    k.try('delete', 'pv', 'logs-pv', '--wait=true', '--timeout=60s');
  },
  async cleanup() {
    k.try('delete', 'pv', 'logs-pv', '--wait=false');
  },
  async checks() {
    const pv = k.json('pv', 'logs-pv');
    const pvc = k.json('pvc', 'logs', '-n', 'logs');
    const pod = q.pod('logs', 'logger');
    const ready = q.ready(pod);
    const vol = pod?.spec?.volumes?.find((v) => v.persistentVolumeClaim?.claimName === 'logs');
    const mount = pod?.spec?.containers?.[0]?.volumeMounts?.find((m) => m.name === vol?.name);
    return [
      ['PV logs-pv: 512Mi, RWO, Retain, class manual', pv?.spec?.capacity?.storage === '512Mi' && pv.spec.accessModes?.includes('ReadWriteOnce') && pv.spec.persistentVolumeReclaimPolicy === 'Retain' && pv.spec.storageClassName === 'manual'],
      ['PV uses hostPath /mnt/logs', pv?.spec?.hostPath?.path === '/mnt/logs'],
      ['PVC logs/logs is Bound to logs-pv', pvc?.status?.phase === 'Bound' && pvc?.spec?.volumeName === 'logs-pv'],
      ['Pod logger is Running', ready],
      ['It mounts the PVC at /var/log/app', mount?.mountPath === '/var/log/app'],
      ['The volume is writable', ready && q.execIn('logs', 'logger', 'sh', '-c', 'echo ok > /var/log/app/.ckagram && cat /var/log/app/.ckagram') === 'ok'],
    ];
  },
};
