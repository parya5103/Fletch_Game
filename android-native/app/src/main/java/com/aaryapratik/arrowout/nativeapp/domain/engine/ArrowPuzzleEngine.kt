package com.aaryapratik.arrowout.nativeapp.domain.engine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import kotlin.math.abs
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
class ArrowPuzzleEngine{
 companion object{const val FREE_HINTS=3;private const val MAX_UNDO=100}
 fun newGame()=ArrowGameState(ArrowBoard(6,6,listOf(
  ArrowPiece(listOf(Cell(0,2),Cell(1,2),Cell(1,1),Cell(2,1)),Direction.RIGHT,0),
  ArrowPiece(listOf(Cell(4,1),Cell(5,1)),Direction.RIGHT,1),
  ArrowPiece(listOf(Cell(2,3),Cell(2,4),Cell(2,5)),Direction.DOWN,2)
  )))
 fun valid(board:ArrowBoard):Boolean{
  if(board.width !in 2..72||board.height !in 2..72)return false
  if(board.activeCells.any{it.x !in 0 until board.width||it.y !in 0 until board.height})return false
  val occupied=mutableSetOf<Cell>()
  for(piece in board.pieces){
   if(piece.cells.size<2||piece.cells.distinct().size!=piece.cells.size||piece.colorIndex !in 0..7)return false
   if(piece.cells.any{it.x !in 0 until board.width||it.y !in 0 until board.height})return false
   if(piece.cells.zipWithNext().any{(a,b)->abs(a.x-b.x)+abs(a.y-b.y)!=1})return false
   if(piece.cells.any{!occupied.add(it)})return false
   if(board.activeCells.isNotEmpty()&&piece.cells.any{it !in board.activeCells})return false
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
 fun hint(state:ArrowGameState):ArrowGameState{
  if(state.isSolved||state.isFailed)return state
  if(state.hintsUsed>=FREE_HINTS)return state.copy(message="No free hints remaining — continue without a hint")
  val next=state.board.pieces.indices.sortedByDescending{state.board.pieces[it].step}.firstOrNull{state.board.pieces[it].alive&&blocker(state.board,it)==-1}
   ?:return state.copy(message="No safe arrow found — restart this puzzle")
  return state.copy(hintedPieceIndex=next,hintsUsed=state.hintsUsed+1,message="Hint: release the highlighted arrow")
 }
 fun toggleEraser(state:ArrowGameState):ArrowGameState{
  if(state.isSolved||state.isFailed)return state
  if(state.erasersRemaining<=0)return state.copy(message="No erasers remaining")
  val enabled=!state.eraserMode
  return state.copy(eraserMode=enabled,message=if(enabled)"Eraser ready — tap any arrow to remove it" else "Eraser cancelled")
 }
 fun undo(state:ArrowGameState):ArrowGameState{
  if(state.isSolved||state.isFailed)return state
  val index=state.undoStack.lastOrNull()?:return state.copy(message="No move to undo")
  if(index !in state.board.pieces.indices)return state.copy(undoStack=emptyList(),message="Undo history was invalid")
  val pieces=state.board.pieces.toMutableList();pieces[index]=pieces[index].copy(alive=true)
  return state.copy(board=state.board.copy(pieces=pieces),isSolved=false,undoStack=state.undoStack.dropLast(1),undosUsed=state.undosUsed+1,eraserMode=false,hintedPieceIndex=-1,message="Last move undone")
 }
 fun tap(state:ArrowGameState,cell:Cell):ArrowGameState{
  if(state.isSolved||state.isFailed||cell.x !in 0 until state.board.width||cell.y !in 0 until state.board.height)return state
  if(state.eraserMode)return erase(state,cell)
  val index=state.board.pieces.indexOfFirst{it.alive&&it.cells.contains(cell)}
  if(index<0)return state.copy(message="Tap an arrow body")
  val blocker=blocker(state.board,index)
  if(blocker==-2)return state.copy(message="Puzzle data is invalid")
  if(blocker>=0){val hearts=(state.hearts-1).coerceAtLeast(0);return state.copy(hearts=hearts,mistakes=state.mistakes+1,isFailed=hearts==0,message=if(hearts==0)"No hearts left — retry the level" else "Blocked — one heart lost. Clear the exit lane first")}
  val pieces=state.board.pieces.toMutableList();pieces[index]=pieces[index].copy(alive=false)
  val history=(state.undoStack+index).takeLast(MAX_UNDO)
  return finishMove(state.copy(hintedPieceIndex=-1),state.board.copy(pieces=pieces),history,"Arrow cleared — find the next exit")
 }
 private fun erase(state:ArrowGameState,cell:Cell):ArrowGameState{
  if(state.erasersRemaining<=0)return state.copy(eraserMode=false,message="No erasers remaining")
  val index=state.board.pieces.indexOfFirst{it.alive&&it.cells.contains(cell)}
  if(index<0)return state.copy(message="Tap an arrow to erase")
  val pieces=state.board.pieces.toMutableList();pieces[index]=pieces[index].copy(alive=false)
  val history=(state.undoStack+index).takeLast(MAX_UNDO)
  return finishMove(state.copy(erasersRemaining=state.erasersRemaining-1,erasersUsed=state.erasersUsed+1,eraserMode=false,hintedPieceIndex=-1),state.board.copy(pieces=pieces),history,"Eraser used — arrow removed")
 }
 private fun nextDailyStreak(lastDate:String,currentDate:String,currentStreak:Int):Int{
  if(lastDate==currentDate)return currentStreak
  return runCatching{
   val format=SimpleDateFormat("yyyyMMdd",Locale.US)
   val last=format.parse(lastDate)?:return@runCatching 1
   val calendar=Calendar.getInstance().apply{time=last;add(Calendar.DAY_OF_YEAR,1)}
   if(format.format(calendar.time)==currentDate)currentStreak+1 else 1
  }.getOrDefault(1)
 }
 private fun finishMove(state:ArrowGameState,board:ArrowBoard,history:List<Int>,ongoingMessage:String):ArrowGameState{
  val solved=board.pieces.none{it.alive}
  val stars=when{
   state.mistakes==0&&state.hintsUsed==0&&state.erasersUsed==0&&state.undosUsed==0->3
   state.mistakes<=2&&state.hintsUsed<=1&&state.erasersUsed<=1&&state.undosUsed<=2->2
   else->1
  }
  val nextBest=if(solved&&!state.isDaily)state.bestStars.toMutableMap().apply{this[state.level]=maxOf(this[state.level]?:0,stars)}else state.bestStars
  val nextPlays=if(solved&&!state.isDaily)state.bestPlays.toMutableMap().apply{this[state.level]=(this[state.level]?:0)+1}else state.bestPlays
  val dailyStreak=if(solved&&state.isDaily)nextDailyStreak(state.lastDailyDate,state.dailyDate,state.dailyStreak)else state.dailyStreak
  val dailyCompleted=if(solved&&state.isDaily)state.dailyDate else state.dailyCompletedDate
  return state.copy(board=board,undoStack=history,isSolved=solved,eraserMode=false,hintedPieceIndex=-1,
   unlockedLevel=if(solved&&!state.isDaily)maxOf(state.unlockedLevel,(state.level+1).coerceAtMost(1000))else state.unlockedLevel,
   coins=if(solved)state.coins+if(state.isDaily)25 else 10 else state.coins,bestStars=nextBest,bestPlays=nextPlays,
   dailyStreak=dailyStreak,dailyBest=if(solved&&state.isDaily)maxOf(state.dailyBest,dailyStreak)else state.dailyBest,
   lastDailyDate=if(solved&&state.isDaily)state.dailyDate else state.lastDailyDate,dailyCompletedDate=dailyCompleted,
   dailyStars=if(solved&&state.isDaily)stars else state.dailyStars,
   message=if(solved&&state.isDaily)"Daily challenge complete! +25 coins · Streak ${dailyStreak}" else if(solved)"Puzzle solved! +10 coins" else ongoingMessage)
 }
}