import type { Card } from '../types';

const PV = 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/';
const SC = 'https://kubernetes.io/docs/concepts/storage/storage-classes/';
const VOL = 'https://kubernetes.io/docs/concepts/storage/volumes/';

export const cards: Card[] = [
  {
    id: 'sto-01',
    type: 'concept',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    title: 'PV is the disk, PVC is the request',
    body: 'A **PersistentVolume** is a piece of storage in the cluster (cluster-scoped). A **PersistentVolumeClaim** is a namespaced request: "10Gi, ReadWriteOnce, class fast". Kubernetes **binds** one PVC to one PV. Pods mount the PVC, never the PV.',
    check: {
      q: 'Which of these is namespaced?',
      options: ['PersistentVolumeClaim', 'PersistentVolume', 'StorageClass', 'CSIDriver'],
      answer: 0,
    },
    explain: 'PVs, StorageClasses and CSIDrivers are cluster-wide. `kubectl api-resources --namespaced=false` lists all cluster-scoped kinds.',
    docs: PV,
  },
  {
    id: 'sto-02',
    type: 'mcq',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    q: 'What does access mode ReadWriteOnce (RWO) really mean?',
    options: ['Read-write by a single node (Pods on that node may share it)', 'Read-write by a single Pod only', 'Writable once, then read-only', 'Read-write by one namespace'],
    answer: 0,
    explain: 'RWO is per node. For "exactly one Pod" there is ReadWriteOncePod (RWOP). ROX = read-only by many nodes, RWX = read-write by many nodes (NFS, CephFS…).',
    docs: PV + '#access-modes',
  },
  {
    id: 'sto-03',
    type: 'mcq',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    q: 'A PVC stays Pending. Which mismatch does NOT stop it binding to an existing PV?',
    options: ['The PV is larger than requested', 'Different storageClassName', 'The PV lacks the requested access mode', 'The PV is already Bound to another claim'],
    answer: 0,
    explain: 'A bigger PV is fine: a 5Gi claim can bind a 10Gi PV (and gets all 10Gi). Class, access modes, volumeMode and availability must match.',
    docs: PV + '#binding',
  },
  {
    id: 'sto-04',
    type: 'yaml',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    task: 'Claim 1Gi from StorageClass standard. The API server rejects it. Tap the broken line.',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  storageClassName: standard
  accessModes:
  - ReadWriteOne
  resources:
    requests:
      storage: 1Gi`,
    bugLine: 7,
    fixLine: '  - ReadWriteOnce',
    explain: 'Access modes are exact strings: ReadWriteOnce, ReadOnlyMany, ReadWriteMany, ReadWriteOncePod. Also watch units: 1Gi (2^30 bytes) is not 1G (10^9).',
    docs: PV + '#persistentvolumeclaims',
  },
  {
    id: 'sto-05',
    type: 'yaml',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    task: 'Mount PVC data at /var/lib/app. The Pod fails validation. Tap the broken line.',
    yaml: `apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: nginx
    volumeMounts:
    - name: store
      mountPath: /var/lib/app
  volumes:
  - name: store
    persistentVolumeClaim:
      name: data`,
    bugLine: 14,
    fixLine: '      claimName: data',
    explain: 'The field is claimName. The volume name (store) is what volumeMounts refers to; claimName points at the PVC in the same namespace.',
    docs: PV + '#claims-as-volumes',
  },
  {
    id: 'sto-06',
    type: 'concept',
    domain: 'storage',
    topic: 'StorageClass',
    week: 7,
    title: 'StorageClasses make disks on demand',
    body: 'With **dynamic provisioning**, you don\'t create PVs. A PVC names a **StorageClass**, and its **provisioner** (a CSI driver) creates a matching PV automatically. The class marked default is used when a PVC sets no class.',
    check: {
      q: 'How is a StorageClass marked as the cluster default?',
      options: ['Annotation storageclass.kubernetes.io/is-default-class: "true"', 'Name it "default"', 'Set reclaimPolicy: Default', 'Put it in kube-system'],
      answer: 0,
    },
    explain: '`kubectl get sc` shows "(default)" next to it. Only one should be default; with several, the newest one wins.',
    docs: SC + '#default-storageclass',
  },
  {
    id: 'sto-07',
    type: 'mcq',
    domain: 'storage',
    topic: 'StorageClass',
    week: 7,
    q: 'A new PVC on a WaitForFirstConsumer class says Pending: "waiting for first consumer to be created before binding". What should you do?',
    options: ['Nothing wrong: create a Pod that uses it and it binds', 'Delete and recreate the PVC', 'Change the class to Immediate', 'Create a PV by hand'],
    answer: 0,
    explain: 'WaitForFirstConsumer delays provisioning until a Pod is scheduled, so the volume is created in that Pod\'s zone/node. Immediate provisions right away.',
    docs: SC + '#volume-binding-mode',
  },
  {
    id: 'sto-08',
    type: 'mcq',
    domain: 'storage',
    topic: 'StorageClass',
    week: 7,
    q: 'What is the default reclaimPolicy of a dynamically provisioned PV?',
    options: ['Delete (inherited from the StorageClass default)', 'Retain', 'Recycle', 'Archive'],
    answer: 0,
    explain: 'A StorageClass defaults to reclaimPolicy: Delete, so deleting the PVC deletes the PV and the disk. Manually created PVs default to Retain.',
    docs: SC + '#reclaim-policy',
  },
  {
    id: 'sto-09',
    type: 'yaml',
    domain: 'storage',
    topic: 'StorageClass',
    week: 7,
    task: 'A class that keeps disks after the PVC is deleted and lets PVCs grow. Tap the broken line.',
    yaml: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: keep
provisioner: rancher.io/local-path
reclaimPolicy: Keep
allowVolumeExpansion: true
volumeBindingMode: WaitForFirstConsumer`,
    bugLine: 5,
    fixLine: 'reclaimPolicy: Retain',
    explain: 'Valid values are Delete and Retain. (Recycle is deprecated.) Note the class fields sit at the top level: there is no spec: in a StorageClass.',
    docs: SC,
  },
  {
    id: 'sto-10',
    type: 'mcq',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    q: 'A Retain PV is "Released" after its PVC was deleted. A new PVC won\'t bind to it. Why?',
    options: ['It still has a claimRef to the old PVC', 'Released PVs are read-only', 'The data must be deleted first by Kubernetes', 'Retain PVs can never be reused'],
    answer: 0,
    explain: 'Kubernetes keeps the old claimRef so data isn\'t handed to a stranger. If you mean it: `kubectl patch pv pv1 -p \'{"spec":{"claimRef":null}}\'` and it becomes Available.',
    docs: PV + '#retain',
  },
  {
    id: 'sto-11',
    type: 'mcq',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    q: 'How do you grow a bound PVC from 1Gi to 5Gi?',
    options: ['Edit spec.resources.requests.storage, if the class has allowVolumeExpansion: true', 'Delete the PVC and recreate it bigger', 'Edit the PV capacity', 'It is impossible'],
    answer: 0,
    explain: 'Expansion only grows, never shrinks. Some filesystems resize only after the Pod restarts. Check status.capacity on the PVC.',
    docs: PV + '#expanding-persistent-volumes-claims',
  },
  {
    id: 'sto-12',
    type: 'mcq',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    q: 'Which kubectl create subcommand makes a PVC?',
    options: ['There is none: write the YAML (copy it from the docs)', 'kubectl create pvc', 'kubectl create volume', 'kubectl create claim'],
    answer: 0,
    explain: 'No imperative command for PV or PVC. Bookmark the PV docs page and copy its examples. This alone saves minutes on exam day.',
    docs: PV,
  },
  {
    id: 'sto-13',
    type: 'yaml',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    task: 'A 2Gi hostPath PV at /mnt/data with no StorageClass. Tap the broken line.',
    yaml: `apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-data
spec:
  capacity:
    storage: 2Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  hostPath:
    directory: /mnt/data`,
    bugLine: 11,
    fixLine: '    path: /mnt/data',
    explain: 'hostPath takes path (and optionally type: DirectoryOrCreate). A PVC binds to a class-less PV like this one by setting storageClassName: "" explicitly.',
    docs: PV + '#persistent-volumes',
  },
  {
    id: 'sto-14',
    type: 'mcq',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    boss: true,
    q: 'Your PVC has no storageClassName, there is a default StorageClass, and you want it to bind to your manual PV (also no class). What must the PVC say?',
    options: ['storageClassName: ""', 'storageClassName: default', 'storageClassName: null', 'volumeName is not enough, nothing works'],
    answer: 0,
    explain: 'Leaving the field out means "use the default class", which provisions a new volume. An empty string means "no class": only class-less PVs match. (volumeName: pv-data also pins it.)',
    docs: PV + '#class-1',
  },
  {
    id: 'sto-15',
    type: 'concept',
    domain: 'storage',
    topic: 'Volumes',
    week: 7,
    title: 'emptyDir vs hostPath',
    body: '**emptyDir**: a scratch directory created when the Pod starts and deleted when the Pod goes. Containers in the Pod share it. **hostPath**: a path on the node itself. It survives the Pod, but is tied to that one node and is a security risk.',
    check: {
      q: 'Two containers in a Pod need to share files while the Pod lives. Simplest volume?',
      options: ['emptyDir', 'hostPath', 'A PVC with RWX', 'A ConfigMap'],
      answer: 0,
    },
    explain: 'emptyDir is the sidecar-log-shipping classic. `emptyDir: { medium: Memory }` puts it in RAM (counts toward the memory limit).',
    docs: VOL + '#emptydir',
  },
  {
    id: 'sto-16',
    type: 'mcq',
    domain: 'storage',
    topic: 'Volumes',
    week: 7,
    q: 'You delete a PVC that a running Pod is using. What happens?',
    options: ['It stays Terminating until the Pod stops using it', 'It is deleted at once and the Pod crashes', 'The API server refuses', 'The PV is deleted but the PVC stays'],
    answer: 0,
    explain: 'The kubernetes.io/pvc-protection finalizer protects in-use claims. Delete the Pod and the PVC goes away.',
    docs: PV + '#storage-object-in-use-protection',
  },
  {
    id: 'sto-17',
    type: 'cmd',
    domain: 'storage',
    topic: 'StorageClass',
    week: 7,
    task: 'List StorageClasses (and see which is default).',
    answer: 'kubectl get sc',
    distractors: ['storage', '--default', 'pvc'],
    explain: 'In kind the default is "standard" (provisioner rancher.io/local-path, WaitForFirstConsumer). In the exam, read the task: it often names a specific class.',
  },
  {
    id: 'sto-18',
    type: 'cmd',
    domain: 'storage',
    topic: 'PV & PVC',
    week: 7,
    task: 'List PVs sorted by capacity.',
    answer: 'kubectl get pv --sort-by=.spec.capacity.storage',
    distractors: ['--sort=capacity', 'pvc', '-o wide'],
    explain: 'A real past-exam task: "list PVs sorted by capacity and save to a file". Add `> /opt/pv-list.txt` when asked.',
  },
  {
    id: 'sto-19',
    type: 'mcq',
    domain: 'storage',
    topic: 'Volumes',
    week: 7,
    q: 'What does CSI stand for, and why does it exist?',
    options: ['Container Storage Interface: storage drivers plug in without changing Kubernetes', 'Cluster Storage Index: lists all PVs', 'Container Snapshot Interface: only for backups', 'Cloud Storage Integration: AWS only'],
    answer: 0,
    explain: 'CSI is to storage what CNI is to networking and CRI is to container runtimes. The old in-tree cloud drivers were migrated to CSI.',
    docs: VOL + '#csi',
  },
];
