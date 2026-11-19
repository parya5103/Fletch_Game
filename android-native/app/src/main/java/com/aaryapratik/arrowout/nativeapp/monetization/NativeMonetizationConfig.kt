package com.aaryapratik.arrowout.nativeapp.monetization

import com.aaryapratik.arrowout.nativeapp.BuildConfig

/** Reads optional IDs supplied by Gradle properties or CI secrets; empty means safely disabled. */
object NativeMonetizationConfig {
    val current = MonetizationConfig(BuildConfig.ADMOB_INTERSTITIAL_UNIT_ID, BuildConfig.ADMOB_REWARDED_UNIT_ID, BuildConfig.REMOVE_ADS_PRODUCT_ID)
}
