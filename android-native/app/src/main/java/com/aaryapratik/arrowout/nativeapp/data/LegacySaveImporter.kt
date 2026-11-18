package com.aaryapratik.arrowout.nativeapp.data
import com.google.gson.JsonElement
import com.google.gson.JsonParser
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*

data class ImportedArrowProgress(
 val version:Int,
 val unlocked:Int,
 val coins:Int,
 val bestStars:Map<Int,Int>,
 val bestPlays:Map<Int,Int>,
 val sound:Boolean,
 val currentPuzzle:ArrowBoard?,
 val currentLevel:Int,
 val hearts:Int,
 val mistakes:Int,
 val hintsUsed:Int,
 val rawSaveJson:String
)
object LegacySaveImporter{
 const val CURRENT_KEY="arrowOut.v2"
 const val LEGACY_KEY="arrowOut.v1"
 const val MAX_LEVEL=1000
 const val MAX_SAVE_BYTES=1_048_576
 private val engine=ArrowPuzzleEngine()
 fun import(json:String):ImportedArrowProgress{
  require(json.toByteArray(Charsets.UTF_8).size<=MAX_SAVE_BYTES){"Save is too large"}
  val root=JsonParser.parseString(json).asJsonObject
  val version=root.get("v")?.takeIf{it.isJsonPrimitive}?.asInt?:1
  require(version in 1..2){"Unsupported Arrow Out save version"}
  val unlocked=(root.get("unlocked")?.takeIf{it.isJsonPrimitive}?.asInt?:1).coerceIn(1,MAX_LEVEL)
  val coins=(root.get("coins")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceIn(0,1_000_000)
  val best=root.getAsJsonObject("best")
  val stars=linkedMapOf<Int,Int>();val plays=linkedMapOf<Int,Int>()
  best?.entrySet()?.forEach{(key,value)->
   val level=key.toIntOrNull()?.takeIf{it in 1..MAX_LEVEL}?:return@forEach
   if(value.isJsonObject){
    stars[level]=(value.asJsonObject.get("stars")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceIn(0,3)
    plays[level]=(value.asJsonObject.get("plays")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceAtLeast(0)
   }
  }
  val cur=root.get("cur")?.takeIf{it.isJsonObject}?.asJsonObject
  val currentPuzzle=cur?.let(::parseCurrentPuzzle)
  val currentLevel=currentPuzzle?.let{cur?.get("level")?.asInt?.coerceIn(1,MAX_LEVEL)?:unlocked}?:unlocked
  val hearts=(cur?.get("hearts")?.takeIf{it.isJsonPrimitive}?.asInt?:3).coerceIn(1,3)
  val mistakes=(cur?.get("wrong")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceIn(0,3)
  val hints=(cur?.get("hintsUsed")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceAtLeast(0)
  val erasers=(cur?.get("erasersUsed")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceAtLeast(0)
  val undoIds=cur?.getAsJsonArray("undoIds")?.mapNotNull{runCatching{it.asInt}.getOrNull()}.orEmpty()
  val undoStack=currentPuzzle?.pieces?.mapIndexedNotNull{index,piece->if(!piece.alive&&piece.step in undoIds)index else null}?.takeLast(10).orEmpty()
  return ImportedArrowProgress(
   version=version,unlocked=unlocked,coins=coins,bestStars=stars,bestPlays=plays,
   sound=root.get("sound")?.takeIf{it.isJsonPrimitive&&it.asJsonPrimitive.isBoolean}?.asBoolean?:true,
   currentPuzzle=currentPuzzle,currentLevel=currentLevel,hearts=hearts,erasersUsed=erasers,undoStack=undoStack,mistakes=mistakes,hintsUsed=hints,
   rawSaveJson=root.toString()
  )
 }
 private fun parseCurrentPuzzle(cur:com.google.gson.JsonObject):ArrowBoard?=runCatching{
  val level=cur.get("level")?.takeIf{it.isJsonPrimitive}?.asInt?:return null
  require(level in 1..MAX_LEVEL)
  val width=cur.get("cols")?.asInt?:return null
  val height=cur.get("rows")?.asInt?:return null
  require(width in 2..72&&height in 2..72)
  val arrows=cur.getAsJsonArray("arrows")?:return null
  val alive=cur.getAsJsonArray("alive")?:return null
  require(arrows.size()==alive.size()&&arrows.size()<=width*height/2)
  val pieces=arrows.mapIndexed{index,item->
   val arrow=item.asJsonObject
   val dir=Direction.entries.getOrNull(arrow.get("dir")?.asInt?:-1)?:throw IllegalArgumentException("Invalid arrow direction")
   val cells=arrow.getAsJsonArray("cells").map{cell->
    val pair=cell.asJsonObject
    Cell(pair.get("x").asInt,pair.get("y").asInt)
   }
   ArrowPiece(cells,dir,(arrow.get("c")?.asInt?:0).coerceAtLeast(0),arrow.get("step")?.asInt?:index,alive[index].asInt==1)
  }
  val shapeIdx=cur.getAsJsonArray("shapeIdx")
  val active=if(shapeIdx!=null)shapeIdx.map{Cell(it.asInt%width,it.asInt/width)}.toSet()
    else pieces.flatMap{it.cells}.toSet()
  ArrowBoard(width,height,pieces,active).also{require(engine.valid(it)){"Imported current puzzle is invalid"}}
 }.getOrNull()
}