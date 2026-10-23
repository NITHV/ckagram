import { k, q } from '../lib/kube.mjs';

export const firstDeploy = {
  id: 'first-deploy',
  ns: 'web',
  task: `In namespace web, create a Deployment named frontend:
  • image nginx:1.27
  • 3 replicas
  • its Pods must carry the label tier=frontend`,
  hints: [
    'Generate YAML instead of writing it: kubectl create deployment ... --dry-run=client -o yaml > d.yaml',
    'Add tier: frontend under spec.template.metadata.labels, then kubectl apply -f d.yaml',
  ],
  solution: `kubectl create deployment frontend -n web --image=nginx:1.27 --replicas=3 --dry-run=client -o yaml > d.yaml
# edit d.yaml: under spec.template.metadata.labels add   tier: frontend
kubectl apply -f d.yaml
kubectl get pods -n web --show-labels`,
  async setup() {},
  async checks() {
    const d = q.deploy('web', 'frontend');
    const c = d?.spec?.template?.spec?.containers?.[0];
    const pods = k.json('pods', '-n', 'web', '-l', 'tier=frontend')?.items ?? [];
    return [
      ['Deployment web/frontend exists', !!d],
      ['Image is nginx:1.27', c?.image === 'nginx:1.27'],
      ['3 replicas requested', d?.spec?.replicas === 3],
      ['Pod template has label tier=frontend', d?.spec?.template?.metadata?.labels?.tier === 'frontend'],
      ['3 Pods with tier=frontend are Running and Ready', pods.filter(q.ready).length === 3],
    ];
  },
};

export const imagePull = {
  id: 'image-pull',
  ns: 'shop',
  task: `Deployment api in namespace shop is not serving anything.
Get both replicas running. It should run nginx 1.27, alpine variant.`,
  hints: [
    'kubectl get pods -n shop, then kubectl describe pod <one of them> -n shop. Read the Events.',
    'Look closely at the image tag. kubectl set image deployment/api <container>=<image> -n shop',
  ],
  solution: `kubectl describe pod -n shop -l app=api | grep -A3 Events   # "nginx:1.27-alpne" not found
kubectl set image deployment/api nginx=nginx:1.27-alpine -n shop
kubectl rollout status deployment/api -n shop`,
  async setup() {
    k.run('create', 'deployment', 'api', '-n', 'shop', '--image=nginx:1.27-alpne', '--replicas=2');
  },
  async checks() {
    const d = q.deploy('shop', 'api');
    return [
      ['Deployment shop/api still exists', !!d],
      ['Image is nginx:1.27-alpine', d?.spec?.template?.spec?.containers?.[0]?.image === 'nginx:1.27-alpine'],
      ['2 of 2 replicas available', d?.spec?.replicas === 2 && q.available(d) === 2],
    ];
  },
};

export const crashloop = {
  id: 'crashloop',
  ns: 'jobs',
  task: `Pod worker in namespace jobs keeps failing right after it starts.
Fix it so it runs "sleep 3600" and stays Running. Keep the name worker.`,
  hints: [
    'kubectl describe pod worker -n jobs. Look at Last State and the message.',
    'Most Pod fields are immutable. kubectl get pod worker -n jobs -o yaml > w.yaml, fix it, then kubectl replace --force -f w.yaml',
  ],
  solution: `kubectl describe pod worker -n jobs        # exec: "sleeep": executable file not found
kubectl get pod worker -n jobs -o yaml > w.yaml
# fix command: ["sleep", "3600"]
kubectl replace --force -f w.yaml`,
  async setup() {
    k.apply(`apiVersion: v1
kind: Pod
metadata:
  name: worker
  namespace: jobs
spec:
  containers:
  - name: worker
    image: busybox:1.36
    command: ["sleeep", "3600"]`);
  },
  async checks() {
    const p = q.pod('jobs', 'worker');
    const cmd = [...(p?.spec?.containers?.[0]?.command ?? []), ...(p?.spec?.containers?.[0]?.args ?? [])].join(' ');
    return [
      ['Pod jobs/worker exists', !!p],
      ['It runs sleep 3600', /(^|\s)sleep\s+3600/.test(cmd)],
      ['It is Running and Ready', q.ready(p)],
    ];
  },
};
