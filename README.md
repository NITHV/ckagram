# CKAgram

Instagram-style Android app for CKA exam prep. See [PLAN.md](PLAN.md) for the full plan.

## Install on your phone

1. Open the [latest release](https://github.com/NITHV/ckagram/releases/latest) on your phone.
2. Download `ckagram-<build>.apk` and open it. Allow "install unknown apps" for your browser when asked.
3. Later builds install over the old one. Your progress stays on the phone.

Every push to `main` that touches `mobile/` builds a new signed APK through GitHub Actions.

## Layout

```
mobile/
  src/app/          screens (Expo Router): tabs + focus session
  src/content/      CKA cards, typed; one file per topic
  src/engine/       spaced repetition (FSRS), XP/levels, feed builder, wins
  src/state/        React context: progress, celebrations, card queue
  src/ui/           cards, stories bar, rings, theme
  scripts/          check-content.mts: card validation run in CI
  plugins/          Expo config plugin that signs release builds
.github/workflows/  android.yml: typecheck → content check → APK → release
```

## Adding cards

Add to a file in `mobile/src/content/cards/` (or a new file, registered in
`src/content/index.ts`), then run:

```
cd mobile
npm run check-content
npx tsc --noEmit
```

Card types: `concept` (teach + check), `mcq` (recall), `cmd` (build a kubectl
command from tiles), `yaml` (tap the broken manifest line). Write the right
option first; the app shuffles options.

## Signing key

The release keystore lives outside the repo in `D:\Metamorphosis\CKAgram-secrets`
and as GitHub Actions secrets. Back it up: without it, updates can't install
over the existing app.
