# Arrow Out native Android — Play release checklist

This checklist is the release gate for the native Android app (`in.gogocompany.arrowout`). Passing repository CI is necessary but does not replace testing on real Android devices or Play Console review.

## Automated checks (GitHub Actions)

- [ ] Android Native Kotlin: compile, unit tests, and debug/release build tasks pass.
- [ ] CI Tests and Security scan pass on the exact candidate commit.
- [ ] All 1,000 bundled campaign levels pass generator/solver validation.
- [ ] Daily challenge bundled catalogue and deterministic fallback tests pass.
- [ ] 20×20 large-board solver test passes without network access.
- [ ] No new dependency, manifest permission, signing, or app-ID regression is introduced.

Local commands from the repository root:

```bash
cd android-native
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:bundleRelease
```

## Physical-device QA (required)

- [ ] Install the debug build on a low-end Android device and a current Android device.
- [ ] Complete tutorial/first level, campaign progression, all 8 worlds, guardian stories, and daily challenge.
- [ ] Verify a 20×20+ board: pinch zoom, pan, taps, no clipping, no missed touch targets.
- [ ] Enable TalkBack and verify navigation, labels, focus order, and board instructions.
- [ ] Test large text, colorblind palette, dark/light theme, sound, and haptics toggles.
- [ ] Verify 60 fps target during board interactions and transitions; inspect jank/ANRs with Android Studio profiler.
- [ ] Enable airplane mode before launch; play campaign and daily fallback, restart app, and verify local saves remain available.
- [ ] Import a real legacy PWA export and confirm campaign, coins, stars, daily progress, and story markers.
- [ ] Test process death, app relaunch, low storage, and interrupted save scenarios.

## Privacy and monetization QA (required before ads are enabled)

- [ ] Test UMP consent form in applicable regions and verify privacy options remain reachable.
- [ ] Confirm no ad request is made before consent permits it.
- [ ] Confirm interstitials only follow completed levels 15, 18, 21, ... and never interrupt an active puzzle.
- [ ] Confirm rewarded offers require user action and rewards are granted only on the SDK reward callback.
- [ ] Test Remove Ads purchase, pending/cancelled purchase, restore, acknowledgement, and offline entitlement behavior.
- [ ] Confirm ad-free users never receive ads and analytics/crash reporting follow the published privacy disclosure.
- [ ] Verify production AdMob IDs, Play Billing product, Firebase project config, privacy policy, and Data Safety declarations.

## Play Console release

- [ ] Configure the owner-controlled upload key locally; never commit the keystore or passwords.
- [ ] Build and sign the release AAB locally or in a protected release environment.
- [ ] Confirm application ID remains `in.gogocompany.arrowout`, version code is incremented, and release notes match the build.
- [ ] Upload to Internal testing; install through Play and test update-over-existing-install behavior.
- [ ] Review Play pre-launch report, crashes, ANRs, accessibility, screenshots, and device compatibility.
- [ ] Complete store listing, content rating, target audience, Data Safety, ads declaration, privacy policy, and app access instructions.
- [ ] Promote to closed/open testing only after the internal test is clean; production rollout requires owner approval.

## Current known external gates

- A real Android handset and owner-led TalkBack/low-end-device testing are required; CI cannot certify these.
- Production AdMob unit IDs, Play Billing product setup, and approved Firebase project configuration are owner-controlled and are not committed here.
- Release signing is intentionally local/protected only. The repository must not store signing credentials.
- A successful GitHub build does not mean the app has been uploaded, reviewed, or published in Google Play.
