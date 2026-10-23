import type { Domain, DomainId } from './types';

// Weights from the official CKA curriculum v1.37 (github.com/cncf/curriculum).
export const DOMAINS: Domain[] = [
  { id: 'troubleshooting', name: 'Troubleshooting', short: 'Debug', weight: 0.3, emoji: '🩺', color: '#FF3B6B' },
  { id: 'architecture', name: 'Cluster Architecture, Installation & Configuration', short: 'Cluster', weight: 0.25, emoji: '🏗️', color: '#B04BFF' },
  { id: 'networking', name: 'Services & Networking', short: 'Network', weight: 0.2, emoji: '🌐', color: '#3B9CFF' },
  { id: 'workloads', name: 'Workloads & Scheduling', short: 'Workloads', weight: 0.15, emoji: '📦', color: '#FFB020' },
  { id: 'storage', name: 'Storage', short: 'Storage', weight: 0.1, emoji: '💾', color: '#2FD38A' },
];

export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d])) as Record<DomainId, Domain>;
