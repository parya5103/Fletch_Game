package com.aaryapratik.arrowout.nativeapp.data
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonParser
import com.google.gson.JsonObject
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgress
import com.aaryapratik.arrowout.nativeapp.data.local.GameProgressDao
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow

@Singleton class GameRepository @Inject constructor(
 private val dao:GameProgressDao,
 private val levels:ArrowLevelCatalog
){
 private val gson=Gson()
 private val engine=ArrowPuzzleEngine()
 fun observe():Flow<GameProgress?> = dao.observe("arrow-out")
 suspend fun load():ArrowGameState{
  val saved=dao.get("arrow-out")?:return newGame(1)
  val json=JsonParser.parseString(saved.payload).asJsonObject
  val boardJson=json.getAsJsonObject("board")?:throw IllegalStateException("Saved Arrow Out board is missing")
  if(!boardJson.has("activeCells"))boardJson.add("activeCells",JsonArray())
  if(!json.has("isFailed"))json.addProperty("isFailed",false)
  if(!json.has("unlockedLevel"))json.addProperty("unlockedLevel",1)
  if(!json.has("hearts"))json.addProperty("hearts",3)
  if(!json.has("mistakes"))json.addProperty("mistakes",0)
  if(!json.has("hintsUsed"))json.addProperty("hintsUsed",0)
  if(!json.has("hintedPieceIndex"))json.addProperty("hintedPieceIndex",-1)
  if(!json.has("erasersRemaining"))json.addProperty("erasersRemaining",1)
  if(!json.has("erasersUsed"))json.addProperty("erasersUsed",0)
  if(!json.has("eraserMode"))json.addProperty("eraserMode",false)
  if(!json.has("undoStack"))json.add("undoStack",JsonArray())
  if(!json.has("undosUsed"))json.addProperty("undosUsed",0)
  if(!json.has("coins"))json.addProperty("coins",0)
  if(!json.has("bestStars"))json.add("bestStars",JsonObject())
  if(!json.has("bestPlays"))json.add("bestPlays",JsonObject())
  val state=gson.fromJson(json,ArrowGameState::class.java)?:throw IllegalStateException("Saved Arrow Out state is empty")
  require(engine.valid(state.board)){"Saved Arrow Out puzzle is invalid"}
  return state
 }
 fun newGame(level:Int,progress:ArrowGameState?=null):ArrowGameState{
  val safe=level.coerceIn(1,1000)
  val base=progress?:ArrowGameState(levels.boardFor(safe))
  return base.copy(board=levels.boardFor(safe),level=safe,hearts=3,mistakes=0,hintsUsed=0,hintedPieceIndex=-1,isSolved=false,isFailed=false,message="Find a clear arrow and tap to release it")
 }
 suspend fun importLegacy(json:String):ArrowGameState{
  val imported=LegacySaveImporter.import(json)
  val level=imported.currentLevel.coerceIn(1,1000)
  val board=imported.currentPuzzle?:levels.boardFor(level)
  val state=ArrowGameState(
   board=board,level=level,unlockedLevel=imported.unlocked,hearts=imported.hearts,
   mistakes=imported.mistakes,hintsUsed=imported.hintsUsed,erasersUsed=imported.erasersUsed,erasersRemaining=(1-imported.erasersUsed).coerceAtLeast(0),undoStack=imported.undoStack,coins=imported.coins,
   bestStars=imported.bestStars,bestPlays=imported.bestPlays,legacySaveJson=imported.rawSaveJson,
   message="PWA progress imported — continue your level"
  )
  require(engine.valid(state.board)){"Imported Arrow Out puzzle is invalid"}
  save(state)
  return state
 }
 suspend fun save(state:ArrowGameState){dao.upsert(GameProgress("arrow-out",gson.toJson(state),System.currentTimeMillis()))}
}