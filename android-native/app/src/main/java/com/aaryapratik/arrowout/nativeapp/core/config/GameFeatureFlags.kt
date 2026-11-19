package com.aaryapratik.arrowout.nativeapp.core.config

/**
 * Central feature switches for staged releases.
 *
 * Keep product capabilities behind named flags so a feature can be enabled/disabled
 * without editing game rules, persistence, and presentation in multiple places.
 * These are build-time defaults; remotely managed flags can be added behind this API later.
 */
object GameFeatureFlags {
    const val dailyChallenge = true
    const val legacySaveImport = true
    const val playerSettings = true
    const val worldMap = true
    const val achievements = false
    const val cosmetics = false
    const val rewardedAds = false
}
