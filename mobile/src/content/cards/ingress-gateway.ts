import type { Card } from '../types';

const ING = 'https://kubernetes.io/docs/concepts/services-networking/ingress/';
const GW = 'https://kubernetes.io/docs/concepts/services-networking/gateway/';

export const cards: Card[] = [
  {
    id: 'ing-01',
    type: 'concept',
    domain: 'networking',
    topic: 'Ingress',
    week: 6,
    title: 'Ingress routes HTTP by host and path',
    body: 'One entry point, many Services: **shop.example.com/api → api:80**, **/ → web:80**. An Ingress is only rules. An **Ingress controller** (nginx, Traefik, HAProxy…) must be running to act on them.',
    check: {
      q: 'You create a valid Ingress but nothing ever answers on its host. First thing to check?',
      options: ['Is an Ingress controller installed for its IngressClass?', 'Is the Service of type NodePort?', 'Is CoreDNS scaled to 3?', 'Does the Pod have a liveness probe?'],
      answer: 0,
    },
    explain: 'Without a controller the Ingress just sits there with no ADDRESS. `kubectl get ingressclass` shows which controllers exist.',
    docs: ING,
  },
  {
    id: 'ing-02',
    type: 'cmd',
    domain: 'networking',
    topic: 'Ingress',
    week: 6,
    task: 'Create Ingress web that sends shop.example.com/ (Prefix) to Service web on port 80.',
    answer: 'kubectl create ingress web --rule=shop.example.com/*=web:80',
    distractors: ['--class=web', '--path=/', 'expose'],
    explain: 'In `--rule=host/path=service:port`, a trailing `*` on the path means pathType Prefix; without it you get Exact. Add `--class=nginx` to pick a controller.',
    docs: ING,
  },
  {
    id: 'ing-03',
    type: 'mcq',
    domain: 'networking',
    topic: 'Ingress',
    week: 6,
    q: 'With pathType: Prefix and path /api, which request matches?',
    options: ['/api/v1/users', '/apiv1', '/v1/api', '/ap'],
    answer: 0,
    explain: 'Prefix matches whole path segments split by "/": /api matches /api and /api/anything, but not /apiv1. Exact matches only /api.',
    docs: ING + '#path-types',
  },
  {
    id: 'ing-04',
    type: 'yaml',
    domain: 'networking',
    topic: 'Ingress',
    week: 6,
    task: 'Route /api to Service api on port 80. The API server rejects it. Tap the broken line.',
    yaml: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx
  rules:
  - http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api
            port: 80`,
    bugLine: 14,
    fixLine: '            port: { number: 80 }',
    explain: 'In networking.k8s.io/v1, backend.service.port is an object: number: 80 or name: http. (The old v1beta1 serviceName/servicePort fields are gone.)',
    docs: ING + '#the-ingress-resource',
  },
  {
    id: 'ing-05',
    type: 'mcq',
    domain: 'networking',
    topic: 'Ingress',
    week: 6,
    q: 'How do you add HTTPS to an Ingress?',
    options: ['A tls: section naming the hosts and a Secret of type kubernetes.io/tls', 'Set servicePort to 443', 'Add an annotation https: "true"', 'Create a NodePort on 443'],
    answer: 0,
    explain: 'spec.tls: - hosts: [shop.example.com], secretName: shop-tls. Create the Secret with `kubectl create secret tls shop-tls --cert=tls.crt --key=tls.key`.',
    docs: ING + '#tls',
  },
  {
    id: 'ing-06',
    type: 'mcq',
    domain: 'networking',
    topic: 'Ingress',
    week: 6,
    q: 'What does an IngressClass do?',
    options: ['Says which controller handles an Ingress', 'Sets the TLS version', 'Limits request rates', 'Creates the LoadBalancer Service'],
    answer: 0,
    explain: 'Ingresses point at one with spec.ingressClassName. The class marked with annotation ingressclass.kubernetes.io/is-default-class: "true" is used when that field is empty.',
    docs: ING + '#ingress-class',
  },
  {
    id: 'gw-01',
    type: 'concept',
    domain: 'networking',
    topic: 'Gateway API',
    week: 6,
    title: 'Gateway API splits the job in three',
    body: '**GatewayClass**: which implementation (cluster-wide, from the infra provider). **Gateway**: a real listener, e.g. port 80 for *.example.com (owned by the cluster operator). **HTTPRoute**: the app team\'s routing rules, attached to a Gateway with **parentRefs**.',
    check: {
      q: 'Which object attaches an HTTPRoute to a Gateway?',
      options: ['spec.parentRefs in the HTTPRoute', 'spec.routes in the GatewayClass', 'An Ingress with the same name', 'A label on the Service'],
      answer: 0,
    },
    explain: 'Gateway API is the newer, role-oriented successor to Ingress, and it is in the CKA curriculum. Its CRDs (gateway.networking.k8s.io/v1) are installed separately from Kubernetes itself.',
    docs: GW,
  },
  {
    id: 'gw-02',
    type: 'yaml',
    domain: 'networking',
    topic: 'Gateway API',
    week: 6,
    task: 'Send /api traffic from Gateway main to Service api:8080. The route never attaches. Tap the broken line.',
    yaml: `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api
spec:
  parentRefs:
  - name: mian
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: api
      port: 8080`,
    bugLine: 6,
    fixLine: '  - name: main',
    explain: 'parentRefs names the Gateway (same namespace unless you add namespace:). `kubectl describe httproute api` shows Accepted/ResolvedRefs conditions that point straight at mistakes like this.',
    docs: GW + '#api-kind-httproute',
  },
  {
    id: 'gw-03',
    type: 'mcq',
    domain: 'networking',
    topic: 'Gateway API',
    week: 6,
    q: 'How do you send 90% of traffic to v1 and 10% to v2 with an HTTPRoute?',
    options: ['Two backendRefs with weight: 90 and weight: 10', 'Two HTTPRoutes with priority', 'An annotation canary-weight: 10', 'Scale v2 to 10% of the replicas of v1'],
    answer: 0,
    explain: 'Weighted backendRefs are built into Gateway API. With Ingress you needed controller-specific annotations for this.',
    docs: 'https://gateway-api.sigs.k8s.io/guides/traffic-splitting/',
  },
  {
    id: 'gw-04',
    type: 'mcq',
    domain: 'networking',
    topic: 'Gateway API',
    week: 6,
    q: 'An HTTPRoute in namespace team-a cannot attach to Gateway main in namespace infra. What on the Gateway controls this?',
    options: ['listeners[].allowedRoutes.namespaces.from', 'spec.gatewayClassName', 'metadata.ownerReferences', 'spec.addresses'],
    answer: 0,
    explain: 'By default a listener only accepts routes from its own namespace (from: Same). Set from: All, or from: Selector with a namespace label selector.',
    docs: GW,
  },
  {
    id: 'gw-05',
    type: 'yaml',
    domain: 'networking',
    topic: 'Gateway API',
    week: 6,
    task: 'A Gateway listening for HTTP on port 80. Tap the broken line.',
    yaml: `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: main
spec:
  gatewayClassName: nginx
  listeners:
  - name: http
    protocol: HTTP
    port: "eighty"`,
    bugLine: 9,
    fixLine: '    port: 80',
    explain: 'Listener port is an integer. Each listener has a unique name, a protocol (HTTP, HTTPS, TLS, TCP, UDP), a port and optionally a hostname.',
    docs: GW + '#api-kind-gateway',
  },
  {
    id: 'gw-06',
    type: 'mcq',
    domain: 'networking',
    topic: 'Gateway API',
    week: 6,
    q: 'Which HTTPRoute feature redirects http:// requests to https://?',
    options: ['A RequestRedirect filter with scheme: https', 'A backendRef on port 443', 'pathType: Exact', 'An IngressClass annotation'],
    answer: 0,
    explain: 'HTTPRoute filters include RequestRedirect, URLRewrite, RequestHeaderModifier and RequestMirror, all in the standard API.',
    docs: 'https://gateway-api.sigs.k8s.io/guides/http-redirect-rewrite/',
  },
  {
    id: 'gw-07',
    type: 'mcq',
    domain: 'networking',
    topic: 'Gateway API',
    week: 6,
    boss: true,
    q: '`kubectl get httproute` says "the server doesn\'t have a resource type httproute". Why?',
    options: ['The Gateway API CRDs are not installed', 'You need --all-namespaces', 'HTTPRoute is spelled HttpRoute', 'The Gateway is not ready'],
    answer: 0,
    explain: 'Gateway API ships as CRDs, not built into the API server. Install the standard-channel CRDs, then a controller that implements a GatewayClass.',
  },
];
