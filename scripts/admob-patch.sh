#!/usr/bin/env bash
# Applies the AdMob app-open-ads patch to the Bubblewrap-generated Android
# project. Run AFTER `bubblewrap update` (which regenerates the project and
# wipes manual edits) and BEFORE `bubblewrap build`.
#
# Requires:
#   android/twa-manifest.json   - committed TWA configuration
#   ADMOB_APP_ID (env)          - AdMob App ID, format ca-app-pub-...~...
#   ADMOB_APP_OPEN_UNIT_ID (env) - app open ad unit (optional; defaults to
#                                 Google's public TEST unit, safe for testing)
#
# Pattern ported from the official guide:
#   https://developers.google.com/admob/android/app-open
# The patch is idempotent: running it twice makes no further changes.

set -euo pipefail

MANIFEST_DIR="${1:-android}"
TWA_MANIFEST="$MANIFEST_DIR/twa-manifest.json"
APP_GRADLE="$MANIFEST_DIR/app/build.gradle"
APP_MANIFEST="$MANIFEST_DIR/app/src/main/AndroidManifest.xml"

if [ -z "${ADMOB_APP_ID:-}" ]; then
  echo "admob-patch: ADMOB_APP_ID is not set - nothing to do." >&2
  exit 1
fi
# Google's public TEST app open ad unit; replace with the real unit ID via
# secrets before publishing. Testing with live ads risks account suspension.
AD_UNIT="${ADMOB_APP_OPEN_UNIT_ID:-ca-app-pub-3940256099942544/9257395921}"

for f in "$TWA_MANIFEST" "$APP_GRADLE" "$APP_MANIFEST"; do
  if [ ! -f "$f" ]; then
    echo "admob-patch: expected file not found: $f (run 'bubblewrap update' first)" >&2
    exit 1
  fi
done

PACKAGE_ID="$(python3 -c "import json;print(json.load(open('$TWA_MANIFEST'))['packageId'])")"
JAVA_DIR="$MANIFEST_DIR/app/src/main/java/$(echo "$PACKAGE_ID" | tr '.' '/')"
mkdir -p "$JAVA_DIR"

# 1) ArrowOutApp.java - Application class implementing the official
#    app-open-ads pattern (foreground listener, 4-hour expiry, auto reload).
cat > "$JAVA_DIR/ArrowOutApp.java" <<JEOF
package $PACKAGE_ID;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.appopen.AppOpenAd;

import java.util.Date;

/**
 * Arrow Out! - AdMob app open ads.
 *
 * Ported from the official Google guide (App open ads, Google Mobile Ads SDK):
 * https://developers.google.com/admob/android/app-open
 *
 * Shows an app open ad when the app returns to the foreground and reloads
 * the next one after each show/dismiss. The very first cold start has no ad
 * loaded yet, so the first open is ad-free by construction.
 */
public class ArrowOutApp extends Application
    implements ActivityLifecycleCallbacks, DefaultLifecycleObserver {

  private static final String LOG_TAG = "ArrowOutApp";
  private AppOpenAdManager appOpenAdManager;
  private Activity currentActivity;

  @Override
  public void onCreate() {
    super.onCreate();
    this.registerActivityLifecycleCallbacks(this);
    ProcessLifecycleOwner.get().getLifecycle().addObserver(this);
    appOpenAdManager = new AppOpenAdManager();
    MobileAds.initialize(this);
  }

  @Override
  public void onStart(@NonNull LifecycleOwner owner) {
    DefaultLifecycleObserver.super.onStart(owner);
    // currentActivity is null on the very first start; an ad is not loaded
    // yet then either, so nothing shows and the game starts normally.
    appOpenAdManager.showAdIfAvailable(currentActivity);
  }

  @Override
  public void onActivityStarted(@NonNull Activity activity) {
    if (!appOpenAdManager.isShowingAd) {
      currentActivity = activity;
    }
  }

  @Override
  public void onActivityCreated(@NonNull Activity activity, Bundle savedInstanceState) {}

  @Override
  public void onActivityResumed(@NonNull Activity activity) {}

  @Override
  public void onActivityPaused(@NonNull Activity activity) {}

  @Override
  public void onActivityStopped(@NonNull Activity activity) {}

  @Override
  public void onActivitySaveInstanceState(@NonNull Activity activity, @NonNull Bundle outState) {}

  @Override
  public void onActivityDestroyed(@NonNull Activity activity) {}

  /** Utility component from the official app open ads guide. */
  private class AppOpenAdManager {

    private static final String LOG_TAG = "AppOpenAdManager";
    // Replaced at patch time with ADMOB_APP_OPEN_UNIT_ID (test unit by default).
    private static final String AD_UNIT_ID = "$AD_UNIT";

    private AppOpenAd appOpenAd = null;
    private boolean isLoadingAd = false;
    public boolean isShowingAd = false;

    /** Time the last ad was loaded, so expired ads are never shown. */
    private long loadTime = 0;

    public AppOpenAdManager() {}

    private void loadAd(Context context) {
      // Do not load a new ad if one is already loading or available.
      if (isLoadingAd || isAdAvailable()) {
        return;
      }
      isLoadingAd = true;
      AdRequest request = new AdRequest.Builder().build();
      AppOpenAd.load(
          context,
          AD_UNIT_ID,
          request,
          new AppOpenAdLoadCallback() {
            @Override
            public void onAdLoaded(@NonNull AppOpenAd ad) {
              appOpenAd = ad;
              isLoadingAd = false;
              loadTime = (new Date()).getTime();
            }

            @Override
            public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
              // The game continues normally without an ad.
              Log.d(LOG_TAG, "App open ad failed to load: " + loadAdError.getMessage());
              isLoadingAd = false;
            }
          });
    }

    public boolean isAdAvailable() {
      return appOpenAd != null && wasLoadTimeLessThanNHoursAgo(4);
    }

    private boolean wasLoadTimeLessThanNHoursAgo(int numHours) {
      long dateDifference = (new Date()).getTime() - loadTime;
      long numMilliSecondsPerHour = 3600000;
      return dateDifference < (numHours * numMilliSecondsPerHour);
    }

    public void showAdIfAvailable(@NonNull final Activity activity) {
      // If the app open ad is already showing, do not show it again.
      if (isShowingAd) {
        return;
      }
      // No activity yet (very first launch): nothing to attach the ad to.
      if (activity == null) {
        return;
      }
      // If the ad is not available, start loading one for the next open.
      if (!isAdAvailable()) {
        loadAd(activity);
        return;
      }

      appOpenAd.setFullScreenContentCallback(
          new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
              // Set the reference to null so isAdAvailable() returns false.
              appOpenAd = null;
              isShowingAd = false;
              // Preload the next app open ad.
              loadAd(activity);
            }

            @Override
            public void onAdFailedToShowFullScreenContent(@NonNull AdError adError) {
              appOpenAd = null;
              isShowingAd = false;
              loadAd(activity);
            }

            @Override
            public void onAdShowedFullScreenContent() {
              // Called when the ad is shown.
            }
          });

      Log.d(LOG_TAG, "Showing app open ad.");
      isShowingAd = true;
      appOpenAd.show(activity);
    }
  }
}
JEOF
echo "admob-patch: wrote $JAVA_DIR/ArrowOutApp.java (unit: $AD_UNIT)"

# 2) Gradle dependencies (idempotent)
python3 - "$APP_GRADLE" <<'PYEOF'
import sys
path = sys.argv[1]
s = open(path).read()
if 'play-services-ads' in s:
    print('admob-patch: gradle already patched')
else:
    anchor = 'dependencies {'
    if anchor not in s:
        sys.exit('admob-patch: dependencies block not found in app/build.gradle')
    s = s.replace(anchor, anchor + '\n'
        '    implementation "com.google.android.gms:play-services-ads:24.9.0"\n'
        '    implementation "androidx.lifecycle:lifecycle-process:2.9.4"\n'
        '    implementation "androidx.lifecycle:lifecycle-runtime:2.9.4"', 1)
    open(path, 'w').write(s)
    print('admob-patch: added play-services-ads + androidx.lifecycle dependencies')
PYEOF

# 3) AndroidManifest: application android:name + AdMob APPLICATION_ID meta-data
python3 - "$APP_MANIFEST" "$ADMOB_APP_ID" <<'PYEOF'
import re, sys
path, app_id = sys.argv[1], sys.argv[2]
s = open(path).read()
if 'com.google.android.gms.ads.APPLICATION_ID' in s:
    print('admob-patch: manifest already patched')
    sys.exit(0)
m = re.search(r'<application\b[^>]*>', s)
if not m:
    sys.exit('admob-patch: <application> tag not found in AndroidManifest.xml')
tag = m.group(0)
if 'android:name' in tag:
    sys.exit('admob-patch: <application> already has android:name - patch needs manual adjustment')
new_tag = tag.replace('<application', '<application android:name=".ArrowOutApp"', 1)
meta = ('\n    <meta-data\n'
        '        android:name="com.google.android.gms.ads.APPLICATION_ID"\n'
        '        android:value="' + app_id + '" />')
s = s.replace(tag, new_tag + meta, 1)
open(path, 'w').write(s)
print('admob-patch: manifest patched (application android:name + AdMob APPLICATION_ID)')
PYEOF

echo "admob-patch: done."
