package com.aaryapratik.arrowout.nativeapp

import com.aaryapratik.arrowout.nativeapp.data.local.NativeSettings
import com.aaryapratik.arrowout.nativeapp.presentation.ArrowColorPalette
import org.junit.Assert.assertEquals
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
        assertFalse(settings.reducedMotionEnabled)
    }

    @Test fun accessibilityPreferencesCanBeChangedIndependently() {
        val settings = NativeSettings(
            soundEffectsEnabled = true,
            colorblindPaletteEnabled = true,
            largeTextEnabled = true,
            reducedMotionEnabled = true
        )
        assertTrue(settings.soundEffectsEnabled)
        assertTrue(settings.colorblindPaletteEnabled)
        assertTrue(settings.largeTextEnabled)
        assertTrue(settings.reducedMotionEnabled)
        assertTrue(settings.darkTheme)
        assertEquals(8, ArrowColorPalette.colorblindArgb.distinct().size)
        assertEquals(8, ArrowColorPalette.standardArgb.distinct().size)
        assertTrue(settings.hapticsEnabled)
    }
}
