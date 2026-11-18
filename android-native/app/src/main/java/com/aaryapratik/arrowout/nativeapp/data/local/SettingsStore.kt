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
private val Context.arrowSettings by preferencesDataStore(name="arrow_out_settings")
@Singleton class SettingsStore @Inject constructor(@ApplicationContext context:Context){private val store=context.arrowSettings;val soundEnabled:Flow<Boolean> = store.data.map{it[booleanPreferencesKey("sound_enabled")]?:true};suspend fun setSoundEnabled(enabled:Boolean){store.edit{it[booleanPreferencesKey("sound_enabled")]=enabled}}}