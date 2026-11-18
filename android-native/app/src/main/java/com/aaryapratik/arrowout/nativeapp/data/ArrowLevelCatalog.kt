package com.aaryapratik.arrowout.nativeapp.data
import android.content.Context
import com.google.gson.Gson
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

private data class ArrowLevelCatalogDto(val version:Int,val generator:String,val levels:List<ArrowLevelDto>)
private data class ArrowLevelDto(val level:Int,val cols:Int,val rows:Int,val shape:List<Int>,val arrows:List<ArrowDto>)
private data class ArrowDto(val cells:List<List<Int>>,val dir:Int,val color:Int,val step:Int)

@Singleton class ArrowLevelCatalog @Inject constructor(@ApplicationContext private val context:Context){
 private val gson=Gson()
 private val engine=ArrowPuzzleEngine()
 private val catalog:ArrowLevelCatalogDto by lazy {
  context.assets.open("arrow-levels.v1.json").bufferedReader().use{gson.fromJson(it,ArrowLevelCatalogDto::class.java)}
   .also{require(it.version==1&&it.generator=="GameCore"&&it.levels.size==1000){"Native Arrow Out level catalog is incomplete"}}
 }
 fun boardFor(level:Int):ArrowBoard{
  val safe=level.coerceIn(1,1000)
  val data=catalog.levels.getOrNull(safe-1)?:throw IllegalStateException("Missing Arrow Out level $safe")
  require(data.level==safe&&data.cols in 2..72&&data.rows in 2..72){"Invalid Arrow Out level metadata"}
  val pieces=data.arrows.map{arrow->
   val direction=Direction.entries.getOrNull(arrow.dir)?:throw IllegalStateException("Invalid arrow direction")
   val cells=arrow.cells.map{pair->require(pair.size==2);Cell(pair[0],pair[1])}
   ArrowPiece(cells,direction,arrow.color.coerceAtLeast(0),arrow.step,true)
  }
  val active=data.shape.mapIndexedNotNull{index,value->if(value!=0)Cell(index%data.cols,index/data.cols)else null}.toSet()
  val board=ArrowBoard(data.cols,data.rows,pieces,active)
  require(engine.valid(board)){"Generated Arrow Out level $safe failed native validation"}
  board
 }
 fun levelCount()=catalog.levels.size
}