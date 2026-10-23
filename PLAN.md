# CKAgram — Plan

An Android app that replaces Instagram with addictive, win-driven prep for the
**CKA (Certified Kubernetes Administrator)** exam. Building it also teaches
system design.

- **Target exam:** last week of January 2027 (February = buffer / free retake)
- **Study time:** ~1 hour/day
- **Phone:** concepts, reviews, small labs (the Instagram replacement)
- **Laptop/PC:** extensive hands-on labs and timed mock exams on local `kind` clusters
- **CI/CD:** GitHub Actions builds the APK — nothing built on the PC

## Core loop

| Instagram | CKAgram |
|---|---|
| Stories bar | Due spaced-repetition reviews, one ring per exam domain |
| Feed | Mixed cards: concept snaps, recall, spot-the-YAML-bug, kubectl fill-in |
| Reels | 45–60s explainers ending in one question |
| Likes/notifications | Wins feed: personal bests, level-ups, domain badges |
| Random great post | Rare "boss cards" (~1 in 15), 5× XP |
| ➕ Create | Lab: small phone labs; big labs queued for the laptop |
| Streaks | Daily streak + Readiness score weighted by exam domains |

**Rule:** XP comes only from correct recall or passed labs — never from scrolling.

## Curriculum (CKA domains, weights to re-verify against CNCF curriculum repo)

- Troubleshooting — 30%
- Cluster Architecture, Installation & Configuration — 25%
- Services & Networking — 20%
- Workloads & Scheduling — 15%
- Storage — 10%

## Timeline

| Weeks | Dates | Study focus | App milestone |
|---|---|---|---|
| 1–2 | Oct 26 – Nov 8 | Pods, Deployments, ConfigMaps/Secrets | MVP: feed, stories, XP, streaks, APK via Actions |
| 3–4 | Nov 9 – 22 | Workloads & Scheduling | Small phone labs; laptop lab runner |
| 5–6 | Nov 23 – Dec 6 | Services & Networking | Reels, rare drops, wins feed |
| 7 | Dec 7 – 13 | Storage | Readiness score |
| 8–10 | Dec 14 – Jan 3 | Cluster Architecture (kubeadm, etcd, RBAC, Helm, Kustomize, CRDs) | Boss cards |
| 11–12 | Jan 4 – 17 | Troubleshooting intensive | Exam mode |
| 13–14 | Jan 18 – 31 | Timed mocks, killer.sh x2, weak spots | Exam ~Jan 28–31 |

Daily hour: ~15 min reviews/feed (spread out), ~30 min labs, ~15 min new material.

## Architecture (draft — see open decisions)

- **App:** React Native (Expo) + TypeScript, built to APK by GitHub Actions
- **Data:** local-first SQLite on the phone; works offline
- **Content:** cards/labs as versioned JSON in this repo, verified against a live cluster
- **Laptop labs:** `kind` clusters + validator scripts on the PC
- **Later phases (system design lessons):** sync backend, event queue, caching, observability — deployed to Kubernetes as CKA practice

## Open decisions

1. How laptop lab wins reach the phone (completion code, GitHub-based sync, or a small backend)
2. App distribution: APK from GitHub Releases (sideload) vs. Play Store internal track
