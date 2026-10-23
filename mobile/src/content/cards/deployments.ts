import type { Card } from '../types';

const DEPLOY_DOCS = 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/';

export const cards: Card[] = [
  {
    id: 'dep-01',
    type: 'concept',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    title: 'Deployment → ReplicaSet → Pods',
    body: 'A Deployment manages ReplicaSets, and each ReplicaSet keeps N identical Pods alive. A change to the Pod template creates a new ReplicaSet, and Pods shift over to it gradually. That is a rolling update.',
    check: {
      q: 'You delete one Pod from a 3-replica Deployment. What happens?',
      options: ['The ReplicaSet creates a replacement Pod', 'The Deployment scales to 2', 'The Deployment is deleted', 'Nothing until you run rollout restart'],
      answer: 0,
    },
    explain: 'The ReplicaSet controller keeps reconciling actual state (2 Pods) back to desired state (3). That is self-healing.',
    docs: DEPLOY_DOCS,
  },
  {
    id: 'dep-02',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    task: 'Create a Deployment web with image nginx and 3 replicas.',
    answer: 'kubectl create deployment web --image=nginx --replicas=3',
    distractors: ['run', '--count=3', 'pod'],
    explain: 'create deployment accepts --replicas. kubectl run does not.',
  },
  {
    id: 'dep-03',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    task: 'Scale Deployment web to 5 replicas.',
    answer: 'kubectl scale deployment web --replicas=5',
    distractors: ['autoscale', '--max=5', 'edit'],
    explain: 'Scaling does not create a new rollout revision; only Pod template changes do.',
  },
  {
    id: 'dep-04',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Update the nginx container in Deployment web to image nginx:1.27.',
    answer: 'kubectl set image deployment/web nginx=nginx:1.27',
    distractors: ['--image=nginx:1.27', 'web=nginx:1.27', 'rollout'],
    explain: 'The format is <container-name>=<image>. `create deployment --image=nginx` names the container nginx after the image.',
    docs: DEPLOY_DOCS + '#updating-a-deployment',
  },
  {
    id: 'dep-05',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Wait for and watch the rollout of Deployment web.',
    answer: 'kubectl rollout status deployment/web',
    distractors: ['history', '-w', 'describe'],
    explain: 'status blocks until the rollout finishes or fails, which makes it a good check after set image.',
  },
  {
    id: 'dep-06',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Roll Deployment web back to the previous revision.',
    answer: 'kubectl rollout undo deployment/web',
    distractors: ['rollback', 'restart', '--previous'],
    explain: 'Add --to-revision=N to target a specific revision from `kubectl rollout history`.',
    docs: DEPLOY_DOCS + '#rolling-back-a-deployment',
  },
  {
    id: 'dep-07',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Roll Deployment web back to revision 2.',
    answer: 'kubectl rollout undo deployment/web --to-revision=2',
    distractors: ['--revision=2', 'history', '-r=2'],
    explain: 'Check revisions first with `kubectl rollout history deployment/web`. Add --revision=2 to history to see one revision in detail.',
  },
  {
    id: 'dep-08',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Restart all Pods of Deployment web without changing its spec.',
    answer: 'kubectl rollout restart deployment/web',
    distractors: ['delete', 'undo', '--force'],
    explain: 'restart stamps a template annotation, which triggers a normal rolling update. Use it after changing a ConfigMap consumed as env vars.',
  },
  {
    id: 'dep-09',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    q: 'Which Deployment strategy kills all old Pods before creating new ones?',
    options: ['Recreate', 'RollingUpdate', 'BlueGreen', 'Canary'],
    answer: 0,
    explain: 'There are only two built-in strategies: RollingUpdate (default) and Recreate. Blue/green and canary are patterns built from labels and Services.',
    docs: DEPLOY_DOCS + '#strategy',
  },
  {
    id: 'dep-10',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    q: 'Default maxSurge and maxUnavailable for a RollingUpdate?',
    options: ['25% and 25%', '1 and 0', '50% and 50%', '100% and 0%'],
    answer: 0,
    explain: 'Both default to 25%. Set maxUnavailable: 0 and maxSurge: 1 for a zero-downtime one-at-a-time rollout.',
  },
  {
    id: 'dep-11',
    type: 'yaml',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    task: 'The API server rejects this Deployment. Tap the broken line.',
    yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: nginx
        image: nginx`,
    bugLine: 12,
    fixLine: '        app: web',
    explain: 'spec.selector must match the template labels, or the API server rejects it: "selector does not match template labels".',
    docs: DEPLOY_DOCS,
  },
  {
    id: 'dep-12',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    q: 'Can you change spec.selector of an existing apps/v1 Deployment?',
    options: ['No, it is immutable; delete and recreate', 'Yes, with kubectl edit', 'Yes, with kubectl apply only', 'Only by scaling to 0 first'],
    answer: 0,
    explain: 'The selector is immutable in apps/v1. Labels inside the template can change, as long as they still match the selector.',
  },
  {
    id: 'dep-13',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    q: 'Which of these creates a new rollout revision?',
    options: ['Changing the container image', 'Scaling replicas from 3 to 5', 'Adding a label to the Deployment metadata', 'Changing revisionHistoryLimit'],
    answer: 0,
    explain: 'Only changes to spec.template (the Pod template) trigger a rollout and a new ReplicaSet.',
  },
  {
    id: 'dep-14',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Record why the current revision happened, so it shows in rollout history.',
    answer: 'kubectl annotate deployment/web kubernetes.io/change-cause=nginx-1.27',
    distractors: ['--record', 'label', 'change-cause'],
    explain: '--record is deprecated. The CHANGE-CAUSE column reads the kubernetes.io/change-cause annotation.',
  },
  {
    id: 'dep-15',
    type: 'concept',
    domain: 'workloads',
    topic: 'Probes',
    week: 2,
    title: 'Three probes, three jobs',
    body: 'Liveness: is it stuck? If it fails, the container is restarted. Readiness: can it serve? If it fails, the Pod is removed from Service endpoints. Startup: is it still booting? It holds off the other two until it passes.',
    check: {
      q: 'A Pod is Running but shows 0/1 READY and gets no traffic. Which probe is failing?',
      options: ['Readiness', 'Liveness', 'Startup has passed, so none', 'The Service probe'],
      answer: 0,
    },
    explain: 'A failing readiness probe never restarts anything. It just keeps the Pod out of load balancing until it recovers.',
    docs: 'https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/',
  },
  {
    id: 'dep-16',
    type: 'yaml',
    domain: 'workloads',
    topic: 'Probes',
    week: 2,
    task: 'The app serves health on port 8080 at /healthz, but this container keeps restarting. Tap the broken line.',
    yaml: `containers:
- name: api
  image: example/api:2.0
  ports:
  - containerPort: 8080
  livenessProbe:
    httpGet:
      path: /healthz
      port: 80
    initialDelaySeconds: 5
    periodSeconds: 10`,
    bugLine: 8,
    fixLine: '      port: 8080',
    explain: 'The probe checks port 80 where nothing listens, so liveness fails and the kubelet restarts the container again and again.',
  },
  {
    id: 'dep-17',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    q: 'Which controller runs exactly one Pod on every (matching) node?',
    options: ['DaemonSet', 'Deployment', 'StatefulSet', 'ReplicaSet'],
    answer: 0,
    explain: 'DaemonSets are for node agents: log collectors, CNI plugins, kube-proxy.',
    docs: 'https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/',
  },
  {
    id: 'dep-18',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    q: 'Which workload gives Pods stable names (db-0, db-1) and their own persistent volume each?',
    options: ['StatefulSet', 'Deployment', 'DaemonSet', 'Job'],
    answer: 0,
    explain: 'StatefulSets give stable identity and ordering, plus volumeClaimTemplates for one PVC per Pod.',
    docs: 'https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/',
  },
  {
    id: 'dep-19',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Show the rollout history of Deployment web.',
    answer: 'kubectl rollout history deployment/web',
    distractors: ['status', 'get', '--revisions'],
    explain: 'Revisions are kept up to spec.revisionHistoryLimit (default 10).',
  },
  {
    id: 'dep-20',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'Pause the rollout of Deployment web so you can make several changes at once.',
    answer: 'kubectl rollout pause deployment/web',
    distractors: ['stop', 'scale', '--replicas=0'],
    explain: 'While paused, template changes pile up without rolling. `kubectl rollout resume deployment/web` rolls them out together.',
  },
  {
    id: 'dep-21',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    boss: true,
    q: 'After `set image`, rollout status hangs. New Pods show ImagePullBackOff while 3 old Pods keep serving. What is the fastest safe fix?',
    options: [
      'kubectl rollout undo deployment/web',
      'kubectl delete deployment web and recreate it',
      'kubectl scale deployment web --replicas=0',
      'Restart the kubelet on every node',
    ],
    answer: 0,
    explain: 'RollingUpdate keeps old Pods while new ones fail, so the app is still up. undo returns to the working ReplicaSet. Then fix the image tag and roll forward.',
  },
  {
    id: 'dep-22',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    task: 'Generate Deployment YAML for web (image nginx) into web.yaml without creating it.',
    answer: 'kubectl create deployment web --image=nginx --dry-run=client -o yaml > web.yaml',
    distractors: ['run', '--dry-run=server', '-o wide'],
    explain: 'Generate, edit (add probes, resources, volumes), then `kubectl apply -f web.yaml`.',
  },
  {
    id: 'dep-23',
    type: 'yaml',
    domain: 'workloads',
    topic: 'Rollouts',
    week: 2,
    task: 'You want zero downtime, one Pod at a time. Tap the line that breaks that.',
    yaml: `spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 2`,
    bugLine: 6,
    fixLine: '      maxUnavailable: 0',
    explain: 'maxUnavailable: 2 lets half the Pods go down during the rollout. maxUnavailable: 0 with maxSurge: 1 swaps one at a time with full capacity.',
  },
  {
    id: 'dep-24',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Deployments',
    week: 2,
    boss: true,
    q: 'You edit a Deployment and add a label to spec.template.metadata.labels only (the selector is unchanged). What happens?',
    options: [
      'A rolling update starts and new Pods carry the extra label',
      'The API server rejects it: labels must equal the selector',
      'Nothing; template labels are ignored',
      'All Pods are deleted at once',
    ],
    answer: 0,
    explain: 'Template labels may be a superset of the selector. Any template change is a rollout, so a new ReplicaSet appears.',
  },
];
