// Thin helpers around kubectl / docker so labs read like exam steps.
// Every kubectl call is pinned to the lab cluster's context; other clusters are never touched.
import { spawnSync } from 'node:child_process';

export const CLUSTER = 'ckagram';
export const CONTEXT = `kind-${CLUSTER}`;
export const NODES = { cp: `${CLUSTER}-control-plane`, w1: `${CLUSTER}-worker`, w2: `${CLUSTER}-worker2` };

function exec(cmd, args, input) {
  const r = spawnSync(cmd, args, { input, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.error) throw r.error;
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

export const k = {
  /** Run kubectl; throws with stderr on failure. */
  run(...args) {
    const r = exec('kubectl', ['--context', CONTEXT, ...args]);
    if (!r.ok) throw new Error(`kubectl ${args.join(' ')}\n${r.err}`);
    return r.out;
  },
  /** Run kubectl; never throws. */
  try(...args) {
    return exec('kubectl', ['--context', CONTEXT, ...args]);
  },
  apply(yaml) {
    const r = exec('kubectl', ['--context', CONTEXT, 'apply', '-f', '-'], yaml);
    if (!r.ok) throw new Error(`kubectl apply failed\n${r.err}`);
    return r.out;
  },
  /** `kubectl get ... -o json`, or null if it doesn't exist. */
  json(...args) {
    const r = exec('kubectl', ['--context', CONTEXT, 'get', ...args, '-o', 'json']);
    return r.ok ? JSON.parse(r.out) : null;
  },
  /** Run a shell command inside a kind node (the lab version of `ssh node`). */
  node(node, script) {
    return exec('docker', ['exec', node, 'sh', '-c', script]);
  },
  /** Create a namespace and wait until Pods can be created in it (default ServiceAccount exists). */
  async createNamespace(ns) {
    this.run('create', 'namespace', ns);
    await this.waitFor(() => this.try('get', 'serviceaccount', 'default', '-n', ns).ok, 30_000, 500);
  },
  /** Poll until fn returns truthy or the timeout passes. */
  async waitFor(fn, timeoutMs = 90_000, everyMs = 2_000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      try {
        if (await fn()) return true;
      } catch {}
      await new Promise((r) => setTimeout(r, everyMs));
    }
    return false;
  },
};

/** Helpers used by many checks. */
export const q = {
  deploy: (ns, name) => k.json('deployment', name, '-n', ns),
  pod: (ns, name) => k.json('pod', name, '-n', ns),
  node: (name) => k.json('node', name),
  podsOn(nodeName) {
    const list = k.json('pods', '-A', '--field-selector', `spec.nodeName=${nodeName}`);
    return list?.items ?? [];
  },
  ready(pod) {
    return pod?.status?.phase === 'Running' && (pod.status.containerStatuses ?? []).every((c) => c.ready);
  },
  available(dep) {
    return dep?.status?.availableReplicas ?? 0;
  },
  nodeReady(node) {
    return node?.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True') ?? false;
  },
  /** Run a command in a pod container and return stdout (or null). */
  execIn(ns, pod, ...cmd) {
    const r = k.try('exec', pod, '-n', ns, '--', ...cmd);
    return r.ok ? r.out : null;
  },
  /** HTTP GET from inside a Pod (busybox wget). Returns the body or null. */
  wget(ns, pod, url) {
    return q.execIn(ns, pod, 'wget', '-qO-', '-T', '4', url);
  },
  /** Ready endpoint addresses behind a Service, from its EndpointSlices. */
  readyEndpoints(ns, svc) {
    const list = k.json('endpointslices', '-n', ns, '-l', `kubernetes.io/service-name=${svc}`);
    return (list?.items ?? []).flatMap((s) => (s.endpoints ?? []).filter((e) => e.conditions?.ready !== false).flatMap((e) => e.addresses));
  },
  /** `kubectl auth can-i` as someone else: true only for "yes". ns "*" = all namespaces, none = cluster scope. */
  canI(as, verb, resource, ns) {
    const r = k.try('auth', 'can-i', verb, resource, `--as=${as}`, ...(ns === '*' ? ['-A'] : ns ? ['-n', ns] : []));
    return r.out.trim() === 'yes';
  },
  nodeIP(name) {
    return q.node(name)?.status?.addresses?.find((a) => a.type === 'InternalIP')?.address;
  },
  defaultStorageClass() {
    const list = k.json('storageclass');
    return (list?.items ?? []).find((s) => s.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true')?.metadata.name;
  },
};

// --- NetworkPolicy evaluation ----------------------------------------------------------------
// Some CNIs (and kindnet on Docker Desktop's WSL kernel) don't enforce policies, so labs also
// grade them by reading the rules. Covers same-namespace podSelector peers, which is what the labs use.

function selectorMatches(sel, labels) {
  if (!sel) return false;
  const okLabels = Object.entries(sel.matchLabels ?? {}).every(([k2, v]) => labels[k2] === v);
  const okExpr = (sel.matchExpressions ?? []).every((e) => {
    const v = labels[e.key];
    if (e.operator === 'In') return e.values.includes(v);
    if (e.operator === 'NotIn') return v === undefined || !e.values.includes(v);
    if (e.operator === 'Exists') return v !== undefined;
    if (e.operator === 'DoesNotExist') return v === undefined;
    return false;
  });
  return okLabels && okExpr;
}

const isIngressPolicy = (p) => (p.spec.policyTypes ? p.spec.policyTypes.includes('Ingress') : true);

/** Would the policies in ns let a Pod with fromLabels reach a Pod with toLabels on port? */
export function policyAllows(policies, toLabels, fromLabels, port) {
  const selecting = policies.filter((p) => isIngressPolicy(p) && selectorMatches(p.spec.podSelector ?? {}, toLabels));
  if (selecting.length === 0) return true; // not isolated
  return selecting.some((p) =>
    (p.spec.ingress ?? []).some((rule) => {
      const fromOk = !rule.from?.length || rule.from.some((peer) => !peer.namespaceSelector && !peer.ipBlock && selectorMatches(peer.podSelector, fromLabels));
      const portOk = !rule.ports?.length || rule.ports.some((pt) => pt.port === undefined || Number(pt.port) === port || typeof pt.port === 'string');
      return fromOk && portOk;
    })
  );
}

export function policies(ns) {
  return k.json('networkpolicies', '-n', ns)?.items ?? [];
}
