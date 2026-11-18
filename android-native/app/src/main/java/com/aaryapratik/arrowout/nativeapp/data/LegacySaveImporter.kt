package com.aaryapratik.arrowout.nativeapp.data
import com.google.gson.JsonParser
data class ImportedArrowProgress(val version:Int,val unlocked:Int,val coins:Int,val bestStars:Map<Int,Int>,val bestPlays:Map<Int,Int>,val sound:Boolean)
object LegacySaveImporter{
 const val CURRENT_KEY="arrowOut.v2";const val LEGACY_KEY="arrowOut.v1";const val MAX_LEVEL=1000
 fun import(json:String):ImportedArrowProgress{
  val root=JsonParser.parseString(json).asJsonObject
  val version=root.get("v")?.asInt?:1
  val unlocked=(root.get("unlocked")?.asInt?:1).coerceIn(1,MAX_LEVEL)
  val best=root.getAsJsonObject("best")
  val stars=linkedMapOf<Int,Int>();val plays=linkedMapOf<Int,Int>()
  best?.entrySet()?.forEach{(key,value)->val level=key.toIntOrNull()?.takeIf{it in 1..MAX_LEVEL}?:return@forEach;if(value.isJsonObject){stars[level]=(value.asJsonObject.get("stars")?.asInt?:0).coerceIn(0,3);plays[level]=(value.asJsonObject.get("plays")?.asInt?:0).coerceAtLeast(0)}}
  return ImportedArrowProgress(version,unlocked,(root.get("coins")?.asInt?:0).coerceAtLeast(0),stars,plays,root.get("sound")?.asBoolean?:true)
 }
}