package com.aaryapratik.arrowout.nativeapp.data.local

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.arrowSettings by preferencesDataStore(name = "arrow_out_settings")

@Singleton
class SettingsStore @Inject constructor(@ApplicationContext context: Context) {
    private val store = context.arrowSettings

    val settings: Flow<NativeSettings> = store.data.map { preferences ->
        NativeSettings(
            darkTheme = preferences[DARK_THEME] ?: true,
            hapticsEnabled = preferences[HAPTICS_ENABLED] ?: true,
            soundEffectsEnabled = preferences[SOUND_EFFECTS_ENABLED] ?: false,
            colorblindPaletteEnabled = preferences[COLORBLIND_PALETTE_ENABLED] ?: false,
            largeTextEnabled = preferences[LARGE_TEXT_ENABLED] ?: false,
            reducedMotionEnabled = preferences[REDUCED_MOTION_ENABLED] ?: false
        )
    }

    suspend fun setDarkTheme(enabled: Boolean) {
        store.edit { it[DARK_THEME] = enabled }
    }

    suspend fun setHapticsEnabled(enabled: Boolean) {
        store.edit { it[HAPTICS_ENABLED] = enabled }
    }

    suspend fun setSoundEffectsEnabled(enabled: Boolean) {
        store.edit { it[SOUND_EFFECTS_ENABLED] = enabled }
    }

    suspend fun setColorblindPaletteEnabled(enabled: Boolean) {
        store.edit { it[COLORBLIND_PALETTE_ENABLED] = enabled }
    }

    suspend fun setLargeTextEnabled(enabled: Boolean) {
        store.edit { it[LARGE_TEXT_ENABLED] = enabled }
    }

    suspend fun setReducedMotionEnabled(enabled: Boolean) {
        store.edit { it[REDUCED_MOTION_ENABLED] = enabled }
    }

    private companion object {
        val DARK_THEME = booleanPreferencesKey("dark_theme")
        val HAPTICS_ENABLED = booleanPreferencesKey("haptics_enabled")
        val SOUND_EFFECTS_ENABLED = booleanPreferencesKey("sound_effects_enabled")
        val COLORBLIND_PALETTE_ENABLED = booleanPreferencesKey("colorblind_palette_enabled")
        val LARGE_TEXT_ENABLED = booleanPreferencesKey("large_text_enabled")
        val REDUCED_MOTION_ENABLED = booleanPreferencesKey("reduced_motion_enabled")
    }
}
