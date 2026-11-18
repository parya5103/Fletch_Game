package com.aaryapratik.arrowout.nativeapp.data
import android.content.Context
import com.google.gson.Gson
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private data class ArrowLevelCatalogDto(val version:Int,val generator:String,val levels:List<ArrowLevelDto>,val dailyChallenges:List<ArrowDailyDto>)
private data class ArrowLevelDto(val level:Int,val cols:Int,val rows:Int,val shape:List<Int>,val arrows:List<ArrowDto>)
private data class ArrowDailyDto(val date:String,val cols:Int,val rows:Int,val shape:List<Int>,val arrows:List<ArrowDto>)
private data class ArrowDto(val cells:List<List<Int>>,val dir:Int,val color:Int,val step:Int)

@Singleton class ArrowLevelCatalog @Inject constructor(@ApplicationContext private val context:Context){
 private val gson=Gson()
 private val engine=ArrowPuzzleEngine()
 private val catalog:ArrowLevelCatalogDto by lazy{
  context.assets.open("arrow-levels.v1.json").bufferedReader().use{gson.fromJson(it,ArrowLevelCatalogDto::class.java)}
   .also{require(it.version==1&&it.generator=="GameCore"&&it.levels.size==1000&&it.dailyChallenges.size>=365){"Native Arrow Out level/daily catalog is incomplete"}}
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
  val data=catalog.dailyChallenges.firstOrNull{it.date==dateKey}
   ?:throw IllegalStateException("Daily challenge $dateKey is not included in this build. Update the app to refresh daily puzzles.")
  return board(data.cols,data.rows,data.shape,data.arrows)
 }
 fun levelCount()=catalog.levels.size
}