import { cards as clusterDebug } from './cards/cluster-debug';
import { cards as config } from './cards/config';
import { cards as debugPods } from './cards/debug-pods';
import { cards as deployments } from './cards/deployments';
import { cards as helmKustomizeCrd } from './cards/helm-kustomize-crd';
import { cards as ingressGateway } from './cards/ingress-gateway';
import { cards as jobsScaling } from './cards/jobs-scaling';
import { cards as kubeadmEtcd } from './cards/kubeadm-etcd';
import { cards as kubectl } from './cards/kubectl';
import { cards as netpolDns } from './cards/netpol-dns';
import { cards as pods } from './cards/pods';
import { cards as rbac } from './cards/rbac';
import { cards as scheduling } from './cards/scheduling';
import { cards as services } from './cards/services';
import { cards as storage } from './cards/storage';
import type { Card, DomainId } from './types';

// Order matters: new cards are introduced in this order within a week.
export const ALL_CARDS: Card[] = [
  ...kubectl,
  ...pods,
  ...debugPods,
  ...deployments,
  ...config,
  ...scheduling,
  ...jobsScaling,
  ...services,
  ...ingressGateway,
  ...netpolDns,
  ...storage,
  ...rbac,
  ...kubeadmEtcd,
  ...helmKustomizeCrd,
  ...clusterDebug,
];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(ALL_CARDS.map((c) => [c.id, c]));

export function cardsInDomain(domain: DomainId): Card[] {
  return ALL_CARDS.filter((c) => c.domain === domain);
}

export * from './types';
export * from './domains';
