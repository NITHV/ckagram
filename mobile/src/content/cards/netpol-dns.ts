import type { Card } from '../types';

const NP = 'https://kubernetes.io/docs/concepts/services-networking/network-policies/';
const DNS = 'https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/';
const COREDNS = 'https://kubernetes.io/docs/tasks/administer-cluster/dns-custom-nameservers/';

export const cards: Card[] = [
  {
    id: 'np-01',
    type: 'concept',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    title: 'Open by default, closed once selected',
    body: 'Every Pod can reach every other Pod. The moment a **NetworkPolicy selects a Pod** for Ingress (or Egress), only traffic that some policy allows gets through in that direction. Policies only add allows; there is no deny rule.',
    check: {
      q: 'Namespace prod has one policy selecting app=db that allows only app=api. What can reach app=web Pods?',
      options: ['Everything: no policy selects them', 'Only app=api', 'Nothing', 'Only Pods in prod'],
      answer: 0,
    },
    explain: 'Policies isolate only the Pods they select. web is not selected, so it stays wide open.',
    docs: NP,
  },
  {
    id: 'np-02',
    type: 'yaml',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    task: 'Default-deny all incoming traffic to every Pod in the namespace. Tap the broken line.',
    yaml: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
spec:
  podSelector: "*"
  policyTypes:
  - Ingress`,
    bugLine: 5,
    fixLine: '  podSelector: {}',
    explain: 'An empty podSelector {} selects every Pod in the namespace. No ingress rules + policyTypes Ingress = deny all incoming.',
    docs: NP + '#default-deny-all-ingress-traffic',
  },
  {
    id: 'np-03',
    type: 'mcq',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    boss: true,
    q: 'In one `from:` entry you write both `namespaceSelector: {team: a}` and `podSelector: {app: api}` (same list item, no dash before podSelector). What is allowed?',
    options: ['Pods labeled app=api in namespaces labeled team=a', 'All Pods in team=a namespaces, plus app=api Pods in this namespace', 'Nothing: you can\'t combine them', 'Every Pod labeled app=api in any namespace'],
    answer: 0,
    explain: 'Same list item = AND. Two items (a dash before each) = OR. One dash is the most common NetworkPolicy mistake on the exam.',
    docs: NP + '#behavior-of-to-and-from-selectors',
  },
  {
    id: 'np-04',
    type: 'yaml',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    task: 'Allow app=api Pods to reach app=db on TCP 5432 only. Tap the broken line.',
    yaml: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: db-allow-api
spec:
  podSelector:
    matchLabels:
      app: db
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api
    ports:
    - protocol: TCP
      port: "5432/tcp"`,
    bugLine: 17,
    fixLine: '      port: 5432',
    explain: 'port is a number or a named container port. The protocol goes in its own field (TCP is the default).',
    docs: NP,
  },
  {
    id: 'np-05',
    type: 'mcq',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    q: 'You add a default-deny Egress policy. Pods can no longer resolve any Service names. What must you also allow?',
    options: ['Egress to kube-dns on port 53 (UDP and TCP)', 'Ingress from kube-system', 'Egress to the API server on 6443', 'ICMP'],
    answer: 0,
    explain: 'DNS is egress too. Allow port 53 UDP+TCP to Pods labeled k8s-app=kube-dns in kube-system (namespaceSelector kubernetes.io/metadata.name: kube-system).',
    docs: NP,
  },
  {
    id: 'np-06',
    type: 'mcq',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    q: 'Your NetworkPolicies have no effect at all. Traffic flows as if they did not exist. Likely cause?',
    options: ['The CNI plugin does not enforce NetworkPolicy', 'kube-proxy is in IPVS mode', 'The policies need an IngressClass', 'You must restart the Pods'],
    answer: 0,
    explain: 'The API accepts policies either way; enforcement is the CNI plugin\'s job. Calico and Cilium enforce them. Plain Flannel does not.',
    docs: NP + '#prerequisites',
  },
  {
    id: 'np-07',
    type: 'mcq',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    q: 'Which label can you always use to select a namespace by its name?',
    options: ['kubernetes.io/metadata.name', 'name', 'namespace', 'k8s-app'],
    answer: 0,
    explain: 'Kubernetes sets kubernetes.io/metadata.name=<name> on every namespace automatically. Use it in namespaceSelector without labeling anything yourself.',
  },
  {
    id: 'np-08',
    type: 'cmd',
    domain: 'networking',
    topic: 'NetworkPolicy',
    week: 6,
    task: 'List NetworkPolicies in every namespace.',
    answer: 'kubectl get netpol -A',
    distractors: ['networkpolicies.v1', '--all', 'np'],
    explain: 'netpol is the short name. Then `kubectl describe netpol <name> -n <ns>` explains in words what is allowed.',
  },
  {
    id: 'dns-01',
    type: 'concept',
    domain: 'networking',
    topic: 'CoreDNS',
    week: 6,
    title: 'CoreDNS is just a Deployment',
    body: 'Cluster DNS runs as Deployment **coredns** in kube-system, behind a Service still called **kube-dns** (usually 10.96.0.10). Its config is the **Corefile** in ConfigMap **coredns**. Every Pod\'s /etc/resolv.conf points at that Service.',
    check: {
      q: 'Where do you change CoreDNS settings, like forwarding a domain to another DNS server?',
      options: ['ConfigMap coredns in kube-system (the Corefile)', '/etc/resolv.conf on each node', 'The kubelet config', 'The kube-dns Service annotations'],
      answer: 0,
    },
    explain: 'Edit the Corefile with `kubectl edit cm coredns -n kube-system`. The reload plugin picks up changes; or `kubectl rollout restart deploy coredns -n kube-system`.',
    docs: COREDNS,
  },
  {
    id: 'dns-02',
    type: 'mcq',
    domain: 'networking',
    topic: 'CoreDNS',
    week: 6,
    q: 'What does `ndots:5` in a Pod\'s resolv.conf mean?',
    options: ['Names with fewer than 5 dots try the search domains first', 'DNS answers are cached for 5 seconds', 'At most 5 nameservers', 'Names may have at most 5 labels'],
    answer: 0,
    explain: 'So "web" tries web.<ns>.svc.cluster.local, then web.svc.cluster.local, and so on. A trailing dot (google.com.) skips the search list.',
    docs: DNS,
  },
  {
    id: 'dns-03',
    type: 'mcq',
    domain: 'networking',
    topic: 'CoreDNS',
    week: 6,
    q: 'Which Pod dnsPolicy makes the Pod use the node\'s DNS settings instead of CoreDNS?',
    options: ['Default', 'ClusterFirst', 'None', 'ClusterFirstWithHostNet'],
    answer: 0,
    explain: 'Confusingly, "Default" is not the default. ClusterFirst is. None means you supply everything in dnsConfig.',
    docs: DNS + '#pod-s-dns-policy',
  },
  {
    id: 'dns-04',
    type: 'cmd',
    domain: 'networking',
    topic: 'CoreDNS',
    week: 6,
    task: 'Show the logs of the CoreDNS Pods (label k8s-app=kube-dns).',
    answer: 'kubectl logs -n kube-system -l k8s-app=kube-dns',
    distractors: ['coredns', '--all', 'deploy/kube-dns'],
    explain: 'Corefile syntax errors show up here, and the Pods crash. `kubectl logs -n kube-system deploy/coredns` also works.',
  },
  {
    id: 'dns-05',
    type: 'mcq',
    domain: 'networking',
    topic: 'CoreDNS',
    week: 6,
    q: 'What is the DNS name of Pod db-0 in StatefulSet db (headless Service db, namespace prod)?',
    options: ['db-0.db.prod.svc.cluster.local', 'db-0.prod.pod.cluster.local', 'db.db-0.prod.svc', 'prod.db-0.cluster.local'],
    answer: 0,
    explain: '<pod>.<headless-service>.<namespace>.svc.cluster.local. This stable name survives the Pod being rescheduled.',
    docs: 'https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#stable-network-id',
  },
  {
    id: 'net-01',
    type: 'concept',
    domain: 'networking',
    topic: 'Pod networking',
    week: 5,
    title: 'Every Pod gets its own IP',
    body: 'The Kubernetes network model: every Pod has a unique IP, and **any Pod can reach any other Pod without NAT**, across nodes. The **CNI plugin** (Calico, Cilium, Flannel, kindnet…) makes that true.',
    check: {
      q: 'Pods stay ContainerCreating and the node is NotReady with "network plugin not ready". What is missing?',
      options: ['A CNI plugin', 'kube-proxy', 'CoreDNS', 'An Ingress controller'],
      answer: 0,
    },
    explain: 'After kubeadm init, nodes stay NotReady until you install a CNI. The kubelet reads its config from /etc/cni/net.d and the plugin binaries from /opt/cni/bin.',
    docs: 'https://kubernetes.io/docs/concepts/cluster-administration/networking/',
  },
  {
    id: 'net-02',
    type: 'mcq',
    domain: 'networking',
    topic: 'Pod networking',
    week: 5,
    q: 'What does kube-proxy do?',
    options: ['Programs each node so Service IPs forward to Pod endpoints', 'Assigns Pod IPs', 'Answers DNS queries', 'Terminates TLS for Ingress'],
    answer: 0,
    explain: 'It runs as a DaemonSet and writes iptables, IPVS or nftables rules. Pod IPs come from the CNI; DNS from CoreDNS.',
    docs: 'https://kubernetes.io/docs/reference/networking/virtual-ips/',
  },
  {
    id: 'net-03',
    type: 'mcq',
    domain: 'networking',
    topic: 'Pod networking',
    week: 5,
    q: 'On a node, where does the kubelet look for the CNI network configuration by default?',
    options: ['/etc/cni/net.d', '/etc/kubernetes/cni', '/var/lib/kubelet/cni', '/opt/cni/conf'],
    answer: 0,
    explain: 'Config in /etc/cni/net.d (first file alphabetically wins), plugin binaries in /opt/cni/bin.',
  },
];
