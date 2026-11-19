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
    const val showSolution = true
    const val unlimitedUndo = true
    const val guardianStories = true
    const val achievements = true
    const val cosmetics = true
    const val rewardedAds = false
}
