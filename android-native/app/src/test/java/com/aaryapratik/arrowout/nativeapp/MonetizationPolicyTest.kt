package com.aaryapratik.arrowout.nativeapp

import com.aaryapratik.arrowout.nativeapp.monetization.MonetizationPolicy
import org.junit.Assert.*
import org.junit.Test

class MonetizationPolicyTest {
    @Test fun interstitialsStartAfterLevelFifteenAndRepeatEveryThreeClears() {
        assertFalse(MonetizationPolicy.shouldShowInterstitial(14, true, false, "unit-1", false))
        assertTrue(MonetizationPolicy.shouldShowInterstitial(15, true, false, "unit-1", false))
        assertFalse(MonetizationPolicy.shouldShowInterstitial(16, true, false, "unit-1", false))
        assertFalse(MonetizationPolicy.shouldShowInterstitial(17, true, false, "unit-1", false))
        assertTrue(MonetizationPolicy.shouldShowInterstitial(18, true, false, "unit-1", false))
    }

    @Test fun interstitialsNeverShowWithoutConsentOrDuringPuzzle() {
        assertFalse(MonetizationPolicy.shouldShowInterstitial(15, false, false, "unit-1", false))
        assertFalse(MonetizationPolicy.shouldShowInterstitial(15, true, true, "unit-1", false))
        assertFalse(MonetizationPolicy.shouldShowInterstitial(15, true, false, "", false))
        assertFalse(MonetizationPolicy.shouldShowInterstitial(15, true, false, "unit-1", true))
    }

    @Test fun rewardedOffersRequireExplicitUserActionAndConsent() {
        assertTrue(MonetizationPolicy.shouldOfferRewarded(true, false, "rewarded-1", true))
        assertFalse(MonetizationPolicy.shouldOfferRewarded(false, false, "rewarded-1", true))
        assertFalse(MonetizationPolicy.shouldOfferRewarded(true, true, "rewarded-1", true))
        assertFalse(MonetizationPolicy.shouldOfferRewarded(true, false, "", true))
        assertFalse(MonetizationPolicy.shouldOfferRewarded(true, false, "rewarded-1", false))
    }

    @Test fun removeAdsRequiresConfiguredOneTimeProductId() {
        assertTrue(MonetizationPolicy.canOfferRemoveAdsPurchase("arrow_remove_ads"))
        assertFalse(MonetizationPolicy.canOfferRemoveAdsPurchase(""))
    }
}
