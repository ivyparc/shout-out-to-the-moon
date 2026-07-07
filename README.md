# Shout Out to the Moon

Mobile-first POC game for Apple App Store and Google Play release planning.

## Current POC

- Base design resolution: `1179 x 2556`
- Web test viewport preserves the same portrait aspect ratio.
- Tablet and desktop layouts scale the game board responsively.
- Main game text uses `allowFontScaling={false}` through `AppText`.
- App language is selected from the device language on first launch:
  - `ko` -> Korean
  - `en` -> English
  - `ja` -> Japanese
  - `zh-Hans` and general `zh` -> Chinese Simplified
  - `zh-Hant`, `zh-TW`, `zh-HK`, `zh-MO` -> Chinese Traditional
  - everything else -> English
- A saved language in settings takes priority from the next launch onward.
- Google Sheet CSV parsing is header-name based, not column-position based.
- No fallback behavior is implemented for unavailable measurement. The app shows the problem.

## Gameplay

1. Countdown: `3 -> 2 -> 1 -> Make some noise!`
2. The current dB moves the rocket.
3. Higher dB means faster movement and a stronger flame.
4. Below `20 dB`, the rocket descends.
5. Current dB and max dB are shown in real time.
6. Five test buttons generate random dB values inside each range:
   - `0-20`
   - `20-40`
   - `40-60`
   - `60-80`
   - `80+`
7. Touch the meter bar after landing or during play to restart.

## Permissions

iOS `Info.plist` requirements are configured in `app.json`.

- `NSMicrophoneUsageDescription`
- `NSUserTrackingUsageDescription`

Localized tracking usage strings are stored in:

- `src/native-locales/ko.json`
- `src/native-locales/ja.json`
- `src/native-locales/zh-Hans.json`
- `src/native-locales/zh-Hant.json`

Tracking authorization is requested when the app becomes active on iOS.

## Art Assets

The Drive art asset folder is noted in the project request, but the current Codex environment does not have direct Google Drive access. The POC uses code-native placeholder art for the rocket, moon, flame, and scrolling clouds. Replace these with the Drive assets once the files are available locally in the repository.

## Simplest Test Method

When dependencies are installed, run:

```bash
npm run web
```

Then open the Expo web URL in a browser. On web, the app attempts browser microphone dB measurement. If microphone access is unavailable, it displays the microphone error and the five test dB buttons still allow gameplay testing because those buttons are an explicit POC test control.

## Known Gaps

- Native iOS/Android real microphone dB metering is not implemented in this POC. The app reports that directly on native instead of falling back.
- Store-ready icon, splash, screenshots, and final art assets are missing.
- APK/AAB and iOS archive generation are not included yet.
- README had only a title before this update, so product rules, language behavior, permission requirements, and test flow were missing.
