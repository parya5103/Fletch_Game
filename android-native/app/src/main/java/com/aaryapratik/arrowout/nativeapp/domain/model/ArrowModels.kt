package com.aaryapratik.arrowout.nativeapp.domain.model
data class Cell(val x:Int,val y:Int)
enum class Direction(val dx:Int,val dy:Int,val glyph:String){UP(0,-1,"↑"),RIGHT(1,0,"→"),DOWN(0,1,"↓"),LEFT(-1,0,"←")}
data class ArrowPiece(val cells:List<Cell>,val direction:Direction,val colorIndex:Int,val step:Int=0,val alive:Boolean=true)
data class ArrowBoard(val width:Int=6,val height:Int=6,val pieces:List<ArrowPiece>,val activeCells:Set<Cell> = emptySet())
data class ArrowGameState(
 val board:ArrowBoard,
 val message:String="Tap an arrow to clear its exit path",
 val isSolved:Boolean=false,
 val isFailed:Boolean=false,
 val level:Int=1,
 val unlockedLevel:Int=1,
 val hearts:Int=3,
 val mistakes:Int=0,
 val hintsUsed:Int=0,
 val coins:Int=0,
 val bestStars:Map<Int,Int> = emptyMap(),
 val bestPlays:Map<Int,Int> = emptyMap(),
 val legacySaveJson:String?=null
){
 val remaining:Int get()=board.pieces.count{it.alive}
}
sealed interface ArrowUiEvent{
 data class TapCell(val cell:Cell):ArrowUiEvent
 data object Restart:ArrowUiEvent
 data object Continue:ArrowUiEvent
}