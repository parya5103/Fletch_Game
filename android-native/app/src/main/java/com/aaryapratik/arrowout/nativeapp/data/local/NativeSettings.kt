package com.aaryapratik.arrowout.nativeapp.data.local

/** Persisted player preferences. Add new settings here instead of scattering preference keys through UI code. */
data class NativeSettings(
    val darkTheme: Boolean = true,
    val hapticsEnabled: Boolean = true,
    val soundEffectsEnabled: Boolean = false,
    val colorblindPaletteEnabled: Boolean = false,
    val largeTextEnabled: Boolean = false
)
