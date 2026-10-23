# CKAgram

An Android app for CKA exam prep that works like Instagram: a feed of cards, stories
for due reviews, Reels that explain things in under a minute, and laptop labs on a
real cluster that you claim on your phone with a QR code. See [PLAN.md](PLAN.md).

## Install on your phone

1. Open the [latest release](https://github.com/NITHV/ckagram/releases/latest) on your phone.
2. Download `ckagram-<build>.apk` and open it. Allow "install unknown apps" for your browser when asked.
3. Later builds install over the old one. Your progress stays on the phone.

Every push to `main` that touches `mobile/` builds a new signed APK through GitHub Actions.

## Laptop labs (`ckalab`)

Real broken clusters you fix with `kubectl`, the way the exam works.

One-time setup (Windows):

1. Install and start **Docker Desktop**.
2. `winget install Kubernetes.kind`
3. In this folder: `.\ckalab up`. This creates a 3-node cluster named `ckagram` (context `kind-ckagram`).

Then:

```
.\ckalab list                 # all labs, your best times
.\ckalab start image-pull     # breaks something and starts the clock
.\ckalab hint                 # nudge (run again for the next one)
.\ckalab check                # verifies your fix; on success prints a QR code
.\ckalab solution             # full walkthrough
.\ckalab reset | down         # undo the lab | delete the cluster
```

Scan the QR code in the app (**Lab → Scan to claim**) to collect XP. Each code works
once. Node-level labs use `docker exec -it ckagram-worker2 bash` in place of the exam's `ssh`.

Git Bash users: `./ckalab ...` works too.

## Layout

```
mobile/                 the Android app (Expo SDK 58, React Native, TypeScript)
  src/app/              screens: tabs (Home, Explore, Lab, Reels, Profile), session, activity, scan, claim
  src/content/          cards, reels and the lab catalog (typed data)
  src/engine/           spaced repetition (FSRS), XP/levels, feed builder, wins, lab claims
  src/state/            React context: progress, celebrations, likes/saves, card queue
  src/ui/               post cards, reels player, stories, rings, brand, theme
  scripts/              check-content.mts (CI content checks), make-brand.mjs (logo + icons)
  tests/                engine.test.ts: multi-day study simulation on real SQLite
labs/                   ckalab runner, lab definitions, kind config, end-to-end lab test
.github/workflows/      android.yml (tests → APK → release), labs.yml (plays every lab on kind)
```

## Adding content

- **Cards:** add to `mobile/src/content/cards/` and register new files in `src/content/index.ts`.
  Types: `concept`, `mcq`, `cmd` (kubectl tile builder), `yaml` (tap the broken line).
  Put the right option first; the app shuffles options.
- **Reels:** add to `mobile/src/content/reels.ts`. Frames: hook, say, code, flow, list, versus.
  The `quiz` must be an existing card id.
- **Labs:** add metadata to `mobile/src/content/labs.ts`, the implementation to `labs/defs/`,
  and a solver to `labs/test-labs.mjs`.

Then:

```
cd mobile
npm run check-content && npx tsc --noEmit && npm run test:engine
node ../labs/test-labs.mjs <lab-id>      # needs the kind cluster
```

## Brand

The logo ("Level-Up Stack": three containers climbing like stairs) is generated from
code: `npm run brand` in `mobile/` rewrites everything in `assets/brand/`. The wordmark
uses Lilita One (SIL Open Font License, see `assets/fonts/`).

## Signing key

The release keystore lives outside the repo in `D:\Metamorphosis\CKAgram-secrets`
and in GitHub Actions secrets. Back it up: without it, updates can't install over
the existing app.
