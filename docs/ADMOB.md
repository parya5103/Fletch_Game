# AdMob in the Android (TWA) app - the honest picture

This document explains what is possible, what is prepared, and what is NOT
possible when monetizing the Arrow Out! Android app, which is a Trusted Web
Activity (TWA) wrapper around the PWA.

## What works in a TWA

1. App Open ads (AdMob) - shown by the Android shell when the app comes to the
   foreground. This is the one practical native-ad route and it is prepared
   here: `scripts/admob-patch.sh` + the optional workflow step in
   `.github/workflows/twa-build.yml`.
2. That's it for native ads. Banner, interstitial and rewarded ads inside a
   TWA session have no official support - android-browser-helper has an open
   feature request for them (GoogleChrome/android-browser-helper#535) and
   there is no web-to-native bridge in a plain TWA.

## What does NOT work

- The game's existing rewarded-hint "demo ad" flow on the web cannot be wired
  to AdMob rewarded ads inside the TWA - the web page cannot trigger native ads.
- Showing website AdSense ads inside the TWA app is against Google's policies:
  AdSense is for websites, apps must use AdMob. Never enable AdSense
  simultaneously with the TWA distribution.
- AdSense on the website itself stays a separate, later decision - it needs a
  root domain and approval, and is unrelated to this AdMob setup.

## What is prepared in this repo

- `scripts/admob-patch.sh` - applies the AdMob app-open patch to the generated
  Android project on every build (Bubblewrap's `update` wipes manual edits, so
  the workflow re-applies the patch each run - this is by design and stays
  durable). The patch:
  - writes `ArrowOutApp.java` (official app-open pattern: foreground listener,
    4-hour ad expiry, auto-reload, never two ads at once, ad-free first open)
  - adds `play-services-ads:24.9.0` + `androidx.lifecycle:2.9.4` dependencies
  - adds the AdMob `APPLICATION_ID` meta-data and the Application class to the
    manifest
- The patch ONLY runs when the `ADMOB_APP_ID` secret is set. Without it, every
  build stays a clean no-ads build - zero risk to the current app.
- `android/twa-manifest.json` sets `minSdkVersion: 21` (required by the ads SDK).

## How to enable it

1. Create an AdMob account (free): https://admob.google.com
2. Add an Android app (package: com.aaryapratik.arrowout), create an
   "App open" ad unit.
3. Add repo secrets: `ADMOB_APP_ID` (from AdMob), `ADMOB_APP_OPEN_UNIT_ID`.
4. Run the "TWA APK build" workflow - the APK now shows app open ads.

You can validate the entire pipeline today without an AdMob account, using
Google's public test IDs (they always serve test ads):
- ADMOB_APP_ID = ca-app-pub-3940256099942544~3347511713
- ADMOB_APP_OPEN_UNIT_ID = ca-app-pub-3940256099942544/9257395921

Build with test IDs, sideload the APK, open/close the app a few times - test
app-open ads appear from the second open onwards. ALWAYS test with test IDs:
loading live ads in a development build can get the AdMob account suspended.

## Before going live with ads

- Replace the test unit with your real ad unit ID.
- Play Console Data safety form: declare the ads SDK's data collection.
- Update privacy.html's Advertising section to name Google AdMob and link its
  policies (the section already reserves a place for exactly this).
- app-ads.txt: AdMob crawls the developer website listed in the Play store
  listing. Host `app-ads.txt` at the root of that website - the same
  `parya5103.github.io` root repo that serves `.well-known/assetlinks.json`.
  Content: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`
  (pub id is shown in AdMob -> Settings).
- Play listing: set the developer website URL so app-ads.txt is findable.

## SDK status note (checked Oct 2026)

Google Mobile Ads SDK is in maintenance mode; Google points new integrations
to the "GMA Next-Gen SDK". The legacy SDK (play-services-ads 24.9.0, used here)
still works and has the complete official app-open guide. When actually
enabling ads, re-check whether the Next-Gen SDK supports app open ads and
switch the patch if appropriate.

## Revenue reality (no sugarcoating)

- App open eCPMs in India are low (roughly $0.2-$1 per 1000 impressions).
- AdMob pays out after $20 (roughly Rs 1700) accumulated.
- New apps/accounts go through review; ads can take days to serve real
  inventory; "limited ads" states exist for new accounts.
- Meaning: with low download numbers this earns near zero. Treat ads as an
  infrastructure step, not a revenue plan. Growth (CrazyGames, Play Store
  listing quality, game content) comes first; ads only matter after real
  installs.

## Known adjustment points for the first ad-enabled build

The patch is written against the official pattern but cannot be
compile-tested until it actually runs in Actions. If the first ad-enabled
build fails, the Actions log will point at one of these likely spots:
- play-services-ads 24.x may require a newer compileSdk than the
  Bubblewrap-generated project uses (fix: bump in twa-manifest/build files, or
  drop the play-services-ads version).
- `MobileAds.initialize(this)` signature may differ in the newest SDK.
- Manifest/gradle anchors may drift with a future Bubblewrap version.
