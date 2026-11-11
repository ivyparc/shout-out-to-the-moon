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
completes the hold/clap challenges and spends earnings on alternating Speed/Fuel
purchases, or cycles Speed/Fuel/Money. Both engine-first and fuel-first are tested.
Quieter input, unspent coins and failed challenges can take longer; there is no
attempt-count unlock.

- The actual destination is **384,399 km**. Speed remains exactly `dB × Speed` km/s.
- Fuel burns at 1 t/second in every active phase. Default 10 t lasts ten seconds.
- Every completed run pays `floor(distance / 100 × Money)` once.
- Speed becomes `ceil(current × 1.4)`, Fuel increases by 3 t, Money by 0.1.
- Prices are rounded to the nearest five coins, with a minimum of 50: Speed
  `50 × (Speed/10)^1.3`, Fuel `50 × (Fuel/10)`, Money `50 × Money^1.5`.
- The real destination remains 384,399 km. Background artwork travels briskly early in a flight using a logarithmic
  distance scale and a smoothly limited camera velocity. Delayed frames and powerful
  engines cannot cause instant screen jumps. This does not change flight distance. Each atmospheric image appears twice and space once.
  Ruler labels use actual game distance, move downward continuously, and remain
  multiples of five. Their scale is fixed per flight based on the engine; it never
  changes suddenly at a layer boundary. These are game visuals, not a scale model.
- Distance and saved results represent travel of the rocket nose. The ruler, personal
  and community records align with the visible tip; the minimap shows only Best (B),
  aligned with the miniature rocket nose. Score/reward formulas are unchanged.
- Purchases are available between flights; prior saved balances are preserved.
- UFOs and Separation remain disabled; five continuous seconds at 50–60 dB and
  three claps remain required. Rocket vibration follows reduced-motion settings.

Run the progression and gameplay regressions with `node --test tests/*.test.cjs`.

## Moon landing leaderboard — one secure server

The existing [Web Playtest](https://shout-moon-playtest-ivy.kang12365111075.chatgpt.site)
serves both the game and `/api/leaderboard` from **one Sites Worker deployment**.
Its private D1 storage binding is not a second application/API server. There is no
separate scoring, security, legacy, migration or leaderboard service. The iOS
WebView uses the same HTTPS API. Browser requests use the current Site origin.
This is one logical application service, not a guarantee of exactly one physical
machine or concurrent process: Cloudflare controls Worker execution and D1 storage.

This integration adapts the [ivyparc/leaderboard API v2 contract](https://github.com/ivyparc/leaderboard/blob/main/docs/api.md)
to the existing Site's D1 runtime, with Moon-specific progression and migration
operations on the same endpoint. It does not deploy the repository's separate
Node/PostgreSQL example server or connect clients directly to a database.

- Every verified completed flight, including failures, records a score of
  `distance (km) − elapsed time (seconds)`, highest first. The server measures time
  from launch approval to the first completion receipt; upload retries do not
  change the accepted time. Scores are calculated from validated flight frames.
- Each player has one best score per Toronto calendar week (Monday midnight).
  Weekly views reset automatically; historical flights remain available in All time.
- Other players' weekly best heights appear at their altitude, with names shortened
  to seven characters. Moon arrivals appear as a trophy beside the minimap Moon.
- Names are automatically assigned using Subway's adjective+noun+two-digit style;
  existing names are preserved, and manual renames retain the monthly quota.
- New scores live in `moon_flight_scores`. Legacy coin/time tables remain intact
  and are not mixed with the new distance-minus-time score. Existing in-progress
  October flights can still settle rewards under their original distance rules.
- Top 100, personal rank, current/past weeks, All time and nickname editing are
  available from the ranking panel. Reading rankings never creates a score.
- The server issues an opaque 256-bit bearer credential and stores only its hash.
  The client stores its credential per API endpoint. Credentials never appear in
  public rankings. HTTPS, origin checks, request-size/rate limits and ownership
  checks protect writes.
- The same server owns coins, upgrade costs, stats and active flights. It replays
  distance, fuel, continuous five-second hold and timed claps, checks gameplay
  against its clock, and computes the reward. Client-provided scores have no effect.
- Purchases use expected stat values to prevent duplicate retries. Flight batches,
  settlement, score submission and migration redemption are replay-safe.
- Completed runs persist in the client outbox on network failure; **Retry submission**,
  reconnect or restart resumes them. A failed start never fabricates a verified run.
  Expired runs remain visible errors. An unfinished flight can be abandoned without reward.

Microphone samples still originate on the device; this does not attest physical
sound or stop a modified client from fabricating otherwise-valid input. The server
validates game rules and progression. Ranked limits are Speed 10,000, Fuel 600 and
Money 10,000. Test hold/clap controls do not inject input into online flights.

Security review (2026-10-22): server authentication, per-player ownership, trusted
upgrades, earliest server arrival receipts, replay settlement, migration reuse,
foreign origins, request sizes and rate limits are covered by API tests. The iOS
error view now renders error messages as text, not HTML. Next.js and React server
packages were updated following their [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
and [React advisory](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g).
`npm audit --omit=dev` in the Site checkout reports zero known vulnerabilities.
The full development tree still reports 12 affected packages from two advisories:
`braces` via build-time glob tooling, and an older `esbuild` in Drizzle's TypeScript
loader. These are build/tooling paths; no corresponding imports were found in the
production Worker output. Do not expose development servers or build untrusted
source. No forced major downgrade was applied to hide these warnings. This review
is not a penetration-test certification or a guarantee against all cheating.

### Preserve and transfer existing progress

Fresh saves connect online automatically. Existing local coins/upgrades/history
remain untouched until the player explicitly chooses an online profile. Online
history uses a separate key, and **Return to preserved device progress** restores
the original local play state. Legacy local progress is not automatically trusted.

1. Open **Prepare progress transfer** to obtain the target player ID and local
   coin/upgrade snapshot. This does not modify either saved balance.
2. An administrator reviews that snapshot. Use `scripts/approve-moon-migration.mjs`
   with a reviewed JSON file and the server-only `MOON_ADMIN_SECRET` environment
   variable to issue a target-bound, 24-hour, single-use transfer code.
3. The player enters the code on the same device/profile. The server atomically
   imports the approved stats only into an unused online profile. Reusing a code
   cannot add coins again. Original device storage remains available.
4. Only future server-verified Moon landings enter the ranking; old scores are not
   invented or imported. Approval snapshots/reasons remain in the server audit table.

No existing player's progress was approved or moved as part of this implementation.
The administrator secret is a Sites runtime secret, never a browser/iOS build value.

### Source, build and checks

`server/moon-service.mjs` and `server/moon-validator.mjs` contain the authoritative
API and game rules. `server/schema.sql` includes the generated Site migrations.
The existing `web-share` source repository holds the Vinext Worker, Drizzle schema,
immutable migration history and the same original Sites project ID. Run
`npm run site:sync` after editing game/API sources; use the Sites workflow to build
and publish that existing project. Do not register another Site/server.

`npm run ios:web-game` embeds the current client into `AppDelegate.swift`. A public
API URL override is supported with `LEADERBOARD_ENDPOINT`; never put server secrets
in `src/web/leaderboard-config.js`. Store builds still require normal Xcode signing,
archiving and upload.

`npm test` covers gameplay, actual game/client/API integration, SQL transactions,
failed-flight rewards, authoritative upgrade checks, forged submissions, cross-player
access, lost responses, reload recovery, nickname quota and one-time migrations.
The SQL tests use Node 24's built-in SQLite to exercise the D1-compatible queries;
Sites preview exercises the real Worker/D1 runtime separately.

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

## Microphone reference calibration

The browser uses float PCM samples with DC removal, avoiding the previous 8-bit
quantization floor around 51 dB. Automatic gain control, noise suppression and
echo cancellation are requested off. The microphone settings are checked; active
processing blocks reference calibration. Native audio sends raw dBFS and peak
amplitude through the same calibration path.

Before calibration, `dBFS + 96` remains explicitly labelled as an uncalibrated
game level, not sound pressure. A real reference meter beside the microphone can
supply a steady 20–120 dB reading. Five seconds of stable, non-clipping audio
establishes and saves a device-specific offset. Changing microphone/settings
invalidates the saved reference. No reference value is guessed automatically.

This is a single-point estimate, not a certified sound level meter. No A/C
frequency weighting is implemented; spectrum, hardware frequency response or
gain changes can make readings differ from a dBA/dBC reference. Physical accuracy
requires measurement hardware and validation against the actual reference meter.
