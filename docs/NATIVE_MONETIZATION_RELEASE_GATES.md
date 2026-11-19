# Native monetization configuration and release gates

Arrow Out initializes Google Mobile Ads only after Google UMP consent permits ad requests. This repository intentionally does not contain production ad-unit IDs, a Play Billing product, or Firebase project configuration.

## Configure IDs outside source control

Supply Gradle properties locally in `~/.gradle/gradle.properties` or as protected CI Gradle properties: `ADMOB_APP_ID`, `ADMOB_INTERSTITIAL_UNIT_ID`, `ADMOB_REWARDED_UNIT_ID`, and `REMOVE_ADS_PRODUCT_ID`.

Do not commit signing credentials, service-account keys, or private project configuration. The app uses Google’s sample App ID when `ADMOB_APP_ID` is absent; this is a development fallback, not production configuration. Empty ad-unit and product IDs disable their respective release gates.

## Placement policy

- Interstitial eligibility begins after campaign level 15 and repeats every three completed levels (15, 18, 21, ...).
- The caller must invoke the policy only from a completed-level event; it rejects an active puzzle, missing consent, missing unit ID, and ad-free users.
- Rewarded placements require an explicit user action, consent, a configured rewarded unit, and a non-ad-free account.
- Rewarded ads must grant only the promised optional benefit after the SDK confirms a completed reward. Never grant rewards on load, close, or failure callbacks.
- No ad may interrupt a puzzle move or appear as a forced mid-level interstitial.

## Still required before production

1. Create and verify production AdMob app/interstitial/rewarded units and add their IDs to protected build configuration.
2. Implement and test actual interstitial/rewarded load/show callbacks using the currently pinned Mobile Ads SDK.
3. Create the one-time Remove Ads product in Play Console, then integrate Play Billing purchase, acknowledgement, restore, and entitlement persistence.
4. Add the approved Firebase project and Analytics/Crashlytics dependencies/configuration only after the owner supplies project configuration. Do not add a fabricated `google-services.json`.
5. Test UMP consent, privacy-options entry, ad-free entitlement, offline behavior, and ad frequency boundaries on physical devices and in Play internal testing.

This PR provides safe configuration plumbing and a unit-tested policy; it does not claim that live ads, Play Billing, Firebase Analytics, or Crashlytics are active.
