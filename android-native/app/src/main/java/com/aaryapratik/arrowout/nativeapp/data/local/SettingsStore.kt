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
            hapticsEnabled = preferences[HAPTICS_ENABLED] ?: true
        )
    }

    suspend fun setDarkTheme(enabled: Boolean) {
        store.edit { it[DARK_THEME] = enabled }
    }

    suspend fun setHapticsEnabled(enabled: Boolean) {
        store.edit { it[HAPTICS_ENABLED] = enabled }
    }

    private companion object {
        val DARK_THEME = booleanPreferencesKey("dark_theme")
        val HAPTICS_ENABLED = booleanPreferencesKey("haptics_enabled")
    }
}
