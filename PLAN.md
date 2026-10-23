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

## Architecture

- **App:** React Native (Expo SDK 58) + TypeScript, built to a signed APK by GitHub Actions and published as a GitHub Release
- **Data:** local-first SQLite on the phone; works offline
- **Content:** cards, reels and the lab catalog are typed data in the repo, validated in CI
- **Reels:** animated frame sequences (hook, statement, typing terminal, flow, list, versus) with device text-to-speech narration, ending in a quiz card
- **Laptop labs:** `ckalab` runner + kind cluster (1 control plane, 2 workers). Each lab breaks something, checks real cluster state, and prints a signed QR code; the app verifies it and awards XP (one claim per code)
- **Mock exams:** phone (25 domain-weighted questions, 30 min, blind until submit) and laptop (`ckalab mock`: several labs at once, weighted partial credit, signed score QR)
- **Readiness:** 75% knowledge (cards you'd remember 3+ weeks, weighted by exam domain) + 25% hands-on (labs cleared vs. a 40-lab target)
- **CI:** content checks, typecheck, engine simulation test, APK build; a separate workflow plays every lab end-to-end on kind
- **Later phases (system design lessons):** sync backend, event queue, caching, observability, deployed to Kubernetes as CKA practice

## Status

- [x] Phase 1: feed, stories, XP, streaks, levels, spaced repetition, APK pipeline
- [x] Phase 2: laptop labs + QR claims, Reels, logo and icon, UI redesign (Instagram-style posts, profile, search)
- [x] Phase 3: content for weeks 5–12 (networking, Gateway API, storage, RBAC, kubeadm/etcd, Helm/Kustomize/CRDs, cluster troubleshooting), 24 reels, 27 laptop labs, mock exams on phone and laptop
- [ ] Phase 4: week 13–14 exam-day drills, more boss labs (etcd restore, kubeadm upgrade), sync backend as a system design lesson

## Decisions made

1. Laptop-lab wins reach the phone through a signed QR code (no server).
2. APK distributed through GitHub Releases (sideload).
3. Logo: "Level-Up Stack", an original design generated from code.
