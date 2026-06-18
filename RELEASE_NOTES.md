# Android Release Notes

Release notes shown on Google Play are read from:

```
fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt
```

- Max **500 characters** per file (Play Console limit).
- One file per locale (e.g. `en-US`, `ur`).
- File name = `versionCode` of the build (e.g. `22.txt`). `default.txt` is used when no matching versionCode file exists.

## Current release — v1.0.0 (versionCode 22)

**What's new**
- Initial public release of MeraRashan
- Browse ration cards and view card details
- View transaction history and statements
- Download statement PDFs
- Push notifications for new transactions
- Light/dark theme support
- Performance and stability improvements

## How to add notes for a new build

1. Copy `fastlane/metadata/android/en-US/changelogs/default.txt` to `<versionCode>.txt` (e.g. `23.txt`).
2. Edit the bullets — keep under 500 chars.
3. Add translations under other locale folders if needed (e.g. `ur/changelogs/23.txt`).
4. Commit. The next Play upload (manual or via Fastlane `supply`) will pick them up automatically.

## Upload with Fastlane (optional)

```bash
fastlane supply \
  --aab android/app/build/outputs/bundle/release/app-release.aab \
  --track internal \
  --metadata_path fastlane/metadata/android
```
