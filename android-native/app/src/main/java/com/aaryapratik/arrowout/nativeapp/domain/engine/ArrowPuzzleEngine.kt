package com.aaryapratik.arrowout.nativeapp.domain.engine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
class ArrowPuzzleEngine{
 fun newGame()=ArrowGameState(ArrowBoard(6,6,listOf(
  ArrowPiece(listOf(Cell(0,2),Cell(1,2),Cell(1,1),Cell(2,1)),Direction.RIGHT,0),
  ArrowPiece(listOf(Cell(4,1),Cell(5,1)),Direction.RIGHT,1),
  ArrowPiece(listOf(Cell(2,3),Cell(2,4),Cell(2,5)),Direction.DOWN,2)
 )))
 fun valid(board:ArrowBoard):Boolean{
  if(board.width !in 2..20||board.height !in 2..20)return false
  val occupied=mutableSetOf<Cell>()
  for(piece in board.pieces.filter{it.alive}){
   if(piece.cells.size<2||piece.cells.distinct().size!=piece.cells.size)return false
   if(piece.cells.any{it.x !in 0 until board.width||it.y !in 0 until board.height})return false
   if(piece.cells.zipWithNext().any{(a,b)->kotlin.math.abs(a.x-b.x)+kotlin.math.abs(a.y-b.y)!=1})return false
   if(piece.cells.any{!occupied.add(it)})return false
   val head=piece.cells.last();val previous=piece.cells[piece.cells.lastIndex-1]
   if(head.x-previous.x!=piece.direction.dx||head.y-previous.y!=piece.direction.dy)return false
  }
  return true
 }
 fun blocker(board:ArrowBoard,pieceIndex:Int):Int{
  if(!valid(board)||pieceIndex !in board.pieces.indices||!board.pieces[pieceIndex].alive)return -2
  val piece=board.pieces[pieceIndex];var x=piece.cells.last().x+piece.direction.dx;var y=piece.cells.last().y+piece.direction.dy
  while(x in 0 until board.width&&y in 0 until board.height){
   val found=board.pieces.indexOfFirst{it.alive&&it.cells.contains(Cell(x,y))}
   if(found>=0&&found!=pieceIndex)return found
   x+=piece.direction.dx;y+=piece.direction.dy
  }
  return -1
 }
 fun tap(state:ArrowGameState,cell:Cell):ArrowGameState{
  if(state.isSolved||state.isFailed||cell.x !in 0 until state.board.width||cell.y !in 0 until state.board.height)return state
  val index=state.board.pieces.indexOfFirst{it.alive&&it.cells.contains(cell)}
  if(index<0)return state.copy(message="Tap an arrow body")
  val blocker=blocker(state.board,index)
  if(blocker==-2)return state.copy(message="Puzzle data is invalid")
  if(blocker>=0){val hearts=(state.hearts-1).coerceAtLeast(0);return state.copy(hearts=hearts,mistakes=state.mistakes+1,isFailed=hearts==0,message=if(hearts==0)"No hearts left — retry the level" else "Blocked — one heart lost. Clear the exit lane first")}
  val pieces=state.board.pieces.toMutableList();pieces[index]=pieces[index].copy(alive=false)
  val board=state.board.copy(pieces=pieces);val solved=board.pieces.none{it.alive}
  return state.copy(board=board,isSolved=solved,message=if(solved)"Puzzle solved!" else "Arrow cleared — find the next exit")
 }
}