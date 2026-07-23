# Android Release Notes

Release notes shown on Google Play are read from:

```
fastlane/metadata/android/<locale>/changelogs/<versionCode>.txt
```

- Max **500 characters** per file (Play Console limit).
- One file per locale (e.g. `en-US`, `ur`).
- File name = `versionCode` of the build (e.g. `22.txt`). `default.txt` is used when no matching versionCode file exists.

## Current release — v1.0.2 (versionCode 24)

**What's new**
- Biometric App Lock — unlock the app with fingerprint or Face ID (iOS Face ID permission wired via `NSFaceIDUsageDescription`)
- 4-digit App PIN fallback for when biometrics are unavailable or fail
- Manage from Profile → Privacy & Security (set, change, remove PIN; toggle lock)
- Auto-switch to PIN entry after 3 failed biometric attempts
- PIN stored as SHA-256 hash with per-device random salt

**What testers should verify**
- Enable Biometric App Lock → set 4-digit PIN → relaunch app → biometric prompt appears first
- Fail biometric 3× → PIN pad appears; correct PIN unlocks
- Disable lock via biometric OR PIN confirmation
- Change PIN and Remove PIN flows from Privacy & Security
- On devices without biometrics: setting shows greyed-out with helper text; PIN still settable
- iOS first launch shows Face ID consent dialog once; subsequent launches go straight to scan
- All prior v1.0.1 flows still work (OTP login, cards, transactions, statement PDF, push, inbox, themes)

## Previous release — v1.0.1 (versionCode 23)

- Login with OTP, cards, transactions, statement PDF
- Push notifications (Android & iOS) + in-app inbox
- Light/dark theme, PWA install, WhatsApp support tile

## Previous release — v1.0.0 (versionCode 22)

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
