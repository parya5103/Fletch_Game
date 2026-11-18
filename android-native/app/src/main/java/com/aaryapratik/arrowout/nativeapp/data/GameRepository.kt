package com.aaryapratik.arrowout.nativeapp.data
import com.google.gson.Gson
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgress
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgressDao
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
@Singleton class GameRepository @Inject constructor(private val dao:GameProgressDao){private val gson=Gson();fun observe():Flow<GameProgress?>=dao.observe("arrow-out");suspend fun save(unlocked:Int,remaining:Int){dao.upsert(GameProgress("arrow-out",gson.toJson(mapOf("unlocked" to unlocked,"remaining" to remaining)),System.currentTimeMillis()))}}