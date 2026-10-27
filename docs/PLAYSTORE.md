# Play Store (APK) Setup - Arrow Out!

This repo contains everything needed to turn the PWA into an Android app (APK/AAB)
using Bubblewrap / Trusted Web Activity. All build tooling runs free on GitHub
Actions. The only cost is the one-time $25 Google Play developer fee.

## What is already prepared

- `android/twa-manifest.json` - the TWA project config: package `com.aaryapratik.arrowout`,
  site `https://parya5103.github.io/Fletch_Game/`, notifications enabled, Daily
  Challenge shortcut, official 512px + maskable icons.
- `.github/workflows/twa-keygen.yml` - one-time signing key generator (manual run).
- `.github/workflows/twa-build.yml` - builds the signed APK + AAB + assetlinks.json (manual run).
- Optional AdMob app-open ads are prepared but OFF by default: the build only
  includes ads if the `ADMOB_APP_ID` secret is set. See `docs/ADMOB.md` for the
  full picture (what works in a TWA, what does not, and the exact steps).
- No game code is touched by any of this; CI and the live site are unaffected.

## One-time setup (~10 minutes)

1. Run the workflow: GitHub -> Actions tab -> "TWA signing key" -> Run workflow.
   It finishes in about a minute and produces an artifact called `twa-signing-key`.
2. Download the artifact. Open `SECRETS-SETUP.txt` and follow it: add the three
   repository secrets (`TWA_KEYSTORE_B64`, `TWA_KEYSTORE_PASSWORD`, `TWA_KEY_PASSWORD`)
   under Settings -> Secrets and variables -> Actions.
3. Keep a private backup of `android.keystore` (cloud drive, email to yourself, etc).
   Losing it after the first Play Store upload means the app identity is lost forever.
   If the artifact expires before you set the secrets, just re-run the workflow -
   that is safe until the first Play Store upload.

## Build the APK

1. The repo must be public and GitHub Pages enabled (the TWA opens the live site,
   and the build downloads the launcher icons from it).
2. Actions tab -> "TWA APK build" -> Run workflow. Takes about 5-10 minutes.
3. Download the `arrow-out-twa-release` artifact. It contains:
   - `app-release-signed.apk` - sideload this on your Android phone to test
     (file manager -> open APK -> allow "unknown sources" -> install).
   - `app-release-bundle.aab` - this is what you upload to the Play Store.
   - `assetlinks.json` - the Digital Asset Links file (see next section).

## Digital Asset Links (required for the full-screen app look)

Android verifies the app against:
`https://parya5103.github.io/.well-known/assetlinks.json`

That URL is the account's ROOT site, not this repo. So:

1. Create a new public repository named exactly `parya5103.github.io`.
2. In that repo, add a file at path `.well-known/assetlinks.json` with the
   contents of the generated assetlinks.json (GitHub's "Add file" web editor
   accepts a path like `.well-known/assetlinks.json`).
3. Check `https://parya5103.github.io/.well-known/assetlinks.json` opens in a browser.

Without this file the APK still runs, but Chrome shows a browser URL bar and a
"site not verified" notification instead of the full-screen app.

## Publish to Play Store (one-time $25 fee)

1. https://play.google.com/console -> pay the fee -> Create app.
2. Upload `app-release-bundle.aab` to Internal testing first. Install on your
   phone from the Play link and test everything (levels, saves, notifications,
   offline play, the update banner).
3. Complete the store listing: name, description, screenshots, content rating,
   and privacy policy URL: `https://parya5103.github.io/Fletch_Game/privacy.html`.
4. Roll out to production.

## Updating the app later

- Bump `appVersion` and `appVersionCode` in `android/twa-manifest.json`
  (for example `1.0.1` and `2`), commit, then re-run "TWA APK build" and upload
  the new AAB. The signing key never changes.

## Important notes

- The package id `com.aaryapratik.arrowout` is permanent once published on Play.
  If you want a different one, change `packageId` in `android/twa-manifest.json`
  before the first upload.
- Never re-run the "TWA signing key" workflow after the first Play Store upload.
- If you buy a custom domain later, update `host`, `startUrl`, `iconUrl`,
  `maskableIconUrl`, `webManifestUrl` and the shortcut URL in
  `android/twa-manifest.json`, and serve assetlinks.json from the new domain's
  `.well-known/` path instead.
- The build uses `--skipPwaValidation` so it does not depend on the site being
  reachable by the quality checker; the game already passes the same PWA checks
  in the regular CI.
- For ads, read `docs/ADMOB.md` before enabling anything. Short version: only
  app-open ads are practical in a TWA, the default build has no ads, and testing
  uses Google's public test ad IDs.
