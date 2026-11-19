package com.aaryapratik.arrowout.nativeapp

import com.aaryapratik.arrowout.nativeapp.data.local.NativeSettings
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeSettingsTest {
    @Test fun accessiblePreferencesHaveSafeDefaults() {
        val settings = NativeSettings()
        assertTrue(settings.darkTheme)
        assertTrue(settings.hapticsEnabled)
        assertFalse(settings.soundEffectsEnabled)
        assertFalse(settings.colorblindPaletteEnabled)
        assertFalse(settings.largeTextEnabled)
    }

    @Test fun accessibilityPreferencesCanBeChangedIndependently() {
        val settings = NativeSettings(
            soundEffectsEnabled = true,
            colorblindPaletteEnabled = true,
            largeTextEnabled = true
        )
        assertTrue(settings.soundEffectsEnabled)
        assertTrue(settings.colorblindPaletteEnabled)
        assertTrue(settings.largeTextEnabled)
        assertTrue(settings.darkTheme)
        assertTrue(settings.hapticsEnabled)
    }
}
