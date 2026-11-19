package com.aaryapratik.arrowout.nativeapp
import com.aaryapratik.arrowout.nativeapp.data.dailyFallbackLevel
import com.aaryapratik.arrowout.nativeapp.domain.engine.ArrowPuzzleEngine
import com.aaryapratik.arrowout.nativeapp.domain.model.*
import com.aaryapratik.arrowout.nativeapp.presentation.utcDailyDateKey
import java.time.Instant
import java.util.Date
import java.util.TimeZone
import org.junit.Assert.*
import org.junit.Test
class ArrowPuzzleEngineTest{
 private val engine=ArrowPuzzleEngine()
 @Test fun initialPuzzleIsValid(){assertTrue(engine.valid(engine.newGame().board))}
 @Test fun frontArrowBlocksArrowBehindIt(){val s=engine.newGame();assertEquals(1,engine.blocker(s.board,0));assertEquals(-1,engine.blocker(s.board,1))}
 @Test fun clearFrontArrowThenBackArrowCanExit(){var s=engine.newGame();s=engine.tap(s,Cell(4,1));assertEquals(2,s.remaining);s=engine.tap(s,Cell(2,1));assertEquals(1,s.remaining)}
 @Test fun bodyProjectionDoesNotBlockHeadExitRay(){val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,2),Cell(1,2),Cell(1,1),Cell(2,1)),Direction.RIGHT,0),ArrowPiece(listOf(Cell(3,2),Cell(3,3)),Direction.DOWN,1)));assertEquals(-1,engine.blocker(board,0))}
 @Test fun blockedMovesConsumeHeartsAndThirdMistakeFailsLevel(){
  var state=ArrowGameState(ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,0),Cell(1,0)),Direction.RIGHT,0),ArrowPiece(listOf(Cell(2,0),Cell(3,0)),Direction.RIGHT,1))))
  state=engine.tap(state,Cell(0,0));assertEquals(2,state.hearts);assertEquals(1,state.mistakes);assertFalse(state.isFailed)
  state=engine.tap(state,Cell(0,0));state=engine.tap(state,Cell(0,0));assertEquals(0,state.hearts);assertTrue(state.isFailed)
 }
 @Test fun clearingEveryArrowAwardsStarsCoinsAndUnlocksNextLevel(){
  val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,0),Cell(1,0)),Direction.RIGHT,0)))
  val result=engine.tap(ArrowGameState(board),Cell(1,0))
  assertTrue(result.isSolved);assertEquals(2,result.unlockedLevel);assertEquals(10,result.coins);assertEquals(3,result.bestStars[1])
 }
 @Test fun hintRevealsAnArrowWithACompletelyClearExitRay(){
  val hinted=engine.hint(engine.newGame())
  assertTrue(hinted.hintedPieceIndex>=0);assertEquals(-1,engine.blocker(hinted.board,hinted.hintedPieceIndex));assertEquals(1,hinted.hintsUsed)
 }
 @Test fun eraserRemovesAnyArrowAndUndoRestoresIt(){
  val eraser=engine.toggleEraser(engine.newGame())
  val erased=engine.tap(eraser,Cell(0,2))
  assertEquals(2,erased.remaining);assertEquals(0,erased.erasersRemaining);assertEquals(1,erased.erasersUsed)
  val restored=engine.undo(erased)
  assertEquals(3,restored.remaining);assertEquals(1,restored.undosUsed);assertEquals(0,restored.undoStack.size)
 }
 @Test fun dailyChallengeAwardsCoinsAndExtendsConsecutiveDayStreak(){
  val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,0),Cell(1,0)),Direction.RIGHT,0)))
  val start=ArrowGameState(board,isDaily=true,dailyDate="20261119",lastDailyDate="20261118",dailyStreak=3)
  val result=engine.tap(start,Cell(0,0))
  assertTrue(result.isSolved);assertEquals(4,result.dailyStreak);assertEquals(4,result.dailyBest)
  assertEquals(25,result.coins);assertEquals("20261119",result.dailyCompletedDate);assertEquals(1,result.unlockedLevel)
 }
 @Test fun negativeColorIndexesAreRejected(){
  val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,0),Cell(1,0)),Direction.RIGHT,-1)))
  assertFalse(engine.valid(board))
 }
 @Test fun undoCannotReverseACompletedReward(){
  val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,0),Cell(1,0)),Direction.RIGHT,0)))
  val solved=engine.tap(ArrowGameState(board),Cell(0,0))
  assertTrue(solved.isSolved)
  assertEquals(10,solved.coins)
  val afterUndo=engine.undo(solved)
  assertTrue(afterUndo.isSolved)
  assertEquals(10,afterUndo.coins)
 }
 @Test fun dailyFallbackSelectsStableCampaignBoardsBeyondBundledCalendar(){
  val first=dailyFallbackLevel("20281117")
  assertEquals(first,dailyFallbackLevel("20281117"))
  assertTrue(first in 1..1000)
  assertNotEquals(first,dailyFallbackLevel("20281118"))
 }
 @Test fun dailyFallbackRejectsMalformedDateKeys(){
  assertThrows(IllegalArgumentException::class.java){dailyFallbackLevel("not-a-date")}
 }
 @Test fun dailyDateKeyUsesUtcEvenWhenDeviceTimezoneDiffers(){
  val original=TimeZone.getDefault()
  try{
   TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"))
   val instant=Date.from(Instant.parse("2026-11-18T23:30:00Z"))
   assertEquals("20261118",utcDailyDateKey(instant))
  }finally{TimeZone.setDefault(original)}
 }
 @Test fun malformedOverlappingPathsAreRejected(){val board=ArrowBoard(4,4,listOf(ArrowPiece(listOf(Cell(0,1),Cell(1,1)),Direction.RIGHT,0),ArrowPiece(listOf(Cell(0,1),Cell(0,2)),Direction.DOWN,1)));assertFalse(engine.valid(board))}
 @Test fun freeHintsAreLimitedToThreePerLevel(){
  var state=engine.newGame()
  repeat(3){state=engine.hint(state)}
  assertEquals(3,state.hintsUsed)
  val exhausted=engine.hint(state)
  assertEquals(3,exhausted.hintsUsed)
  assertEquals("No free hints remaining — continue without a hint",exhausted.message)
 }
}
 @Test fun undoHistoryIsNotTruncatedAfterTenMoves(){
  val pieces=(0 until 12).map{row->ArrowPiece(listOf(Cell(0,row*2),Cell(1,row*2)),Direction.RIGHT,row%8)}
  val board=ArrowBoard(4,24,pieces)
  var state=ArrowGameState(board)
  pieces.indices.forEach{index->state=engine.tap(state,Cell(1,index*2))}
  assertEquals(12,state.undoStack.size)
  repeat(12){state=engine.undo(state)}
  assertEquals(12,state.remaining)
 }
 @Test fun solutionOverlayReturnsACompleteValidExitOrderWithoutChangingPuzzle(){
  val state=engine.newGame()
  val solution=engine.solution(state)
  assertEquals(state.remaining,solution.size)
  var board=state.board
  solution.forEach{index->
   assertEquals(-1,engine.blocker(board,index))
   val pieces=board.pieces.toMutableList()
   pieces[index]=pieces[index].copy(alive=false)
   board=board.copy(pieces=pieces)
  }
  assertEquals(state.remaining,engine.solution(state).size)
 }

