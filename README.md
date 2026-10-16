# Shout Out to the Moon

Mobile-first POC game for Apple App Store and Google Play release planning.

## Current POC

- Base design resolution: `1179 x 2556`
- Web test viewport preserves the same portrait aspect ratio.
- Tablet and desktop layouts scale the game board responsively.
- Main game text uses `allowFontScaling={false}` through `AppText`.
- The iOS TestFlight build uses a native `WKWebView` shell generated from the web game source.
- The native iOS shell builds without CocoaPods or Expo native modules; the workspace contains only the app project.
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

1. Say `Launch` to start.
2. The current dB moves the rocket while the rocket remains visually centered.
3. Higher dB means stronger thrust and flame, with an upper thrust limit so loud inputs cannot bypass the upgrade progression.
4. Ascend through troposphere, stratosphere, mesosphere, thermosphere, exosphere, then space. The joined backgrounds scroll downward; UFO encounters are temporarily disabled.
5. Hold `50-60 dB` for 5 seconds when prompted.
6. Clap 3 times when prompted near the moon.
7. Land on the moon, then say `Replay` or tap the replay control to restart.
8. Current dB, max dB, and the energy bar are shown during play.
9. Test controls generate dB/clap/launch inputs for development.

## Upgrade progression

A fresh save reaches the Moon in 9–10 runs at a steady 65–75 dB when the player
completes separation/hold/clap prompts and buys engine and fuel upgrades alternately.
Either purchase order is supported. 65–70 dB lands on run 10; 75 dB lands on run 9. At 55 dB it takes 13 runs. Louder voices arrive sooner;
quieter voices or failed challenges take longer. There is no attempt-count unlock.

- Speed is exactly `dB × Speed` km/s (58 dB × 10 = 580 km/s).
- Fuel burns at 1 t/second in every active phase, independent of sound or speed. Default 10 t lasts 10 seconds, including challenges.
- Every run pays `floor(distance / 100 × Money)` once, without base or landing bonuses.
- Engine/fuel purchases add 1. Current-stat bands 10–20 / 21–30 / 31–40 / 41–50 / 51+ cost 50 / 100 / 150 / 200 / 250 coins. Fuel 22 → 23 costs 100 coins.
- Money purchases add 0.1. Current-stat bands 1–2 / 2.1–3 / 3.1–4 / 4.1–5 / above 5 use the same five costs. The overlapping 5 boundary belongs to the explicit 4.1–5 band.
- Costs and gameplay distances come from the [SOTM source sheet](https://docs.google.com/spreadsheets/d/1Z7Bft-n0MNSQMPITQEgAo0O_mGSvueM2QRrhg_HDNoA/edit), snapshot imported 2026-10-15. Source ranges: `dB - Speed!A2:F9`, `Atmospheric Layers!A3:D10`. Game distances total 19,500 and backgrounds follow those boundaries. Left markers use the sheet’s reference altitudes (12 / 50 / 85 / 600 / 10,000 km), then the Moon’s average 384,400 km; those labels are not reward distances. This is a bundled snapshot, not a live Google Sheets connection.
- Downward foreground streaks respond immediately to speed, independently of the economy and fuel clock. Each atmosphere image appears twice; space once.
- Purchases are available between runs. Existing saved upgrades/coins are preserved.
- UFOs remain disabled; continuous five-second hold and three claps remain required.

Run the progression and gameplay regressions with `node --test tests/*.test.cjs`.

## Permissions

iOS `Info.plist` requirements are configured in `app.json`.

- `NSMicrophoneUsageDescription`
- `NSSpeechRecognitionUsageDescription`
- `NSUserTrackingUsageDescription`

Localized iOS permission strings are stored in:

- `ios/ShoutOuttotheMoon/Supporting/ko.lproj/InfoPlist.strings`
- `ios/ShoutOuttotheMoon/Supporting/ja.lproj/InfoPlist.strings`
- `ios/ShoutOuttotheMoon/Supporting/zh-Hans.lproj/InfoPlist.strings`
- `ios/ShoutOuttotheMoon/Supporting/zh-Hant.lproj/InfoPlist.strings`

Tracking authorization is requested when the app becomes active on iOS.

## Art Assets

The game uses PNG assets from `public/assets` for the rocket, moon, mini map, flame levels, clouds, and UFO. The iOS TestFlight build embeds the required assets as data URIs inside the generated native `AppDelegate.swift`.

## TestFlight Upload Checklist

The iOS build flow is:

```text
web game source -> generated iOS AppDelegate.swift -> Xcode archive -> TestFlight
```

Before every TestFlight upload:

1. Update the web game source and assets first.
2. Generate the iOS native WebView source:

```bash
npm run ios:web-game
```

3. Increase the iOS build number in both places:
   - `app.json` -> `expo.ios.buildNumber`
   - `ios/ShoutOuttotheMoon.xcodeproj/project.pbxproj` -> `CURRENT_PROJECT_VERSION`
4. Open the workspace, not the project file:

```bash
open ios/ShoutOuttotheMoon.xcworkspace
```

5. In Xcode, confirm `ios/ShoutOuttotheMoon/AppDelegate.swift` contains `WKWebView` and `gameHTML`.
6. In Xcode Build Phases, confirm React Native, Expo configuration, and CocoaPods script phases are not present. In Signing & Capabilities, use automatic signing with team `GWBS3Q4W36`; its Apple Developer account must be signed in under Xcode Settings -> Accounts.
7. Archive and upload the new build number to TestFlight.
8. On the device, confirm the installed TestFlight app shows the new build number if a startup diagnostic appears.

Avoid running this unless the native iOS project must be regenerated:

```bash
npx expo prebuild -p ios
```

`expo prebuild` can recreate native iOS files and restore React Native build phases. If it is used, rerun `npm run ios:web-game`, recheck Build Phases, and verify the build number before archiving.

## Simplest Test Method

When dependencies are installed, run:

```bash
npm run web
```

Then open the Expo web URL in a browser. On web, the app attempts browser microphone dB measurement. If microphone access is unavailable, it displays the microphone error and the five test dB buttons still allow gameplay testing because those buttons are an explicit POC test control.

## Known Gaps

- Native Android store packaging has not been finalized.
- Store-ready screenshots and final App Store / Play Store listing materials are still needed.
- The iOS TestFlight build depends on the generated `AppDelegate.swift`; regenerate it after web game changes.
