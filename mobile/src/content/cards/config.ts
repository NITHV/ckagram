import type { Card } from '../types';

const CM_DOCS = 'https://kubernetes.io/docs/concepts/configuration/configmap/';
const SECRET_DOCS = 'https://kubernetes.io/docs/concepts/configuration/secret/';

export const cards: Card[] = [
  {
    id: 'cfg-01',
    type: 'concept',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    title: 'Config lives outside the image',
    body: 'A ConfigMap holds non-secret key/value config. Pods consume it as env vars (env / envFrom) or as files (a volume, one file per key). Same image, different config per environment.',
    check: {
      q: 'You update a ConfigMap. Which consumers see the new value without a restart?',
      options: ['Mounted volume files (after a short delay)', 'Environment variables', 'Both', 'Neither'],
      answer: 0,
    },
    explain: 'The kubelet refreshes mounted ConfigMap files eventually (subPath mounts excepted). Env vars are read once at container start, so restart (`kubectl rollout restart`).',
    docs: CM_DOCS,
  },
  {
    id: 'cfg-02',
    type: 'cmd',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    task: 'Create ConfigMap app-config with key MODE=prod.',
    answer: 'kubectl create configmap app-config --from-literal=MODE=prod',
    distractors: ['--from-env=MODE=prod', 'secret', '--data'],
    explain: 'Repeat --from-literal for more keys. Short name: cm.',
  },
  {
    id: 'cfg-03',
    type: 'cmd',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    task: 'Create ConfigMap nginx-conf from the file nginx.conf.',
    answer: 'kubectl create configmap nginx-conf --from-file=nginx.conf',
    distractors: ['--from-literal=nginx.conf', '-f', '--from-env-file=nginx.conf'],
    explain: '--from-file uses the file name as the key and its contents as the value. --from-env-file instead parses KEY=VALUE lines into separate keys.',
  },
  {
    id: 'cfg-04',
    type: 'yaml',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    task: 'Load every key of ConfigMap app-config as env vars. Tap the broken line.',
    yaml: `containers:
- name: app
  image: nginx
  envFrom:
  - configMapKeyRef:
      name: app-config`,
    bugLine: 4,
    fixLine: '  - configMapRef:',
    explain: 'envFrom takes configMapRef (whole ConfigMap). configMapKeyRef is for a single key under env[].valueFrom.',
    docs: 'https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/',
  },
  {
    id: 'cfg-05',
    type: 'yaml',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    task: 'Set DB_HOST from key db_host in ConfigMap app-config. Tap the broken line.',
    yaml: `env:
- name: DB_HOST
  valueFrom:
    configMapKeyRef:
      name: app-config
      value: db_host`,
    bugLine: 5,
    fixLine: '      key: db_host',
    explain: 'A key reference uses name (the ConfigMap) and key (the entry). The same shape works for secretKeyRef.',
  },
  {
    id: 'cfg-06',
    type: 'concept',
    domain: 'workloads',
    topic: 'Secrets',
    week: 2,
    title: 'Secrets are encoded, not encrypted',
    body: 'Secret values in .data are base64-encoded, which anyone can decode. Real protection comes from RBAC on Secrets and enabling encryption at rest for etcd.',
    check: {
      q: 'Someone can `kubectl get secret db -o yaml`. Can they read the password?',
      options: ['Yes, by base64-decoding it', 'No, it is AES-encrypted', 'Only with the cluster CA key', 'Only on the control plane node'],
      answer: 0,
    },
    explain: 'base64 is encoding. Lock down get/list on Secrets with RBAC and configure an EncryptionConfiguration on the API server.',
    docs: SECRET_DOCS,
  },
  {
    id: 'cfg-07',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Secrets',
    week: 2,
    task: 'Create a generic Secret db-pass with key password=s3cret.',
    answer: 'kubectl create secret generic db-pass --from-literal=password=s3cret',
    distractors: ['opaque', 'tls', 'configmap'],
    explain: 'Subcommands: generic, tls and docker-registry. kubectl base64-encodes the value for you.',
  },
  {
    id: 'cfg-08',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Secrets',
    week: 2,
    task: 'Print the decoded password key of Secret db-pass.',
    answer: "kubectl get secret db-pass -o jsonpath='{.data.password}' | base64 -d",
    distractors: ['--decode-secret', "'{.stringData.password}'", 'describe'],
    explain: 'describe only shows byte sizes. jsonpath plus base64 -d gives the plain value.',
  },
  {
    id: 'cfg-09',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Secrets',
    week: 2,
    q: 'Which Secret field lets you write plain-text values in YAML?',
    options: ['stringData', 'data', 'plainData', 'values'],
    answer: 0,
    explain: 'stringData is write-only convenience. The API server encodes it into data on save.',
  },
  {
    id: 'cfg-10',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Secrets',
    week: 2,
    task: 'Create a TLS Secret web-tls from tls.crt and tls.key.',
    answer: 'kubectl create secret tls web-tls --cert=tls.crt --key=tls.key',
    distractors: ['generic', '--from-file=tls.crt', '--ca=tls.crt'],
    explain: 'Creates type kubernetes.io/tls with keys tls.crt and tls.key. Ingress and Gateway TLS reference these.',
  },
  {
    id: 'cfg-11',
    type: 'yaml',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    task: 'Mount ConfigMap nginx-conf at /etc/nginx/conf.d. Tap the broken line.',
    yaml: `spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: conf
      mountPath: /etc/nginx/conf.d
  volumes:
  - name: config
    configMap:
      name: nginx-conf`,
    bugLine: 8,
    fixLine: '  - name: conf',
    explain: 'volumeMounts[].name must match a volumes[].name in the same Pod. Here the mount says conf and the volume says config.',
  },
  {
    id: 'cfg-12',
    type: 'mcq',
    domain: 'troubleshooting',
    topic: 'ConfigMaps',
    week: 2,
    q: 'A Pod references a ConfigMap key that does not exist in an env var. What status do you see?',
    options: ['CreateContainerConfigError', 'CrashLoopBackOff', 'ImagePullBackOff', 'Pending'],
    answer: 0,
    explain: 'The kubelet cannot build the container config. describe shows the missing key. Mark the reference optional: true if it may be absent.',
  },
  {
    id: 'cfg-13',
    type: 'mcq',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    q: 'What does `immutable: true` on a ConfigMap do?',
    options: [
      'Blocks changes to its data and lets kubelets stop watching it',
      'Encrypts it at rest',
      'Prevents it from being deleted',
      'Makes Pods restart when it changes',
    ],
    answer: 0,
    explain: 'Immutable ConfigMaps and Secrets reduce API server load and protect against accidental edits. To change one, delete and recreate it.',
  },
  {
    id: 'cfg-14',
    type: 'mcq',
    domain: 'workloads',
    topic: 'ConfigMaps',
    week: 2,
    q: 'What is the size limit of a single ConfigMap?',
    options: ['1 MiB', '64 KiB', '10 MiB', 'No limit'],
    answer: 0,
    explain: 'The 1 MiB limit comes from etcd object size. Larger data belongs in a volume or external storage.',
  },
  {
    id: 'cfg-15',
    type: 'cmd',
    domain: 'workloads',
    topic: 'Secrets',
    week: 2,
    task: 'Create a docker-registry Secret regcred for registry.example.com, user dev, password pw.',
    answer: 'kubectl create secret docker-registry regcred --docker-server=registry.example.com --docker-username=dev --docker-password=pw',
    distractors: ['generic', '--registry=registry.example.com', '--user=dev'],
    explain: 'Reference it from the Pod with spec.imagePullSecrets: [{name: regcred}] to pull private images.',
  },
  {
    id: 'cfg-16',
    type: 'mcq',
    domain: 'workloads',
    topic: 'Secrets',
    week: 2,
    boss: true,
    q: 'You change the value in Secret db-pass. The Pod uses it via env (secretKeyRef) and also as a volume with subPath. What sees the new value without a restart?',
    options: ['Neither', 'Both', 'Only the env var', 'Only the subPath file'],
    answer: 0,
    explain: 'Env vars are fixed at start, and subPath mounts are never updated. Only a plain (non-subPath) volume mount refreshes. Restart the Pods.',
  },
];
