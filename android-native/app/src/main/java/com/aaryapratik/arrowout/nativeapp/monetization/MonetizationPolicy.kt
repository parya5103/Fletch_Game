package com.aaryapratik.arrowout.nativeapp.monetization

/** Deterministic policy only; callers must load/show ads after a completed level event. */
internal object MonetizationPolicy {
    fun shouldShowInterstitial(completedLevel: Int, consentGranted: Boolean, adFree: Boolean, adUnitId: String, puzzleActive: Boolean): Boolean =
        consentGranted && !adFree && adUnitId.isNotBlank() && !puzzleActive && completedLevel >= 15 && (completedLevel - 15) % 3 == 0

    fun shouldOfferRewarded(consentGranted: Boolean, adFree: Boolean, adUnitId: String, userInitiated: Boolean): Boolean =
        consentGranted && !adFree && adUnitId.isNotBlank() && userInitiated

    fun canOfferRemoveAdsPurchase(productId: String): Boolean = productId.isNotBlank()
}

data class MonetizationConfig(val interstitialUnitId: String, val rewardedUnitId: String, val removeAdsProductId: String) {
    val interstitialConfigured: Boolean get() = interstitialUnitId.isNotBlank()
    val rewardedConfigured: Boolean get() = rewardedUnitId.isNotBlank()
    val removeAdsConfigured: Boolean get() = removeAdsProductId.isNotBlank()
}
