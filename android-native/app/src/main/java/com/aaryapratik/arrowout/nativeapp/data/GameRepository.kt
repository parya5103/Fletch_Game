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
 suspend fun load():ArrowGameState?{
  val saved=dao.get("arrow-out")?:return null
  val state=gson.fromJson(saved.payload,ArrowGameState::class.java)?:throw IllegalStateException("Saved Arrow Out state is empty")
  require(ArrowPuzzleEngine().valid(state.board)){"Saved Arrow Out puzzle is invalid"}
  return state
 }
 suspend fun save(state:ArrowGameState){dao.upsert(GameProgress("arrow-out",gson.toJson(state),System.currentTimeMillis()))}
}