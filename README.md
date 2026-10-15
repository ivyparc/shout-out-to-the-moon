# Shout Out to the Moon

Mobile-first POC game for Apple App Store and Google Play release planning.

## Current POC

- Base design resolution: `1179 x 2556`
- Web test viewport preserves the same portrait aspect ratio.
- Tablet and desktop layouts scale the game board responsively.
- Main game text uses `allowFontScaling={false}` through `AppText`.
- The iOS TestFlight build uses a native `WKWebView` shell generated from the web game source.
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

A fresh save targets its first landing in about 9–10 runs when the player flies at
40–80 dB, completes separation/hold/clap prompts, and spends earnings on engine
and fuel upgrades alternately. Starting with either engine or fuel is supported.
Quieter flight, failed challenges, saving coins, or buying only money upgrades can
require more runs. There is no fixed attempt-count unlock.

- Engine and fuel start at 10. Each purchase adds 1 and costs `60 + 10 × purchased levels` for that stat.
- Fuel burns at 0.15 units/second. Engine upgrades supply the main increase in flight speed; loudness has diminishing returns.
- A failed flight earns `floor((31 + 60 × distance progress) × money multiplier)` coins if it traveled any distance.
- A successful landing earns `floor(121 × money multiplier)` coins, including a landing bonus. Every run settles once.
- Money upgrades add 0.1; they start at 50 coins and increase in price by 25 each time.
- Purchases are available between runs. Existing coins and upgrades are preserved; upgraded saves may reach the Moon sooner.
- UFO encounters remain disabled. The continuous five-second hold and three-clap challenges remain required.

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
6. In Xcode Build Phases, confirm `Bundle React Native code and images` is not present.
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
