package com.aaryapratik.arrowout.nativeapp.data
import com.google.gson.Gson
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgress
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgressDao
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.ArrowGameState
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
@Singleton class GameRepository @Inject constructor(private val dao:GameProgressDao){
 private val gson=Gson()
 fun observe():Flow<GameProgress?> = dao.observe("arrow-out")
 suspend fun load():ArrowGameState? = dao.get("arrow-out")?.payload?.let{gson.fromJson(it,ArrowGameState::class.java)}
 suspend fun save(state:ArrowGameState){dao.upsert(GameProgress("arrow-out",gson.toJson(state),System.currentTimeMillis()))}
}