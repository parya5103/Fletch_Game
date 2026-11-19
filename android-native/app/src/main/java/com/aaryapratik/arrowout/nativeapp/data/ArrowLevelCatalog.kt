package com.aaryapratik.arrowout.nativeapp.data
import android.content.Context
import com.google.gson.Gson
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

private data class ArrowLevelCatalogDto(val version:Int,val generator:String,val levels:List<ArrowLevelDto>)
private data class ArrowDailyCatalogDto(val version:Int,val generator:String,val dailyChallenges:List<ArrowDailyDto>)
private data class ArrowLevelDto(val level:Int,val cols:Int,val rows:Int,val shape:List<Int>,val arrows:List<ArrowDto>)
private data class ArrowDailyDto(val date:String,val cols:Int,val rows:Int,val shape:List<Int>,val arrows:List<ArrowDto>)
private data class ArrowDto(val cells:List<List<Int>>,val dir:Int,val color:Int,val step:Int)

@Singleton class ArrowLevelCatalog @Inject constructor(@ApplicationContext private val context:Context){
 private val gson=Gson()
 private val engine=ArrowPuzzleEngine()
 private val catalog:ArrowLevelCatalogDto by lazy{
  context.assets.open("arrow-levels.v1.json").bufferedReader().use{gson.fromJson(it,ArrowLevelCatalogDto::class.java)}
   .also{require(it.version==1&&it.generator=="GameCore"&&it.levels.size==1000){"Native Arrow Out campaign catalog is incomplete"}}
 }
 private val dailyCatalog:ArrowDailyCatalogDto by lazy{
  context.assets.open("arrow-daily.v1.json").bufferedReader().use{gson.fromJson(it,ArrowDailyCatalogDto::class.java)}
   .also{require(it.version==1&&it.generator=="GameCore"&&it.dailyChallenges.size>=365){"Native Arrow Out daily catalog is incomplete"}}
 }
 private fun board(cols:Int,rows:Int,shape:List<Int>,arrows:List<ArrowDto>):ArrowBoard{
  require(cols in 2..72&&rows in 2..72)
  val pieces=arrows.map{arrow->
   val direction=Direction.entries.getOrNull(arrow.dir)?:throw IllegalStateException("Invalid arrow direction")
   val cells=arrow.cells.map{pair->require(pair.size==2);Cell(pair[0],pair[1])}
   ArrowPiece(cells,direction,arrow.color.coerceAtLeast(0),arrow.step,true)
  }
  require(shape.size==cols*rows){"Invalid active board mask"}
  val active=shape.mapIndexedNotNull{index,value->if(value!=0)Cell(index%cols,index/cols)else null}.toSet()
  val result=ArrowBoard(cols,rows,pieces,active)
  require(engine.valid(result)){"Generated Arrow Out board failed native validation"}
  return result
 }
 fun boardFor(level:Int):ArrowBoard{
  val safe=level.coerceIn(1,1000)
  val data=catalog.levels.getOrNull(safe-1)?:throw IllegalStateException("Missing Arrow Out level $safe")
  require(data.level==safe){"Invalid Arrow Out level metadata"}
  return board(data.cols,data.rows,data.shape,data.arrows)
 }
 fun dailyBoard(dateKey:String):ArrowBoard{
  val data=dailyCatalog.dailyChallenges.firstOrNull{it.date==dateKey}
  return if(data!=null) board(data.cols,data.rows,data.shape,data.arrows)
  else boardFor(dailyFallbackLevel(dateKey))
 }
 fun levelCount()=catalog.levels.size
}
/** Stable, bounded fallback so daily play never stops when the bundled calendar expires. */
internal fun dailyFallbackLevel(dateKey:String):Int {
 val date=try { LocalDate.parse(dateKey,DateTimeFormatter.BASIC_ISO_DATE) }
 catch(error:DateTimeParseException) { throw IllegalArgumentException("Daily challenge date must use yyyyMMdd",error) }
 return Math.floorMod(date.toEpochDay(),1000L).toInt()+1
}
