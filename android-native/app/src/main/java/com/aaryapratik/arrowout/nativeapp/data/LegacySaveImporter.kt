package com.aaryapratik.arrowout.nativeapp.data
import com.google.gson.JsonParser

data class ImportedArrowProgress(
 val version:Int,
 val unlocked:Int,
 val coins:Int,
 val bestStars:Map<Int,Int>,
 val bestPlays:Map<Int,Int>,
 val sound:Boolean,
 /** Validated opaque snapshot retained so fields unknown to this native release are not silently discarded. */
 val rawSaveJson:String
)
object LegacySaveImporter{
 const val CURRENT_KEY="arrowOut.v2"
 const val LEGACY_KEY="arrowOut.v1"
 const val MAX_LEVEL=1000
 const val MAX_SAVE_BYTES=1_048_576
 fun import(json:String):ImportedArrowProgress{
  require(json.toByteArray(Charsets.UTF_8).size<=MAX_SAVE_BYTES){"Save is too large"}
  val root=JsonParser.parseString(json).asJsonObject
  val version=root.get("v")?.takeIf{it.isJsonPrimitive}?.asInt?:1
  require(version in 1..2){"Unsupported Arrow Out save version"}
  val unlocked=(root.get("unlocked")?.takeIf{it.isJsonPrimitive}?.asInt?:1).coerceIn(1,MAX_LEVEL)
  val coins=(root.get("coins")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceAtLeast(0)
  val best=root.getAsJsonObject("best")
  val stars=linkedMapOf<Int,Int>();val plays=linkedMapOf<Int,Int>()
  best?.entrySet()?.forEach{(key,value)->
   val level=key.toIntOrNull()?.takeIf{it in 1..MAX_LEVEL}?:return@forEach
   if(value.isJsonObject){
    stars[level]=(value.asJsonObject.get("stars")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceIn(0,3)
    plays[level]=(value.asJsonObject.get("plays")?.takeIf{it.isJsonPrimitive}?.asInt?:0).coerceAtLeast(0)
   }
  }
  return ImportedArrowProgress(
   version=version,unlocked=unlocked,coins=coins,bestStars=stars,bestPlays=plays,
   sound=root.get("sound")?.takeIf{it.isJsonPrimitive&&it.asJsonPrimitive.isBoolean}?.asBoolean?:true,
   rawSaveJson=root.toString()
  )
 }
}