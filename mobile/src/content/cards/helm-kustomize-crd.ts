import type { Card } from '../types';

const KUS = 'https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/';
const CRD = 'https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/';
const HELM = 'https://helm.sh/docs/intro/using_helm/';

export const cards: Card[] = [
  {
    id: 'helm-01',
    type: 'concept',
    domain: 'architecture',
    topic: 'Helm',
    week: 10,
    title: 'Helm installs packaged apps',
    body: 'A **chart** is a package of templated manifests. A **release** is one installed copy of it. Values fill in the templates: **helm install web bitnami/nginx --set replicaCount=3**. Helm keeps a revision history per release, so you can roll back.',
    check: {
      q: 'Which command lists releases in every namespace?',
      options: ['helm list -A', 'helm get all', 'helm repo list', 'kubectl get releases'],
      answer: 0,
    },
    explain: 'Like kubectl, helm is namespaced: add -n <ns> or -A. Releases are stored as Secrets in the release namespace.',
    docs: HELM,
  },
  {
    id: 'helm-02',
    type: 'mcq',
    domain: 'architecture',
    topic: 'Helm',
    week: 10,
    q: 'Order of commands to install chart nginx from a new repo bitnami?',
    options: ['helm repo add → helm repo update → helm install', 'helm install → helm repo add', 'helm pull → kubectl apply → helm repo add', 'helm init → helm install'],
    answer: 0,
    explain: '`helm repo add bitnami https://charts.bitnami.com/bitnami`, `helm repo update`, `helm search repo nginx`, `helm install web bitnami/nginx -n web --create-namespace`.',
    docs: HELM,
  },
  {
    id: 'helm-03',
    type: 'mcq',
    domain: 'architecture',
    topic: 'Helm',
    week: 10,
    q: 'How do you see which values a chart accepts before installing?',
    options: ['helm show values bitnami/nginx', 'helm get values bitnami/nginx', 'helm list --values', 'kubectl explain chart'],
    answer: 0,
    explain: '`show` reads a chart. `get values <release>` reads what an installed release was given. `helm template` renders manifests locally without installing.',
    docs: 'https://helm.sh/docs/helm/helm_show_values/',
  },
  {
    id: 'helm-04',
    type: 'mcq',
    domain: 'architecture',
    topic: 'Helm',
    week: 10,
    q: 'Release web is on revision 3 and broken. How do you go back to revision 2?',
    options: ['helm rollback web 2', 'helm upgrade web --revision=2', 'kubectl rollout undo release/web', 'helm uninstall web --keep 2'],
    answer: 0,
    explain: '`helm history web` lists revisions. A rollback creates a new revision (4) with revision 2\'s contents.',
    docs: 'https://helm.sh/docs/helm/helm_rollback/',
  },
  {
    id: 'helm-05',
    type: 'mcq',
    domain: 'architecture',
    topic: 'Helm',
    week: 10,
    q: 'You pass both `-f values.yaml` and `--set replicaCount=5`. values.yaml says 2. What wins?',
    options: ['--set: 5', 'values.yaml: 2', 'The chart default', 'Helm errors on the conflict'],
    answer: 0,
    explain: 'Precedence: chart defaults < -f files (later files win) < --set. Use `helm upgrade web bitnami/nginx --reuse-values --set …` to change one value.',
  },
  {
    id: 'kus-01',
    type: 'concept',
    domain: 'architecture',
    topic: 'Kustomize',
    week: 10,
    title: 'Kustomize patches YAML without templates',
    body: 'A **kustomization.yaml** lists **resources** (plain manifests) and transforms them: **namespace**, **namePrefix**, **labels**, **images**, **patches**. An **overlay** (e.g. prod/) points at a **base** and changes only what differs. It\'s built into kubectl.',
    check: {
      q: 'Which command applies the kustomization in directory overlays/prod?',
      options: ['kubectl apply -k overlays/prod', 'kubectl apply -f overlays/prod/kustomization.yaml', 'kustomize install overlays/prod', 'helm install overlays/prod'],
      answer: 0,
    },
    explain: '`kubectl kustomize overlays/prod` prints the rendered result without applying. Great for checking before you apply.',
    docs: KUS,
  },
  {
    id: 'kus-02',
    type: 'yaml',
    domain: 'architecture',
    topic: 'Kustomize',
    week: 10,
    task: 'The prod overlay should reuse the base and set namespace prod. Tap the broken line.',
    yaml: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: prod
resource:
- ../../base
images:
- name: nginx
  newTag: "1.27"`,
    bugLine: 3,
    fixLine: 'resources:',
    explain: 'resources (plural) lists files or directories. A directory entry must contain its own kustomization.yaml.',
    docs: KUS,
  },
  {
    id: 'kus-03',
    type: 'mcq',
    domain: 'architecture',
    topic: 'Kustomize',
    week: 10,
    q: 'What does a Kustomize configMapGenerator do that a plain ConfigMap does not?',
    options: ['Appends a content hash to the name, so changes roll the Pods', 'Encrypts the data', 'Makes it immutable', 'Shares it across namespaces'],
    answer: 0,
    explain: 'app-config becomes app-config-7g2h9k…, and every reference is rewritten. Change a value → new name → the Deployment template changes → rolling update.',
    docs: KUS + '#configmapgenerator',
  },
  {
    id: 'kus-04',
    type: 'cmd',
    domain: 'architecture',
    topic: 'Kustomize',
    week: 10,
    task: 'Render (print, not apply) the kustomization in directory base.',
    answer: 'kubectl kustomize base',
    distractors: ['apply', '-k', '--dry-run=client'],
    explain: '`kubectl apply -k base --dry-run=client -o yaml` also works, but this is shorter.',
  },
  {
    id: 'crd-01',
    type: 'concept',
    domain: 'architecture',
    topic: 'CRDs & operators',
    week: 10,
    title: 'CRDs teach the API new nouns',
    body: 'A **CustomResourceDefinition** adds a new resource type (e.g. **Backup** in group **db.example.com**) that kubectl can create, list and watch like built-ins. An **operator** is a controller that watches those objects and does the work: reconcile desired vs actual.',
    check: {
      q: 'You create a Backup object and nothing happens. The CRD exists. What is missing?',
      options: ['The operator/controller that acts on Backups', 'A RoleBinding for kubectl', 'A Service for the CRD', 'A StorageClass'],
      answer: 0,
    },
    explain: 'A CRD alone only stores data in etcd. Behavior comes from a controller. `kubectl get crd` lists them; `kubectl explain backup.spec` shows the schema.',
    docs: CRD,
  },
  {
    id: 'crd-02',
    type: 'yaml',
    domain: 'architecture',
    topic: 'CRDs & operators',
    week: 10,
    task: 'A namespaced CRD for kind Backup. The API server rejects it. Tap the broken line.',
    yaml: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backup.db.example.com
spec:
  group: db.example.com
  scope: Namespaced
  names:
    plural: backups
    singular: backup
    kind: Backup`,
    bugLine: 3,
    fixLine: '  name: backups.db.example.com',
    explain: 'The CRD name must be <plural>.<group>. (A real CRD also needs versions: with served, storage and a schema.)',
    docs: CRD + '#create-a-customresourcedefinition',
  },
  {
    id: 'crd-03',
    type: 'mcq',
    domain: 'architecture',
    topic: 'CRDs & operators',
    week: 10,
    q: 'A CRD lists versions v1beta1 and v1. How many can have `storage: true`?',
    options: ['Exactly one', 'All served versions', 'None, storage is automatic', 'Up to two'],
    answer: 0,
    explain: 'Many versions can be served, but objects are saved in etcd as exactly one storage version.',
    docs: 'https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definition-versioning/',
  },
  {
    id: 'crd-04',
    type: 'cmd',
    domain: 'architecture',
    topic: 'CRDs & operators',
    week: 10,
    task: 'List the CRDs installed in the cluster.',
    answer: 'kubectl get crd',
    distractors: ['customresources', '-A', 'api-versions'],
    explain: 'Exam tasks like "list the CRDs installed by cert-manager and save them to a file" are common. Pipe through grep: `kubectl get crd | grep cert-manager`.',
  },
  {
    id: 'crd-05',
    type: 'mcq',
    domain: 'architecture',
    topic: 'CRDs & operators',
    week: 10,
    boss: true,
    q: 'You delete a CRD. What happens to the custom objects of that type?',
    options: ['They are all deleted too', 'They stay and become read-only', 'They move to a default CRD', 'The deletion is refused while objects exist'],
    answer: 0,
    explain: 'Deleting a CRD deletes every custom resource of that kind in every namespace. Treat it as destructive.',
    docs: CRD + '#delete-a-customresourcedefinition',
  },
];
