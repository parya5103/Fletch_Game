package com.aaryapratik.arrowout.nativeapp.domain.model
data class Cell(val x:Int,val y:Int)
enum class Direction(val dx:Int,val dy:Int,val glyph:String){UP(0,-1,"↑"),RIGHT(1,0,"→"),DOWN(0,1,"↓"),LEFT(-1,0,"←")}
data class ArrowPiece(val cells:List<Cell>,val direction:Direction,val colorIndex:Int,val alive:Boolean=true)
data class ArrowBoard(val width:Int=6,val height:Int=6,val pieces:List<ArrowPiece>)
data class ArrowGameState(val board:ArrowBoard,val message:String="Tap an arrow to clear its exit path",val isSolved:Boolean=false,val level:Int=1){
 val remaining:Int get()=board.pieces.count{it.alive}
}
sealed interface ArrowUiEvent{data class TapCell(val cell:Cell):ArrowUiEvent;data object Restart:ArrowUiEvent}